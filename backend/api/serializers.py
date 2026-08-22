from rest_framework import serializers
from django.db.models import Count, OuterRef, Subquery, IntegerField, Q
from django.db.models.functions import Coalesce
from core.models import Game, Review, Post, PostMedia, Like, Bookmark, News, NewsSource, Pitch, InvestorCall, Project, JobPosting, ProjectMember, Organisation, OrganisationMember, OrganisationFollow, OrganisationInvitation, Role, PlaytestFeedback, CommunityTranslation
from api.models import User, Interest, Follow, Notification, Conversation, Message, LibraryEntry, SupportTicket, ConversationMember, MessageReaction, Block, Report


def count_subquery(related_model, fk_name, q_filter=None, **extra_filters):
    """A correlated-subquery COUNT for annotating list querysets.

    Lets feed/list views precompute engagement counts in one query instead of the serializer /
    ranking loop issuing a per-object `.count()` (the N+1 that made the feed fire hundreds of
    queries). A subquery is used rather than stacking `Count()` annotations because multiple
    Count()s over different relations JOIN-multiply the rows (catastrophic for a viral post with
    tens of thousands of likes and replies).
    """
    qs = related_model.objects.filter(**{fk_name: OuterRef('pk')}, **extra_filters)
    if q_filter is not None:
        qs = qs.filter(q_filter)
    sub = qs.order_by().values(fk_name).annotate(c=Count('*')).values('c')
    return Coalesce(Subquery(sub, output_field=IntegerField()), 0)


# A "direct" repost (the plain Repost toggle, PostViewSet.repost) has no content of its own —
# as opposed to a quote-repost, which is a separate post with its own caption/media/gif/poll.
# Filtering on `content==''` alone isn't enough to tell them apart: the quote composer lets you
# submit a quote with attached media/gif/poll but no caption text, which also has content=='' —
# that quote-repost was being miscounted as a direct repost (inflating reposts_count and wrongly
# flipping is_reposted/the repost button to "active" for someone who only quoted, never reposted).
DIRECT_REPOST_Q = (
    Q(content='')
    & (Q(image__isnull=True) | Q(image=''))
    & (Q(media_file__isnull=True) | Q(media_file=''))
    & (Q(gif_url__isnull=True) | Q(gif_url=''))
    & (Q(poll_options__isnull=True) | Q(poll_options=[]))
    & Q(media__isnull=True)
)

RESERVED_USERNAMES = [
    'admin', 'administrator', 'root', 'settings', 'explore', 'messages',
    'notifications', 'bookmarks', 'login', 'register', 'api', 'media',
    'static', 'home', 'news', 'devs', 'invest', 'u', 'user'
]


def validate_public_url(value):
    """Reject anything but an http(s) URL for user-supplied links (website/twitter/youtube).

    The client sanitizes these on render, but values can be POSTed straight to the API, so this
    is the authoritative guard against `javascript:`/`data:` XSS payloads being stored.
    """
    if value in (None, ''):
        return value
    if not isinstance(value, str):
        raise serializers.ValidationError("Must be a URL string.")
    trimmed = value.strip()
    if not trimmed:
        return trimmed
    if not trimmed.lower().startswith(('http://', 'https://')):
        raise serializers.ValidationError("Link must start with http:// or https://.")
    return trimmed


def validate_extra_links_value(value):
    """Validate the extra_links JSON: a list of {label, url} with http(s) urls only."""
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError("extra_links must be a list.")
    if len(value) > 20:
        raise serializers.ValidationError("Too many links (max 20).")
    cleaned = []
    for item in value:
        if not isinstance(item, dict):
            raise serializers.ValidationError("Each link must be an object with 'label' and 'url'.")
        label = str(item.get('label', '')).strip()
        url = validate_public_url(item.get('url', ''))
        if not url:
            continue
        cleaned.append({'label': label[:100], 'url': url})
    return cleaned

def get_request_cache(request):
    if not request:
        return None
    if not hasattr(request, '_user_relations_cache'):
        cache = {
            'following_ids': set(),
            'requested_ids': set(),
            'requested_me_ids': set(),
            'blocked_ids': set(),
            'blocked_me_ids': set(),
            'muted_ids': set(),
            'liked_post_ids': set(),
            'bookmarked_post_ids': set(),
            'reposted_post_ids': set(),
            'liked_review_ids': set(),
            'bookmarked_review_ids': set(),
            'liked_news_ids': set(),
            'bookmarked_news_ids': set(),
            'poll_vote_by_post_id': {},
        }
        if request.user.is_authenticated:
            from api.models import Follow, FollowRequest, Block, Mute
            from core.models import Like, Bookmark, Post, PollVote
            cache['following_ids'] = set(Follow.objects.filter(follower=request.user).values_list('following_id', flat=True))
            cache['requested_ids'] = set(FollowRequest.objects.filter(sender=request.user).values_list('receiver_id', flat=True))
            cache['requested_me_ids'] = set(FollowRequest.objects.filter(receiver=request.user).values_list('sender_id', flat=True))
            cache['blocked_ids'] = set(Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True))
            cache['blocked_me_ids'] = set(Block.objects.filter(blocked=request.user).values_list('blocker_id', flat=True))
            cache['muted_ids'] = set(Mute.objects.filter(muter=request.user).values_list('muted_id', flat=True))

            cache['liked_post_ids'] = set(Like.objects.filter(user=request.user, post__isnull=False).values_list('post_id', flat=True))
            cache['bookmarked_post_ids'] = set(Bookmark.objects.filter(user=request.user, post__isnull=False).values_list('post_id', flat=True))
            cache['reposted_post_ids'] = set(Post.objects.filter(DIRECT_REPOST_Q, user=request.user, repost_parent__isnull=False).values_list('repost_parent_id', flat=True))
            cache['liked_review_ids'] = set(Like.objects.filter(user=request.user, review__isnull=False).values_list('review_id', flat=True))
            cache['bookmarked_review_ids'] = set(Bookmark.objects.filter(user=request.user, review__isnull=False).values_list('review_id', flat=True))
            cache['liked_news_ids'] = set(Like.objects.filter(user=request.user, news__isnull=False).values_list('news_id', flat=True))
            cache['bookmarked_news_ids'] = set(Bookmark.objects.filter(user=request.user, news__isnull=False).values_list('news_id', flat=True))
            cache['poll_vote_by_post_id'] = dict(PollVote.objects.filter(user=request.user).values_list('post_id', 'option_index'))
        request._user_relations_cache = cache
    return request._user_relations_cache


def _compute_poll_results(obj, context):
    """
    Shared by PostSerializer and SimplePostSerializer so both surfaces (full posts and
    quote/reply embeds) compute poll results identically. Returns None for non-poll posts.
    Privacy note: this always computes real vote data regardless of the post author's privacy
    settings — callers' to_representation() MUST blank this to None in their private-post
    redaction branch (mirroring how they already blank poll_options to []), since this function
    has no notion of "is the viewer authorized to see this."
    """
    if not obj.poll_options:
        return None
    from core.models import PollVote
    from django.db.models import Count
    from django.utils import timezone

    counts = [0] * len(obj.poll_options)
    for row in PollVote.objects.filter(post=obj).values('option_index').annotate(c=Count('id')):
        idx = row['option_index']
        if 0 <= idx < len(counts):
            counts[idx] = row['c']

    request = context.get('request')
    cache = get_request_cache(request)
    user_choice = cache['poll_vote_by_post_id'].get(obj.id) if cache else None

    return {
        'counts': counts,
        'total_votes': sum(counts),
        'user_choice': user_choice,
        'is_closed': bool(obj.poll_expires_at and timezone.now() >= obj.poll_expires_at),
        'expires_at': obj.poll_expires_at,
    }


class InterestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interest
        fields = ['id', 'name', 'slug']

class UserSerializer(serializers.ModelSerializer):
    interests = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'avatar', 'cover_image', 'bio', 'real_name', 'location', 'social_links', 'role',
            'phone_number', 'is_gamer', 'is_developer', 'is_investor',
            'gender', 'birth_date', 'show_birth_date', 'interests', 'platforms', 'top_favorites',
            'followers_count', 'following_count', 'is_following', 'is_requested', 'has_requested_me', 'is_blocked', 'has_blocked_me', 'is_muted', 'steam_id', 'xbox_gamertag', 'date_joined', 'settings', 'dnd_mode',
            'reviews_count'
        ]
        # email is read-only here: changing it must go through a verified flow, not a
        # plain profile PATCH (otherwise a user could take over account-recovery identity
        # without re-verification). steam_id is managed by the sync_steam/disconnect_steam
        # actions, not by direct serializer writes.
        read_only_fields = ['id', 'date_joined', 'email', 'steam_id']

    def to_representation(self, instance):
        """Override to safely handle mixed Cloudinary and local media paths and enforce privacy settings."""
        representation = super().to_representation(instance)
        request = self.context.get('request')

        for field in ['avatar', 'cover_image']:
            val = representation.get(field)
            if not val:
                continue
            
            # If it's a Cloudinary URL (or any external URL)
            if str(val).startswith('http'):
                if str(val).startswith('http://res.cloudinary.com'):
                    representation[field] = str(val).replace('http://', 'https://')
            else:
                # Local path that didn't get absolute URL for some reason
                if request and not str(val).startswith('http'):
                    try:
                        representation[field] = request.build_absolute_uri(val)
                    except Exception:
                        pass

        # Privacy enforcement, two tiers:
        #  - Contact info (email, phone) and the raw settings blob belong to the account owner
        #    ONLY, always. These were previously returned for every non-private user in every
        #    nested/list response (feed authors, search results, follower lists), which allowed
        #    bulk harvesting of the whole user base's emails and phone numbers.
        #  - Semi-private profile details are visible to followers but hidden from strangers when
        #    the profile is private.
        is_private = instance.settings.get('privateProfile', False)
        is_owner = bool(request and request.user.is_authenticated and request.user.id == instance.id)
        is_following = False
        cache = get_request_cache(request)
        if cache:
            is_following = instance.id in cache['following_ids']

        if not is_owner:
            representation.pop('email', None)
            representation.pop('phone_number', None)
            # Expose only the display-privacy flags the UI legitimately needs about another user
            # (whether the profile / Steam status is private) — never the full settings object
            # (notification prefs, dnd, connected accounts, blocked terms, etc.).
            if 'settings' in representation:
                public_flags = ('privateProfile', 'steamStatusPrivate')
                representation['settings'] = {
                    k: instance.settings.get(k, False) for k in public_flags
                }

            # Respect the user's birthday-visibility toggle for everyone but the owner.
            if not representation.get('show_birth_date'):
                representation['birth_date'] = None

            if is_private and not is_following:
                for f in ['location', 'birth_date', 'gender', 'steam_id']:
                    if f in representation:
                        representation[f] = None
                for f in ['social_links', 'top_favorites', 'platforms', 'interests']:
                    if f in representation:
                        representation[f] = []

        return representation

    def validate_username(self, value):
        if value.lower() in RESERVED_USERNAMES:
            raise serializers.ValidationError("This username is reserved.")
        if '/' in value or '?' in value or '&' in value or '%' in value:
             raise serializers.ValidationError("Username contains invalid characters.")
        if Organisation.objects.filter(slug__iexact=value).exists():
            raise serializers.ValidationError("This username is taken by an organisation.")
        return value
    
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_requested = serializers.SerializerMethodField()
    has_requested_me = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()
    has_blocked_me = serializers.SerializerMethodField()
    is_muted = serializers.SerializerMethodField()

    def get_followers_count(self, obj):
        if self.parent is not None:
            return 0
        return obj.followers.count()

    def get_following_count(self, obj):
        if self.parent is not None:
            return 0
        return obj.following.count()

    def get_reviews_count(self, obj):
        if self.parent is not None:
            return 0
        return obj.reviews.count()

    def get_is_following(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['following_ids']
        return False

    def get_is_requested(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['requested_ids']
        return False

    def get_has_requested_me(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['requested_me_ids']
        return False

    def get_is_blocked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['blocked_ids']
        return False

    def get_has_blocked_me(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['blocked_me_ids']
        return False

    def get_is_muted(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['muted_ids']
        return False

class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    target_url = serializers.SerializerMethodField()
    recent_actors = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'actor', 'verb', 'notification_type', 'actor_count', 'recent_actors',
            'target_type', 'target_id', 'is_read', 'created_at', 'target_url',
        ]
        read_only_fields = ['id', 'recipient', 'actor', 'created_at']

    def get_recent_actors(self, obj):
        # Bulk-resolved once per list response by the viewset (see NotificationViewSet.list),
        # not a per-row query — falls back to a single query here only for a lone GET/retrieve.
        cache = self.context.get('recent_actors_cache')
        if cache is not None:
            users = [cache[uid] for uid in obj.recent_actor_ids if uid in cache]
        else:
            users = list(User.objects.filter(id__in=obj.recent_actor_ids))
            users.sort(key=lambda u: obj.recent_actor_ids.index(u.id))
        return UserSerializer(users, many=True, context=self.context).data

    def get_target_url(self, obj):
        try:
            if 'requested to follow' in obj.verb:
                return None  # No redirect - handled by inline accept/reject buttons
            
            if 'following' in obj.verb:
                return f"/{obj.actor.username}"
            
            if obj.target:
                model_name = obj.target_type.model if obj.target_type else ''
                
                if 'replied' in obj.verb:
                    parent_post = getattr(obj.target, 'parent', None)
                    if parent_post:
                        return f"/{parent_post.user.username}/status/{parent_post.id}"
                
                elif 'commented' in obj.verb:
                    review = getattr(obj.target, 'review_parent', None)
                    if review:
                        return f"/{review.user.username}/review/{review.id}"
                
                elif 'liked' in obj.verb:
                    if model_name == 'post':
                        return f"/{obj.target.user.username}/status/{obj.target.id}"
                    elif model_name == 'review':
                        return f"/{obj.target.user.username}/review/{obj.target.id}"
                
                elif 'invited' in obj.verb:
                    if model_name == 'conversation':
                        return f"/messages?chatId={obj.target.id}"
                    project = getattr(obj.target, 'project', None)
                    if project:
                        return f"/projects/{project.id}"
                    organisation = getattr(obj.target, 'organisation', None)
                    if organisation:
                        return f"/organisations/{organisation.slug}"

                elif 'quoted' in obj.verb or 'reposted' in obj.verb:
                    if model_name == 'post':
                        return f"/{obj.target.user.username}/status/{obj.target.id}"

                elif 'accepted' in obj.verb:
                    project = getattr(obj.target, 'project', None)
                    if project:
                        return f"/projects/{project.id}"
                    organisation = getattr(obj.target, 'organisation', None)
                    if organisation:
                        return f"/organisations/{organisation.slug}"

                elif 'followed' in obj.verb and model_name == 'project':
                    return f"/projects/{obj.target.id}"

                elif 'transferred ownership' in obj.verb:
                    if model_name == 'organisation':
                        return f"/organisations/{obj.target.slug}"

                elif 'mentioned' in obj.verb:
                    if model_name == 'post':
                        return f"/{obj.target.user.username}/status/{obj.target.id}"
                    elif model_name == 'review':
                        return f"/{obj.target.user.username}/review/{obj.target.id}"
        except Exception as e:
            print("Error generating target_url in NotificationSerializer:", e)
        return None

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    real_name = serializers.CharField(required=True, max_length=100, min_length=1)
    # Explicitly tell DRF to accept a list of strings, not IDs
    interests = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    roles = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'phone_number', 
            'is_gamer', 'is_developer', 'is_investor',
            'gender', 'birth_date', 'platforms', 'interests', 'roles', 'real_name'
        ]
        extra_kwargs = {'password': {'write_only': True}}

    def validate_real_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Display name is required.")
        value = value.strip()
        if '<' in value or '>' in value:
            raise serializers.ValidationError("Display name contains invalid characters.")
        return value

    def validate_username(self, value):
        if value.lower() in RESERVED_USERNAMES:
            raise serializers.ValidationError("This username is reserved.")
        if '/' in value or '?' in value or '&' in value or '%' in value:
             raise serializers.ValidationError("Username contains invalid characters.")
        
        user = User.objects.filter(username=value).first()
        if user and user.is_active:
            raise serializers.ValidationError("A user with that username already exists.")
        
        if Organisation.objects.filter(slug__iexact=value).exists():
            raise serializers.ValidationError("This username is taken by an organisation.")
        return value

    def validate_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value

    def validate_email(self, value):
        # No "already exists" error here: rejecting a known email would let anyone probe which
        # addresses have accounts (enumeration). RegisterView.create silently short-circuits
        # for active emails instead, returning the same verification_required response.
        # (Usernames are public identifiers — profiles live at /<username> — so the username
        # duplicate error above leaks nothing that isn't already public.)
        return value

    def create(self, validated_data):
        # (Do not log validated_data — it contains the cleartext password.)
        email = validated_data.get('email')
        username = validated_data.get('username')
        
        # Clean up any unverified, inactive users with matching email or username
        if email:
            User.objects.filter(email=email, is_active=False).delete()
        if username:
            User.objects.filter(username=username, is_active=False).delete()
        
        interests_data = validated_data.pop('interests', [])
        roles_data = validated_data.pop('roles', [])
        password = validated_data.pop('password')
        
        # Map roles to boolean fields if present (optional helper logic)
        if roles_data:
            if 'Gamer' in roles_data: validated_data['is_gamer'] = True
            if 'Developer' in roles_data: validated_data['is_developer'] = True
            if 'Investor' in roles_data: validated_data['is_investor'] = True

        # Create user securely (will default to is_active=False in view, but here we can create normally)
        user = User.objects.create_user(password=password, **validated_data)

        # Handle Interests
        if interests_data:
            from django.utils.text import slugify
            for interest_name in interests_data:
                # Create the tag if it doesn't exist, get it if it does
                interest_obj, _ = Interest.objects.get_or_create(name=interest_name, defaults={'slug': slugify(interest_name)})
                user.interests.add(interest_obj)

        return user

class GameSerializer(serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = ['id', 'title', 'cover_image', 'release_date', 'igdb_id', 'genres', 'platforms']
        read_only_fields = ['id']

    def get_cover_image(self, obj):
        if not obj.cover_image:
            return None
        value = str(obj.cover_image)
        if value.startswith('http'):
            return value
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.cover_image.url)
        return value

class GameDetailSerializer(serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    average_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    log_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Game
        fields = [
            'id', 'title', 'cover_image', 'release_date', 'igdb_id', 'steam_appid', 'genres',
            'summary', 'description', 'developer', 'publisher', 'screenshots', 'platforms', 'igdb_url',
            'average_rating', 'review_count', 'log_count',
            'metacritic_score', 'hltb_main', 'hltb_main_extra', 'hltb_completionist'
        ]
        read_only_fields = ['id']

    def get_cover_image(self, obj):
        if not obj.cover_image:
            return None
        value = str(obj.cover_image)
        # If it's already a full URL (Steam CDN, Cloudinary, etc.), return as-is
        if value.startswith('http'):
            return value
        # Otherwise, build the full media URL
        request = self.context.get('request')
        try:
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        except Exception:
            return None

class ReviewSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    game = GameSerializer(read_only=True)
    game_id = serializers.PrimaryKeyRelatedField(queryset=Game.objects.all(), source='game', write_only=True)
    type = serializers.CharField(default='review', read_only=True)
    is_bookmarked = serializers.SerializerMethodField()
    bookmarks_count = serializers.SerializerMethodField()
    is_liked_by_user = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()
    reposts_count = serializers.SerializerMethodField()

    def get_likes_count(self, obj):
        # Prefer the queryset annotation (feed/list views set it) to avoid a per-object COUNT.
        ann = getattr(obj, 'likes_count_ann', None)
        return ann if ann is not None else obj.likes.count()

    def get_bookmarks_count(self, obj):
        ann = getattr(obj, 'bookmarks_count_ann', None)
        return ann if ann is not None else obj.bookmarks.count()

    def get_replies_count(self, obj):
        ann = getattr(obj, 'replies_count_ann', None)
        return ann if ann is not None else obj.replies.count()

    def get_reposts_count(self, obj):
        # Unlike Post, a Review has no plain "direct repost" action — every repost of a
        # review is a quote-repost (ReplyModal always sets repost_parent_review with the
        # user's own content/media), so the total count is the right number here.
        ann = getattr(obj, 'reposts_count_ann', None)
        return ann if ann is not None else obj.reposts.count()

    class Meta:
        model = Review
        fields = [
            'id', 'user', 'game', 'game_id', 'rating', 'content', 'is_liked', 'is_bookmarked',
            'bookmarks_count', 'is_completed', 'contains_spoilers', 'timestamp', 'type',
            'is_liked_by_user', 'likes_count', 'playthrough_number', 'replies_count', 'reposts_count'
        ]
        read_only_fields = ['id', 'user', 'timestamp']

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['bookmarked_review_ids']
        return False

    def get_is_liked_by_user(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['liked_review_ids']
        return False

    def validate(self, data):
        request = self.context.get('request')
        if request and request.method == 'POST':
            game = data.get('game')
            playthrough = data.get('playthrough_number', 1)
            if Review.objects.filter(user=request.user, game=game, playthrough_number=playthrough).exists():
                raise serializers.ValidationError("You have already logged this playthrough.")
        # Prevent changing game_id on update
        if request and request.method in ['PUT', 'PATCH']:
            if 'game' in data and self.instance and data['game'] != self.instance.game:
                raise serializers.ValidationError("You cannot change the game of an existing review.")
        return data

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Check private profile access for the review's author
        is_private = instance.user.settings.get('privateProfile', False)
        is_owner = request and request.user.is_authenticated and request.user.id == instance.user.id
        is_following = False
        cache = get_request_cache(request)
        if cache:
            is_following = instance.user.id in cache['following_ids']
            
        if is_private and not is_owner and not is_following:
            representation['content'] = "This review is from a private account."
            representation['rating'] = None
            representation['is_completed'] = False
            representation['contains_spoilers'] = False
            representation['is_private_restricted'] = True
            
            # Clear interactive fields
            representation['is_liked'] = False
            representation['is_bookmarked'] = False
            representation['bookmarks_count'] = 0
            representation['is_liked_by_user'] = False
            representation['likes_count'] = 0
            
        return representation


class PostMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMedia
        fields = ['id', 'file', 'media_type', 'order']


class SimplePostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    type = serializers.CharField(default='post', read_only=True)
    replies_count = serializers.IntegerField(source='replies.count', read_only=True)
    reply_to_username = serializers.SerializerMethodField()
    news_details = serializers.SerializerMethodField()
    # Without this, a quote/repost embed (which serializes its `repost_parent` through this
    # serializer) only ever showed the legacy single `media_file` — the multi-image gallery
    # a post actually has was silently dropped, showing just the first image.
    media = PostMediaSerializer(many=True, read_only=True)
    poll_results = serializers.SerializerMethodField()
    # A direct repost's own PostCard renders its `repost_parent` (serialized through here)
    # recursively as the fully interactive card — same for the "replying to" parent preview
    # on the status page (get_parent_details). Without these, that card's like/bookmark/
    # repost buttons always rendered as unliked/0, regardless of the real state, because the
    # fields were simply missing from the response.
    is_liked = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    bookmarks_count = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()
    reposts_count = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'user', 'title', 'content', 'image', 'media_file', 'media_type', 'media', 'gif_url', 'poll_options', 'poll_expires_at', 'poll_results', 'timestamp', 'parent', 'review_parent', 'news_parent', 'repost_parent', 'replies_count', 'type', 'reply_to_username', 'news_details', 'category', 'trending_score', 'is_liked', 'likes_count', 'is_bookmarked', 'bookmarks_count', 'is_reposted', 'reposts_count']

    def get_poll_results(self, obj):
        return _compute_poll_results(obj, self.context)

    def get_reply_to_username(self, obj):
        if obj.parent:
            return obj.parent.user.username
        if obj.review_parent:
            return obj.review_parent.user.username
        return None

    def get_news_details(self, obj):
        if obj.news_parent:
            return {
                'id': obj.news_parent.id,
                'title': obj.news_parent.title,
                'image_url': obj.news_parent.image_url,
                'source_name': obj.news_parent.source.name,
                'source_icon': obj.news_parent.source.icon
            }
        return None

    def get_is_liked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['liked_post_ids']
        return False

    def get_likes_count(self, obj):
        ann = getattr(obj, 'likes_count_ann', None)
        return ann if ann is not None else obj.likes.count()

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['bookmarked_post_ids']
        return False

    def get_bookmarks_count(self, obj):
        ann = getattr(obj, 'bookmarks_count_ann', None)
        return ann if ann is not None else obj.bookmarks.count()

    def get_is_reposted(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['reposted_post_ids']
        return False

    def get_reposts_count(self, obj):
        # Direct reposts + quote-reposts combined — see PostSerializer.get_reposts_count.
        ann = getattr(obj, 'reposts_count_ann', None)
        return ann if ann is not None else obj.reposts.count()

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')

        # Check private profile access for the post's author
        is_private = instance.user.settings.get('privateProfile', False)
        is_owner = request and request.user.is_authenticated and request.user.id == instance.user.id
        is_following = False
        cache = get_request_cache(request)
        if cache:
            is_following = instance.user.id in cache['following_ids']

        if is_private and not is_owner and not is_following:
            representation['content'] = "This post is from a private account."
            representation['title'] = None
            representation['image'] = None
            representation['media_file'] = None
            representation['media_type'] = None
            representation['gif_url'] = None
            representation['poll_options'] = []
            representation['poll_results'] = None
            representation['is_private_restricted'] = True
            representation['replies_count'] = 0
            representation['likes_count'] = 0
            representation['is_liked'] = False
            representation['is_bookmarked'] = False
            representation['bookmarks_count'] = 0
            representation['reposts_count'] = 0
            representation['is_reposted'] = False

        return representation


# from core.models import Game, Review, Post, Project, JobPosting, PostMedia (Imported at top)

class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    author_details = serializers.SerializerMethodField()
    reply_to_username = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    bookmarks_count = serializers.SerializerMethodField()
    parent_details = serializers.SerializerMethodField()
    review_details = serializers.SerializerMethodField()
    news_details = serializers.SerializerMethodField()
    project_details = serializers.SerializerMethodField()
    type = serializers.CharField(default='post', read_only=True)
    reposts_count = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()
    repost_details = serializers.SerializerMethodField()
    repost_review_details = serializers.SerializerMethodField()
    
    # Media Handling
    media = PostMediaSerializer(many=True, read_only=True)
    uploaded_media = serializers.ListField(
        child=serializers.FileField(max_length=100000, allow_empty_file=False, use_url=False),
        write_only=True,
        required=False
    )

    # Poll Support — poll_duration_minutes is a write-only input (client sends a duration, not an
    # absolute timestamp, avoiding client-clock-skew issues); create() converts it into the real
    # poll_expires_at model field. poll_results is the computed read side (counts/percentages/the
    # requester's own vote) — see _compute_poll_results.
    poll_duration_minutes = serializers.IntegerField(write_only=True, required=False, min_value=5, max_value=10080)
    poll_results = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'user', 'author_identity', 'author_details', 'title', 'content', 'image', 'parent', 'review_parent', 'news_parent', 'project_parent',
            'timestamp', 'replies_count', 'likes_count', 'is_liked', 'is_bookmarked', 'bookmarks_count',
            'review_details', 'news_details', 'project_details', 'parent_details', 'reply_to_username',
            'media_file', 'media_type', 'gif_url', 'poll_options', 'poll_duration_minutes', 'poll_expires_at', 'poll_results', 'type',
            'media', 'uploaded_media', 'repost_parent', 'repost_details', 'reposts_count', 'is_reposted',
            'repost_parent_review', 'repost_review_details', 'category', 'trending_score'
        ]
        read_only_fields = ['id', 'user', 'author_details', 'timestamp', 'reply_to_username', 'replies_count', 'parent_details', 'news_details', 'project_details', 'type', 'media', 'reposts_count', 'is_reposted', 'repost_review_details', 'trending_score', 'poll_expires_at', 'poll_results']

    def validate_uploaded_media(self, files):
        from .uploads import MAX_POST_MEDIA_COUNT, validate_media_file
        if len(files) > MAX_POST_MEDIA_COUNT:
            raise serializers.ValidationError(f"A post can have at most {MAX_POST_MEDIA_COUNT} media files.")
        for file in files:
            validate_media_file(file, allow_video=True)
        return files

    def validate(self, data):
        # A poll needs a duration to compute poll_expires_at from — reject rather than silently
        # defaulting, so a poll never ends up with no real user-chosen length.
        if data.get('poll_options') and 'poll_duration_minutes' not in data:
            raise serializers.ValidationError({"poll_duration_minutes": "Poll duration is required when poll_options is set."})
        return data

    def get_poll_results(self, obj):
        return _compute_poll_results(obj, self.context)

    def create(self, validated_data):
        from .uploads import validate_media_file
        uploaded_media = validated_data.pop('uploaded_media', [])
        # Legacy single-file support (optional, can be inferred from first media item)
        # But frontend might still send media_file for now.

        poll_duration_minutes = validated_data.pop('poll_duration_minutes', None)
        if validated_data.get('poll_options') and poll_duration_minutes:
            from django.utils import timezone
            from datetime import timedelta
            validated_data['poll_expires_at'] = timezone.now() + timedelta(minutes=poll_duration_minutes)

        post = super().create(validated_data)

        # Handle Multiple Media
        if uploaded_media:
            for index, file in enumerate(uploaded_media):
                # Kind comes from the (already validated) extension — the multipart
                # content_type header is client-supplied and can't be trusted.
                media_type = validate_media_file(file, allow_video=True)
                PostMedia.objects.create(post=post, file=file, media_type=media_type, order=index)
            
            # Legacy Backfill: Set the first item as the main media_file for backward compatibility
            first_media = post.media.first()
            if first_media:
                 post.media_file = first_media.file
                 post.media_type = first_media.media_type
                 post.save()
        
        return post

    def get_author_details(self, obj):
        request = self.context.get('request')
        if obj.author_identity == 'organisation' and obj.project_parent and obj.project_parent.organisation:
            org = obj.project_parent.organisation
            return {
                'type': 'organisation',
                'name': org.name,
                'slug': org.slug,
                'avatar': request.build_absolute_uri(org.logo.url) if org.logo and request else (org.logo.url if org.logo else None),
                'is_verified': org.is_verified,
            }
        elif obj.author_identity == 'project' and obj.project_parent:
            proj = obj.project_parent
            return {
                'type': 'project',
                'name': proj.title,
                'slug': proj.id,
                'avatar': request.build_absolute_uri(proj.cover_image.url) if proj.cover_image and request else (proj.cover_image.url if proj.cover_image else None),
                'is_verified': False,
            }
        else:
            user = obj.user
            return {
                'type': 'user',
                'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'slug': user.username,
                'avatar': request.build_absolute_uri(user.avatar.url) if user.avatar and request else (user.avatar.url if user.avatar else None),
                'is_verified': False,
            }

    def get_is_liked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['liked_post_ids']
        return False

    def get_replies_count(self, obj):
        # Prefer the queryset annotation (feed/list views set it) to avoid a per-object COUNT.
        ann = getattr(obj, 'replies_count_ann', None)
        return ann if ann is not None else obj.replies.count()

    def get_likes_count(self, obj):
        ann = getattr(obj, 'likes_count_ann', None)
        return ann if ann is not None else obj.likes.count()

    def get_bookmarks_count(self, obj):
        ann = getattr(obj, 'bookmarks_count_ann', None)
        return ann if ann is not None else obj.bookmarks.count()

    def get_reposts_count(self, obj):
        # Matches X/Twitter: the number shown next to the repost icon is direct reposts PLUS
        # quote-reposts combined (obj.reposts holds both — see DIRECT_REPOST_Q for how they're
        # told apart). is_reposted below stays direct-only on purpose — quoting a post doesn't
        # light up the repost icon for the quoting user, only a plain repost does.
        ann = getattr(obj, 'reposts_count_ann', None)
        return ann if ann is not None else obj.reposts.count()

    def get_is_reposted(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['reposted_post_ids']
        return False

    def get_repost_details(self, obj):
        if obj.repost_parent:
            return SimplePostSerializer(obj.repost_parent, context=self.context).data
        return None

    def get_repost_review_details(self, obj):
        if obj.repost_parent_review:
            return ReviewSerializer(obj.repost_parent_review, context=self.context).data
        return None

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['bookmarked_post_ids']
        return False

    def get_review_details(self, obj):
        if obj.review_parent:
            return ReviewSerializer(obj.review_parent, context=self.context).data
        return None

    def get_project_details(self, obj):
        if obj.project_parent:
            request = self.context.get('request')
            project = obj.project_parent
            cover = project.cover_image
            return {
                'id': project.id,
                'title': project.title,
                'cover_image': request.build_absolute_uri(cover.url) if cover and request else (cover.url if cover else None),
                'owner_username': project.owner.username,
                'organisation_name': project.organisation.name if project.organisation else None,
            }
        return None

    def get_news_details(self, obj):
        if obj.news_parent:
            return {
                'id': obj.news_parent.id,
                'title': obj.news_parent.title,
                'image_url': obj.news_parent.image_url,
                'source_name': obj.news_parent.source.name,
                'source_icon': obj.news_parent.source.icon
            }
        return None

    def get_parent_details(self, obj):
        if obj.review_parent:
            return ReviewSerializer(obj.review_parent, context=self.context).data
        if obj.parent:
            return SimplePostSerializer(obj.parent, context=self.context).data
        return None

    def get_reply_to_username(self, obj):
        if obj.parent:
            return obj.parent.user.username
        if obj.review_parent:
            return obj.review_parent.user.username
        return None

    def validate_poll_options(self, value):
        if value:
            if isinstance(value, str):
                import json
                try:
                    value = json.loads(value)
                except ValueError:
                    raise serializers.ValidationError("Poll options must be a valid JSON list.")

            if not isinstance(value, list):
                raise serializers.ValidationError("Poll options must be a list of strings.")
            if len(value) < 2:
                raise serializers.ValidationError("Poll must have at least 2 options.")
            if len(value) > 4:
                raise serializers.ValidationError("Poll must have at most 4 options.")
            if any(not isinstance(option, str) or not option.strip() for option in value):
                raise serializers.ValidationError("Poll options must be non-empty strings.")
        return value

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Check private profile access for the post's author
        is_private = instance.user.settings.get('privateProfile', False)
        is_owner = request and request.user.is_authenticated and request.user.id == instance.user.id
        is_following = False
        cache = get_request_cache(request)
        if cache:
            is_following = instance.user.id in cache['following_ids']
            
        if is_private and not is_owner and not is_following:
            representation['content'] = "This post is from a private account."
            representation['title'] = None
            representation['image'] = None
            representation['media_file'] = None
            representation['media_type'] = None
            representation['gif_url'] = None
            representation['poll_options'] = []
            representation['poll_results'] = None
            representation['media'] = []
            representation['is_private_restricted'] = True
            
            # Hide nested comments/parent details
            representation['replies_count'] = 0
            representation['likes_count'] = 0
            representation['is_liked'] = False
            representation['is_bookmarked'] = False
            representation['bookmarks_count'] = 0
            representation['reposts_count'] = 0
            representation['is_reposted'] = False
            representation['repost_parent'] = None
            representation['repost_details'] = None
            representation['repost_parent_review'] = None
            representation['repost_review_details'] = None
            
        return representation


class ConversationMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    invited_by = UserSerializer(read_only=True)

    class Meta:
        model = ConversationMember
        fields = ['id', 'user', 'is_admin', 'is_muted', 'joined_at', 'status', 'invited_by']

class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    memberships = ConversationMemberSerializer(many=True, read_only=True, source='members')
    is_pending_invite = serializers.SerializerMethodField()
    my_membership_status = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'participants', 'other_user', 'last_message', 'unread_count', 'updated_at', 'is_group', 'name', 'avatar', 'memberships', 'is_pending_invite', 'my_membership_status']
        read_only_fields = ['id', 'participants', 'updated_at']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Ensure absolute URL for group avatar
        avatar = representation.get('avatar')
        if avatar and not str(avatar).startswith('http') and request:
            representation['avatar'] = request.build_absolute_uri(avatar)
        return representation

    def _my_membership(self, obj):
        # Reads the prefetched `members__user` cache (set by ConversationViewSet.get_queryset)
        # instead of issuing a fresh query — this one lookup backs both is_pending_invite and
        # my_membership_status, which previously ran the same query twice per conversation.
        request = self.context.get('request')
        if not (request and request.user.is_authenticated):
            return None
        for m in obj.members.all():
            if m.user_id == request.user.id:
                return m
        return None

    def get_other_user(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # obj.participants is prefetched by the viewset; filter in Python to use that cache.
            other_user = next((u for u in obj.participants.all() if u.id != request.user.id), None)
            if other_user:
                return UserSerializer(other_user, context=self.context).data
        return None

    def get_last_message(self, obj):
        # Prefer the annotated fields set by ConversationViewSet.get_queryset (a single
        # correlated-subquery pass over all conversations instead of one query per row).
        # Fall back to a direct query if the serializer is ever used outside that viewset.
        if hasattr(obj, 'ann_last_created_at'):
            if obj.ann_last_created_at is None:
                return None
            content = "This message was deleted" if obj.ann_last_is_deleted else obj.ann_last_content
            return {
                'content': content,
                'created_at': obj.ann_last_created_at,
                'sender_username': obj.ann_last_sender,
            }

        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            content = last_msg.content
            if last_msg.is_deleted:
                content = "This message was deleted"
            return {
                'content': content,
                'created_at': last_msg.created_at,
                'sender_username': last_msg.sender.username
            }
        return None

    def get_unread_count(self, obj):
        if hasattr(obj, 'ann_unread_count'):
            return obj.ann_unread_count

        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

    def get_is_pending_invite(self, obj):
        membership = self._my_membership(obj)
        return membership.status == 'pending' if membership else False

    def get_my_membership_status(self, obj):
        membership = self._my_membership(obj)
        return membership.status if membership else None



class LibraryEntrySerializer(serializers.ModelSerializer):
    game = GameSerializer(read_only=True)
    playtime_hours = serializers.SerializerMethodField()

    class Meta:
        model = LibraryEntry
        fields = ['id', 'user', 'game', 'playtime_forever', 'playtime_hours', 'platform', 'status', 'added_at']
        read_only_fields = ['id', 'user', 'added_at']

    def get_playtime_hours(self, obj):
        if obj.playtime_forever:
            return round(obj.playtime_forever / 60, 1)
        return 0.0

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Check private profile access for the library entry's owner
        is_private = instance.user.settings.get('privateProfile', False)
        is_owner = request and request.user.is_authenticated and request.user.id == instance.user.id
        is_following = False
        cache = get_request_cache(request)
        if cache:
            is_following = instance.user.id in cache['following_ids']
            
        if is_private and not is_owner and not is_following:
            representation['playtime_forever'] = 0
            representation['playtime_hours'] = 0.0
            representation['platform'] = None
            representation['status'] = None
            representation['is_private_restricted'] = True
            
        return representation



class LikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Like
        fields = ['id', 'user', 'post', 'review', 'news', 'playtest_feedback', 'community_translation', 'timestamp']
        read_only_fields = ['id', 'user', 'timestamp']

    def create(self, validated_data):
        # Ensure only one target is set
        targets = [validated_data.get('post'), validated_data.get('review'), validated_data.get('news'), validated_data.get('playtest_feedback'), validated_data.get('community_translation')]
        if sum(x is not None for x in targets) != 1:
            raise serializers.ValidationError("Like must target exactly one item (post, review, news, playtest_feedback, or community_translation).")
        return super().create(validated_data)

class NewsSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    source_icon = serializers.URLField(source='source.icon', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    bookmarks_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = News
        fields = ['id', 'title', 'link', 'image_url', 'description', 'pub_date', 'category', 'source_name', 'source_icon', 'is_liked', 'is_bookmarked', 'like_count', 'comment_count', 'bookmarks_count']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['liked_news_ids']
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['bookmarked_news_ids']
        return False
class MessageReactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = MessageReaction
        fields = ['id', 'emoji', 'username', 'user']

class SimpleMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'content', 'sender_username', 'image', 'gif_url']

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    is_me = serializers.SerializerMethodField()
    shared_post_details = SimplePostSerializer(source='shared_post', read_only=True)
    shared_review_details = ReviewSerializer(source='shared_review', read_only=True)
    shared_news_details = NewsSerializer(source='shared_news', read_only=True)
    reactions = MessageReactionSerializer(many=True, read_only=True)
    reply_to_details = SimpleMessageSerializer(source='reply_to', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'content', 'is_read', 'created_at', 'is_me',
            'image', 'gif_url', 'shared_post', 'shared_review', 'shared_news',
            'shared_post_details', 'shared_review_details', 'shared_news_details',
            'reactions', 'reply_to', 'reply_to_details', 'is_pinned', 'is_edited', 'is_deleted', 'edited_at'
        ]
        read_only_fields = [
            'id', 'sender', 'created_at', 'is_me', 
            'shared_post_details', 'shared_review_details', 'shared_news_details', 
            'reactions', 'reply_to_details', 'is_pinned', 'is_edited', 'is_deleted', 'edited_at'
        ]

    def get_is_me(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender == request.user
        return False

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if instance.is_deleted:
            rep['content'] = "This message was deleted"
            rep['image'] = None
            rep['gif_url'] = None
            rep['shared_post_details'] = None
            rep['shared_review_details'] = None
            rep['shared_news_details'] = None
        return rep


class BookmarkSerializer(serializers.ModelSerializer):
    post_details = PostSerializer(source='post', read_only=True)
    review_details = ReviewSerializer(source='review', read_only=True)
    news_details = NewsSerializer(source='news', read_only=True)

    class Meta:
        model = Bookmark
        fields = ['id', 'user', 'post', 'review', 'news', 'timestamp', 'post_details', 'review_details', 'news_details']
        read_only_fields = ['id', 'user', 'timestamp']

    def create(self, validated_data):
        # Ensure only one target is set
        targets = [validated_data.get('post'), validated_data.get('review'), validated_data.get('news')]
        if sum(x is not None for x in targets) != 1:
            raise serializers.ValidationError("Bookmark must target exactly one item (post, review, or news).")
        return super().create(validated_data)

class RoleSerializer(serializers.ModelSerializer):
    organisation = serializers.PrimaryKeyRelatedField(queryset=Organisation.objects.all(), required=False)

    class Meta:
        model = Role
        fields = ['id', 'organisation', 'project', 'name', 'description', 'permissions', 'is_system', 'is_default_for', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_system', 'is_default_for', 'created_at', 'updated_at']
        # DRF auto-generates a UniqueTogetherValidator from Role.Meta.constraints, which forces
        # every field in the constraint (including `organisation`) to be present in the raw
        # request — before our own validate() below gets a chance to derive `organisation` from
        # `project`. We replace that automatic check with an equivalent manual one instead.
        validators = []

    def validate(self, attrs):
        project = attrs.get('project', self.instance.project if self.instance else None)
        organisation = attrs.get('organisation', self.instance.organisation if self.instance else None)
        if project is not None:
            if project.organisation_id is None:
                raise serializers.ValidationError({"project": "Personal (org-less) projects don't support custom roles."})
            # A project-scoped role always belongs to that project's own organisation —
            # derive it rather than trusting a possibly-mismatched client-supplied value.
            attrs['organisation'] = organisation = project.organisation
        elif organisation is None:
            raise serializers.ValidationError({"organisation": "This field is required when no project is given."})

        name = attrs.get('name', self.instance.name if self.instance else None)
        clash = Role.objects.filter(organisation=organisation, project=project, name=name)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError({"name": "A role with this name already exists in this scope."})
        return attrs


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )
    custom_role_details = RoleSerializer(source='custom_role', read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'project', 'user', 'user_id', 'role', 'custom_role', 'custom_role_details', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

    def validate_custom_role(self, value):
        if value is None:
            return value
        project = self.instance.project if self.instance else self.initial_data.get('project')
        if isinstance(project, (int, str)):
            project = Project.objects.filter(id=project).first()
        if project and value.project_id != project.id:
            raise serializers.ValidationError("This role does not belong to this project.")
        return value

class ProjectSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    organisation_details = serializers.SerializerMethodField()
    members = ProjectMemberSerializer(many=True, read_only=True)
    followers_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = ['id', 'owner', 'organisation', 'organisation_details', 'title', 'description', 'cover_image', 'logo', 'tech_stack', 'status', 'website', 'twitter', 'youtube', 'extra_links', 'members', 'followers_count', 'is_following', 'created_at', 'updated_at']
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at', 'organisation_details']

    def validate_website(self, value):
        return validate_public_url(value)

    def validate_twitter(self, value):
        return validate_public_url(value)

    def validate_youtube(self, value):
        return validate_public_url(value)

    def validate_extra_links(self, value):
        return validate_extra_links_value(value)

    def get_followers_count(self, obj):
        # len() over the prefetched rows (ProjectViewSet prefetches 'followers') — .count()
        # would issue one query per project on list endpoints.
        return len(obj.followers.all())

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return any(f.user_id == request.user.id for f in obj.followers.all())
        return False

    def get_organisation_details(self, obj):
        if obj.organisation:
            request = self.context.get('request')
            logo = obj.organisation.logo
            return {
                'id': obj.organisation.id,
                'name': obj.organisation.name,
                'slug': obj.organisation.slug,
                'logo': request.build_absolute_uri(logo.url) if logo and request else (logo.url if logo else None),
                'is_verified': obj.organisation.is_verified
            }
        return None


class PlaytestFeedbackSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = PlaytestFeedback
        fields = [
            'id', 'project', 'author', 'title', 'type', 'priority', 'build_version',
            'description', 'status', 'is_pinned', 'converted_task_id',
            'likes_count', 'is_liked', 'submitted_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'author', 'status', 'is_pinned', 'converted_task_id',
            'likes_count', 'is_liked', 'submitted_at', 'created_at',
        ]

    def update(self, instance, validated_data):
        # `project` is set at creation and must not be reassigned afterwards, so an author
        # can't move their feedback onto a different project via PATCH.
        validated_data.pop('project', None)
        return super().update(instance, validated_data)

    def get_likes_count(self, obj):
        # len() over the prefetched rows (see the viewset's prefetch_related('likes')) —
        # a per-row COUNT query would defeat the prefetch on every list render.
        return len(obj.likes.all())

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Iterate the prefetch cache: .filter() would issue a fresh query per row.
            return any(like.user_id == request.user.id for like in obj.likes.all())
        return False

    def validate_title(self, value):
        return value.strip() if value else value

    def validate_description(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("This field is required.")
        return value


class CommunityTranslationSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    approved_by = UserSerializer(read_only=True)
    votes_count = serializers.SerializerMethodField()
    is_voted = serializers.SerializerMethodField()
    # Neither is unconditionally required at the DRF-field level — whether `text` or
    # `plural_forms` is the one actually required (and the other forced to a derived/null value)
    # depends on the target key's `isPlural` flag, resolved and enforced in
    # _validate_payload_shape() below.
    text = serializers.CharField(required=False, allow_blank=True)
    plural_forms = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = CommunityTranslation
        fields = [
            'id', 'project', 'key', 'namespace', 'language', 'author', 'text', 'plural_forms',
            'status', 'approved_by', 'approved_at', 'votes_count', 'is_voted',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'author', 'namespace', 'status', 'approved_by', 'approved_at',
            'votes_count', 'is_voted', 'created_at', 'updated_at',
        ]

    def get_votes_count(self, obj):
        # Prefer the viewset's Count annotation; fall back to the prefetched rows. Either way
        # no per-row COUNT query.
        annotated = getattr(obj, 'vote_count', None)
        if annotated is not None:
            return annotated
        return len(obj.likes.all())

    def get_is_voted(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Iterate the prefetch cache: .filter() would issue a fresh query per row.
            return any(like.user_id == request.user.id for like in obj.likes.all())
        return False

    def update(self, instance, validated_data):
        # A translation suggestion's identity (which project/key/language it targets) is fixed
        # at creation — an author editing their suggestion can only change its text/plural_forms.
        validated_data.pop('project', None)
        validated_data.pop('key', None)
        validated_data.pop('language', None)
        return super().update(instance, validated_data)

    def validate(self, attrs):
        from .locale_registry import get as get_locale, resolve_project_locales
        from .views import _project_workspace_state_readonly

        project = attrs.get('project') if self.instance is None else self.instance.project
        key = attrs.get('key') if self.instance is None else self.instance.key
        language = attrs.get('language') if self.instance is None else self.instance.language

        state = _project_workspace_state_readonly(project) if project else None
        entries = (state.data or {}).get('translationKeys', []) if state else []
        entry = next((e for e in entries if e.get('key') == key), None)

        # Key/language identity and the duplicate-suggestion check are create-only — on update,
        # project/key/language are dropped above (and can't be resubmitted), so the instance
        # already passed this once.
        if self.instance is None:
            if entry is None:
                raise serializers.ValidationError("Unknown translation key for this project.")
            attrs['namespace'] = entry.get('namespace', '')

            locale_codes = {l.code for l in resolve_project_locales(state.data if state else {})}
            if language not in locale_codes:
                raise serializers.ValidationError("This project does not accept translations in that language.")

            request = self.context.get('request')
            user = request.user if request else None
            if user and user.is_authenticated:
                duplicate = CommunityTranslation.objects.filter(
                    project=project, key=key, language=language, author=user,
                ).exclude(status='rejected').exists()
                if duplicate:
                    raise serializers.ValidationError(
                        "You've already suggested a translation for this string — edit your existing suggestion instead."
                    )

        # Payload-shape validation runs on BOTH create and update — round 1's version of this
        # method only ran on create, which meant a PATCH could smuggle plural_forms onto a flat
        # key (or clear plural_forms off a plural one) with no check at all.
        self._validate_payload_shape(attrs, entry, get_locale(language))
        return attrs

    def _validate_payload_shape(self, attrs, entry, locale):
        is_plural = bool(entry.get('isPlural')) if entry else False

        if not is_plural:
            if attrs.get('plural_forms'):
                raise serializers.ValidationError({'plural_forms': ["This string isn't pluralisable — submit `text` instead."]})
            text = attrs.get('text', self.instance.text if self.instance else None)
            if not text or not text.strip():
                raise serializers.ValidationError({'text': ["This field is required."]})
            if len(text) > 2000:
                raise serializers.ValidationError({'text': ["Keep suggestions under 2000 characters."]})
            attrs['text'] = text.strip()
            attrs['plural_forms'] = None
            return

        if locale is None:
            raise serializers.ValidationError("Unknown language.")

        plural_forms = attrs.get('plural_forms', self.instance.plural_forms if self.instance else None)
        if not isinstance(plural_forms, dict):
            raise serializers.ValidationError({'plural_forms': ["This field is required for a pluralisable string."]})

        missing = [c for c in locale.gettext_category_order if not str(plural_forms.get(c, '')).strip()]
        if missing:
            raise serializers.ValidationError({'plural_forms': [f"Missing form(s) for: {', '.join(missing)}."]})

        unknown = set(plural_forms.keys()) - set(locale.cldr_categories)
        if unknown:
            raise serializers.ValidationError({'plural_forms': [f"Unknown plural categor{'y' if len(unknown) == 1 else 'ies'}: {', '.join(sorted(unknown))}."]})

        cleaned = {k: str(v).strip() for k, v in plural_forms.items() if str(v).strip()}
        if any(len(v) > 2000 for v in cleaned.values()):
            raise serializers.ValidationError({'plural_forms': ["Keep each form under 2000 characters."]})
        if sum(len(v) for v in cleaned.values()) > 12000:
            raise serializers.ValidationError({'plural_forms': ["Keep the total under 12000 characters."]})

        attrs['plural_forms'] = cleaned
        attrs['text'] = cleaned.get(locale.gettext_category_order[-1]) or next(iter(cleaned.values()))


class JobPostingSerializer(serializers.ModelSerializer):
    recruiter = UserSerializer(read_only=True)
    project_details = serializers.SerializerMethodField()

    class Meta:
        model = JobPosting
        fields = ['id', 'recruiter', 'project', 'project_details', 'title', 'description', 'post_type', 'tech_stack', 'job_type', 'location_type', 'experience_level', 'is_active', 'created_at']
        read_only_fields = ['id', 'recruiter', 'created_at', 'project_details']

    def get_project_details(self, obj):
        if obj.project:
            request = self.context.get('request')
            cover = obj.project.cover_image
            return {
                'id': obj.project.id,
                'title': obj.project.title,
                'cover_image': request.build_absolute_uri(cover.url) if cover and request else (cover.url if cover else None)
            }
        return None

class PitchSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Pitch
        fields = ['id', 'user', 'title', 'description', 'genre', 'platform', 'funding_goal', 'stage', 'image', 'pitch_deck_url', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

class InvestorCallSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = InvestorCall
        fields = ['id', 'user', 'organization_name', 'investor_type', 'looking_for', 'ticket_size', 'deadline', 'is_active', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

class SupportTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = ['id', 'user', 'ticket_type', 'subject', 'category', 'description', 'steps_to_reproduce', 'severity', 'is_resolved', 'created_at']
        read_only_fields = ['id', 'user', 'is_resolved', 'created_at']

class OrganisationMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )
    custom_role_details = RoleSerializer(source='custom_role', read_only=True)

    class Meta:
        model = OrganisationMember
        fields = ['id', 'organisation', 'user', 'user_id', 'role', 'custom_role', 'custom_role_details', 'joined_at']
        read_only_fields = ['id', 'joined_at']

    def validate_custom_role(self, value):
        if value is None:
            return value
        organisation = self.instance.organisation if self.instance else self.initial_data.get('organisation')
        if isinstance(organisation, (int, str)):
            organisation = Organisation.objects.filter(id=organisation).first()
        if organisation and value.organisation_id != organisation.id:
            raise serializers.ValidationError("This role does not belong to this organisation.")
        return value


class OrganisationSerializer(serializers.ModelSerializer):
    members = OrganisationMemberSerializer(many=True, read_only=True)
    followers_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    
    class Meta:
        model = Organisation
        fields = ['id', 'name', 'slug', 'description', 'logo', 'banner', 'website', 'twitter', 'youtube', 'extra_links', 'is_verified', 'members', 'followers_count', 'is_following', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_verified', 'created_at', 'updated_at']

    def validate_website(self, value):
        return validate_public_url(value)

    def validate_twitter(self, value):
        return validate_public_url(value)

    def validate_youtube(self, value):
        return validate_public_url(value)

    def validate_extra_links(self, value):
        return validate_extra_links_value(value)

    def validate_slug(self, value):
        slug = value.strip().lower()
        if not slug:
            raise serializers.ValidationError("Slug is required.")
        
        # If updating, make sure slug hasn't changed
        if self.instance and self.instance.slug != slug:
            raise serializers.ValidationError("Slug cannot be modified after creation.")
            
        if slug in RESERVED_USERNAMES:
            raise serializers.ValidationError("This slug is reserved.")
            
        from api.models import User
        if User.objects.filter(username__iexact=slug).exists():
            raise serializers.ValidationError("This name is taken by a user account.")
            
        # Check unique constraint manually
        qs = Organisation.objects.filter(slug__iexact=slug)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("An organisation with this slug already exists.")
            
        return slug

    def get_followers_count(self, obj):
        return obj.followers.count()
        
    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.followers.filter(user=request.user).exists()
        return False


class OrganisationInvitationSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )
    organisation_details = serializers.SerializerMethodField()
    invited_by_details = UserSerializer(source='invited_by', read_only=True)
    custom_role_details = RoleSerializer(source='custom_role', read_only=True)

    class Meta:
        model = OrganisationInvitation
        fields = ['id', 'organisation', 'organisation_details', 'user', 'user_id', 'role', 'custom_role', 'custom_role_details', 'invited_by', 'invited_by_details', 'created_at', 'is_active']
        read_only_fields = ['id', 'invited_by', 'created_at', 'is_active']
        
    def get_organisation_details(self, obj):
        request = self.context.get('request')
        logo = obj.organisation.logo
        return {
            'id': obj.organisation.id,
            'name': obj.organisation.name,
            'slug': obj.organisation.slug,
            'logo': request.build_absolute_uri(logo.url) if logo and request else (logo.url if logo else None)
        }


class ReportSerializer(serializers.Serializer):
    """
    Plain (non-Model) serializer: `target_type` is a short client-facing string ('post', 'review',
    'user', 'conversation'), resolved to a real django ContentType in the view rather than trusting
    a client-supplied app_label/model pair directly.
    """
    TARGET_TYPE_MAP_KEYS = ('post', 'review', 'user', 'conversation')

    target_type = serializers.ChoiceField(choices=TARGET_TYPE_MAP_KEYS)
    target_id = serializers.IntegerField()
    reason = serializers.ChoiceField(choices=[c[0] for c in Report.REASON_CHOICES])
    details = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def to_representation(self, instance):
        return {
            'id': instance.id,
            'target_type': instance.target_type.model,
            'target_id': instance.target_id,
            'reason': instance.reason,
            'details': instance.details,
            'status': instance.status,
            'created_at': instance.created_at,
        }


from core.models import WorkspaceState

class WorkspaceStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceState
        fields = ['key', 'data', 'version', 'updated_at']

