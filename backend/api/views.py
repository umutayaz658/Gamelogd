from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions, filters, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from core.models import Game, Review, Post
from api.models import User, Notification, SupportTicket, Interest, PendingRegistration
from .serializers import UserSerializer, GameSerializer, ReviewSerializer, PostSerializer, RegisterSerializer, SupportTicketSerializer
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from api.services.email_service import send_verification_email, send_support_ticket_email

from api.permissions import IsOwnerOrReadOnly, ProjectAccessPermission

class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        username_or_email = request.data.get('username')
        password = request.data.get('password')

        if not username_or_email or not password:
            return Response({'error': 'Please provide both username/email and password'}, status=status.HTTP_400_BAD_REQUEST)

        # Find the user by email or username
        user = User.objects.filter(Q(email=username_or_email) | Q(username=username_or_email)).first()

        if user:
            if user.check_password(password):
                # Check if user has verified their email
                if not user.is_active:
                    return Response({
                        'status': 'verification_required',
                        'email': user.email,
                        'error': 'Please verify your email address before logging in.'
                    }, status=status.HTTP_403_FORBIDDEN)

                token, created = Token.objects.get_or_create(user=user)
                return Response({
                    'token': token.key,
                    'user_id': user.pk,
                    'email': user.email
                })
        else:
            # Check if there is a pending registration
            pending = PendingRegistration.objects.filter(Q(email=username_or_email) | Q(username=username_or_email)).first()
            if pending:
                from django.contrib.auth.hashers import check_password as django_check_password
                hashed_pw = pending.registration_data.get('password')
                if hashed_pw and django_check_password(password, hashed_pw):
                    return Response({
                        'status': 'verification_required',
                        'email': pending.email,
                        'error': 'Please verify your email address before logging in.'
                    }, status=status.HTTP_403_FORBIDDEN)
        
        return Response({'non_field_errors': ['Unable to log in with provided credentials.']}, status=status.HTTP_400_BAD_REQUEST)

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

