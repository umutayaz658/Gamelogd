import logging
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions, filters, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from core.models import Game, Review, Post, Organisation, OrganisationMember, OrganisationFollow, OrganisationInvitation
from api.models import User, Notification, SupportTicket, Interest, PendingRegistration, PendingEmailChange
from .serializers import UserSerializer, GameSerializer, ReviewSerializer, PostSerializer, RegisterSerializer, SupportTicketSerializer, OrganisationSerializer, OrganisationMemberSerializer, OrganisationInvitationSerializer
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)
from django.utils.html import strip_tags
from django.conf import settings
from api.services.email_service import send_verification_email, send_support_ticket_email, send_email_change_verification_email

from api.permissions import IsOwnerOrReadOnly, ProjectAccessPermission, OrganisationAccessPermission
from api.authentication import set_auth_cookie, clear_auth_cookie

from rest_framework.throttling import ScopedRateThrottle


class CustomAuthToken(ObtainAuthToken):
    # ObtainAuthToken sets throttle_classes = (); re-enable scoped throttling explicitly.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

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
                response = Response({
                    'token': token.key,
                    'user_id': user.pk,
                    'email': user.email
                })
                return set_auth_cookie(response, token.key)
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
    throttle_scope = 'login'

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

            # Only trust the email if Google itself has verified it. An unverified email in the
            # token could otherwise be used to log into a local account that shares that address.
            if idinfo.get('email_verified') is not True:
                return Response({"error": "Google account email is not verified."}, status=status.HTTP_400_BAD_REQUEST)

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
            response = Response({
                'token': token.key,
                'user_id': user.pk,
                'email': user.email
            })
            return set_auth_cookie(response, token.key)

        except ValueError as e:
            return Response({"error": f"Invalid token: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

# Read-only on purpose: profile mutations must go through CurrentUserView (/users/me/),
# never PATCH/PUT/DELETE on /users/<username>/. A full ModelViewSet here would let any
# authenticated user edit or delete any other account (IDOR). Custom @action routes
# (follow, block, sync_steam, ...) still work on a ReadOnlyModelViewSet.
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'real_name']
    lookup_field = 'username'

    def filter_queryset(self, queryset):
        # Strip leading '@' from search term if present to allow searching like @username
        search_query = self.request.query_params.get('search', '')
        if search_query.startswith('@'):
            q_params = self.request._request.GET.copy()
            q_params['search'] = search_query[1:]
            self.request._request.GET = q_params
        return super().filter_queryset(queryset)

    def get_queryset(self):
        queryset = User.objects.all()
        request = self.request
        if request and request.user.is_authenticated:
            if self.action == 'list':
                from api.models import Block
                blocked_ids = Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
                blocker_ids = Block.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
                queryset = queryset.exclude(id__in=blocked_ids).exclude(id__in=blocker_ids)
        return queryset

    def _check_private_access(self, target_user, request):
        is_private = target_user.settings.get('privateProfile', False)
        is_owner = request.user.is_authenticated and request.user.id == target_user.id
        from api.models import Follow
        is_following = request.user.is_authenticated and Follow.objects.filter(follower=request.user, following=target_user).exists()
        
        if is_private and not is_owner and not is_following:
            return False
        return True

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, username=None):
        target_user = self.get_object()
        if request.user == target_user:
            return Response({"error": "You cannot follow yourself."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check block restrictions
        from api.models import Block
        if Block.objects.filter(blocker=request.user, blocked=target_user).exists() or \
           Block.objects.filter(blocker=target_user, blocked=request.user).exists():
            return Response({"error": "Cannot follow this user due to block restrictions."}, status=status.HTTP_403_FORBIDDEN)
        
        from api.models import Follow, FollowRequest, Notification
        # If target user has a private profile
        if target_user.settings.get('privateProfile', False):
            if Follow.objects.filter(follower=request.user, following=target_user).exists():
                return Response({"message": "You are already following this user.", "status": "following", "is_following": True, "is_requested": False}, status=status.HTTP_200_OK)
            
            follow_req, req_created = FollowRequest.objects.get_or_create(sender=request.user, receiver=target_user)
            if not req_created:
                return Response({"message": "Follow request already pending.", "status": "pending", "is_following": False, "is_requested": True}, status=status.HTTP_200_OK)
            
            # Send Notification for follow request
            Notification.objects.create(
                recipient=target_user,
                actor=request.user,
                verb='requested to follow you'
            )
            return Response({"message": "Follow request sent.", "status": "pending", "is_following": False, "is_requested": True}, status=status.HTTP_201_CREATED)
        
        follow_instance, created = Follow.objects.get_or_create(follower=request.user, following=target_user)
        
        if not created:
            return Response({"message": "You are already following this user.", "status": "following", "is_following": True, "is_requested": False}, status=status.HTTP_200_OK)
            
        return Response({"message": f"You are now following {target_user.username}", "status": "following", "is_following": True, "is_requested": False}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def followers(self, request, username=None):
        user = self.get_object()
        if not self._check_private_access(user, request):
            return Response({"error": "This account is private."}, status=status.HTTP_403_FORBIDDEN)
        
        followers = User.objects.filter(id__in=user.followers.values_list('follower_id', flat=True)).order_by('username')
        if request.user.is_authenticated:
            from api.models import Block
            blocked_ids = Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
            blocker_ids = Block.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
            followers = followers.exclude(id__in=blocked_ids).exclude(id__in=blocker_ids)
        
        search_query = request.query_params.get('search', '')
        if search_query:
            from django.db.models import Q
            followers = followers.filter(Q(username__icontains=search_query) | Q(real_name__icontains=search_query))
            
        serializer = self.get_serializer(followers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='following-list', permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def following_list(self, request, username=None):
        user = self.get_object()
        if not self._check_private_access(user, request):
            return Response({"error": "This account is private."}, status=status.HTTP_403_FORBIDDEN)
        
        following = User.objects.filter(id__in=user.following.values_list('following_id', flat=True)).order_by('username')
        if request.user.is_authenticated:
            from api.models import Block
            blocked_ids = Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
            blocker_ids = Block.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
            following = following.exclude(id__in=blocked_ids).exclude(id__in=blocker_ids)
        
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

        # Validate as a SteamID64 (17-digit number) before persisting or using it to build
        # outbound Steam API URLs — prevents injecting arbitrary values into request URLs.
        import re
        steam_id = str(steam_id).strip()
        if not re.fullmatch(r'\d{17}', steam_id):
            return Response({"error": "Invalid Steam ID. Provide a 17-digit SteamID64."}, status=status.HTTP_400_BAD_REQUEST)

        # Always save Steam ID first so it persists
        request.user.steam_id = steam_id
        request.user.save()

        from django.conf import settings
        if not settings.STEAM_API_KEY:
            return Response({
                "status": "Steam ID saved, but library sync is unavailable (STEAM_API_KEY not configured).",
                "steam_id_saved": True
            }, status=status.HTTP_200_OK)

        # Run sync in background thread so the user doesn't wait
        import threading
        user_id = request.user.id

        def run_sync():
            from api.services.steam import fetch_steam_library
            from api.models import Notification, User as UserModel
            try:
                stats = fetch_steam_library(user_id, steam_id)
                # Create a notification for the user when sync completes
                user = UserModel.objects.get(id=user_id)
                synced = stats.get('synced', 0)
                total = stats.get('total', 0)
                Notification.objects.create(
                    recipient=user,
                    actor=user,
                    verb=f'Your Steam library sync is complete! {synced}/{total} games synced successfully.'
                )
            except Exception as e:
                print(f"Background Steam sync failed for user {user_id}: {e}")
                try:
                    user = UserModel.objects.get(id=user_id)
                    Notification.objects.create(
                        recipient=user,
                        actor=user,
                        verb='Steam library sync failed. Please check your privacy settings and try again.'
                    )
                except Exception:
                    pass

        threading.Thread(target=run_sync, daemon=True).start()

        return Response({
            "status": "sync_started",
            "message": "Steam library sync has been started. You will be notified when it's complete."
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
        # Rotate the auth token so a previously-issued (possibly stolen) token can't outlive the
        # password change — DRF tokens otherwise never expire. Return the fresh token and refresh
        # the httpOnly cookie so the caller's own session stays valid without a re-login.
        Token.objects.filter(user=user).delete()
        new_token = Token.objects.create(user=user)
        response = Response(
            {'message': 'Password changed successfully', 'token': new_token.key},
            status=status.HTTP_200_OK,
        )
        return set_auth_cookie(response, new_token.key)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='delete-account')
    def delete_account(self, request):
        user = request.user
        password = request.data.get('password')
        if not password:
            return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not user.check_password(password):
            return Response({'error': 'Incorrect password'}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response({'message': 'Account deleted successfully'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='request-email-change')
    def request_email_change(self, request):
        # Every account must map to exactly one real, reachable email — the actual
        # `email` field on the model stays read-only everywhere else (see UserSerializer)
        # so this verified request/confirm pair is the ONLY way it can ever change.
        user = request.user
        new_email = (request.data.get('new_email') or '').strip()

        if not new_email:
            return Response({'error': 'A new email address is required'}, status=status.HTTP_400_BAD_REQUEST)

        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_email(new_email)
        except DjangoValidationError:
            return Response({'error': 'Enter a valid email address'}, status=status.HTTP_400_BAD_REQUEST)

        if new_email.lower() == (user.email or '').lower():
            return Response({'error': 'This is already your current email address'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
            return Response({'error': 'A user with that email already exists'}, status=status.HTTP_400_BAD_REQUEST)

        code = PendingEmailChange.generate_code()
        PendingEmailChange.objects.update_or_create(
            user=user,
            defaults={
                'new_email': new_email,
                'code': code,
                'failed_attempts': 0,
                'expires_at': timezone.now() + timedelta(minutes=5),
            }
        )
        send_email_change_verification_email(new_email, code)

        return Response({'status': 'verification_required', 'new_email': new_email}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='confirm-email-change')
    def confirm_email_change(self, request):
        user = request.user
        code = request.data.get('code')

        if not code:
            return Response({'error': 'Verification code is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Uniform error for every failure case (no pending request, expired, wrong code)
        # so a caller can't distinguish them — same principle as VerifyEmailView.
        GENERIC_ERROR = 'Invalid or expired verification code.'

        pending = PendingEmailChange.objects.filter(user=user).first()
        if not pending:
            return Response({'error': GENERIC_ERROR}, status=status.HTTP_400_BAD_REQUEST)

        if pending.is_expired():
            pending.delete()
            return Response({'error': GENERIC_ERROR}, status=status.HTTP_400_BAD_REQUEST)

        if pending.code != str(code).strip():
            pending.failed_attempts += 1
            if pending.failed_attempts >= PendingEmailChange.MAX_VERIFY_ATTEMPTS:
                pending.delete()
            else:
                pending.save(update_fields=['failed_attempts'])
            return Response({'error': GENERIC_ERROR}, status=status.HTTP_400_BAD_REQUEST)

        # Re-check uniqueness at confirm time too — a race where someone else claims
        # the same address between the request and confirm steps.
        if User.objects.filter(email__iexact=pending.new_email).exclude(pk=user.pk).exists():
            pending.delete()
            return Response({'error': 'That email address was just taken by another account'}, status=status.HTTP_400_BAD_REQUEST)

        user.email = pending.new_email
        user.save(update_fields=['email'])
        pending.delete()

        return Response({'email': user.email}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='steam-status')
    def steam_status(self, request, username=None):
        user = self.get_object()
        if not self._check_private_access(user, request):
            return Response({
                "is_playing": False,
                "game_title": None,
                "steam_appid": None,
                "cover_image": None
            }, status=status.HTTP_200_OK)
        
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
        if not self._check_private_access(user, request):
            return Response({"error": "This account is private."}, status=status.HTTP_403_FORBIDDEN)
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
        for i, (genre, weight) in enumerate(sorted(genre_weights.items(), key=lambda x: x[1], reverse=True)[:10]):
            percentage = round((weight / total_weight) * 100)
            if percentage == 0:
                continue
            total_hours = round(weight / 60, 1)
            result.append({
                "genre": genre,
                "percentage": percentage,
                "color": colors[len(result) % len(colors)],
                "total_hours": total_hours,
                "game_count": genre_game_counts.get(genre, 0)
            })

        return Response(result)

    @action(detail=True, methods=['get'], url_path='recommended-games')
    def recommended_games(self, request, username=None):
        user = self.get_object()
        if not self._check_private_access(user, request):
            return Response({"error": "This account is private."}, status=status.HTTP_403_FORBIDDEN)
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

        # Fallback — a user who has already played/reviewed every unplayed game matching
        # their own top genres would otherwise see an empty shelf with no explanation.
        if not recommended.exists():
            recommended = Game.objects.exclude(id__in=all_played_ids).order_by('?')[:20]

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
        if not self._check_private_access(user, request):
            return Response({"error": "This account is private."}, status=status.HTTP_403_FORBIDDEN)
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
        if not self._check_private_access(user, request):
            return Response({"error": "This account is private."}, status=status.HTTP_403_FORBIDDEN)
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
        from api.models import Follow, FollowRequest, Notification
        deleted_count, _ = Follow.objects.filter(follower=request.user, following=target_user).delete()
        
        if deleted_count == 0:
            # Check for a pending follow request
            req_deleted_count, _ = FollowRequest.objects.filter(sender=request.user, receiver=target_user).delete()
            if req_deleted_count > 0:
                # Remove follow request notification
                Notification.objects.filter(recipient=target_user, actor=request.user, verb='requested to follow you').delete()
                return Response({"message": "Follow request cancelled.", "status": "none", "is_following": False, "is_requested": False}, status=status.HTTP_200_OK)
            return Response({"error": "You are not following this user."}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({"message": f"You have unfollowed {target_user.username}", "status": "none", "is_following": False, "is_requested": False}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='approve-request', permission_classes=[permissions.IsAuthenticated])
    def approve_request(self, request, username=None):
        sender = self.get_object()
        from api.models import FollowRequest, Follow, Notification
        try:
            follow_req = FollowRequest.objects.get(sender=sender, receiver=request.user)
        except FollowRequest.DoesNotExist:
            return Response({"error": "Follow request not found."}, status=status.HTTP_404_NOT_FOUND)
        
        Follow.objects.get_or_create(follower=sender, following=request.user)
        follow_req.delete()
        
        # Delete notification
        Notification.objects.filter(recipient=request.user, actor=sender, verb='requested to follow you').delete()
        
        # Notify the sender that their request was approved
        Notification.objects.create(
            recipient=sender,
            actor=request.user,
            verb='accepted your follow request'
        )
        
        return Response({"message": f"Approved follow request from {sender.username}."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject-request', permission_classes=[permissions.IsAuthenticated])
    def reject_request(self, request, username=None):
        sender = self.get_object()
        from api.models import FollowRequest, Notification
        try:
            follow_req = FollowRequest.objects.get(sender=sender, receiver=request.user)
        except FollowRequest.DoesNotExist:
            return Response({"error": "Follow request not found."}, status=status.HTTP_404_NOT_FOUND)
        
        follow_req.delete()
        
        # Delete notification
        Notification.objects.filter(recipient=request.user, actor=sender, verb='requested to follow you').delete()
        
        return Response({"message": f"Rejected follow request from {sender.username}."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='follow-requests', permission_classes=[permissions.IsAuthenticated])
    def follow_requests(self, request):
        from api.models import FollowRequest
        requests_qs = FollowRequest.objects.filter(receiver=request.user).select_related('sender')
        senders = [req.sender for req in requests_qs]
        serializer = self.get_serializer(senders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def block(self, request, username=None):
        target_user = self.get_object()
        if request.user == target_user:
            return Response({"error": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)
        
        from api.models import Block, Follow, FollowRequest, Notification
        block_instance, created = Block.objects.get_or_create(blocker=request.user, blocked=target_user)
        if not created:
            return Response({"message": "You have already blocked this user."}, status=status.HTTP_200_OK)
            
        # Clean up follows, follow requests, and follow request notifications when blocking
        Follow.objects.filter(follower=request.user, following=target_user).delete()
        Follow.objects.filter(follower=target_user, following=request.user).delete()
        FollowRequest.objects.filter(sender=request.user, receiver=target_user).delete()
        FollowRequest.objects.filter(sender=target_user, receiver=request.user).delete()
        
        Notification.objects.filter(recipient=target_user, actor=request.user, verb='requested to follow you').delete()
        Notification.objects.filter(recipient=request.user, actor=target_user, verb='requested to follow you').delete()
        
        return Response({"message": f"Blocked {target_user.username} successfully."}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unblock(self, request, username=None):
        target_user = self.get_object()
        from api.models import Block
        deleted_count, _ = Block.objects.filter(blocker=request.user, blocked=target_user).delete()
        if deleted_count == 0:
            return Response({"error": "You have not blocked this user."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": f"Unblocked {target_user.username} successfully."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='blocked-users', permission_classes=[permissions.IsAuthenticated])
    def blocked_users(self, request):
        from api.models import Block
        blocked_relations = Block.objects.filter(blocker=request.user).select_related('blocked')
        blocked_users_list = [relation.blocked for relation in blocked_relations]
        serializer = self.get_serializer(blocked_users_list, many=True)
        return Response(serializer.data)

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
    throttle_scope = 'register'

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
            traceback.print_exc()  # full detail stays in server logs only
            return Response({
                'error': 'Registration processing failed. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyEmailView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'verify_email'

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        code = request.data.get('code')

        if not email or not code:
            return Response({'error': 'Email and verification code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Uniform error for every failure case so callers can't tell "already verified"
        # from "no such pending" from "wrong code" — that distinction leaks which emails
        # are registered (enumeration).
        GENERIC_ERROR = 'Invalid or expired verification code.'

        # Look up pending registration
        pending = PendingRegistration.objects.filter(email=email).first()
        if not pending:
            return Response({'error': GENERIC_ERROR}, status=status.HTTP_400_BAD_REQUEST)

        if pending.is_expired():
            pending.delete()
            return Response({'error': GENERIC_ERROR}, status=status.HTTP_400_BAD_REQUEST)

        if pending.code != str(code).strip():
            # Lock out brute force (even from distributed IPs) after N wrong codes.
            pending.failed_attempts += 1
            if pending.failed_attempts >= PendingRegistration.MAX_VERIFY_ATTEMPTS:
                pending.delete()
            else:
                pending.save(update_fields=['failed_attempts'])
            return Response({'error': GENERIC_ERROR}, status=status.HTTP_400_BAD_REQUEST)

        # Success! Extract registration data and create user
        data = pending.registration_data
        
        # Clean up legacy inactive users with same email or username (if any)
        username = data.get('username')

        try:
            with transaction.atomic():
                # Only clean up leftover *unverified* accounts — never delete an already
                # active user that happens to collide (registration validation prevents
                # active collisions, but this stays safe if that invariant ever slips).
                if email:
                    User.objects.filter(email=email, is_active=False).delete()
                if username:
                    User.objects.filter(username=username, is_active=False).delete()

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
            traceback.print_exc()  # full detail stays in server logs only
            return Response({
                'error': 'Registration processing failed. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Login user immediately by generating auth token
        token, created = Token.objects.get_or_create(user=user)
        response = Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email,
            'username': user.username,
            'message': 'Email verified and account created successfully.'
        }, status=status.HTTP_200_OK)
        return set_auth_cookie(response, token.key)


class ResendVerificationView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'resend_verification'

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')

        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Only actually send when a pending registration exists, but always return the
        # same response so this endpoint can't be used to probe which emails are registered.
        pending = PendingRegistration.objects.filter(email=email).first()
        if pending:
            code = PendingRegistration.generate_code()
            pending.code = code
            pending.expires_at = timezone.now() + timedelta(minutes=5)
            pending.failed_attempts = 0  # fresh code, fresh attempt budget
            pending.save()
            # Send Email (async - does not block response)
            send_verification_email(email, code)

        return Response(
            {'message': 'If a pending registration exists for this email, a new code has been sent.'},
            status=status.HTTP_200_OK,
        )


from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CurrentUserView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class LogoutView(generics.GenericAPIView):
    """Clear the httpOnly auth cookie for the current browser session.

    Only the browser cookie is cleared; the DRF token itself is left intact so that
    header-based clients (mobile / other devices) sharing the token stay logged in.

    Deliberately runs with no authentication: the endpoint only deletes a cookie from the
    caller's own browser, so it needs no identity. Authenticating here would make logout
    fail (401) for exactly the case that needs it most — an expired or revoked token —
    leaving an httpOnly cookie the frontend cannot delete itself. That strands the user,
    because the Next.js middleware gates routes on the cookie's presence. Being
    auth-exempt also makes logout idempotent and safe to call defensively on a 401.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        response = Response({'detail': 'Logged out.'}, status=status.HTTP_200_OK)
        return clear_auth_cookie(response)

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

    @action(detail=False, methods=['get'], url_path='hidden-gems')
    def hidden_gems(self, request):
        from django.db.models import Avg, Count
        # High average rating but low review count or library entries
        gems = Game.objects.annotate(
            avg_rating=Avg('reviews__rating'),
            rev_count=Count('reviews')
        ).filter(rev_count__gt=0, rev_count__lte=5, avg_rating__gte=7).order_by('-avg_rating', '?')[:10]
        
        if not gems.exists():
            # Fallback if no specific data
            gems = Game.objects.annotate(
                rev_count=Count('reviews')
            ).filter(rev_count__lte=5).order_by('?')[:10]
            
        result = []
        for g in gems:
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
                "avg_rating": getattr(g, 'avg_rating', 0)
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

    @action(detail=False, methods=['get'], url_path='global-search')
    def global_search(self, request):
        """GET /api/games/global-search/?q=Rockstar"""
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response([])

        # 1. Search Local Games (with some fuzzy matching or icontains)
        local_games = Game.objects.filter(Q(title__icontains=query))[:5]
        from api.serializers import GameSerializer
        games_data = GameSerializer(local_games, many=True, context={'request': request}).data
        
        # Tag them
        for g in games_data:
            g['result_type'] = 'game'

        # 2. Search IGDB Companies
        from api.services.igdb_service import search_igdb_companies
        companies_data = search_igdb_companies(query, limit=5)
        for c in companies_data:
            c['result_type'] = 'company'

        # 3. Combine and return
        combined = list(games_data) + list(companies_data)
        return Response(combined)

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
        
        # Exclude reviews from blocked/blocking users and private profiles (unless authorized)
        request = self.request
        from django.db.models import Q
        if request and request.user.is_authenticated:
            from api.models import Block
            blocked_ids = Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
            blocker_ids = Block.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
            queryset = queryset.exclude(user_id__in=blocked_ids).exclude(user_id__in=blocker_ids)
            
            following_ids = list(request.user.following.values_list('following_id', flat=True))
            private_ids = User.objects.filter(
                is_private=True
            ).exclude(id__in=following_ids).exclude(id=request.user.id).values_list('id', flat=True)
            queryset = queryset.exclude(user_id__in=private_ids)
        else:
            private_ids = User.objects.filter(
                is_private=True
            ).values_list('id', flat=True)
            queryset = queryset.exclude(user_id__in=private_ids)
        
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

    def _sync_library_status(self, review):
        """Sync LibraryEntry status based on review is_completed flag, and ensure logged games are in the library."""
        from api.models import LibraryEntry
        
        entry, created = LibraryEntry.objects.get_or_create(
            user=review.user,
            game=review.game,
            defaults={
                'status': 'completed' if review.is_completed else 'playing',
                'platform': 'Manual'
            }
        )
        
        if review.is_completed and entry.status != 'completed':
            entry.status = 'completed'
            entry.save(update_fields=['status'])
        elif not review.is_completed and entry.status == 'completed':
            entry.status = 'playing'
            entry.save(update_fields=['status'])

    def perform_create(self, serializer):
        review = serializer.save(user=self.request.user)
        self._sync_library_status(review)

    def perform_update(self, serializer):
        review = serializer.save()
        self._sync_library_status(review)


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
        
        # Exclude posts from blocked/blocking users and private profiles (unless authorized)
        request = self.request
        from django.db.models import Q
        if request and request.user.is_authenticated:
            from api.models import Block
            blocked_ids = Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
            blocker_ids = Block.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
            queryset = queryset.exclude(user_id__in=blocked_ids).exclude(user_id__in=blocker_ids)
            
            following_ids = list(request.user.following.values_list('following_id', flat=True))
            private_ids = User.objects.filter(
                is_private=True
            ).exclude(id__in=following_ids).exclude(id=request.user.id).values_list('id', flat=True)
            queryset = queryset.exclude(Q(user_id__in=private_ids) & Q(project_parent__isnull=True))
        else:
            private_ids = User.objects.filter(
                is_private=True
            ).values_list('id', flat=True)
            queryset = queryset.exclude(Q(user_id__in=private_ids) & Q(project_parent__isnull=True))
            
        username = self.request.query_params.get('username', None)
        parent_id = self.request.query_params.get('parent', None)

        if username is not None:
            queryset = queryset.filter(user__username=username, project_parent__isnull=True)
        
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

        organisation_slug = self.request.query_params.get('organisation_slug', None)
        if organisation_slug:
            queryset = queryset.filter(project_parent__organisation__slug=organisation_slug)

        manageable = self.request.query_params.get('manageable', None)
        if manageable == 'true' and self.request.user.is_authenticated:
            user = self.request.user
            queryset = queryset.filter(
                Q(project_parent__owner=user) |
                Q(project_parent__members__user=user, project_parent__members__status='active') |
                Q(project_parent__organisation__members__user=user, project_parent__organisation__members__role__in=['owner', 'admin'])
            ).distinct()

        return queryset

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                logger.info("Post creation validation error: %s", serializer.errors)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception:
            # Full traceback goes to structured logging (picked up by any log aggregator) —
            # never returned to clients.
            logger.exception("Error creating post for user %s", request.user.pk)
            return Response({"error": "Failed to create post. Please try again."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_create(self, serializer):
        project_parent = serializer.validated_data.get('project_parent')
        author_identity = serializer.validated_data.get('author_identity', 'user')
        user = self.request.user

        if project_parent:
            # Check if authorized to post a devlog under this project
            is_authorized = (project_parent.owner == user or 
                             project_parent.members.filter(user=user, role__in=['editor', 'admin']).exists())
            
            if not is_authorized and project_parent.organisation:
                is_authorized = project_parent.organisation.members.filter(user=user).exists()
                
            if not is_authorized:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to post a devlog for this project.")
                
            # Check author identity constraints
            if author_identity == 'organisation':
                if not project_parent.organisation:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({"author_identity": "This project does not belong to an organisation."})
                
                # Must be owner/admin of the organisation to post as organisation
                is_org_admin = project_parent.organisation.members.filter(user=user, role__in=['owner', 'admin']).exists()
                if not is_org_admin:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Only organisation owners or admins can post as the organisation.")
                    
            elif author_identity == 'project':
                # Must be project owner/admin or org owner/admin to post as project
                is_proj_admin = (project_parent.owner == user or 
                                 project_parent.members.filter(user=user, role='admin').exists() or 
                                 (project_parent.organisation and 
                                  project_parent.organisation.members.filter(user=user, role__in=['owner', 'admin']).exists()))
                if not is_proj_admin:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Only project admins or organisation admins can post as the project.")
        else:
            if author_identity != 'user':
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"author_identity": "Can only post as user when not linking to a project parent."})
        # Check block restrictions for interactions (reply, quote repost, comments)
        repost_parent = serializer.validated_data.get('repost_parent')
        parent = serializer.validated_data.get('parent')
        review_parent = serializer.validated_data.get('review_parent')
        
        target_author = None
        if repost_parent:
            target_author = repost_parent.user
        elif parent:
            target_author = parent.user
        elif review_parent:
            target_author = review_parent.user
            
        if target_author:
            from api.models import Block
            if Block.objects.filter(blocker=self.request.user, blocked=target_author).exists() or \
               Block.objects.filter(blocker=target_author, blocked=self.request.user).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Cannot interact with this post due to block restrictions.")
                
        category = self.request.data.get('category')
        post_kwargs = {}
        if category:
            post_kwargs['category'] = category
            
        post = serializer.save(user=self.request.user, **post_kwargs)
        
        # Calculate auto-category and trending score
        from api.services.categorize import auto_categorize_post, calculate_trending_score
        if not category:
            post.category = auto_categorize_post(post)
        post.trending_score = calculate_trending_score(post)
        post.save()
        
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
        from api.models import ConversationMember
        # Return conversations where user is participant and status not in declined/left/blocked
        member_conversations = ConversationMember.objects.filter(
            user=self.request.user
        ).exclude(status__in=['declined', 'left', 'blocked']).values_list('conversation_id', flat=True)

        qs = Conversation.objects.filter(id__in=member_conversations).order_by('-updated_at')

        # Backfill any legacy conversations missing this user's membership row — previously this
        # ran a get_or_create per conversation on every single list request (an N+1 that alone
        # could account for ~200 queries on a 200-conversation inbox); now it's one existence
        # check per legacy conversation, and zero once every membership exists (the normal case).
        conv_ids = list(qs.values_list('id', flat=True))
        if conv_ids:
            existing_ids = set(ConversationMember.objects.filter(
                conversation_id__in=conv_ids, user=self.request.user
            ).values_list('conversation_id', flat=True))
            missing_ids = [cid for cid in conv_ids if cid not in existing_ids]
            for cid in missing_ids:
                ConversationMember.objects.get_or_create(conversation_id=cid, user=self.request.user)

        # Annotate last-message fields and unread count via correlated subqueries/aggregation
        # instead of letting the serializer query obj.messages per conversation (was 2 extra
        # queries per row — get_last_message + get_unread_count — on top of the base query).
        from django.db.models import OuterRef, Subquery, Count, Q
        last_msg_qs = Message.objects.filter(conversation=OuterRef('pk')).order_by('-created_at')
        qs = qs.annotate(
            ann_last_content=Subquery(last_msg_qs.values('content')[:1]),
            ann_last_created_at=Subquery(last_msg_qs.values('created_at')[:1]),
            ann_last_sender=Subquery(last_msg_qs.values('sender__username')[:1]),
            ann_last_is_deleted=Subquery(last_msg_qs.values('is_deleted')[:1]),
            ann_unread_count=Count(
                'messages',
                filter=Q(messages__is_read=False) & ~Q(messages__sender=self.request.user),
                distinct=True,
            ),
        )

        return qs.prefetch_related('members__user', 'members__invited_by', 'participants')

    @action(detail=False, methods=['post'])
    def start_chat(self, request):
        username = request.data.get('username')
        if not username:
            return Response({"error": "Username is required"}, status=400)
        
        target_user = get_object_or_404(User, username=username)
        
        if target_user == request.user:
            return Response({"error": "Cannot chat with yourself"}, status=400)

        # Check block relationships
        from api.models import Block
        if Block.objects.filter(blocker=request.user, blocked=target_user).exists() or \
           Block.objects.filter(blocker=target_user, blocked=request.user).exists():
            return Response({"error": "Cannot message this user due to block restrictions."}, status=status.HTTP_403_FORBIDDEN)

        # Check if conversation exists (complex query for exact participants)
        conversations = Conversation.objects.filter(is_group=False).filter(participants=request.user).filter(participants=target_user)
        
        if conversations.exists():
            conversation = conversations.first()
        else:
            conversation = Conversation.objects.create(is_group=False)
            conversation.participants.add(request.user, target_user)
            conversation.save()
            
        # Ensure memberships exist and are accepted
        member1, _ = ConversationMember.objects.get_or_create(conversation=conversation, user=request.user)
        member2, _ = ConversationMember.objects.get_or_create(conversation=conversation, user=target_user)
        member1.status = 'accepted'
        member1.save()
        member2.status = 'accepted'
        member2.save()
        
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
        
        # Create memberships - creator is accepted admin, others are pending invited
        ConversationMember.objects.create(conversation=conversation, user=request.user, is_admin=True, status='accepted')
        for u in users:
            ConversationMember.objects.create(conversation=conversation, user=u, is_admin=False, status='pending', invited_by=request.user)
            
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
        blocked_users = []
        for u in users:
            member_qs = ConversationMember.objects.filter(conversation=conversation, user=u)
            if member_qs.exists():
                member = member_qs.first()
                if member.status == 'blocked':
                    blocked_users.append(u.username)
                    continue
                elif member.status == 'accepted':
                    continue
                else:
                    member.status = 'pending'
                    member.invited_by = request.user
                    member.save()
            else:
                ConversationMember.objects.create(
                    conversation=conversation,
                    user=u,
                    status='pending',
                    invited_by=request.user
                )
            if u not in conversation.participants.all():
                conversation.participants.add(u)
            added_users.append(u.username)
                
        conversation.save()
        res_data = {'status': 'success', 'added_members': added_users}
        if blocked_users:
            res_data['blocked_members'] = blocked_users
        return Response(res_data)

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
        member = ConversationMember.objects.filter(conversation=conversation, user=request.user).first()
        if member:
            member.status = 'left'
            member.save()
        
        # If no participants left, delete conversation
        if conversation.participants.count() == 0:
            conversation.delete()
            return Response({'status': 'deleted', 'message': 'Group deleted as it has no participants'})
            
        # If the user leaving was the only admin, appoint another participant as admin
        elif not ConversationMember.objects.filter(conversation=conversation, is_admin=True, status='accepted').exists():
            first_member = ConversationMember.objects.filter(conversation=conversation, status='accepted').first()
            if first_member:
                first_member.is_admin = True
                first_member.save()
                
        conversation.save()
        return Response({'status': 'success', 'message': 'You left the group'})

    @action(detail=True, methods=['post'], url_path='accept-invite')
    def accept_invite(self, request, pk=None):
        conversation = self.get_object()
        member = get_object_or_404(ConversationMember, conversation=conversation, user=request.user)
        if member.status != 'pending':
            return Response({"error": "No pending invite for this conversation"}, status=400)
        member.status = 'accepted'
        member.save()
        if request.user not in conversation.participants.all():
            conversation.participants.add(request.user)
            conversation.save()
        return Response({"status": "success", "message": "Joined the conversation"})

    @action(detail=True, methods=['post'], url_path='decline-invite')
    def decline_invite(self, request, pk=None):
        conversation = self.get_object()
        member = get_object_or_404(ConversationMember, conversation=conversation, user=request.user)
        if member.status != 'pending':
            return Response({"error": "No pending invite for this conversation"}, status=400)
        member.status = 'declined'
        member.save()
        conversation.participants.remove(request.user)
        conversation.save()
        return Response({"status": "success", "message": "Declined group invitation"})

    @action(detail=True, methods=['post'], url_path='block-group')
    def block_group(self, request, pk=None):
        conversation = self.get_object()
        if not conversation.is_group:
            return Response({"error": "Cannot block group in direct messages. Use block-user instead."}, status=400)
        member, created = ConversationMember.objects.get_or_create(conversation=conversation, user=request.user)
        member.status = 'blocked'
        member.save()
        conversation.participants.remove(request.user)
        conversation.save()
        return Response({"status": "success", "message": "Blocked group"})

    @action(detail=True, methods=['post'], url_path='unblock-group')
    def unblock_group(self, request, pk=None):
        conversation = self.get_object()
        member = get_object_or_404(ConversationMember, conversation=conversation, user=request.user)
        if member.status != 'blocked':
            return Response({"error": "Group is not blocked"}, status=400)
        member.status = 'declined'
        member.save()
        return Response({"status": "success", "message": "Group unblocked"})

    @action(detail=True, methods=['post'], url_path='block-user')
    def block_user(self, request, pk=None):
        conversation = self.get_object()
        if conversation.is_group:
            return Response({"error": "Cannot block user in group chat settings"}, status=400)
        other_user = conversation.participants.exclude(id=request.user.id).first()
        if not other_user:
            return Response({"error": "No other user found"}, status=400)
        
        from api.models import BlockedUser
        blocked_user, created = BlockedUser.objects.get_or_create(blocker=request.user, blocked=other_user)
        return Response({"status": "success", "message": f"Blocked user {other_user.username}"})

    @action(detail=True, methods=['post'], url_path='unblock-user')
    def unblock_user(self, request, pk=None):
        conversation = self.get_object()
        if conversation.is_group:
            return Response({"error": "Cannot unblock user in group chat settings"}, status=400)
        other_user = conversation.participants.exclude(id=request.user.id).first()
        if not other_user:
            return Response({"error": "No other user found"}, status=400)
        
        from api.models import BlockedUser
        BlockedUser.objects.filter(blocker=request.user, blocked=other_user).delete()
        return Response({"status": "success", "message": f"Unblocked user {other_user.username}"})

    @action(detail=True, methods=['post'], url_path='report')
    def report(self, request, pk=None):
        conversation = self.get_object()
        reason = request.data.get('reason')
        if not reason:
            return Response({"error": "Reason is required"}, status=400)
        
        from api.models import ConversationReport
        ConversationReport.objects.create(conversation=conversation, reported_by=request.user, reason=reason)
        return Response({"status": "success", "message": "Conversation reported"})

    @action(detail=True, methods=['get'], url_path='media')
    def shared_media(self, request, pk=None):
        conversation = self.get_object()
        messages = conversation.messages.filter(
            Q(image__isnull=False) | Q(gif_url__isnull=False)
        ).exclude(image='').order_by('-created_at')
        
        from api.serializers import MessageSerializer
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='pinned')
    def pinned_messages(self, request, pk=None):
        conversation = self.get_object()
        messages = conversation.messages.filter(is_pinned=True).order_by('-created_at')
        from api.serializers import MessageSerializer
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='search-messages')
    def search_messages(self, request, pk=None):
        conversation = self.get_object()
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        messages = conversation.messages.filter(content__icontains=query).order_by('-created_at')
        from api.serializers import MessageSerializer
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        conversation = self.get_object()
        if conversation.is_group:
            user_membership = get_object_or_404(ConversationMember, conversation=conversation, user=request.user)
            if not user_membership.is_admin:
                return Response({"error": "Only group admins can delete the group"}, status=403)
            conversation.delete()
            return Response({"status": "success", "message": "Group deleted successfully"})
        else:
            member = ConversationMember.objects.filter(conversation=conversation, user=request.user).first()
            if member:
                member.status = 'declined'
                member.save()
            return Response({"status": "success", "message": "Chat deleted successfully"})

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
        if not conversation_id:
            return Response({'results': [], 'has_more': False})

        if request.query_params.get('pinned') == 'true':
            pinned_qs = self.filter_queryset(self.get_queryset()).filter(
                is_pinned=True
            ).order_by('pinned_at')
            serializer = self.get_serializer(pinned_qs, many=True)
            return Response({'results': serializer.data, 'has_more': False})

        # Full-history search — the in-conversation search box used to filter only the
        # ~30 messages already loaded client-side (a correctness regression once the main
        # list became paginated), so it now searches the whole conversation server-side.
        search_query = request.query_params.get('search')
        if search_query:
            matched_qs = self.filter_queryset(self.get_queryset()).filter(
                content__icontains=search_query
            ).order_by('-created_at')[:50]
            serializer = self.get_serializer(matched_qs, many=True)
            return Response({'results': serializer.data, 'has_more': False})

        # Jump to an arbitrary message (e.g. from a search result) that may not be in the
        # currently-loaded page — returns a window of messages around it so the frontend
        # can render it in place, like tapping a search hit in WhatsApp.
        around_id = request.query_params.get('around_id')
        if around_id:
            queryset = self.filter_queryset(self.get_queryset())
            target = queryset.filter(id=around_id).first()
            if not target:
                return Response({'results': [], 'has_more': False})
            before_full_qs = queryset.filter(id__lt=around_id)
            before_page = list(before_full_qs.order_by('-created_at')[:15])
            after_page = list(queryset.filter(id__gt=around_id).order_by('created_at')[:15])
            combined = list(reversed(before_page)) + [target] + after_page
            has_more = before_full_qs.count() > len(before_page)
            serializer = self.get_serializer(combined, many=True)
            return Response({'results': serializer.data, 'has_more': has_more})

        # Mark unread messages from other users as read
        Message.objects.filter(
            conversation_id=conversation_id,
            is_read=False
        ).exclude(sender=request.user).update(is_read=True)

        # Bounded pagination — a chat's full history used to be refetched on every single
        # 3-second poll (unbounded, ever-growing payload). Three modes, all ordered oldest-
        # to-newest in the response:
        #   - neither param: latest `limit` messages (initial load)
        #   - before_id: the `limit` messages immediately preceding before_id ("load earlier")
        #   - after_id: only messages newer than after_id (polling delta, no history refetch)
        queryset = self.filter_queryset(self.get_queryset())
        try:
            limit = int(request.query_params.get('limit', 30))
        except (TypeError, ValueError):
            limit = 30
        after_id = request.query_params.get('after_id')
        before_id = request.query_params.get('before_id')

        if after_id:
            newer = queryset.filter(id__gt=after_id)
            serializer = self.get_serializer(newer, many=True)
            return Response({'results': serializer.data, 'has_more': False})

        if before_id:
            older_qs = queryset.filter(id__lt=before_id)
            page = list(older_qs.order_by('-created_at')[:limit])
            has_more = older_qs.count() > len(page)
            serializer = self.get_serializer(list(reversed(page)), many=True)
            return Response({'results': serializer.data, 'has_more': has_more})

        total_count = queryset.count()
        page = list(queryset.order_by('-created_at')[:limit])
        has_more = total_count > len(page)
        serializer = self.get_serializer(list(reversed(page)), many=True)
        return Response({'results': serializer.data, 'has_more': has_more})

    def perform_create(self, serializer):
        conversation = serializer.validated_data['conversation']
        if self.request.user not in conversation.participants.all():
            raise permissions.PermissionDenied("You are not a participant in this conversation.")
        
        # Check if current user is pending invite
        membership = conversation.members.filter(user=self.request.user).first()
        if membership and membership.status == 'pending':
            raise permissions.PermissionDenied("You must accept the group invitation first.")
            
        # Check if conversation is a 1-on-1 direct message and has a block relationship
        if not conversation.is_group:
            other_participants = conversation.participants.exclude(id=self.request.user.id)
            from api.models import Block
            from django.db.models import Q
            if Block.objects.filter(
                Q(blocker=self.request.user, blocked__in=other_participants) |
                Q(blocker__in=other_participants, blocked=self.request.user)
            ).exists():
                raise permissions.PermissionDenied("You cannot send messages to this conversation due to block restrictions.")
        
        # File validations
        image = self.request.FILES.get('image')
        if image:
            if image.size > 10 * 1024 * 1024:
                from rest_framework.exceptions import ValidationError
                raise ValidationError("File size must be less than 10MB.")
            ext = image.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                from rest_framework.exceptions import ValidationError
                raise ValidationError("Unsupported file format. Allowed formats: jpg, jpeg, png, gif, webp.")
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

    # Matches the WhatsApp pin model: at most 3 pinned messages per conversation —
    # pinning a 4th evicts whichever pin is oldest (by pinned_at, not by when the
    # message itself was originally sent).
    MAX_PINNED_MESSAGES = 3

    @action(detail=True, methods=['post'], url_path='pin')
    def pin(self, request, pk=None):
        message = self.get_object()
        evicted_message_id = None

        if message.is_pinned:
            message.is_pinned = False
            message.pinned_at = None
            message.save(update_fields=['is_pinned', 'pinned_at'])
        else:
            message.is_pinned = True
            message.pinned_at = timezone.now()
            message.save(update_fields=['is_pinned', 'pinned_at'])

            pinned_qs = Message.objects.filter(
                conversation=message.conversation, is_pinned=True
            ).order_by('pinned_at')
            if pinned_qs.count() > self.MAX_PINNED_MESSAGES:
                oldest = pinned_qs.first()
                evicted_message_id = oldest.id
                oldest.is_pinned = False
                oldest.pinned_at = None
                oldest.save(update_fields=['is_pinned', 'pinned_at'])

        serializer = self.get_serializer(message)
        return Response({
            "status": "success",
            "is_pinned": message.is_pinned,
            "message": serializer.data,
            "evicted_message_id": evicted_message_id,
        })

    @action(detail=True, methods=['post'], url_path='edit')
    def edit(self, request, pk=None):
        message = self.get_object()
        if message.sender != request.user:
            return Response({"error": "Only the sender can edit this message"}, status=403)
        
        import datetime
        from django.utils import timezone
        if timezone.now() - message.created_at > datetime.timedelta(minutes=15):
            return Response({"error": "Time limit of 15 minutes to edit this message has expired"}, status=400)
            
        content = request.data.get('content', '').strip()
        if not content:
            return Response({"error": "Content cannot be empty"}, status=400)
        if len(content) > 5000:
            return Response({"error": "Message content exceeds limit"}, status=400)
            
        message.content = content
        message.is_edited = True
        message.edited_at = timezone.now()
        message.save()
        
        serializer = self.get_serializer(message)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        message = self.get_object()
        if message.sender != request.user:
            return Response({"error": "Only the sender can edit this message"}, status=403)
        
        import datetime
        from django.utils import timezone
        if timezone.now() - message.created_at > datetime.timedelta(minutes=15):
            return Response({"error": "Time limit of 15 minutes to edit this message has expired"}, status=400)
            
        content = request.data.get('content', '').strip()
        if not content:
            return Response({"error": "Content cannot be empty"}, status=400)
        if len(content) > 5000:
            return Response({"error": "Message content exceeds limit"}, status=400)
            
        message.content = content
        message.is_edited = True
        message.edited_at = timezone.now()
        message.save()
        
        serializer = self.get_serializer(message)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        message = self.get_object()
        if message.sender != request.user:
            return Response({"error": "Only the sender can delete this message"}, status=403)
        message.is_deleted = True
        message.content = "This message was deleted"
        message.save()
        return Response({"status": "success", "message": "Message deleted"})

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

    def get_queryset(self):
        queryset = LibraryEntry.objects.all().select_related('game', 'user')
        # Exclude library entries from blocked/blocking users and private profiles (unless authorized)
        request = self.request
        from django.db.models import Q
        if request and request.user.is_authenticated:
            from api.models import Block
            blocked_ids = Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
            blocker_ids = Block.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
            queryset = queryset.exclude(user_id__in=blocked_ids).exclude(user_id__in=blocker_ids)
            
            following_ids = list(request.user.following.values_list('following_id', flat=True))
            private_ids = User.objects.filter(
                is_private=True
            ).exclude(id__in=following_ids).exclude(id=request.user.id).values_list('id', flat=True)
            queryset = queryset.exclude(user_id__in=private_ids)
        else:
            private_ids = User.objects.filter(
                is_private=True
            ).values_list('id', flat=True)
            queryset = queryset.exclude(user_id__in=private_ids)
        return queryset

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
        playtest_feedback_id = request.data.get('playtest_feedback')

        # Check block restrictions before liking content
        target_author = None
        if post_id:
            from core.models import Post
            post = Post.objects.filter(id=post_id).first()
            if post:
                target_author = post.user
        elif review_id:
            from core.models import Review
            review = Review.objects.filter(id=review_id).first()
            if review:
                target_author = review.user

        if target_author:
            from api.models import Block
            if Block.objects.filter(blocker=user, blocked=target_author).exists() or \
               Block.objects.filter(blocker=target_author, blocked=user).exists():
                return Response({"error": "Cannot like content from this user due to block restrictions."}, status=status.HTTP_403_FORBIDDEN)

        existing = Like.objects.filter(user=user, post_id=post_id, review_id=review_id, news_id=news_id, playtest_feedback_id=playtest_feedback_id).first()
        
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
        # Scope to rosters the requester can actually see: projects they own, are a
        # member of, or whose organisation they belong to. Without this, any authenticated
        # user could enumerate every project's membership/roles (and retrieve any row by id).
        from django.db.models import Q
        user = self.request.user
        queryset = ProjectMember.objects.filter(
            Q(project__owner=user)
            | Q(project__members__user=user)
            | Q(project__organisation__members__user=user)
        ).distinct()
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

        if target_user == user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You can't invite yourself.")

        if target_user == project.owner:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("The project owner already has full access and can't be invited.")

        if not serializer.validated_data.get('custom_role'):
            from rest_framework.exceptions import ValidationError
            raise ValidationError("A role must be selected.")

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
        if serializer.instance.user_id == project.owner_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("The project owner's access can't be changed here.")
        serializer.save()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        instance = self.get_object()
        if instance.user != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only accept your own invites.")

        instance.status = 'active'
        instance.save()

        # A project always belongs to its organisation as a whole, not just to whichever members
        # happen to have their own org-level invite — so accepting a project invite implicitly
        # joins that organisation too, at a fixed base 'member' level regardless of the project
        # role picked (the project role only ever controls project-scoped access, never org-wide
        # standing). No-op if they're already an org member (any role).
        if instance.project.organisation_id:
            from .permission_catalog import create_default_roles
            member_role = create_default_roles(instance.project.organisation)['member']
            OrganisationMember.objects.get_or_create(
                organisation=instance.project.organisation,
                user=instance.user,
                defaults={'role': 'member', 'custom_role': member_role},
            )

        from api.models import Notification
        from django.contrib.contenttypes.models import ContentType

        # Resolve (and stop offering Accept/Decline on) the "invited you" notification. Without
        # this, an already-active member could hit stale Accept/Decline buttons on the old
        # notification — Decline would unconditionally delete their now-active membership.
        Notification.objects.filter(
            recipient=instance.user,
            target_type=ContentType.objects.get_for_model(ProjectMember),
            target_id=instance.id,
        ).delete()

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
        invitee = instance.user

        if invitee == project.owner:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("The project owner can't be removed from their own project.")

        if invitee != user:
            if project.owner != user and not project.members.filter(user=user, role='admin').exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only project admins can remove members.")

        from api.models import Notification
        from django.contrib.contenttypes.models import ContentType
        Notification.objects.filter(
            recipient=invitee,
            target_type=ContentType.objects.get_for_model(ProjectMember),
            target_id=instance.id,
        ).delete()

        instance.delete()

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().select_related('owner').order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, ProjectAccessPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'tech_stack']
    filterset_fields = ['status', 'organisation']
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
            
        organisation_slug = self.request.query_params.get('organisation_slug', None)
        if organisation_slug:
            queryset = queryset.filter(organisation__slug=organisation_slug)
            
        manageable = self.request.query_params.get('manageable', None)
        if manageable == 'true' and self.request.user.is_authenticated:
            from django.db.models import Q
            user = self.request.user
            queryset = queryset.filter(
                Q(owner=user) |
                Q(members__user=user, members__status='active') |
                Q(organisation__members__user=user, organisation__members__role__in=['owner', 'admin'])
            ).distinct()

        return queryset

    def perform_create(self, serializer):
        organisation_id = self.request.data.get('organisation')
        if organisation_id:
            org = get_object_or_404(Organisation, id=organisation_id)
            if not org.members.filter(user=self.request.user, role__in=['owner', 'admin']).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to create projects for this organisation.")
            project = serializer.save(owner=self.request.user, organisation=org)
            from api.permission_catalog import create_default_project_roles
            create_default_project_roles(project)
        else:
            serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        if 'organisation' in self.request.data:
            org_id = self.request.data.get('organisation')
            if org_id:
                org = get_object_or_404(Organisation, id=org_id)
                if not org.members.filter(user=self.request.user, role__in=['owner', 'admin']).exists():
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You do not have permission to assign projects to this organisation.")
        serializer.save()

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
        
        exclude_ids = set()
        if user.is_authenticated:
            from api.models import Block
            exclude_ids = set(Block.objects.filter(blocker=user).values_list('blocked_id', flat=True))
            exclude_ids.update(Block.objects.filter(blocked=user).values_list('blocker_id', flat=True))
            
            # Exclude private profiles the user does not follow, unless it's their own profile
            following_ids = list(user.following.values_list('following_id', flat=True))
            private_ids = User.objects.filter(
                is_private=True
            ).exclude(id__in=following_ids).exclude(id=user.id).values_list('id', flat=True)
            exclude_ids.update(private_ids)
        else:
            private_ids = User.objects.filter(
                is_private=True
            ).values_list('id', flat=True)
            exclude_ids.update(private_ids)

        # Precompute engagement counts in the query (single subquery each) so the scoring loop
        # and the serializer don't fire a per-item .count() — the N+1 that made this endpoint
        # issue hundreds of queries per request.
        from .serializers import count_subquery
        post_anns = dict(
            likes_count_ann=count_subquery(Like, 'post'),
            replies_count_ann=count_subquery(Post, 'parent'),
            reposts_count_ann=count_subquery(Post, 'repost_parent', content=''),
            bookmarks_count_ann=count_subquery(Bookmark, 'post'),
        )
        review_anns = dict(
            likes_count_ann=count_subquery(Like, 'review'),
            replies_count_ann=count_subquery(Post, 'review_parent'),
            bookmarks_count_ann=count_subquery(Bookmark, 'review'),
        )

        # select_related('user') alone still leaves the author's M2M interests (UserSerializer's
        # StringRelatedField) and each post's media set to be fetched with one query per item —
        # prefetch both so the whole feed resolves those in 2 queries total, not 2 per item.
        post_prefetch = ('user__interests', 'media')
        review_prefetch = ('user__interests',)

        posts = Post.objects.filter(
            parent__isnull=True,
            review_parent__isnull=True,
            news_parent__isnull=True,
            timestamp__gte=time_limit
        )
        if exclude_ids:
            posts = posts.exclude(user_id__in=exclude_ids)
        posts = posts.select_related('user').prefetch_related(*post_prefetch).annotate(**post_anns).order_by('-timestamp')[:80]

        if posts.count() < 40:
            posts = Post.objects.filter(
                parent__isnull=True,
                review_parent__isnull=True,
                news_parent__isnull=True
            )
            if exclude_ids:
                posts = posts.exclude(user_id__in=exclude_ids)
            posts = posts.select_related('user').prefetch_related(*post_prefetch).annotate(**post_anns).order_by('-timestamp')[:80]

        reviews = Review.objects.filter(timestamp__gte=time_limit)
        if exclude_ids:
            reviews = reviews.exclude(user_id__in=exclude_ids)
        reviews = reviews.select_related('user', 'game').prefetch_related(*review_prefetch).annotate(**review_anns).order_by('-timestamp')[:80]

        if reviews.count() < 40:
            reviews = Review.objects.all()
            if exclude_ids:
                reviews = reviews.exclude(user_id__in=exclude_ids)
            reviews = reviews.select_related('user', 'game').prefetch_related(*review_prefetch).annotate(**review_anns).order_by('-timestamp')[:80]

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
            
            # Social / Engagement factor (read the annotations set above; no per-item queries)
            likes = getattr(item, 'likes_count_ann', 0) or 0
            replies = getattr(item, 'replies_count_ann', 0) or 0

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

        from api.models import Block
        exclude_ids = set(Block.objects.filter(blocker=user).values_list('blocked_id', flat=True))
        exclude_ids.update(Block.objects.filter(blocked=user).values_list('blocker_id', flat=True))

        followed_users_ids = user.following.values_list('following_id', flat=True)
        if exclude_ids:
            followed_users_ids = [uid for uid in followed_users_ids if uid not in exclude_ids]
        
        # Annotate engagement counts so the serializers below read them instead of firing a
        # per-item .count() (see for_you / count_subquery).
        from .serializers import count_subquery
        posts = Post.objects.filter(
            user_id__in=followed_users_ids,
            parent__isnull=True,
            review_parent__isnull=True,
            news_parent__isnull=True
        ).select_related('user').prefetch_related('user__interests', 'media').annotate(
            likes_count_ann=count_subquery(Like, 'post'),
            replies_count_ann=count_subquery(Post, 'parent'),
            reposts_count_ann=count_subquery(Post, 'repost_parent', content=''),
            bookmarks_count_ann=count_subquery(Bookmark, 'post'),
        ).order_by('-timestamp')[:50]

        reviews = Review.objects.filter(user_id__in=followed_users_ids).select_related('user', 'game').prefetch_related('user__interests').annotate(
            likes_count_ann=count_subquery(Like, 'review'),
            replies_count_ann=count_subquery(Post, 'review_parent'),
            bookmarks_count_ann=count_subquery(Bookmark, 'review'),
        ).order_by('-timestamp')[:50]
        
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

class OrganisationViewSet(viewsets.ModelViewSet):
    queryset = Organisation.objects.all().order_by('-created_at')
    serializer_class = OrganisationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, OrganisationAccessPermission]
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'slug', 'description']

    def get_queryset(self):
        queryset = Organisation.objects.all().order_by('-created_at')
        member_only = self.request.query_params.get('member', None)
        if member_only == 'true' and self.request.user.is_authenticated:
            queryset = queryset.filter(members__user=self.request.user)
        return queryset

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        try:
            obj = get_object_or_404(queryset, **filter_kwargs)
        except Exception:
            if self.kwargs[lookup_url_kwarg].isdigit():
                obj = get_object_or_404(queryset, id=int(self.kwargs[lookup_url_kwarg]))
            else:
                raise
        # The base ModelViewSet.get_object() calls this automatically — this override replaced
        # that default (to add the slug-or-id fallback lookup above) but had been skipping the
        # object-level permission check ever since, silently letting OrganisationAccessPermission
        # never actually run for update/destroy requests.
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        from api.serializers import RESERVED_USERNAMES
        name = self.request.data.get('name', '')
        slug = self.request.data.get('slug', '').strip().lower()
        
        if not slug:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"slug": "Slug is required."})
            
        if slug in RESERVED_USERNAMES:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"slug": "This slug is reserved."})
            
        if User.objects.filter(username__iexact=slug).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"slug": "This name is taken by a user account."})
            
        with transaction.atomic():
            organisation = serializer.save()
            OrganisationMember.objects.create(
                organisation=organisation,
                user=self.request.user,
                role='owner'
            )
            from .permission_catalog import create_default_roles
            create_default_roles(organisation)

    def destroy(self, request, *args, **kwargs):
        organisation = self.get_object()
        # Projects survive org deletion (Project.organisation is on_delete=SET_NULL), but their
        # WorkspaceState rows are FK'd to the organisation with on_delete=CASCADE — without this
        # step every surviving project would silently lose its entire Kanban/GDD/Asset workspace
        # data the instant the org is deleted. Migrate each project's row to the same solo-project
        # key format _project_workspace_state() already uses for orgless projects, before the
        # organisation (and its CASCADE-linked rows) is actually removed.
        from core.models import WorkspaceState
        for project in organisation.projects.all():
            old_key = f"workspace__org_{organisation.id}_board_project_{project.id}"
            new_key = f"workspace__solo_board_project_{project.id}"
            old_state = WorkspaceState.objects.filter(key=old_key, organisation=organisation).first()
            if not old_state:
                continue
            if WorkspaceState.objects.filter(key=new_key, user_id=project.owner_id).exclude(pk=old_state.pk).exists():
                # A solo-scoped row already exists at the destination (shouldn't normally happen
                # for a still-org-linked project, but guard against violating the unique
                # constraint rather than crashing the whole deletion).
                old_state.delete()
            else:
                old_state.key = new_key
                old_state.organisation = None
                old_state.user_id = project.owner_id
                old_state.save(update_fields=['key', 'organisation', 'user'])
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, slug=None):
        organisation = self.get_object()
        follow_obj, created = OrganisationFollow.objects.get_or_create(user=request.user, organisation=organisation)
        if not created:
            return Response({"message": "Already following this organisation."}, status=status.HTTP_200_OK)
        return Response({"message": f"Now following {organisation.name}"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, slug=None):
        organisation = self.get_object()
        deleted_count, _ = OrganisationFollow.objects.filter(user=request.user, organisation=organisation).delete()
        if deleted_count == 0:
            return Response({"error": "You are not following this organisation."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": f"Unfollowed {organisation.name}"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def invite(self, request, slug=None):
        organisation = self.get_object()
        if not organisation.members.filter(user=request.user, role__in=['owner', 'admin']).exists():
            return Response({"error": "You do not have permission to invite members."}, status=status.HTTP_403_FORBIDDEN)
            
        user_id = request.data.get('user_id')
        role = request.data.get('role', 'member')
        custom_role_id = request.data.get('custom_role')

        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not custom_role_id:
            return Response({"error": "A role must be selected."}, status=status.HTTP_400_BAD_REQUEST)

        custom_role = Role.objects.filter(id=custom_role_id, organisation=organisation, project__isnull=True).first()
        if not custom_role:
            return Response({"error": "Invalid role for this organisation."}, status=status.HTTP_400_BAD_REQUEST)
        if custom_role.is_default_for == 'owner':
            return Response({"error": "The Owner role can't be assigned through an invite."}, status=status.HTTP_400_BAD_REQUEST)

        target_user = get_object_or_404(User, id=user_id)

        if target_user == request.user:
            return Response({"error": "You can't invite yourself."}, status=status.HTTP_400_BAD_REQUEST)

        if organisation.members.filter(user=target_user).exists():
            return Response({"error": "User is already a member of this organisation."}, status=status.HTTP_400_BAD_REQUEST)

        # update_or_create reuses the same row/id if this user was previously invited (even if
        # declined/inactive) instead of colliding with the (organisation, user) unique constraint —
        # this both fixes re-inviting after a decline and keeps a stable target_id for notifications.
        invitation, _ = OrganisationInvitation.objects.update_or_create(
            organisation=organisation,
            user=target_user,
            defaults={'role': role, 'custom_role': custom_role, 'invited_by': request.user, 'is_active': True}
        )

        from django.contrib.contenttypes.models import ContentType
        content_type = ContentType.objects.get_for_model(invitation.__class__)
        Notification.objects.get_or_create(
            recipient=target_user,
            actor=request.user,
            verb=f'invited you to join {organisation.name}',
            target_type=content_type,
            target_id=invitation.id
        )

        return Response(OrganisationInvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='transfer-ownership')
    def transfer_ownership(self, request, slug=None):
        organisation = self.get_object()
        current_owner_membership = organisation.members.filter(user=request.user, role='owner').first()
        if not current_owner_membership:
            return Response({"error": "Only the current owner can transfer ownership."}, status=status.HTTP_403_FORBIDDEN)

        new_owner_user_id = request.data.get('new_owner_user_id')
        if not new_owner_user_id:
            return Response({"error": "new_owner_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if str(new_owner_user_id) == str(request.user.id):
            return Response({"error": "You're already the owner."}, status=status.HTTP_400_BAD_REQUEST)

        new_owner_membership = organisation.members.filter(user_id=new_owner_user_id).first()
        if not new_owner_membership:
            return Response({"error": "That user is not a member of this organisation."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            current_owner_membership.role = 'admin'
            current_owner_membership.custom_role = None
            current_owner_membership.save()

            new_owner_membership.role = 'owner'
            new_owner_membership.custom_role = None
            new_owner_membership.save()

            from django.contrib.contenttypes.models import ContentType
            org_content_type = ContentType.objects.get_for_model(organisation.__class__)
            Notification.objects.create(
                recipient=new_owner_membership.user,
                actor=request.user,
                verb=f'transferred ownership of {organisation.name} to you',
                target_type=org_content_type,
                target_id=organisation.id
            )
            Notification.objects.create(
                recipient=request.user,
                actor=request.user,
                verb=f'transferred ownership of {organisation.name} to {new_owner_membership.user.username}',
                target_type=org_content_type,
                target_id=organisation.id
            )

        return Response({"message": f"Ownership transferred to @{new_owner_membership.user.username}."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def projects(self, request, slug=None):
        organisation = self.get_object()
        projects = organisation.projects.all().order_by('-created_at')
        from .serializers import ProjectSerializer
        serializer = ProjectSerializer(projects, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def devlogs(self, request, slug=None):
        organisation = self.get_object()
        from core.models import Post
        from .serializers import PostSerializer
        posts = Post.objects.filter(project_parent__organisation=organisation, parent__isnull=True).order_by('-timestamp')
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)


class OrganisationMemberViewSet(viewsets.ModelViewSet):
    queryset = OrganisationMember.objects.all()
    serializer_class = OrganisationMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Scope to organisations the requester belongs to, so members/roles of arbitrary
        # organisations can't be enumerated or retrieved by id.
        user = self.request.user
        queryset = OrganisationMember.objects.filter(
            organisation__members__user=user
        ).distinct()
        organisation_id = self.request.query_params.get('organisation')
        if organisation_id:
            queryset = queryset.filter(organisation_id=organisation_id)
        return queryset

    def perform_create(self, serializer):
        # Without this guard any authenticated user could POST themselves (or anyone) straight
        # into any organisation as admin/owner — the serializer exposes organisation/user_id/role
        # as writable. Membership additions must go through an org owner/admin, mirroring the
        # privileged OrganisationViewSet.invite action and ProjectMemberViewSet.perform_create.
        from rest_framework.exceptions import PermissionDenied, ValidationError
        organisation = serializer.validated_data['organisation']
        if not organisation.members.filter(user=self.request.user, role__in=['owner', 'admin']).exists():
            raise PermissionDenied("Only organisation owners and admins can add members.")

        # Ownership is only ever granted via the transfer-ownership action, never by creating a row.
        if serializer.validated_data.get('role') == 'owner':
            raise ValidationError("Use the ownership transfer action to make someone the owner.")
        custom_role = serializer.validated_data.get('custom_role')
        if custom_role and custom_role.is_default_for == 'owner':
            raise ValidationError("The Owner role can't be assigned directly. Use ownership transfer instead.")

        target_user = serializer.validated_data['user']
        if organisation.members.filter(user=target_user).exists():
            raise ValidationError("This user is already a member of the organisation.")

        serializer.save()

    def update(self, request, *args, **kwargs):
        member = self.get_object()
        requesting_member = member.organisation.members.filter(user=request.user).first()
        if not requesting_member or requesting_member.role not in ['owner', 'admin']:
            return Response({"error": "Only admins and owners can modify member roles."}, status=status.HTTP_403_FORBIDDEN)

        # Ownership can only change via the dedicated transfer-ownership action (owner-only,
        # confirmation-gated) — not this generic endpoint, which any admin can otherwise reach.
        if member.role == 'owner':
            return Response({"error": "The owner's role can't be changed here. Use ownership transfer instead."}, status=status.HTTP_400_BAD_REQUEST)
        if request.data.get('role') == 'owner':
            return Response({"error": "Use the ownership transfer action to make someone the owner."}, status=status.HTTP_400_BAD_REQUEST)
        custom_role_id = request.data.get('custom_role')
        if custom_role_id:
            target_role = Role.objects.filter(id=custom_role_id).first()
            if target_role and target_role.is_default_for == 'owner':
                return Response({"error": "The Owner role can't be assigned directly. Use ownership transfer instead."}, status=status.HTTP_400_BAD_REQUEST)

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        member = self.get_object()
        if member.role == 'owner':
            return Response({"error": "Cannot delete the owner of an organisation. Transfer ownership first."}, status=status.HTTP_400_BAD_REQUEST)
            
        requesting_member = member.organisation.members.filter(user=request.user).first()
        if not requesting_member:
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
            
        if member.user != request.user and requesting_member.role not in ['owner', 'admin']:
            return Response({"error": "Only admins and owners can remove members."}, status=status.HTTP_403_FORBIDDEN)

        # An organisation's projects are implicitly available to all its members (mirrors
        # ProjectMemberViewSet.accept's auto-join the other way round) — so leaving/being removed
        # from the organisation must also remove them from every project under it. Otherwise
        # they'd keep project-level access (and show up in project rosters) via a membership the
        # UI has no way to reach or explain anymore.
        ProjectMember.objects.filter(project__organisation=member.organisation, user=member.user).delete()

        return super().destroy(request, *args, **kwargs)


class OrganisationInvitationViewSet(viewsets.ModelViewSet):
    queryset = OrganisationInvitation.objects.all()
    serializer_class = OrganisationInvitationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = OrganisationInvitation.objects.all()
        organisation_slug = self.request.query_params.get('organisation_slug', None)
        if organisation_slug:
            from django.shortcuts import get_object_or_404
            from core.models import Organisation
            from rest_framework.exceptions import PermissionDenied
            org = get_object_or_404(Organisation, slug=organisation_slug)
            if org.members.filter(user=self.request.user, role__in=['owner', 'admin']).exists():
                return queryset.filter(organisation=org, is_active=True).order_by('-created_at')
            else:
                raise PermissionDenied("You do not have permission to view invitations for this organisation.")
        # Without an explicit organisation_slug (e.g. a plain DELETE/accept/decline on a detail URL),
        # make both "invitations sent to me" and "invitations I can manage as an org owner/admin"
        # reachable — previously this only included the former, so an org admin cancelling an
        # invite they sent (dashboard's DELETE /organisation-invitations/{id}/, no query params)
        # would 404 before even reaching the destroy() permission check.
        from django.db.models import Q
        return queryset.filter(
            Q(user=self.request.user) |
            Q(organisation__members__user=self.request.user, organisation__members__role__in=['owner', 'admin']),
            is_active=True,
        ).distinct().order_by('-created_at')

    def perform_create(self, serializer):
        # Same class of hole as OrganisationMemberViewSet: without this, a user could POST an
        # invitation to themselves with role='admin' and then accept it. Only org owners/admins
        # may create invitations, and invited_by is always the requester (never client-supplied).
        from rest_framework.exceptions import PermissionDenied, ValidationError
        organisation = serializer.validated_data['organisation']
        if not organisation.members.filter(user=self.request.user, role__in=['owner', 'admin']).exists():
            raise PermissionDenied("Only organisation owners and admins can invite members.")

        if serializer.validated_data.get('role') == 'owner':
            raise ValidationError("The Owner role can't be assigned through an invite. Use ownership transfer instead.")
        custom_role = serializer.validated_data.get('custom_role')
        if custom_role and custom_role.is_default_for == 'owner':
            raise ValidationError("The Owner role can't be assigned through an invite.")

        target_user = serializer.validated_data['user']
        if target_user == self.request.user:
            raise ValidationError("You can't invite yourself.")
        if organisation.members.filter(user=target_user).exists():
            raise ValidationError("This user is already a member of the organisation.")

        serializer.save(invited_by=self.request.user, is_active=True)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        invitation = self.get_object()
        if invitation.user != request.user:
            return Response({"error": "This invitation was not sent to you."}, status=status.HTTP_403_FORBIDDEN)
            
        from django.contrib.contenttypes.models import ContentType
        content_type = ContentType.objects.get_for_model(OrganisationInvitation)

        with transaction.atomic():
            member, created = OrganisationMember.objects.get_or_create(
                organisation=invitation.organisation,
                user=request.user,
                defaults={'role': invitation.role, 'custom_role': invitation.custom_role}
            )
            invitation.is_active = False
            invitation.save()

            OrganisationFollow.objects.get_or_create(user=request.user, organisation=invitation.organisation)

            # Resolve (and stop offering Accept/Decline on) the "invited you" notification —
            # mirrors FollowRequest.approve_request's cleanup of its own pending-request notification.
            Notification.objects.filter(
                recipient=invitation.user, target_type=content_type, target_id=invitation.id
            ).delete()

            Notification.objects.create(
                recipient=invitation.invited_by,
                actor=request.user,
                verb=f'accepted your invitation to join {invitation.organisation.name}',
                target=invitation,
            )

        return Response({"message": f"Successfully joined {invitation.organisation.name}."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        invitation = self.get_object()
        if invitation.user != request.user:
            return Response({"error": "This invitation was not sent to you."}, status=status.HTTP_403_FORBIDDEN)

        invitation.is_active = False
        invitation.save()

        from django.contrib.contenttypes.models import ContentType
        Notification.objects.filter(
            recipient=invitation.user,
            target_type=ContentType.objects.get_for_model(OrganisationInvitation),
            target_id=invitation.id,
        ).delete()

        return Response({"message": "Invitation declined."}, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        invitation = self.get_object()
        is_invitee = invitation.user == request.user
        is_org_admin = invitation.organisation.members.filter(user=request.user, role__in=['owner', 'admin']).exists()
        if not is_invitee and not is_org_admin:
            return Response({"error": "You do not have permission to delete this invitation."}, status=status.HTTP_403_FORBIDDEN)

        from django.contrib.contenttypes.models import ContentType
        Notification.objects.filter(
            recipient=invitation.user,
            target_type=ContentType.objects.get_for_model(OrganisationInvitation),
            target_id=invitation.id,
        ).delete()

        return super().destroy(request, *args, **kwargs)


from core.models import Role
from .serializers import RoleSerializer
from .permission_catalog import PERMISSION_CATALOG
from .permissions_service import get_effective_permissions, user_has_permission


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        # Only roles for organisations/projects the requester actually belongs to are visible.
        # Without this scoping, any authenticated user could enumerate every organisation's role
        # names, descriptions and exact granular permission sets (list or retrieve-by-id).
        queryset = Role.objects.filter(
            Q(organisation__members__user=user)
            | Q(project__members__user=user)
            | Q(project__owner=user)
            | Q(project__organisation__members__user=user)
        ).distinct()
        project_id = self.request.query_params.get('project')
        organisation_id = self.request.query_params.get('organisation')
        if project_id:
            # Project-scoped roles are their own separate catalog — never mixed with
            # the organisation's own roles, even when the project belongs to an org.
            queryset = queryset.filter(project_id=project_id)
        elif organisation_id:
            queryset = queryset.filter(organisation_id=organisation_id, project__isnull=True)
        return queryset

    def _require_manage_permission(self, organisation, project=None):
        if not user_has_permission(self.request.user, 'team.role.manage', organisation=organisation, project=project):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to manage roles for this scope.")

    def _require_owner(self, organisation):
        if not organisation.members.filter(user=self.request.user, role='owner').exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the organisation owner can edit the Owner role.")

    def perform_create(self, serializer):
        organisation = serializer.validated_data.get('organisation')
        project = serializer.validated_data.get('project')
        self._require_manage_permission(organisation, project=project)
        serializer.save(is_system=False, is_default_for='')

    def perform_update(self, serializer):
        role = serializer.instance
        self._require_manage_permission(role.organisation, project=role.project)
        if role.is_default_for == 'owner':
            # The Owner role is the only system role that's fully locked: anyone with plain
            # team.role.manage (today: every admin too, since Owner/Admin share the same
            # seeded permission set) could otherwise silently strip/grant owner-level access
            # via this role's permissions, or rename it in a way that breaks the "this org's
            # Owner role" lookup elsewhere. Admin/Member may be freely renamed and
            # have their permissions edited — is_default_for (not name) is what the rest of the
            # system actually keys off of, so renaming them is safe.
            self._require_owner(role.organisation)
            from rest_framework.exceptions import ValidationError
            serializer.validated_data.pop('name', None)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manage_permission(instance.organisation, project=instance.project)
        if instance.is_system:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("System roles cannot be deleted.")

        # Role selection is mandatory everywhere else in this system, so deleting a role must
        # never leave anyone without one — reassign affected members to this scope's baseline
        # "Member" role instead of nulling custom_role out (this scope always has one: Member is
        # a system role that can't itself be deleted).
        from .permission_catalog import create_default_roles, create_default_project_roles
        fallback_roles = create_default_project_roles(instance.project) if instance.project_id else create_default_roles(instance.organisation)
        fallback_role = fallback_roles['member']
        OrganisationMember.objects.filter(custom_role=instance).update(custom_role=fallback_role)
        ProjectMember.objects.filter(custom_role=instance).update(custom_role=fallback_role)
        OrganisationInvitation.objects.filter(custom_role=instance, is_active=True).update(custom_role=fallback_role)

        instance.delete()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def permission_catalog_view(request):
    from .permission_catalog import PERMISSION_HIERARCHY
    return Response({"catalog": PERMISSION_CATALOG, "hierarchy": PERMISSION_HIERARCHY})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_permissions_view(request):
    organisation = None
    project = None
    org_id = request.query_params.get('organisation')
    project_id = request.query_params.get('project')
    if org_id:
        from core.models import Organisation
        organisation = get_object_or_404(Organisation, id=org_id)
    if project_id:
        from core.models import Project
        project = get_object_or_404(Project, id=project_id)
        if organisation is None:
            organisation = project.organisation

    perms = get_effective_permissions(request.user, organisation=organisation, project=project)
    if perms is None:
        return Response({"role": None, "permissions": []})

    role = None
    if organisation is not None:
        member = None
        if project is not None:
            member = project.members.filter(user=request.user, status='active').first()
        if member is None:
            member = organisation.members.filter(user=request.user).first()
        if member and member.custom_role_id:
            role = {"id": member.custom_role.id, "name": member.custom_role.name, "is_system": member.custom_role.is_system}

    return Response({"role": role, "permissions": perms})


from core.models import WorkspaceState
from .serializers import WorkspaceStateSerializer

def _parse_org_workspace_key(key):
    """
    Parses 'workspace__org_<org_id>_board_org' or
    'workspace__org_<org_id>_board_project_<project_id>' into (org_id, project_id).
    Raises ValueError on malformed keys.
    """
    import re
    match = re.match(r'^workspace__org_(\d+)_board_(.+)$', key)
    if not match:
        raise ValueError("Malformed org workspace key.")
    org_id = int(match.group(1))
    board = match.group(2)
    project_id = int(board[len('project_'):]) if board.startswith('project_') else None
    return org_id, project_id


def _check_org_board_access(org, project_id, user):
    """
    Coarse membership gate for an org-scoped WorkspaceState key. Org owners/admins
    may access every board in their org (mirrors ProjectViewSet's manageable-filter
    precedent). Plain members may access the org-root board, but a project-specific
    board additionally requires actual membership on that project — closing a prior
    gap where any org member could write to a project's board without being on it.
    """
    if org.members.filter(user=user, role__in=['owner', 'admin']).exists():
        return True
    if not org.members.filter(user=user).exists():
        return False
    if project_id is None:
        return True
    from core.models import Project
    project = Project.objects.filter(id=project_id).first()
    if project is None:
        return True
    return project.owner_id == user.id or project.members.filter(user=user, status='active').exists()


def _parse_solo_project_key(key):
    """Return the project id for a non-org (personal) project board key, else None.

    Format: 'workspace__solo_board_project_<project_id>' — note there is NO per-user
    suffix: a project board is shared by all its members and always stored under the
    project owner's WorkspaceState row (the canonical row), so every member reads/writes
    the same board instead of a per-viewer copy.
    """
    import re
    match = re.match(r'^workspace__solo_board_project_(\d+)$', key)
    return int(match.group(1)) if match else None


def _check_solo_project_access(project, user):
    """Membership gate for a non-org project board: owner or active project member."""
    return project.owner_id == user.id or project.members.filter(user=user, status='active').exists()


def _project_workspace_state(project):
    """
    Get-or-creates the WorkspaceState row backing a project's Kanban board (and everything else
    in its Devs workspace), using the exact same key format the frontend's storageKey() builds —
    see _parse_org_workspace_key above for the org-linked half of this format.
    """
    if project.organisation_id:
        key = f"workspace__org_{project.organisation_id}_board_project_{project.id}"
        obj, _ = WorkspaceState.objects.get_or_create(key=key, organisation_id=project.organisation_id, user=None, defaults={'data': {}})
    else:
        # Shared, owner-canonical row (no per-user suffix) so all project members see the
        # same board — see _parse_solo_project_key.
        key = f"workspace__solo_board_project_{project.id}"
        obj, _ = WorkspaceState.objects.get_or_create(key=key, user_id=project.owner_id, organisation=None, defaults={'data': {}})
    return obj


def _versioned_workspace_upsert(*, key, data, base_version, user=None, organisation=None, user_id=None):
    """Upsert a WorkspaceState row with optimistic-concurrency protection.

    Returns (obj, conflict). If base_version is provided and doesn't match the stored row's
    version, nothing is written and conflict=True — the caller returns 409 with the current
    state so the client reconciles instead of silently clobbering a teammate's change on a
    shared board. When base_version is None the write proceeds unconditionally (legacy
    last-write-wins), so older clients that don't send a version keep working. The read-modify-
    write runs under select_for_update so concurrent writers serialise rather than race.
    """
    identity = {'key': key, 'organisation': organisation}
    if user_id is not None:
        identity['user_id'] = user_id
    else:
        identity['user'] = user

    with transaction.atomic():
        obj = WorkspaceState.objects.select_for_update().filter(**identity).first()
        if obj is None:
            obj = WorkspaceState.objects.create(data=data, version=1, **identity)
            return obj, False
        if base_version is not None and base_version != obj.version:
            return obj, True
        obj.data = data
        obj.version = obj.version + 1
        obj.save()
        return obj, False


class WorkspaceStateViewSet(viewsets.ModelViewSet):
    queryset = WorkspaceState.objects.all()
    serializer_class = WorkspaceStateSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'key'
    lookup_value_regex = '[^/]+'
    # Only GET (read) and POST (guarded create) are allowed. PUT/PATCH/DELETE are removed
    # because those verbs bypassed the granular TOOL_WRITE_PERMISSIONS check that only
    # create() enforces, letting a view-only member overwrite or wipe the whole board blob.
    # All writes must go through create().
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        from django.db.models import Q
        return WorkspaceState.objects.filter(
            Q(user=user) |
            Q(organisation__members__user=user)
        ).distinct()

    def get_object(self):
        key = self.kwargs.get('key')
        user = self.request.user

        if key.startswith('workspace__org_'):
            try:
                org_id, project_id = _parse_org_workspace_key(key)
                from core.models import Organisation
                from django.shortcuts import get_object_or_404
                from rest_framework.exceptions import PermissionDenied

                org = get_object_or_404(Organisation, id=org_id)
                if not _check_org_board_access(org, project_id, user):
                    raise PermissionDenied("You do not have access to this organization's workspace.")

                # Do not create rows on read (GET must not mutate). Return an unsaved,
                # empty instance when the key doesn't exist yet; writes go through create().
                obj = WorkspaceState.objects.filter(key=key, organisation=org, user=None).first()
                if obj is None:
                    obj = WorkspaceState(key=key, organisation=org, user=None, data={})
                return obj
            except ValueError:
                from rest_framework.exceptions import ValidationError
                raise ValidationError("Invalid workspace key format.")
        else:
            solo_project_id = _parse_solo_project_key(key)
            if solo_project_id is not None:
                from core.models import Project
                from django.shortcuts import get_object_or_404
                from rest_framework.exceptions import PermissionDenied
                project = get_object_or_404(Project, id=solo_project_id)
                if not _check_solo_project_access(project, user):
                    raise PermissionDenied("You do not have access to this project's workspace.")
                # Canonical owner row shared by all members (do not create on read).
                obj = WorkspaceState.objects.filter(key=key, user_id=project.owner_id, organisation=None).first()
                if obj is None:
                    obj = WorkspaceState(key=key, user_id=project.owner_id, organisation=None, data={})
                return obj

            obj = WorkspaceState.objects.filter(key=key, user=user, organisation=None).first()
            if obj is None:
                obj = WorkspaceState(key=key, user=user, organisation=None, data={})
            return obj

    def create(self, request, *args, **kwargs):
        key = request.data.get('key')
        data = request.data.get('data')
        tool = request.data.get('tool')
        if not key:
            return Response({"error": "key is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Optimistic-concurrency token (the version the client last loaded). Optional so older
        # clients that omit it fall back to last-write-wins; malformed values are ignored.
        base_version = request.data.get('base_version')
        try:
            base_version = int(base_version) if base_version is not None else None
        except (TypeError, ValueError):
            base_version = None

        def conflict_response(obj):
            return Response(
                {
                    "error": "conflict",
                    "detail": "This board was updated by someone else. Reload before saving.",
                    "current": self.get_serializer(obj).data,
                },
                status=status.HTTP_409_CONFLICT,
            )

        user = request.user
        if key.startswith('workspace__org_'):
            try:
                org_id, project_id = _parse_org_workspace_key(key)
                from core.models import Organisation, Project
                from django.shortcuts import get_object_or_404

                org = get_object_or_404(Organisation, id=org_id)
                if not _check_org_board_access(org, project_id, user):
                    return Response({"error": "You do not have access to this organization's workspace."}, status=status.HTTP_403_FORBIDDEN)

                if tool:
                    from .permission_catalog import TOOL_WRITE_PERMISSIONS
                    from .permissions_service import user_has_any_permission
                    write_perms = TOOL_WRITE_PERMISSIONS.get(tool)
                    project = Project.objects.filter(id=project_id).first() if project_id else None
                    if write_perms and not user_has_any_permission(user, write_perms, organisation=org, project=project):
                        return Response({"error": f"You do not have permission to modify {tool}."}, status=status.HTTP_403_FORBIDDEN)

                obj, conflict = _versioned_workspace_upsert(
                    key=key, data=data, base_version=base_version, organisation=org, user=None,
                )
                if conflict:
                    return conflict_response(obj)
            except ValueError:
                return Response({"error": "Invalid workspace key format."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            solo_project_id = _parse_solo_project_key(key)
            if solo_project_id is not None:
                from core.models import Project
                from django.shortcuts import get_object_or_404
                project = get_object_or_404(Project, id=solo_project_id)
                if not _check_solo_project_access(project, user):
                    return Response({"error": "You do not have access to this project's workspace."}, status=status.HTTP_403_FORBIDDEN)

                if tool:
                    from .permission_catalog import TOOL_WRITE_PERMISSIONS
                    from .permissions_service import user_has_any_permission
                    write_perms = TOOL_WRITE_PERMISSIONS.get(tool)
                    if write_perms and not user_has_any_permission(user, write_perms, organisation=None, project=project):
                        return Response({"error": f"You do not have permission to modify {tool}."}, status=status.HTTP_403_FORBIDDEN)

                # Write to the canonical owner row so all members share one board.
                obj, conflict = _versioned_workspace_upsert(
                    key=key, data=data, base_version=base_version, user_id=project.owner_id, organisation=None,
                )
                if conflict:
                    return conflict_response(obj)
            else:
                obj, conflict = _versioned_workspace_upsert(
                    key=key, data=data, base_version=base_version, user=user, organisation=None,
                )
                if conflict:
                    return conflict_response(obj)

        serializer = self.get_serializer(obj)
        return Response(serializer.data, status=status.HTTP_200_OK)


from core.models import PlaytestFeedback
from .serializers import PlaytestFeedbackSerializer


# Mirrors frontend/src/components/devs/WorkspaceTypes.ts's DEFAULT_COLUMNS — a WorkspaceState
# row with no 'columns' key is treated by the frontend as "not yet loaded" and silently ignored
# in its entirety (see WorkspaceContext.tsx's `if (backendData && backendData.columns?.length)`
# load guard), so convert_to_task must seed real columns before a fresh project's board has ever
# been opened, or the task it just wrote would never actually appear in the Kanban board.
_DEFAULT_KANBAN_COLUMNS = [
    {'id': 'backlog', 'label': 'Backlog', 'color': 'border-zinc-700/50', 'dotColor': 'bg-zinc-500', 'isDefault': True},
    {'id': 'inProgress', 'label': 'In Progress', 'color': 'border-blue-500/30', 'dotColor': 'bg-blue-500', 'isDefault': True, 'wipLimit': 3},
    {'id': 'review', 'label': 'Review', 'color': 'border-amber-500/30', 'dotColor': 'bg-amber-500', 'isDefault': True, 'wipLimit': 2},
    {'id': 'done', 'label': 'Done', 'color': 'border-emerald-500/30', 'dotColor': 'bg-emerald-500', 'isDefault': True},
]


class PlaytestFeedbackViewSet(viewsets.ModelViewSet):
    """
    Public, membership-free playtest feedback on a project — see core.models.PlaytestFeedback's
    docstring for why this is a real model rather than the generic WorkspaceState blob everything
    else in the Devs workspace uses. Anyone can read; any logged-in user can submit feedback for
    any project (no project/org membership required); only the author can edit/delete their own
    submission. Pinning, status changes, converting to (and pulling back from) a Kanban task, and
    deleting *other* people's feedback are each gated by their own granular 'feedback.*' permission
    (see api.permission_catalog) rather than one blanket manager flag.
    """
    queryset = PlaytestFeedback.objects.select_related('author', 'project').prefetch_related('likes').all()
    serializer_class = PlaytestFeedbackSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)

        status_filter = self.request.query_params.get('status')
        if status_filter == 'pinned':
            qs = qs.filter(is_pinned=True)
        elif status_filter in ('open', 'in_progress', 'resolved'):
            qs = qs.filter(status=status_filter)

        priority_filter = self.request.query_params.get('priority')
        if priority_filter in ('low', 'medium', 'high', 'urgent'):
            qs = qs.filter(priority=priority_filter)

        return qs

    def list(self, request, *args, **kwargs):
        # Reconcile against the Kanban board before serializing: a task can be deleted directly
        # from the Kanban board (a plain WorkspaceState blob edit the backend has no other hook
        # into), which would otherwise leave converted_task_id pointing at a task that no longer
        # exists — the feedback would show "In Kanban" forever with no way to convert it again.
        # This keeps both surfaces (Devs workspace and the public project page) self-healing
        # without either needing to know about the other's state.
        queryset = self.filter_queryset(self.get_queryset())
        feedback_list = self._reconcile_converted_tasks(queryset)
        page = self.paginate_queryset(feedback_list)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(feedback_list, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._reconcile_converted_tasks([instance])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def _reconcile_converted_tasks(self, feedback_iterable):
        feedback_list = list(feedback_iterable)
        by_project = {}
        for fb in feedback_list:
            if fb.converted_task_id:
                by_project.setdefault(fb.project_id, []).append(fb)
        for project_id, items in by_project.items():
            project = items[0].project
            workspace_state = _project_workspace_state(project)
            existing_task_ids = {t.get('id') for t in (workspace_state.data or {}).get('tasks', [])}
            for fb in items:
                if fb.converted_task_id not in existing_task_ids:
                    fb.converted_task_id = ''
                    fb.save(update_fields=['converted_task_id'])
        return feedback_list

    def perform_create(self, serializer):
        from django.utils import timezone
        serializer.save(author=self.request.user, submitted_at=timezone.now())

    def destroy(self, request, *args, **kwargs):
        # Deliberately bypasses self.get_object()'s automatic IsOwnerOrReadOnly check (which would
        # otherwise 403 a project manager deleting someone *else's* feedback) — the real rule here
        # is "author OR feedback.delete", checked explicitly below.
        from rest_framework.exceptions import PermissionDenied
        feedback = get_object_or_404(PlaytestFeedback, pk=kwargs.get('pk'))
        project = feedback.project
        is_author = feedback.author_id == request.user.id
        can_delete = user_has_permission(request.user, 'feedback.delete', organisation=project.organisation, project=project)
        if not (is_author or can_delete):
            raise PermissionDenied("You do not have permission to delete this feedback.")
        feedback.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _require_permission(self, request, feedback, perm_key):
        from rest_framework.exceptions import PermissionDenied
        project = feedback.project
        if not user_has_permission(request.user, perm_key, organisation=project.organisation, project=project):
            raise PermissionDenied("You do not have permission to do that.")

    @action(detail=True, methods=['post'], url_path='toggle-pin', permission_classes=[permissions.IsAuthenticated])
    def toggle_pin(self, request, pk=None):
        # Not gated by IsOwnerOrReadOnly — a manager pins feedback submitted by other people too.
        feedback = get_object_or_404(PlaytestFeedback, pk=pk)
        self._require_permission(request, feedback, 'feedback.pin')
        feedback.is_pinned = not feedback.is_pinned
        feedback.save(update_fields=['is_pinned'])
        return Response(PlaytestFeedbackSerializer(feedback, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='set-status', permission_classes=[permissions.IsAuthenticated])
    def set_status(self, request, pk=None):
        feedback = get_object_or_404(PlaytestFeedback, pk=pk)
        new_status = request.data.get('status')
        if new_status not in ('open', 'in_progress', 'resolved'):
            return Response({"error": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == 'in_progress':
            perm_key = 'feedback.mark_in_progress'
        elif new_status == 'resolved':
            perm_key = 'feedback.mark_resolved'
        else:
            # Reverting to 'open' undoes whichever status is currently set, so it's gated by
            # the same permission that set it in the first place.
            perm_key = 'feedback.mark_in_progress' if feedback.status == 'in_progress' else 'feedback.mark_resolved'
        self._require_permission(request, feedback, perm_key)
        feedback.status = new_status
        feedback.save(update_fields=['status'])
        return Response(PlaytestFeedbackSerializer(feedback, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='convert-to-task', permission_classes=[permissions.IsAuthenticated])
    def convert_to_task(self, request, pk=None):
        from django.utils import timezone
        import time as time_module

        feedback = get_object_or_404(PlaytestFeedback, pk=pk)
        self._require_permission(request, feedback, 'feedback.convert_to_task')
        if feedback.converted_task_id:
            return Response({"error": "This feedback has already been converted to a task."}, status=status.HTTP_400_BAD_REQUEST)

        project = feedback.project
        workspace_state = _project_workspace_state(project)
        data = workspace_state.data or {}
        if not data.get('columns'):
            data['columns'] = _DEFAULT_KANBAN_COLUMNS
        columns = data['columns']
        target_column = columns[0]
        target_column_id = target_column['id']

        tasks = data.setdefault('tasks', [])
        wip_limit = target_column.get('wipLimit')
        if wip_limit is not None:
            current_count = sum(1 for t in tasks if t.get('columnId') == target_column_id)
            if current_count >= wip_limit:
                column_label = target_column.get('label', target_column_id)
                return Response(
                    {"error": f"Cannot convert: the \"{column_label}\" column is full ({current_count}/{wip_limit}). Raise its WIP limit or move a task out first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        task_id = f"task-{int(time_module.time() * 1000)}"
        new_task = {
            'id': task_id,
            'title': f"[Feedback] {(feedback.title or feedback.description)[:60]}",
            'description': feedback.description,
            'priority': feedback.priority,
            'category': 'qa',
            'columnId': target_column_id,
            'subtasks': [],
            'comments': [],
            'createdAt': timezone.now().isoformat(),
        }
        tasks.append(new_task)
        workspace_state.data = data
        workspace_state.save(update_fields=['data'])

        feedback.converted_task_id = task_id
        feedback.save(update_fields=['converted_task_id'])
        return Response(PlaytestFeedbackSerializer(feedback, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='revert-task', permission_classes=[permissions.IsAuthenticated])
    def revert_task(self, request, pk=None):
        """Pulls a feedback item back out of Kanban: deletes the linked task from the board (if
        it's still there) and clears converted_task_id so it can be converted again."""
        feedback = get_object_or_404(PlaytestFeedback, pk=pk)
        self._require_permission(request, feedback, 'feedback.convert_to_task')
        if not feedback.converted_task_id:
            return Response({"error": "This feedback isn't in Kanban."}, status=status.HTTP_400_BAD_REQUEST)

        project = feedback.project
        workspace_state = _project_workspace_state(project)
        data = workspace_state.data or {}
        tasks = data.get('tasks', [])
        remaining_tasks = [t for t in tasks if t.get('id') != feedback.converted_task_id]
        if len(remaining_tasks) != len(tasks):
            data['tasks'] = remaining_tasks
            workspace_state.data = data
            workspace_state.save(update_fields=['data'])

        feedback.converted_task_id = ''
        feedback.save(update_fields=['converted_task_id'])
        return Response(PlaytestFeedbackSerializer(feedback, context={'request': request}).data, status=status.HTTP_200_OK)


class ExplorePostsViewSet(viewsets.ViewSet):
    """Explore posts with category filtering and trending sorting."""
    permission_classes = [permissions.AllowAny]
    
    def list(self, request):
        from core.models import Post
        from api.serializers import PostSerializer
        from django.utils import timezone
        from datetime import timedelta
        
        category = request.query_params.get('category', 'all')
        hashtag = request.query_params.get('hashtag', '').strip()
        ordering = request.query_params.get('ordering', 'popular')
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 20)), 50)
        
        from api.serializers import count_subquery
        from core.models import Like, Bookmark
        posts = Post.objects.filter(
            parent__isnull=True,
            review_parent__isnull=True,
            news_parent__isnull=True
        ).select_related('user').prefetch_related('user__interests', 'media').annotate(
            # Counts only, not the full related objects — prefetching the actual likes/replies/
            # reposts/bookmarks rows here fetched (and discarded) every row of engagement for
            # every post on the page, which is unbounded for a viral post. The serializer no
            # longer renders those relations, only their counts.
            likes_count_ann=count_subquery(Like, 'post'),
            replies_count_ann=count_subquery(Post, 'parent'),
            reposts_count_ann=count_subquery(Post, 'repost_parent', content=''),
            bookmarks_count_ann=count_subquery(Bookmark, 'post'),
        )
        
        if ordering == 'popular' or not ordering:
            cutoff = timezone.now() - timedelta(days=7)
            posts = posts.filter(timestamp__gte=cutoff)
            
        if category and category != 'all':
            posts = posts.filter(category=category)
            
        if hashtag:
            if hashtag.startswith('#'):
                hashtag = hashtag[1:]
            import re
            from django.db import connection
            # PostgreSQL case-insensitive regex word boundary matches with \y, others with \b
            boundary = '\\y' if connection.vendor == 'postgresql' else '\\b'
            # Escape the user input before it goes into a DB-side regex — otherwise a crafted
            # pattern (e.g. "(a+)+$") causes catastrophic backtracking / a CPU-exhaustion DoS.
            posts = posts.filter(content__iregex=rf'#{re.escape(hashtag)}{boundary}')
            
        if ordering == 'newest':
            posts = posts.order_by('-timestamp')
        elif ordering == 'oldest':
            posts = posts.order_by('timestamp')
        else: # popular
            posts = posts.order_by('-trending_score', '-timestamp')
            
        # Pagination
        start = (page - 1) * page_size
        end = start + page_size
        paginated = posts[start:end]
        
        serializer = PostSerializer(paginated, many=True, context={'request': request})
        return Response({
            'results': serializer.data,
            'has_next': posts.count() > end,
            'page': page,
        })
