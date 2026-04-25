from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions, filters, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from rest_framework import status
from core.models import Game, Review, Post
from api.models import User, Notification
from .serializers import UserSerializer, GameSerializer, ReviewSerializer, PostSerializer, RegisterSerializer
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.db.models import Q

class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        username_or_email = request.data.get('username')
        password = request.data.get('password')

        if not username_or_email or not password:
            return Response({'error': 'Please provide both username/email and password'}, status=status.HTTP_400_BAD_REQUEST)

        # Find the user by email or username
        user = User.objects.filter(Q(email=username_or_email) | Q(username=username_or_email)).first()

        if user and user.check_password(password):
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'email': user.email
            })
        
        return Response({'non_field_errors': ['Unable to log in with provided credentials.']}, status=status.HTTP_400_BAD_REQUEST)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'real_name']
    lookup_field = 'username'

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, username=None):
        target_user = self.get_object()
        if request.user == target_user:
            return Response({"error": "You cannot follow yourself."}, status=status.HTTP_400_BAD_REQUEST)
        
        from api.models import Follow
        follow_instance, created = Follow.objects.get_or_create(follower=request.user, following=target_user)
        
        if not created:
            return Response({"message": "You are already following this user."}, status=status.HTTP_200_OK)
            
        return Response({"message": f"You are now following {target_user.username}"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, username=None):
        target_user = self.get_object()
        from api.models import Follow
        
        deleted, _ = Follow.objects.filter(follower=request.user, following=target_user).delete()
        
        if deleted:
            return Response({"message": f"You unfollowed {target_user.username}"}, status=status.HTTP_200_OK)
        return Response({"error": "You are not following this user."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def counts(self, request):
        # Unread Messages (from others)
        from api.models import Message, Notification
        unread_messages = Message.objects.filter(
            conversation__participants=request.user,
            is_read=False
        ).exclude(sender=request.user).count()

        # Unread Notifications
        unread_notifications = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()

        return Response({
            "messages": unread_messages,
            "notifications": unread_notifications
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def sync_steam(self, request):
        steam_id = request.data.get('steam_id')
        if not steam_id:
            return Response({"error": "Steam ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.conf import settings
        if not settings.STEAM_API_KEY:
            return Response({"error": "Server configuration error: STEAM_API_KEY not set."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Save Steam ID
        request.user.steam_id = steam_id
        request.user.save()
        
        # Trigger Sync
        from api.services.steam import fetch_steam_library
        try:
             # In production, use Celery: fetch_steam_library.delay(request.user.id, steam_id)
            fetch_steam_library(request.user.id, steam_id)
        except Exception as e:
            # If sync fails immediately (synchronous), let the user know, but we already saved the ID.
            # Maybe we should return a warning?
            print(f"Sync trigger failed: {e}")
            return Response({"status": "Steam ID saved, but sync failed. Check privacy settings or try again later.", "warning": str(e)}, status=status.HTTP_200_OK)
        
        return Response({"status": "Sync started"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def disconnect_steam(self, request):
        # Clear Steam ID
        request.user.steam_id = ""
        request.user.save()
        
        # Remove Steam Games from Library
        from api.models import LibraryEntry
        LibraryEntry.objects.filter(user=request.user, platform__iexact='steam').delete()
        
        return Response({'status': 'disconnected'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='game-dna')
    def game_dna(self, request, username=None):
        user = self.get_object()
        from api.models import LibraryEntry
        
        # Sadece aktif oynanan oyunları filtrele
        active_statuses = ['playing', 'completed', 'replaying']
        entries = LibraryEntry.objects.filter(
            user=user,
            status__in=active_statuses
        ).select_related('game')

        # Tür sayımı
        genre_counts = {}
        for entry in entries:
            for genre in (entry.game.genres or []):
                genre_counts[genre] = genre_counts.get(genre, 0) + 1

        total = sum(genre_counts.values())
        if total == 0:
            return Response([])

        # Yüzde hesapla ve sırala
        colors = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#f43f5e", "#06b6d4", "#ec4899", "#6366f1"]
        result = []
        for i, (genre, count) in enumerate(sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)):
            result.append({
                "genre": genre,
                "percentage": round((count / total) * 100),
                "color": colors[i % len(colors)]
            })

        return Response(result)

    @action(detail=True, methods=['get'], url_path='recommended-games')
    def recommended_games(self, request, username=None):
        user = self.get_object()
        from api.models import LibraryEntry
        from core.models import Game
        
        # 1. Calculate user's top genres (Game DNA)
        active_statuses = ['playing', 'completed', 'replaying']
        entries = LibraryEntry.objects.filter(
            user=user,
            status__in=active_statuses
        ).select_related('game')

        genre_counts = {}
        played_game_ids = set()
        for entry in entries:
            played_game_ids.add(entry.game.id)
            for genre in (entry.game.genres or []):
                genre_counts[genre] = genre_counts.get(genre, 0) + 1

        # Also get all other game IDs the user has to exclude them
        all_user_entries = LibraryEntry.objects.filter(user=user)
        all_played_ids = set([e.game_id for e in all_user_entries])
        
        # Exclude reviewed games to ensure completely unlogged discovery
        from core.models import Review
        reviewed_game_ids = set(Review.objects.filter(user=user).values_list('game_id', flat=True))
        all_played_ids = all_played_ids.union(reviewed_game_ids)

        # New parameter for genre filtering
        target_genre = request.query_params.get('genre', 'all')
        
        translation_map = {
            'aksiyon': 'action',
            'macera': 'adventure',
            'basit eğlence': 'casual',
            'bağımsız yapım': 'indie',
            'devasa çok oyunculu': 'massively multiplayer',
            'yarış': 'racing',
            'rvo': 'rpg',
            'simülasyon': 'simulation',
            'spor': 'sports',
            'strateji': 'strategy',
            'erken erişim': 'early access'
        }
        
        # If no genres found, return random popular games
        if target_genre != 'all':
            english_genre = translation_map.get(target_genre.lower(), target_genre)
            genre_query = Q(genres__icontains=target_genre) | Q(genres__icontains=english_genre)
            recommended = Game.objects.filter(genre_query).exclude(id__in=all_played_ids).order_by('?')[:20]
                
        elif not genre_counts:
            recommended = Game.objects.exclude(id__in=all_played_ids).order_by('?')[:20]
        else:
            # Get top 3 genres
            top_genres = [g[0] for g in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:3]]
            
            # 2. Query games that matching any of top genres
            # using Postgres jsonb array filtering or Q objects
            genre_query = Q()
            for genre in top_genres:
                english_genre = translation_map.get(genre.lower(), genre)
                genre_query |= Q(genres__icontains=genre) | Q(genres__icontains=english_genre)
                
            recommended = Game.objects.filter(genre_query).exclude(id__in=all_played_ids).order_by('?')[:20]

        # 3. Serialize output
        result = []
        for g in recommended:
            image_url = None
            if g.cover_image:
                # If cover_image is a URL (like standard Steam URLs), use it directly
                # If it's a file path, we need to return the media URL. 
                # Since django might add backend:8000 internally if we use build_absolute_uri,
                # we return the relative url (e.g. /media/games/...) and let the frontend prefix it 
                # if necessary, or we can construct it using a known host.
                
                if str(g.cover_image).startswith('http'):
                    image_url = str(g.cover_image)
                elif hasattr(g.cover_image, 'url'):
                    # The frontend expects standard absolute paths or relative paths it proxies
                    image_url = g.cover_image.url
                    # To ensure it always points to localhost/127.0.0.1 for local dev:
                    if request and not str(image_url).startswith('http'):
                        host = request.get_host() # Might be localhost:8000 or 127.0.0.1:8000
                        scheme = request.scheme
                        # If the host is 'backend:8000' (docker internal), replace it with localhost
                        if 'backend' in host:
                            host = host.replace('backend', '127.0.0.1')
                        image_url = f"{scheme}://{host}{image_url}"
            
            result.append({
                "id": g.id,
                "title": g.title,
                "cover_image": image_url
            })

        return Response(result)

    def _format_image_url(self, request, cover_image):
        if not cover_image: return None
        if str(cover_image).startswith('http'): return str(cover_image)
        if hasattr(cover_image, 'url'):
            url = cover_image.url
            if request and not str(url).startswith('http'):
                host = request.get_host()
                if 'backend' in host: host = host.replace('backend', '127.0.0.1')
                return f"{request.scheme}://{host}{url}"
        return None

    @action(detail=True, methods=['get'])
    def backlog(self, request, username=None):
        user = self.get_object()
        from api.models import LibraryEntry
        
        entries = LibraryEntry.objects.filter(
            user=user, status='plan_to_play'
        ).select_related('game').order_by('-added_at')[:10]
        
        result = []
        for e in entries:
            g = e.game
            result.append({
                "id": g.id,
                "title": g.title,
                "cover_image": self._format_image_url(request, g.cover_image)
            })
        return Response(result)

    @action(detail=True, methods=['get'], url_path='friends-playing')
    def friends_playing(self, request, username=None):
        user = self.get_object()
        from api.models import Follow, LibraryEntry
        
        following_users = Follow.objects.filter(follower=user).values_list('following_id', flat=True)
        if not following_users:
            return Response([])
            
        recent_entries = LibraryEntry.objects.filter(
            user_id__in=following_users,
            status__in=['playing', 'completed', 'replaying']
        ).select_related('game', 'user').order_by('-added_at')[:15]
        
        seen_games = set()
        result = []
        for e in recent_entries:
            if e.game.id in seen_games: continue
            seen_games.add(e.game.id)
            g = e.game
            result.append({
                "id": g.id,
                "title": g.title,
                "cover_image": self._format_image_url(request, g.cover_image),
                "friend_username": e.user.username,
                "status": e.status
            })
            if len(result) >= 10: break
                
        return Response(result)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, username=None):
        target_user = self.get_object()
        from api.models import Follow
        deleted_count, _ = Follow.objects.filter(follower=request.user, following=target_user).delete()
        
        if deleted_count == 0:
            return Response({"error": "You are not following this user."}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({"message": f"You have unfollowed {target_user.username}"}, status=status.HTTP_200_OK)

from api.models import Notification
from .serializers import NotificationSerializer

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'marked all read'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'status': 'marked read'})

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

class CurrentUserView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['title']

    @action(detail=False, methods=['get'])
    def trending(self, request):
        from django.db.models import Count
        trending_games = Game.objects.annotate(
            entry_count=Count('library_entries')
        ).filter(entry_count__gt=0).order_by('-entry_count')[:10]
        
        result = []
        for g in trending_games:
            image_url = None
            if g.cover_image:
                if str(g.cover_image).startswith('http'):
                    image_url = str(g.cover_image)
                elif hasattr(g.cover_image, 'url'):
                    url = g.cover_image.url
                    if request and not str(url).startswith('http'):
                        host = request.get_host()
                        if 'backend' in host: host = host.replace('backend', '127.0.0.1')
                        image_url = f"{request.scheme}://{host}{url}"
            
            result.append({
                "id": g.id,
                "title": g.title,
                "cover_image": image_url,
                "entry_count": getattr(g, 'entry_count', 0)
            })
        return Response(result)

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Review.objects.all()
        username = self.request.query_params.get('username', None)
        if username is not None:
            queryset = queryset.filter(user__username=username)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-timestamp')
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {
        'news_parent': ['exact', 'isnull'],
        'project_parent': ['exact', 'isnull'],
    }

    def get_queryset(self):
        queryset = Post.objects.all().order_by('-timestamp')
        username = self.request.query_params.get('username', None)
        parent_id = self.request.query_params.get('parent', None)

        if username is not None:
            queryset = queryset.filter(user__username=username)
        
        if parent_id is not None:
            queryset = queryset.filter(parent_id=parent_id)

        review_parent_id = self.request.query_params.get('review_parent', None)
        if review_parent_id is not None:
            queryset = queryset.filter(review_parent_id=review_parent_id)
        
        news_parent_id = self.request.query_params.get('news_parent', None)
        if news_parent_id is not None:
            queryset = queryset.filter(news_parent_id=news_parent_id)
        
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("VALIDATION ERROR:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        post = serializer.save(user=self.request.user)
        
        try:
            # --- Notification: Reply ---
            from django.contrib.contenttypes.models import ContentType
            post_ct = ContentType.objects.get_for_model(Post)
            
            if post.parent and post.parent.user != self.request.user:
                preview = post.content[:100] if post.content else ''
                Notification.objects.create(
                    recipient=post.parent.user,
                    actor=self.request.user,
                    verb='replied to your post',
                    target_type=post_ct,
                    target_id=post.parent.id,
                    preview_text=preview,
                )
            elif post.review_parent and post.review_parent.user != self.request.user:
                from django.contrib.contenttypes.models import ContentType
                review_ct = ContentType.objects.get_for_model(Review)
                preview = post.content[:100] if post.content else ''
                Notification.objects.create(
                    recipient=post.review_parent.user,
                    actor=self.request.user,
                    verb='commented on your review',
                    target_type=review_ct,
                    target_id=post.review_parent.id,
                    preview_text=preview,
                )
            elif post.news_parent:
                pass  # News has no single owner to notify
            
            # --- Notification: @Mention detection ---
            import re
            mentions = re.findall(r'@(\w+)', post.content or '')
            if mentions:
                mentioned_users = User.objects.filter(username__in=mentions).exclude(id=self.request.user.id)
                for mentioned_user in mentioned_users:
                    # Don't duplicate if already notified as reply recipient
                    if post.parent and post.parent.user == mentioned_user:
                        continue
                    if post.review_parent and post.review_parent.user == mentioned_user:
                        continue
                    Notification.objects.create(
                        recipient=mentioned_user,
                        actor=self.request.user,
                        verb='mentioned you',
                        target_type=post_ct,
                        target_id=post.id,
                        preview_text=post.content[:100] if post.content else '',
                    )
        except Exception as e:
            print(f"Error creating notification: {e}")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return Response({'error': 'You can only delete your own posts.'}, status=status.HTTP_403_FORBIDDEN)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

from api.models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user).order_by('-updated_at')

    @action(detail=False, methods=['post'])
    def start_chat(self, request):
        username = request.data.get('username')
        if not username:
            return Response({"error": "Username is required"}, status=400)
        
        target_user = get_object_or_404(User, username=username)
        
        if target_user == request.user:
            return Response({"error": "Cannot chat with yourself"}, status=400)

        # Check if conversation exists (complex query for exact participants)
        # We look for a conversation where both users are participants
        conversations = Conversation.objects.filter(participants=request.user).filter(participants=target_user)
        
        if conversations.exists():
            conversation = conversations.first()
        else:
            conversation = Conversation.objects.create()
            conversation.participants.add(request.user, target_user)
            conversation.save()
        
        serializer = self.get_serializer(conversation)
        return Response(serializer.data)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.request.query_params.get('conversation_id')
        if conversation_id:
            return Message.objects.filter(conversation_id=conversation_id, conversation__participants=self.request.user).order_by('created_at')
        return Message.objects.none()

    def list(self, request, *args, **kwargs):
        conversation_id = request.query_params.get('conversation_id')
        if conversation_id:
            # Mark unread messages from other users as read
            Message.objects.filter(
                conversation_id=conversation_id,
                is_read=False
            ).exclude(sender=request.user).update(is_read=True)
        
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        conversation = serializer.validated_data['conversation']
        if self.request.user not in conversation.participants.all():
            raise permissions.PermissionDenied("You are not a participant in this conversation.")
        
        message = serializer.save(sender=self.request.user)
        
        # Update conversation timestamp
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])
        
        # --- Create message notification ---
        from django.contrib.contenttypes.models import ContentType
        conv_ct = ContentType.objects.get_for_model(Conversation)
        recipients = conversation.participants.exclude(id=self.request.user.id)
        preview = message.content[:100] if message.content else ''
        if message.shared_post:
            preview = 'Shared a post with you'
        elif message.shared_review:
            preview = 'Shared a review with you'
        
        for recipient in recipients:
            Notification.objects.create(
                recipient=recipient,
                actor=self.request.user,
                verb='sent you a message',
                target_type=conv_ct,
                target_id=conversation.id,
                preview_text=preview,
            )

from api.models import LibraryEntry
from .serializers import LibraryEntrySerializer
from django_filters.rest_framework import DjangoFilterBackend

class LibraryViewSet(viewsets.ModelViewSet):
    queryset = LibraryEntry.objects.all().select_related('game', 'user')
    serializer_class = LibraryEntrySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['user__username', 'platform', 'status']
    ordering_fields = ['playtime_forever', 'game__title']
    ordering = ['-playtime_forever']

from core.models import News
from .serializers import NewsSerializer

from django.db.models import Count

class NewsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = News.objects.all().select_related('source').annotate(
        like_count=Count('likes', distinct=True),
        comment_count=Count('comments', distinct=True)
    )
    serializer_class = NewsSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['category']
    ordering_fields = ['pub_date', 'like_count', 'comment_count']
    ordering = ['-pub_date']

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

from .serializers import LikeSerializer
from core.models import Like

class LikeViewSet(viewsets.GenericViewSet, viewsets.mixins.CreateModelMixin, viewsets.mixins.DestroyModelMixin):
    queryset = Like.objects.all()
    serializer_class = LikeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        # Check for existence to toggle or prevent duplicates
        user = request.user
        post_id = request.data.get('post')
        review_id = request.data.get('review')
        news_id = request.data.get('news')
        
        existing = Like.objects.filter(user=user, post_id=post_id, review_id=review_id, news_id=news_id).first()
        
        if existing:
            existing.delete()
            return Response({'status': 'unliked'}, status=status.HTTP_200_OK)
        
        response = super().create(request, *args, **kwargs)
        
        # --- Create like notification ---
        from django.contrib.contenttypes.models import ContentType
        try:
            if post_id:
                post = Post.objects.select_related('user').get(id=post_id)
                if post.user != user:
                    post_ct = ContentType.objects.get_for_model(Post)
                    preview = post.content[:100] if post.content else ''
                    Notification.objects.create(
                        recipient=post.user,
                        actor=user,
                        verb='liked your post',
                        target_type=post_ct,
                        target_id=post.id,
                        preview_text=preview,
                    )
            elif review_id:
                review = Review.objects.select_related('user').get(id=review_id)
                if review.user != user:
                    review_ct = ContentType.objects.get_for_model(Review)
                    preview = f'{review.game.title} - {review.content[:80]}' if review.content else review.game.title
                    Notification.objects.create(
                        recipient=review.user,
                        actor=user,
                        verb='liked your review',
                        target_type=review_ct,
                        target_id=review.id,
                        preview_text=preview,
                    )
        except Exception as e:
            print(f'Notification creation failed: {e}')
        
        return response

from core.models import Project, JobPosting
from .serializers import ProjectSerializer, JobPostingSerializer

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'tech_stack']

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class JobPostingViewSet(viewsets.ModelViewSet):
    queryset = JobPosting.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['job_type', 'location_type', 'experience_level']
    search_fields = ['title', 'description']

    def perform_create(self, serializer):
        serializer.save(recruiter=self.request.user)
            
from core.models import Pitch, InvestorCall
from .serializers import PitchSerializer, InvestorCallSerializer

class PitchViewSet(viewsets.ModelViewSet):
    queryset = Pitch.objects.all().order_by('-created_at')
    serializer_class = PitchSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['genre', 'platform', 'stage']
    search_fields = ['title']

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class InvestorCallViewSet(viewsets.ModelViewSet):
    queryset = InvestorCall.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = InvestorCallSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['investor_type', 'ticket_size']
    search_fields = ['organization_name', 'looking_for']

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
            

# ─────────────────────────────────────────────────────────────
# Recommendation & Feed Ranking Views
# ─────────────────────────────────────────────────────────────

from rest_framework.views import APIView
from api.recommendation_models import PostInteraction
from api.recommendation_serializers import PostInteractionSerializer, FriendSuggestionSerializer


class RankedFeedView(APIView):
    """
    GET /api/feed/ranked/?page=1&page_size=20
    Kişiselleştirilmiş sıralı feed döndürür.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        page_size = min(page_size, 50)  # max limit

        from api.services.feed_ranking import get_ranked_feed
        from .serializers import PostSerializer

        posts = get_ranked_feed(request.user, page=page, page_size=page_size)
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response({
            'page': page,
            'page_size': page_size,
            'count': len(posts),
            'results': serializer.data,
        })


class FriendSuggestionView(APIView):
    """
    GET /api/users/suggestions/?count=20
    Arkadaş / takım arkadaşı önerileri döndürür.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = int(request.query_params.get('count', 20))
        count = min(count, 50)

        from api.services.friend_suggestion import get_friend_suggestions
        suggestions = get_friend_suggestions(request.user, count=count)
        serializer = FriendSuggestionSerializer(
            suggestions, many=True, context={'request': request}
        )
        return Response({
            'count': len(suggestions),
            'results': serializer.data,
        })


class PostInteractionView(APIView):
    """
    POST /api/posts/<id>/interact/
    Body: {"interaction_type": "view"|"share"|"play_request"}

    Etkileşim kaydeder ve cold start sayacını artırır.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        interaction_type = request.data.get('interaction_type')
        valid_types = ['view', 'share', 'play_request']

        if interaction_type not in valid_types:
            return Response(
                {'error': f'interaction_type must be one of: {valid_types}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        post_obj = get_object_or_404(Post, id=post_id)

        interaction = PostInteraction.objects.create(
            user=request.user,
            post=post_obj,
            interaction_type=interaction_type,
        )

        # Cold start sayacını artır
        from api.services.cold_start import increment_interaction_count
        increment_interaction_count(request.user)

        serializer = PostInteractionSerializer(interaction)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PostScoreDebugView(APIView):
    """
    GET /api/posts/<id>/debug-score/
    Postun algoritmadaki puanını ve tüm bileşen detaylarını döndürür.
    Geliştirici araçları / debug amaçlı kullanılır.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, post_id):
        import math
        from datetime import timedelta

        post = get_object_or_404(
            Post.objects.select_related('user', 'game_tag', 'score_cache'),
            id=post_id
        )
        user = request.user
        author = post.user

        # ── Cold Start Info ──
        from api.services.cold_start import should_use_cold_start, _get_blend_alpha, _score_cold_start
        is_cold = should_use_cold_start(user)
        alpha = _get_blend_alpha(user)

        # ── Affinity Score (bileşenleriyle) ──
        from api.models import Follow
        from api.recommendation_models import PostInteraction, PostScoreCache

        is_following = Follow.objects.filter(follower=user, following=author).exists()
        is_following_val = 1.0 if is_following else 0.0

        recent_cutoff = timezone.now() - timedelta(days=30)
        interaction_count_raw = PostInteraction.objects.filter(
            user=user,
            post__user=author,
            created_at__gte=recent_cutoff,
        ).count()
        interaction_ratio = min(interaction_count_raw / 50, 1.0)

        user_games = set(user.library.values_list('game_id', flat=True))
        author_games = set(author.library.values_list('game_id', flat=True))
        union = user_games | author_games
        common_game_ratio = len(user_games & author_games) / len(union) if union else 0.0

        affinity_total = 0.30 * is_following_val + 0.45 * interaction_ratio + 0.25 * common_game_ratio

        # ── Engagement Weight (bileşenleriyle) ──
        from api.services.feed_ranking import ENGAGEMENT_WEIGHTS, _compute_interaction_counts
        try:
            cache = post.score_cache
            counts = {
                'view': cache.view_count,
                'like': cache.like_count,
                'comment': cache.comment_count,
                'share': cache.share_count,
                'play_request': cache.play_request_count,
            }
        except PostScoreCache.DoesNotExist:
            counts = _compute_interaction_counts(post)

        raw_weighted = sum(ENGAGEMENT_WEIGHTS[k] * counts.get(k, 0) for k in ENGAGEMENT_WEIGHTS)
        engagement_total = math.log1p(raw_weighted)

        # ── Content Relevance (bileşenleriyle) ──
        user_genre_slugs = set(user.interests.values_list('slug', flat=True))
        post_genres = set()
        game_tag_title = None
        if post.game_tag_id:
            try:
                game_tag_title = post.game_tag.title
                post_genres = set(g.lower() for g in (post.game_tag.genres or []))
            except Exception:
                pass
        genre_union = user_genre_slugs | post_genres
        genre_match = len(user_genre_slugs & post_genres) / len(genre_union) if genre_union else 0.3

        user_platforms = set(p.lower() for p in (user.platforms or []))
        post_platform = (post.platform_tag or '').lower().strip()
        if post_platform and user_platforms:
            platform_match = 1.0 if post_platform in user_platforms else 0.3
        else:
            platform_match = 0.5

        from api.services.feed_ranking import _user_media_preference
        media_pref = _user_media_preference(user, post.media_type)

        relevance_total = genre_match * 0.5 + platform_match * 0.2 + media_pref * 0.3

        # ── Time Decay ──
        hours_age = (timezone.now() - post.timestamp).total_seconds() / 3600.0
        time_decay_lambda = 0.035
        decay_total = math.exp(-time_decay_lambda * max(hours_age, 0))

        # ── Virality Boost ──
        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_1h = PostInteraction.objects.filter(
            post=post,
            created_at__gte=one_hour_ago,
        ).count()
        expected_avg = 5
        if recent_1h <= expected_avg:
            virality_total = 0.0
        else:
            virality_total = max(0, math.log2(recent_1h / expected_avg) - 1) * 0.15

        # ── Final Score ──
        final_score = (affinity_total * engagement_total * relevance_total * decay_total) + virality_total

        # ── Cold Start Score (varsa) ──
        cold_start_score = None
        if is_cold:
            try:
                cold_start_score = round(_score_cold_start(user, post), 4)
            except Exception:
                cold_start_score = None

        return Response({
            'post_id': post.id,
            'post_author': author.username,
            'game_tag': game_tag_title,
            'post_age_hours': round(hours_age, 1),
            'is_cold_start': is_cold,
            'cold_start_alpha': round(alpha, 3),
            'cold_start_score': cold_start_score,
            'scores': {
                'affinity': {
                    'total': round(affinity_total, 4),
                    'is_following': is_following_val,
                    'interaction_count_30d': interaction_count_raw,
                    'interaction_ratio': round(interaction_ratio, 4),
                    'common_games': len(user_games & author_games),
                    'common_game_ratio': round(common_game_ratio, 4),
                },
                'engagement': {
                    'total': round(engagement_total, 4),
                    'raw_weighted_sum': round(raw_weighted, 4),
                    'counts': counts,
                    'weights': ENGAGEMENT_WEIGHTS,
                },
                'content_relevance': {
                    'total': round(relevance_total, 4),
                    'genre_match': round(genre_match, 4),
                    'user_genres': list(user_genre_slugs),
                    'post_genres': list(post_genres),
                    'platform_match': platform_match,
                    'user_platforms': list(user_platforms),
                    'post_platform': post_platform or None,
                    'media_preference': round(media_pref, 4),
                    'post_media_type': post.media_type,
                },
                'time_decay': {
                    'total': round(decay_total, 4),
                    'hours_age': round(hours_age, 1),
                    'lambda': time_decay_lambda,
                    'half_life_hours': round(math.log(2) / time_decay_lambda, 1),
                },
                'virality': {
                    'total': round(virality_total, 4),
                    'recent_1h_interactions': recent_1h,
                    'expected_avg': expected_avg,
                },
            },
            'final_score': round(final_score, 6),
            'formula': 'affinity × engagement × relevance × decay + virality',
        })
