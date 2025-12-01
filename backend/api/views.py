from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions, filters, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from core.models import Game, Review, Post
from api.models import User, Notification
from .serializers import UserSerializer, GameSerializer, ReviewSerializer, PostSerializer, RegisterSerializer

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
        
        # Save Steam ID
        request.user.steam_id = steam_id
        request.user.save()
        
        # Trigger Sync
        from api.services.steam import fetch_steam_library
        # In production, use Celery: fetch_steam_library.delay(request.user.id, steam_id)
        fetch_steam_library(request.user.id, steam_id)
        
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

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-timestamp')
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Post.objects.all().order_by('-timestamp')
        username = self.request.query_params.get('username', None)
        if username is not None:
            queryset = queryset.filter(user__username=username)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

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