class GoogleLoginView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        credential = request.data.get('credential')
        if not credential:
            return Response({"error": "No credential provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from django.conf import settings
            idinfo = id_token.verify_oauth2_token(
                credential, 
                google_requests.Request(), 
                settings.GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=10
            )

            email = idinfo.get('email')
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')

            user = User.objects.filter(email=email).first()
            if not user:
                return Response({
                    "is_new_user": True,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name
                }, status=status.HTTP_200_OK)

            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'email': user.email
            })

        except ValueError as e:
            return Response({"error": f"Invalid token: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

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

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def followers(self, request, username=None):
        user = self.get_object()
        followers = User.objects.filter(id__in=user.followers.values_list('follower_id', flat=True)).order_by('username')
        
        search_query = request.query_params.get('search', '')
        if search_query:
            from django.db.models import Q
            followers = followers.filter(Q(username__icontains=search_query) | Q(real_name__icontains=search_query))
            
        serializer = self.get_serializer(followers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='following-list', permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def following_list(self, request, username=None):
        user = self.get_object()
        following = User.objects.filter(id__in=user.following.values_list('following_id', flat=True)).order_by('username')
        
        search_query = request.query_params.get('search', '')
        if search_query:
            from django.db.models import Q
            following = following.filter(Q(username__icontains=search_query) | Q(real_name__icontains=search_query))
            
        serializer = self.get_serializer(following, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='remove-follower', permission_classes=[permissions.IsAuthenticated])
    def remove_follower(self, request, username=None):
        user = self.get_object() # This is the follower we want to remove
        from api.models import Follow
        deleted_count, _ = Follow.objects.filter(follower=user, following=request.user).delete()
        if deleted_count == 0:
            return Response({"error": "This user is not following you."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": f"Removed {user.username} from followers."}, status=status.HTTP_200_OK)

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
            stats = fetch_steam_library(request.user.id, steam_id)
        except Exception as e:
            print(f"Sync trigger failed: {e}")
            return Response({
                "status": "Steam ID saved, but sync failed. Check privacy settings or try again later.",
                "warning": str(e)
            }, status=status.HTTP_200_OK)
        
        return Response({
            "status": "Sync completed",
            "total_games": stats.get('total', 0),
            "synced": stats.get('synced', 0),
            "created": stats.get('created', 0),
            "covers_fixed": stats.get('cover_fixed', 0),
            "errors": stats.get('errors', 0),
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def disconnect_steam(self, request):
        # Clear Steam ID
        request.user.steam_id = ""
        request.user.save()
        
        # Remove Steam Games from Library
        from api.models import LibraryEntry
        LibraryEntry.objects.filter(user=request.user, platform__iexact='steam').delete()
        
        return Response({'status': 'disconnected'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='change-password')
    def change_password(self, request):
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        if not current_password or not new_password:
            return Response({'error': 'Both current and new passwords are required'}, status=status.HTTP_400_BAD_REQUEST)
        if not user.check_password(current_password):
            return Response({'error': 'Incorrect current password'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from django.contrib.auth.password_validation import validate_password
            validate_password(new_password, user)
        except Exception as e:
            return Response({'error': list(e.messages) if hasattr(e, 'messages') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='delete-account')
    def delete_account(self, request):
        user = request.user
        user.delete()
        return Response({'message': 'Account deleted successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='steam-status')
    def steam_status(self, request, username=None):
        user = self.get_object()
        
        # Check settings for privacy
        is_private = user.settings.get('steamStatusPrivate', False)
        is_owner = request.user.is_authenticated and request.user.id == user.id
        
        if is_private and not is_owner:
            return Response({
                "is_playing": False,
                "game_title": None,
                "steam_appid": None,
                "cover_image": None
            }, status=status.HTTP_200_OK)
            
        from api.services.steam import fetch_steam_currently_playing
        status_data = fetch_steam_currently_playing(user.steam_id)
        return Response(status_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='game-dna')
    def game_dna(self, request, username=None):
        user = self.get_object()
        from api.models import LibraryEntry
        
        # Playtime > 0 olan tüm oyunları dahil et (dropped dahil)
        # Böylece Steam kütüphanesindeki oynanan her oyun Game DNA'ya etki eder
        entries = LibraryEntry.objects.filter(
            user=user,
            playtime_forever__gt=0
        ).select_related('game')

        # Playtime-ağırlıklı tür hesaplaması
        # Her oyunun playtime'ı (dakika) o oyunun türlerine ağırlık olarak eklenir
        # Böylece 300 saat oynanan aksiyon oyunu, 5 saat oynanan RPG'den çok daha fazla etki eder
        from api.services.steam import normalize_genre
        genre_weights = {}  # genre -> total playtime in minutes
        genre_game_counts = {}  # genre -> number of games (for display)
        for entry in entries:
            # Playtime 0 ise minimum 1 dakika ağırlık ver (oyun yine de sayılsın)
            weight = max(entry.playtime_forever, 1)
            for genre in (entry.game.genres or []):
                normalized = normalize_genre(genre)
                genre_weights[normalized] = genre_weights.get(normalized, 0) + weight
                genre_game_counts[normalized] = genre_game_counts.get(normalized, 0) + 1

        total_weight = sum(genre_weights.values())
        if total_weight == 0:
            return Response([])

        # Yüzde hesapla ve sırala (playtime ağırlığına göre)
        colors = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#f43f5e", "#06b6d4", "#ec4899", "#6366f1"]
        result = []
        for i, (genre, weight) in enumerate(sorted(genre_weights.items(), key=lambda x: x[1], reverse=True)):
            total_hours = round(weight / 60, 1)
            result.append({
                "genre": genre,
                "percentage": round((weight / total_weight) * 100),
                "color": colors[i % len(colors)],
                "total_hours": total_hours,
                "game_count": genre_game_counts.get(genre, 0)
            })

        return Response(result)

    @action(detail=True, methods=['get'], url_path='recommended-games')
    def recommended_games(self, request, username=None):
        user = self.get_object()
        from api.models import LibraryEntry
        from core.models import Game
        
        # 1. Calculate user's top genres (Game DNA) — playtime > 0 olan tüm oyunlar
        entries = LibraryEntry.objects.filter(
            user=user,
            playtime_forever__gt=0
        ).select_related('game')

        from api.services.steam import normalize_genre
        genre_counts = {}
        played_game_ids = set()
        for entry in entries:
            played_game_ids.add(entry.game.id)
            weight = max(entry.playtime_forever, 1)
            for genre in (entry.game.genres or []):
                normalized = normalize_genre(genre)
                genre_counts[normalized] = genre_counts.get(normalized, 0) + weight

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

        # 3. Serialize output using GameSerializer for consistent URL handling
        from api.serializers import GameSerializer
        serializer = GameSerializer(recommended, many=True, context={'request': request})
        return Response(serializer.data)

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

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            import json
            from datetime import date, datetime
            from django.contrib.auth.hashers import make_password
            
            validated_data = serializer.validated_data
            
            # Convert to a plain dict with JSON-safe values
            safe_data = {}
            for key, value in validated_data.items():
                if isinstance(value, (date, datetime)):
                    safe_data[key] = value.isoformat()
                elif isinstance(value, list):
                    safe_data[key] = list(value)
                else:
                    safe_data[key] = value
            
            # Pre-hash password so we don't store cleartext in the pending table
            raw_password = safe_data.get('password')
            if raw_password:
                safe_data['password'] = make_password(raw_password)
                
            email = safe_data.get('email')
            username = safe_data.get('username')
            
            # Verify the data is truly JSON-serializable before saving
            json.dumps(safe_data)
            
            # Clean up any existing pending registration for this email/username
            if email:
                PendingRegistration.objects.filter(email=email).delete()
            if username:
                PendingRegistration.objects.filter(username=username).delete()
                
            # Generate code
            code = PendingRegistration.generate_code()
            
            # Save pending registration
            PendingRegistration.objects.create(
                email=email,
                username=username,
                code=code,
                registration_data=safe_data
            )
            
            # Send Email (async - does not block response)
            send_verification_email(email, code)

            return Response({
                'status': 'verification_required',
                'email': email
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Registration processing failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyEmailView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        code = request.data.get('code')

        if not email or not code:
            return Response({'error': 'Email and verification code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Look up pending registration
        pending = PendingRegistration.objects.filter(email=email).first()
        if not pending:
            user_exists = User.objects.filter(email=email, is_active=True).exists()
            if user_exists:
                return Response({'error': 'Account is already verified.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'No pending registration found for this email.'}, status=status.HTTP_400_BAD_REQUEST)

        if pending.code != str(code).strip():
            return Response({'error': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        if pending.is_expired():
            return Response({'error': 'Verification code has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        # Success! Extract registration data and create user
        data = pending.registration_data
        
        # Clean up legacy inactive users with same email or username (if any)
        username = data.get('username')

        try:
            with transaction.atomic():
                if email:
                    User.objects.filter(email=email).delete()
                if username:
                    User.objects.filter(username=username).delete()

                interests_data = data.pop('interests', [])
                roles_data = data.pop('roles', [])
                password = data.pop('password')
                
                if roles_data:
                    if 'Gamer' in roles_data: data['is_gamer'] = True
                    if 'Developer' in roles_data: data['is_developer'] = True
                    if 'Investor' in roles_data: data['is_investor'] = True
                    
                if 'birth_date' in data and data['birth_date']:
                    from datetime import datetime
                    if isinstance(data['birth_date'], str):
                        data['birth_date'] = datetime.strptime(data['birth_date'], '%Y-%m-%d').date()

                # Create active user
                user = User.objects.create(is_active=True, password=password, **data)
                
                # Add interests
                if interests_data:
                    from django.utils.text import slugify
                    for interest_name in interests_data:
                        interest_obj, _ = Interest.objects.get_or_create(name=interest_name, defaults={'slug': slugify(interest_name)})
                        user.interests.add(interest_obj)

                # Delete pending registration
                pending.delete()
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Registration processing failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Login user immediately by generating auth token
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email,
            'username': user.username,
            'message': 'Email verified and account created successfully.'
        }, status=status.HTTP_200_OK)


class ResendVerificationView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')

        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        pending = PendingRegistration.objects.filter(email=email).first()
        if not pending:
            user_exists = User.objects.filter(email=email, is_active=True).exists()
            if user_exists:
                return Response({'error': 'Account is already verified.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'No pending registration found for this email.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate new code
        code = PendingRegistration.generate_code()
        pending.code = code
        pending.expires_at = timezone.now() + timedelta(minutes=5)
        pending.save()

        # Send Email (async - does not block response)
        send_verification_email(email, code)

        return Response({'message': 'New verification code sent.'}, status=status.HTTP_200_OK)


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

    @action(detail=True, methods=['get'], url_path='details')
    def details(self, request, pk=None):
        from django.db.models import Avg, Count
        game = self.get_object()
        
        # Fetch IGDB details on demand
        if not game.details_fetched:
            from api.services.igdb_service import fetch_game_details
            game = fetch_game_details(game)

        # Calculate average rating and counts
        stats = Review.objects.filter(game=game).aggregate(
            avg_rating=Avg('rating'),
            rev_count=Count('id')
        )
        
        # We need log count as well, which is library entries (how many users have it in library)
        from api.models import LibraryEntry
        log_count = LibraryEntry.objects.filter(game=game).count()
        
        # Annotate model on the fly for serializer
        game.average_rating = stats['avg_rating']
        game.review_count = stats['rev_count']
        game.log_count = log_count
        
        from api.serializers import GameDetailSerializer
        serializer = GameDetailSerializer(game, context={'request': request})
        return Response(serializer.data)

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

    @action(detail=False, methods=['get'], url_path='company-info')
    def company_info(self, request):
        """GET /api/games/company-info/?name=Rockstar+Games"""
        name = request.query_params.get('name', '').strip()
        if not name:
            return Response({"error": "Company name is required (use ?name=...)"}, status=status.HTTP_400_BAD_REQUEST)

        from api.services.igdb_service import fetch_company_info
        info = fetch_company_info(name)
        if not info:
            return Response({"error": "Company not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(info)

    @action(detail=False, methods=['get'], url_path='company-games')
    def company_games(self, request):
        """GET /api/games/company-games/?name=Rockstar+Games"""
        name = request.query_params.get('name', '').strip()
        if not name:
            return Response({"error": "Company name is required (use ?name=...)"}, status=status.HTTP_400_BAD_REQUEST)

        from api.services.igdb_service import fetch_company_games
        igdb_games = fetch_company_games(name)

        # Cross-reference with local DB, and auto-create missing ones
        for game in igdb_games:
            local_game = Game.objects.filter(igdb_id=game['igdb_id']).first()
            
            if not local_game:
                # Auto-create the game so it becomes clickable in the frontend
                local_game = Game.objects.create(
                    title=game['name'],
                    igdb_id=game['igdb_id'],
                    cover_image=game.get('cover_url') or '',
                    release_date=game.get('release_date') or None
                )
                
            game['local_id'] = local_game.id
            
            # Use local cover if available and IGDB didn't return one
            if not game.get('cover_url') and local_game.cover_image:
                cover_val = str(local_game.cover_image)
                if cover_val.startswith('http'):
                    game['cover_url'] = cover_val
                elif hasattr(local_game.cover_image, 'url'):
                    game['cover_url'] = request.build_absolute_uri(local_game.cover_image.url)

        return Response(igdb_games)

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().select_related('user', 'game')
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['user__username']
    ordering_fields = ['timestamp', 'rating']
    ordering = ['-timestamp']

    def get_queryset(self):
        queryset = Review.objects.all().select_related('user', 'game')
        
        # Annotate with likes count for ordering by popularity
        from django.db.models import Count
        queryset = queryset.annotate(likes_count=Count('likes', distinct=True))

        username = self.request.query_params.get('username', None)
        if username is not None:
            queryset = queryset.filter(user__username=username)
            
        game_id = self.request.query_params.get('game_id', None)
        if game_id is not None:
            queryset = queryset.filter(game_id=game_id)
            
        # Handle custom ordering by likes_count
        ordering = self.request.query_params.get('ordering', None)
        if ordering == '-likes_count':
            queryset = queryset.order_by('-likes_count', '-timestamp')
        elif ordering == 'likes_count':
            queryset = queryset.order_by('likes_count', '-timestamp')
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().select_related('user').order_by('-timestamp')
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {
        'news_parent': ['exact', 'isnull'],
        'project_parent': ['exact', 'isnull'],
    }

    def get_queryset(self):
        queryset = Post.objects.all().select_related('user').order_by('-timestamp')
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
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(project_parent__status=status_filter)

        tech_stack = self.request.query_params.get('tech_stack_filter', None)
        if tech_stack:
            techs = [t.strip() for t in tech_stack.split(',') if t.strip()]
            for tech in techs:
                queryset = queryset.filter(project_parent__tech_stack__icontains=tech)
                
        is_following_project = self.request.query_params.get('is_following_project', None)
        if is_following_project == 'true' and self.request.user.is_authenticated:
            queryset = queryset.filter(project_parent__followers__user=self.request.user)

        return queryset

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                print("VALIDATION ERROR:", serializer.errors)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print("ERROR IN POST CREATION:", tb)
            return Response({"error": str(e), "traceback": tb}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_create(self, serializer):
        project_parent = serializer.validated_data.get('project_parent')
        if project_parent:
            user = self.request.user
            if project_parent.owner != user:
                is_authorized = project_parent.members.filter(user=user, role__in=['editor', 'admin']).exists()
                if not is_authorized:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You do not have permission to post a devlog for this project.")
        post = serializer.save(user=self.request.user)
        
        # Quote post notification
        if post.repost_parent and post.repost_parent.user != self.request.user:
            from api.models import Notification
            from django.contrib.contenttypes.models import ContentType
            content_type = ContentType.objects.get_for_model(Post)
            Notification.objects.create(
                recipient=post.repost_parent.user,
                actor=self.request.user,
                verb='quoted your post',
                target_type=content_type,
                target_id=post.id
            )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def repost(self, request, pk=None):
        original_post = self.get_object()
        user = request.user
        
        # Check if already reposted directly by this user (content is empty)
        existing = Post.objects.filter(user=user, repost_parent=original_post, content='').first()
        
        if existing:
            existing.delete()
            return Response({'status': 'unreposted', 'reposts_count': original_post.reposts.filter(content='').count()}, status=status.HTTP_200_OK)
            
        # Create direct repost
        repost_post = Post.objects.create(
            user=user,
            repost_parent=original_post,
            content=''
        )
        
        # Trigger notification
        if original_post.user != user:
            from api.models import Notification
            from django.contrib.contenttypes.models import ContentType
            content_type = ContentType.objects.get_for_model(Post)
            Notification.objects.create(
                recipient=original_post.user,
                actor=user,
                verb='reposted your post',
                target_type=content_type,
                target_id=repost_post.id
            )
            
        return Response({'status': 'reposted', 'reposts_count': original_post.reposts.filter(content='').count()}, status=status.HTTP_201_CREATED)

from api.models import Conversation, Message, ConversationMember
from .serializers import ConversationSerializer, MessageSerializer

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Conversation.objects.filter(participants=self.request.user).order_by('-updated_at')
        # Backfill memberships
        for c in qs:
            ConversationMember.objects.get_or_create(conversation=c, user=self.request.user)
        return qs

    @action(detail=False, methods=['post'])
    def start_chat(self, request):
        username = request.data.get('username')
        if not username:
            return Response({"error": "Username is required"}, status=400)
        
        target_user = get_object_or_404(User, username=username)
        
        if target_user == request.user:
            return Response({"error": "Cannot chat with yourself"}, status=400)

        # Check if conversation exists (complex query for exact participants)
        # We look for a conversation where both users are participants and is not a group
        conversations = Conversation.objects.filter(is_group=False).filter(participants=request.user).filter(participants=target_user)
        
        if conversations.exists():
            conversation = conversations.first()
        else:
            conversation = Conversation.objects.create(is_group=False)
            conversation.participants.add(request.user, target_user)
            conversation.save()
            
        # Ensure memberships exist
        ConversationMember.objects.get_or_create(conversation=conversation, user=request.user)
        ConversationMember.objects.get_or_create(conversation=conversation, user=target_user)
        
        serializer = self.get_serializer(conversation)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def create_group(self, request):
        usernames = request.data.get('usernames', [])
        if isinstance(usernames, str):
            import json
            if usernames.startswith('[') and usernames.endswith(']'):
                try:
                    usernames = json.loads(usernames)
                except Exception:
                    pass
            else:
                usernames = [u.strip() for u in usernames.split(',') if u.strip()]
        elif hasattr(request.data, 'getlist'):
            list_data = request.data.getlist('usernames')
            if list_data:
                if len(list_data) == 1 and isinstance(list_data[0], str):
                    if list_data[0].startswith('[') and list_data[0].endswith(']'):
                        import json
                        try:
                            list_data = json.loads(list_data[0])
                        except Exception:
                            pass
                    else:
                        list_data = [u.strip() for u in list_data[0].split(',') if u.strip()]
                usernames = list_data
        
        name = request.data.get('name', 'Group Chat')
        avatar = request.FILES.get('avatar', None)
        
        if not usernames:
            return Response({"error": "At least one other participant username is required"}, status=400)
            
        users = User.objects.filter(username__in=usernames)
        if not users.exists():
            return Response({"error": "No valid participants found"}, status=400)
            
        conversation = Conversation.objects.create(is_group=True, name=name, avatar=avatar)
        conversation.participants.add(request.user)
        for u in users:
            conversation.participants.add(u)
        conversation.save()
        
        # Create memberships
        ConversationMember.objects.create(conversation=conversation, user=request.user, is_admin=True)
        for u in users:
            ConversationMember.objects.create(conversation=conversation, user=u, is_admin=False)
            
        serializer = self.get_serializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=['post'], url_path='toggle-mute')
    def toggle_mute(self, request, pk=None):
        conversation = self.get_object()
        member, created = ConversationMember.objects.get_or_create(conversation=conversation, user=request.user)
        member.is_muted = not member.is_muted
        member.save()
        return Response({'is_muted': member.is_muted, 'status': 'success'})

    @action(detail=True, methods=['post'], url_path='add-members')
    def add_members(self, request, pk=None):
        conversation = self.get_object()
        if not conversation.is_group:
            return Response({"error": "Not a group conversation"}, status=400)
            
        user_membership = get_object_or_404(ConversationMember, conversation=conversation, user=request.user)
        if not user_membership.is_admin:
            return Response({"error": "Only group admins can add members"}, status=403)
            
        usernames = request.data.get('usernames', [])
        if isinstance(usernames, str):
            import json
            if usernames.startswith('[') and usernames.endswith(']'):
                try:
                    usernames = json.loads(usernames)
                except Exception:
                    pass
            else:
                usernames = [u.strip() for u in usernames.split(',') if u.strip()]
        elif hasattr(request.data, 'getlist'):
            list_data = request.data.getlist('usernames')
            if list_data:
                if len(list_data) == 1 and isinstance(list_data[0], str):
                    if list_data[0].startswith('[') and list_data[0].endswith(']'):
                        import json
                        try:
                            list_data = json.loads(list_data[0])
                        except Exception:
                            pass
                    else:
                        list_data = [u.strip() for u in list_data[0].split(',') if u.strip()]
                usernames = list_data
                
        users = User.objects.filter(username__in=usernames)
        
        added_users = []
        for u in users:
            if u not in conversation.participants.all():
                conversation.participants.add(u)
                ConversationMember.objects.get_or_create(conversation=conversation, user=u)
                added_users.append(u.username)
                
        conversation.save()
        return Response({'status': 'success', 'added_members': added_users})

    @action(detail=True, methods=['post'], url_path='remove-member')
    def remove_member(self, request, pk=None):
        conversation = self.get_object()
        if not conversation.is_group:
            return Response({"error": "Not a group conversation"}, status=400)
            
        user_membership = get_object_or_404(ConversationMember, conversation=conversation, user=request.user)
        if not user_membership.is_admin:
            return Response({"error": "Only group admins can remove members"}, status=403)
            
        target_username = request.data.get('username')
        if not target_username:
            return Response({"error": "Username is required"}, status=400)
            
        target_user = get_object_or_404(User, username=target_username)
        if target_user == request.user:
            return Response({"error": "Cannot remove yourself. Use leave instead"}, status=400)
            
        conversation.participants.remove(target_user)
        ConversationMember.objects.filter(conversation=conversation, user=target_user).delete()
        conversation.save()
        return Response({'status': 'success', 'removed_member': target_username})

    @action(detail=True, methods=['post'], url_path='make-admin')
    def make_admin(self, request, pk=None):
        conversation = self.get_object()
        if not conversation.is_group:
            return Response({"error": "Not a group conversation"}, status=400)
            
        user_membership = get_object_or_404(ConversationMember, conversation=conversation, user=request.user)
        if not user_membership.is_admin:
            return Response({"error": "Only group admins can promote other members"}, status=403)
            
        target_username = request.data.get('username')
        if not target_username:
            return Response({"error": "Username is required"}, status=400)
            
        target_user = get_object_or_404(User, username=target_username)
        target_membership = get_object_or_404(ConversationMember, conversation=conversation, user=target_user)
        target_membership.is_admin = True
        target_membership.save()
        return Response({'status': 'success', 'promoted_member': target_username})

    @action(detail=True, methods=['post'], url_path='leave')
    def leave(self, request, pk=None):
        conversation = self.get_object()
        if not conversation.is_group:
            return Response({"error": "Not a group conversation"}, status=400)
            
        if request.user not in conversation.participants.all():
            return Response({"error": "You are not a participant in this conversation"}, status=400)
            
        conversation.participants.remove(request.user)
        ConversationMember.objects.filter(conversation=conversation, user=request.user).delete()
        
        # If no participants left, delete conversation
        if conversation.participants.count() == 0:
            conversation.delete()
            return Response({'status': 'deleted', 'message': 'Group deleted as it has no participants'})
            
        # If the user leaving was the only admin, appoint another participant as admin
        elif not ConversationMember.objects.filter(conversation=conversation, is_admin=True).exists():
            first_member = ConversationMember.objects.filter(conversation=conversation).first()
            if first_member:
                first_member.is_admin = True
                first_member.save()
                
        conversation.save()
        return Response({'status': 'success', 'message': 'You left the group'})

    @action(detail=True, methods=['patch'], url_path='update-group-details')
    def update_group_details(self, request, pk=None):
        conversation = self.get_object()
        if not conversation.is_group:
            return Response({"error": "Not a group conversation"}, status=400)
            
        user_membership = get_object_or_404(ConversationMember, conversation=conversation, user=request.user)
        if not user_membership.is_admin:
            return Response({"error": "Only group admins can update group details"}, status=403)
            
        name = request.data.get('name')
        avatar = request.FILES.get('avatar')
        
        if name:
            conversation.name = name
        if avatar:
            conversation.avatar = avatar
            
        conversation.save()
        serializer = self.get_serializer(conversation)
        return Response(serializer.data)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if self.action == 'list':
            conversation_id = self.request.query_params.get('conversation_id')
            if conversation_id:
                return Message.objects.filter(conversation_id=conversation_id, conversation__participants=user).order_by('created_at')
            return Message.objects.none()
        return Message.objects.filter(conversation__participants=user)

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

    @action(detail=True, methods=['post'], url_path='react')
    def react(self, request, pk=None):
        message = self.get_object()
        emoji = request.data.get('emoji')
        if not emoji:
            return Response({"error": "Emoji is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        from api.models import MessageReaction
        # Toggle reaction
        reaction = MessageReaction.objects.filter(message=message, user=request.user, emoji=emoji).first()
        if reaction:
            reaction.delete()
            action_performed = 'removed'
        else:
            MessageReaction.objects.create(message=message, user=request.user, emoji=emoji)
            action_performed = 'added'
            
        serializer = self.get_serializer(message)
        return Response({
            "status": "success",
            "action": action_performed,
            "message": serializer.data
        }, status=status.HTTP_200_OK)

from api.models import LibraryEntry
from .serializers import LibraryEntrySerializer
from django_filters.rest_framework import DjangoFilterBackend

class LibraryViewSet(viewsets.ModelViewSet):
    queryset = LibraryEntry.objects.all().select_related('game', 'user')
    serializer_class = LibraryEntrySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
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

    @action(detail=False, methods=['post'])
    def fetch(self, request):
        from django.conf import settings
        from django.core.management import call_command
        import threading

        client_secret = request.headers.get('X-Cron-Secret') or request.query_params.get('secret')
        expected_secret = getattr(settings, 'CRON_SECRET', None)

        if not expected_secret or client_secret != expected_secret:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        # Run feedparser news fetching in a background thread to prevent http connection timeout
        def run_fetch():
            try:
                call_command('fetch_news')
            except Exception as e:
                print(f"Error in background fetch_news task: {e}")

        threading.Thread(target=run_fetch).start()
        return Response({"message": "News fetch task started in background."}, status=status.HTTP_200_OK)

from .serializers import LikeSerializer
from core.models import Like

class LikeViewSet(viewsets.GenericViewSet, viewsets.mixins.CreateModelMixin, viewsets.mixins.DestroyModelMixin):
    queryset = Like.objects.all()
    serializer_class = LikeSerializer
    permission_classes = [permissions.IsAuthenticated]

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
        
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

from .serializers import BookmarkSerializer
from core.models import Bookmark

class BookmarkViewSet(viewsets.GenericViewSet, viewsets.mixins.CreateModelMixin, viewsets.mixins.ListModelMixin, viewsets.mixins.DestroyModelMixin):
    queryset = Bookmark.objects.all()
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user).order_by('-timestamp')

    def create(self, request, *args, **kwargs):
        # Check for existence to toggle or prevent duplicates
        user = request.user
        post_id = request.data.get('post')
        review_id = request.data.get('review')
        news_id = request.data.get('news')
        
        existing = Bookmark.objects.filter(user=user, post_id=post_id, review_id=review_id, news_id=news_id).first()
        
        if existing:
            existing.delete()
            return Response({'status': 'unbookmarked'}, status=status.HTTP_200_OK)
        
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

from core.models import Project, JobPosting, ProjectMember
from .serializers import ProjectSerializer, JobPostingSerializer, ProjectMemberSerializer

class ProjectMemberViewSet(viewsets.ModelViewSet):
    queryset = ProjectMember.objects.all()
    serializer_class = ProjectMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ProjectMember.objects.all()
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def perform_create(self, serializer):
        project = serializer.validated_data['project']
        # The serializer validates user via `user_id` mapped to `user`
        target_user = serializer.validated_data['user']
        user = self.request.user
        if project.owner != user and not project.members.filter(user=user, role='admin').exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only project admins can add members.")
        
        # Check if already a member or pending
        if ProjectMember.objects.filter(project=project, user=target_user).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("User is already a member or has a pending invite.")

        member = serializer.save(status='pending')
        
        from api.models import Notification
        Notification.objects.create(
            recipient=target_user,
            actor=user,
            verb='invited you to join the project',
            target=member
        )

    def perform_update(self, serializer):
        project = serializer.instance.project
        user = self.request.user
        if project.owner != user and not project.members.filter(user=user, role='admin').exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only project admins can update members.")
        serializer.save()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        instance = self.get_object()
        if instance.user != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only accept your own invites.")
        
        instance.status = 'active'
        instance.save()
        
        # Trigger notification to project owner
        from api.models import Notification
        Notification.objects.create(
            recipient=instance.project.owner,
            actor=request.user,
            verb='accepted your invite to join the project',
            target=instance
        )
        
        return Response({'status': 'active'}, status=status.HTTP_200_OK)
    def perform_destroy(self, instance):
        project = instance.project
        user = self.request.user
        
        # Allow the user to decline/remove themselves
        if instance.user == user:
            instance.delete()
            return

        if project.owner != user and not project.members.filter(user=user, role='admin').exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only project admins can remove members.")
        instance.delete()

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().select_related('owner').order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, ProjectAccessPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'tech_stack']
    filterset_fields = ['status']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Project.objects.all().select_related('owner').order_by('-created_at')
        # Tech stack filtering (comma-separated)
        tech_stack = self.request.query_params.get('tech_stack_filter', None)
        if tech_stack:
            techs = [t.strip() for t in tech_stack.split(',') if t.strip()]
            for tech in techs:
                queryset = queryset.filter(tech_stack__icontains=tech)
                
        is_following = self.request.query_params.get('is_following', None)
        if is_following == 'true' and self.request.user.is_authenticated:
            queryset = queryset.filter(followers__user=self.request.user)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, pk=None):
        project = self.get_object()
        from core.models import ProjectFollow
        follow_obj, created = ProjectFollow.objects.get_or_create(user=request.user, project=project)
        if not created:
            return Response({"message": "Already following this project."}, status=status.HTTP_200_OK)
        
        # Trigger notification to project owner
        if project.owner != request.user:
            from api.models import Notification
            from django.contrib.contenttypes.models import ContentType
            content_type = ContentType.objects.get_for_model(project.__class__)
            Notification.objects.create(
                recipient=project.owner,
                actor=request.user,
                verb='followed your project',
                target_type=content_type,
                target_id=project.id
            )
            
        return Response({"message": f"Now following {project.title}"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, pk=None):
        project = self.get_object()
        from core.models import ProjectFollow
        deleted_count, _ = ProjectFollow.objects.filter(user=request.user, project=project).delete()
        if deleted_count == 0:
            return Response({"error": "You are not following this project."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": f"Unfollowed {project.title}"}, status=status.HTTP_200_OK)

class JobPostingViewSet(viewsets.ModelViewSet):
    queryset = JobPosting.objects.filter(is_active=True).select_related('recruiter').order_by('-created_at')
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['job_type', 'location_type', 'experience_level', 'post_type']
    search_fields = ['title', 'description']

    def get_queryset(self):
        queryset = super().get_queryset()
        tech_stack = self.request.query_params.get('tech_stack')
        if tech_stack:
            techs = [t.strip() for t in tech_stack.split(',') if t.strip()]
            for tech in techs:
                queryset = queryset.filter(tech_stack__contains=[tech])
        return queryset

    def perform_create(self, serializer):
        serializer.save(recruiter=self.request.user)
            
from core.models import Pitch, InvestorCall
from .serializers import PitchSerializer, InvestorCallSerializer

class PitchViewSet(viewsets.ModelViewSet):
    queryset = Pitch.objects.all().select_related('user').order_by('-created_at')
    serializer_class = PitchSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['genre', 'platform', 'stage']
    search_fields = ['title']

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class InvestorCallViewSet(viewsets.ModelViewSet):
    queryset = InvestorCall.objects.filter(is_active=True).select_related('user').order_by('-created_at')
    serializer_class = InvestorCallSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['investor_type', 'ticket_size']
    search_fields = ['organization_name', 'looking_for']

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
            
class SupportTicketViewSet(viewsets.ModelViewSet):
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        ticket = serializer.save(user=self.request.user)
        
        # Send email (async - does not block response)
        send_support_ticket_email(ticket, self.request.user)


from datetime import timedelta

class FeedViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'], url_path='for-you')
    def for_you(self, request):
        user = request.user
        time_limit = timezone.now() - timedelta(days=30)
        
        posts = Post.objects.filter(
            parent__isnull=True,
            review_parent__isnull=True,
            news_parent__isnull=True,
            timestamp__gte=time_limit
        ).select_related('user').order_by('-timestamp')[:80]
        
        if posts.count() < 40:
            posts = Post.objects.filter(
                parent__isnull=True,
                review_parent__isnull=True,
                news_parent__isnull=True
            ).select_related('user').order_by('-timestamp')[:80]
            
        reviews = Review.objects.filter(timestamp__gte=time_limit).select_related('user', 'game').order_by('-timestamp')[:80]
        if reviews.count() < 40:
            reviews = Review.objects.all().select_related('user', 'game').order_by('-timestamp')[:80]

        followed_users_ids = set()
        library_game_ids = set()
        library_playtimes = {}
        interest_keywords = set()

        if user.is_authenticated:
            followed_users_ids = set(user.following.values_list('following_id', flat=True))
            library_game_ids = set(user.library.values_list('game_id', flat=True))
            library_playtimes = {entry.game_id: entry.playtime_forever for entry in user.library.all()}
            interest_keywords = set(user.interests.values_list('name', flat=True))
            if user.is_developer:
                interest_keywords.update(['dev', 'development', 'indie', 'coding', 'engine', 'unity', 'unreal'])
            if user.is_investor:
                interest_keywords.update(['pitch', 'invest', 'funding', 'seed', 'startup', 'market'])
            
            interest_keywords = {k.lower() for k in interest_keywords}

        scored_items = []
        now = timezone.now()

        merged_items = []
        for p in posts:
            merged_items.append(('post', p))
        for r in reviews:
            merged_items.append(('review', r))

        for item_type, item in merged_items:
            score = 10.0
            
            # Recency decay
            age_in_days = (now - item.timestamp).total_seconds() / 86400.0
            recency_multiplier = 1.0 / (1.0 + age_in_days * 0.5)
            score *= recency_multiplier
            
            # Social / Engagement factor
            likes = item.likes.count() if hasattr(item, 'likes') else 0
            replies = item.replies.count() if hasattr(item, 'replies') else 0
            
            score += likes * 0.5
            score += replies * 0.8
            
            # Personalization
            if user.is_authenticated:
                if item.user_id in followed_users_ids:
                    score += 5.0
                    
                text_to_search = ""
                if item_type == 'post':
                    text_to_search = (item.content or "") + " " + (item.title or "")
                elif item_type == 'review':
                    text_to_search = (item.content or "") + " " + (item.game.title or "")
                    
                text_to_search_lower = text_to_search.lower()
                keyword_matches = sum(1 for kw in interest_keywords if kw in text_to_search_lower)
                score += min(keyword_matches * 2.0, 6.0)
                
                if item_type == 'review':
                    if item.game_id in library_game_ids:
                        score += 4.0
                        playtime = library_playtimes.get(item.game_id, 0)
                        if playtime > 0:
                            score += 2.0
                            
            scored_items.append((score, item_type, item))

        scored_items.sort(key=lambda x: x[0], reverse=True)
        top_items = scored_items[:60]
        
        results = []
        for score, item_type, item in top_items:
            if item_type == 'post':
                data = PostSerializer(item, context={'request': request}).data
                data['type'] = 'post'
            else:
                data = ReviewSerializer(item, context={'request': request}).data
                data['type'] = 'review'
            data['relevance_score'] = score
            results.append(data)
            
        return Response(results)

    @action(detail=False, methods=['get'], url_path='following')
    def following(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response([])

        followed_users_ids = user.following.values_list('following_id', flat=True)
        
        posts = Post.objects.filter(
            user_id__in=followed_users_ids,
            parent__isnull=True,
            review_parent__isnull=True,
            news_parent__isnull=True
        ).select_related('user').order_by('-timestamp')[:50]
        
        reviews = Review.objects.filter(user_id__in=followed_users_ids).select_related('user', 'game').order_by('-timestamp')[:50]
        
        merged_items = []
        for p in posts:
            data = PostSerializer(p, context={'request': request}).data
            data['type'] = 'post'
            merged_items.append((p.timestamp, data))
        for r in reviews:
            data = ReviewSerializer(r, context={'request': request}).data
            data['type'] = 'review'
            merged_items.append((r.timestamp, data))
            
        merged_items.sort(key=lambda x: x[0], reverse=True)
        results = [item[1] for item in merged_items[:50]]
        return Response(results)
