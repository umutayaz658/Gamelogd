from rest_framework import serializers
from core.models import Game, Review, Post, PostMedia, Like, Bookmark, News, NewsSource, Pitch, InvestorCall, Project, JobPosting, ProjectMember, Organisation, OrganisationMember, OrganisationFollow, OrganisationInvitation
from api.models import User, Interest, Follow, Notification, Conversation, Message, LibraryEntry, SupportTicket, ConversationMember, MessageReaction, Block

RESERVED_USERNAMES = [
    'admin', 'administrator', 'root', 'settings', 'explore', 'messages', 
    'notifications', 'bookmarks', 'login', 'register', 'api', 'media', 
    'static', 'home', 'news', 'devs', 'invest', 'u', 'user'
]

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
            'liked_post_ids': set(),
            'bookmarked_post_ids': set(),
            'reposted_post_ids': set(),
            'liked_review_ids': set(),
            'bookmarked_review_ids': set(),
            'liked_news_ids': set(),
            'bookmarked_news_ids': set(),
        }
        if request.user.is_authenticated:
            from api.models import Follow, FollowRequest, Block
            from core.models import Like, Bookmark, Post
            cache['following_ids'] = set(Follow.objects.filter(follower=request.user).values_list('following_id', flat=True))
            cache['requested_ids'] = set(FollowRequest.objects.filter(sender=request.user).values_list('receiver_id', flat=True))
            cache['requested_me_ids'] = set(FollowRequest.objects.filter(receiver=request.user).values_list('sender_id', flat=True))
            cache['blocked_ids'] = set(Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True))
            cache['blocked_me_ids'] = set(Block.objects.filter(blocked=request.user).values_list('blocker_id', flat=True))
            
            cache['liked_post_ids'] = set(Like.objects.filter(user=request.user, post__isnull=False).values_list('post_id', flat=True))
            cache['bookmarked_post_ids'] = set(Bookmark.objects.filter(user=request.user, post__isnull=False).values_list('post_id', flat=True))
            cache['reposted_post_ids'] = set(Post.objects.filter(user=request.user, repost_parent__isnull=False).values_list('repost_parent_id', flat=True))
            cache['liked_review_ids'] = set(Like.objects.filter(user=request.user, review__isnull=False).values_list('review_id', flat=True))
            cache['bookmarked_review_ids'] = set(Bookmark.objects.filter(user=request.user, review__isnull=False).values_list('review_id', flat=True))
            cache['liked_news_ids'] = set(Like.objects.filter(user=request.user, news__isnull=False).values_list('news_id', flat=True))
            cache['bookmarked_news_ids'] = set(Bookmark.objects.filter(user=request.user, news__isnull=False).values_list('news_id', flat=True))
        request._user_relations_cache = cache
    return request._user_relations_cache

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
            'followers_count', 'following_count', 'is_following', 'is_requested', 'has_requested_me', 'is_blocked', 'has_blocked_me', 'steam_id', 'date_joined', 'settings', 'dnd_mode',
            'reviews_count'
        ]
        read_only_fields = ['id', 'date_joined']

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

        # Privacy Enforcement: strip private details if the requesting user is not authorized
        is_private = instance.settings.get('privateProfile', False)
        is_owner = request and request.user.is_authenticated and request.user.id == instance.id
        is_following = False
        cache = get_request_cache(request)
        if cache:
            is_following = instance.id in cache['following_ids']

        if is_private and not is_owner and not is_following:
            sensitive_fields = [
                'email', 'phone_number', 'location', 'birth_date', 'gender', 
                'steam_id', 'social_links', 'top_favorites', 'platforms', 
                'interests', 'show_birth_date'
            ]
            for f in sensitive_fields:
                if f in representation:
                    if f in ['social_links', 'top_favorites', 'platforms', 'interests']:
                        representation[f] = []
                    elif f == 'settings':
                        representation[f] = {'privateProfile': True}
                    else:
                        representation[f] = None
            if 'settings' in representation:
                representation['settings'] = {'privateProfile': True}

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

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Check if request.user has blocked obj
            from api.models import Block
            return Block.objects.filter(blocker=request.user, blocked=obj).exists()

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

class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    target_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'actor', 'verb', 'target_type', 'target_id', 'is_read', 'created_at', 'target_url']
        read_only_fields = ['id', 'recipient', 'actor', 'created_at']

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

                elif 'quoted' in obj.verb or 'reposted' in obj.verb:
                    if model_name == 'post':
                        return f"/{obj.target.user.username}/status/{obj.target.id}"

                elif 'accepted' in obj.verb:
                    project = getattr(obj.target, 'project', None)
                    if project:
                        return f"/projects/{project.id}"

                elif 'followed' in obj.verb and model_name == 'project':
                    return f"/projects/{obj.target.id}"
                
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
        user = User.objects.filter(email=value).first()
        if user and user.is_active:
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def create(self, validated_data):
        print("DEBUG: Validated Data received:", validated_data)
        
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
            host = request.get_host()
            if 'backend' in host:
                host = host.replace('backend', '127.0.0.1')
            return f"{request.scheme}://{host}{obj.cover_image.url}"
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
    bookmarks_count = serializers.IntegerField(source='bookmarks.count', read_only=True)
    is_liked_by_user = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'user', 'game', 'game_id', 'rating', 'content', 'is_liked', 'is_bookmarked', 
            'bookmarks_count', 'is_completed', 'contains_spoilers', 'timestamp', 'type',
            'is_liked_by_user', 'likes_count', 'playthrough_number'
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


class SimplePostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    type = serializers.CharField(default='post', read_only=True)
    replies_count = serializers.IntegerField(source='replies.count', read_only=True)
    reply_to_username = serializers.SerializerMethodField()
    news_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = ['id', 'user', 'title', 'content', 'image', 'media_file', 'media_type', 'gif_url', 'poll_options', 'timestamp', 'parent', 'review_parent', 'news_parent', 'repost_parent', 'replies_count', 'type', 'reply_to_username', 'news_details', 'category', 'trending_score']

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
            representation['is_private_restricted'] = True
            
        return representation


# from core.models import Game, Review, Post, Project, JobPosting, PostMedia (Imported at top)

class PostMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMedia
        fields = ['id', 'file', 'media_type', 'order']

class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    author_details = serializers.SerializerMethodField()
    reply_to_username = serializers.SerializerMethodField()
    replies_count = serializers.IntegerField(source='replies.count', read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    bookmarks_count = serializers.IntegerField(source='bookmarks.count', read_only=True)
    parent_details = serializers.SerializerMethodField()
    review_details = serializers.SerializerMethodField()
    news_details = serializers.SerializerMethodField()
    project_details = serializers.SerializerMethodField()
    type = serializers.CharField(default='post', read_only=True)
    reposts_count = serializers.IntegerField(source='reposts.count', read_only=True)
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

    class Meta:
        model = Post
        fields = [
            'id', 'user', 'author_identity', 'author_details', 'title', 'content', 'image', 'parent', 'review_parent', 'news_parent', 'project_parent',
            'timestamp', 'replies', 'likes', 'replies_count', 'likes_count', 'is_liked', 'is_bookmarked', 'bookmarks_count',
            'review_details', 'news_details', 'project_details', 'parent_details', 'reply_to_username',
            'media_file', 'media_type', 'gif_url', 'poll_options', 'type',
            'media', 'uploaded_media', 'repost_parent', 'repost_details', 'reposts_count', 'is_reposted',
            'repost_parent_review', 'repost_review_details', 'category', 'trending_score'
        ]
        read_only_fields = ['id', 'user', 'author_details', 'timestamp', 'reply_to_username', 'replies_count', 'parent_details', 'news_details', 'project_details', 'type', 'media', 'reposts_count', 'is_reposted', 'repost_review_details', 'trending_score']

    def create(self, validated_data):
        uploaded_media = validated_data.pop('uploaded_media', [])
        # Legacy single-file support (optional, can be inferred from first media item)
        # But frontend might still send media_file for now.
        
        post = super().create(validated_data)

        # Handle Multiple Media
        if uploaded_media:
            for index, file in enumerate(uploaded_media):
                media_type = 'video' if file.content_type.startswith('video') else 'image'
                PostMedia.objects.create(post=post, file=file, media_type=media_type, order=index)
            
            # Legacy Backfill: Set the first item as the main media_file for backward compatibility
            first_media = post.media.first()
            if first_media:
                 post.media_file = first_media.file
                 post.media_type = first_media.media_type
                 post.save()
        
        return post

    def get_author_details(self, obj):
        if obj.author_identity == 'organisation' and obj.project_parent and obj.project_parent.organisation:
            org = obj.project_parent.organisation
            return {
                'type': 'organisation',
                'name': org.name,
                'slug': org.slug,
                'avatar': org.logo.url if org.logo else None,
                'is_verified': org.is_verified,
            }
        elif obj.author_identity == 'project' and obj.project_parent:
            proj = obj.project_parent
            return {
                'type': 'project',
                'name': proj.title,
                'slug': proj.id,
                'avatar': proj.cover_image.url if proj.cover_image else None,
                'is_verified': False,
            }
        else:
            user = obj.user
            return {
                'type': 'user',
                'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'slug': user.username,
                'avatar': user.avatar.url if user.avatar else None,
                'is_verified': False,
            }

    def get_is_liked(self, obj):
        request = self.context.get('request')
        cache = get_request_cache(request)
        if cache:
            return obj.id in cache['liked_post_ids']
        return False

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
            return {
                'id': obj.project_parent.id,
                'title': obj.project_parent.title,
                'cover_image': obj.project_parent.cover_image.url if obj.project_parent.cover_image else None
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
            representation['media'] = []
            representation['is_private_restricted'] = True
            
            # Hide nested comments/parent details
            representation['replies'] = []
            representation['likes'] = []
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

    def get_other_user(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            other_user = obj.participants.exclude(id=request.user.id).first()
            if other_user:
                return UserSerializer(other_user, context=self.context).data
        return None

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            # If deleted, hide content from last message preview
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
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

    def get_is_pending_invite(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.members.filter(user=request.user).first()
            if membership:
                return membership.status == 'pending'
        return False

    def get_my_membership_status(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.members.filter(user=request.user).first()
            if membership:
                return membership.status
        return None



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
        fields = ['id', 'user', 'post', 'review', 'news', 'timestamp']
        read_only_fields = ['id', 'user', 'timestamp']

    def create(self, validated_data):
        # Ensure only one target is set
        targets = [validated_data.get('post'), validated_data.get('review'), validated_data.get('news')]
        if sum(x is not None for x in targets) != 1:
            raise serializers.ValidationError("Like must target exactly one item (post, review, or news).")
        return super().create(validated_data)

class NewsSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    source_icon = serializers.URLField(source='source.icon', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    bookmarks_count = serializers.IntegerField(source='bookmarks.count', read_only=True)

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

class ProjectMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = ProjectMember
        fields = ['id', 'project', 'user', 'user_id', 'role', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

class ProjectSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    organisation_details = serializers.SerializerMethodField()
    members = ProjectMemberSerializer(many=True, read_only=True)
    followers_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = ['id', 'owner', 'organisation', 'organisation_details', 'title', 'description', 'cover_image', 'tech_stack', 'status', 'members', 'followers_count', 'is_following', 'created_at', 'updated_at']
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at', 'organisation_details']

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.followers.filter(user=request.user).exists()
        return False

    def get_organisation_details(self, obj):
        if obj.organisation:
            return {
                'id': obj.organisation.id,
                'name': obj.organisation.name,
                'slug': obj.organisation.slug,
                'logo': obj.organisation.logo.url if obj.organisation.logo else None,
                'is_verified': obj.organisation.is_verified
            }
        return None

class JobPostingSerializer(serializers.ModelSerializer):
    recruiter = UserSerializer(read_only=True)
    project_details = serializers.SerializerMethodField()

    class Meta:
        model = JobPosting
        fields = ['id', 'recruiter', 'project', 'project_details', 'title', 'description', 'post_type', 'tech_stack', 'job_type', 'location_type', 'experience_level', 'is_active', 'created_at']
        read_only_fields = ['id', 'recruiter', 'created_at', 'project_details']

    def get_project_details(self, obj):
        if obj.project:
            return {
                'id': obj.project.id,
                'title': obj.project.title,
                'cover_image': obj.project.cover_image.url if obj.project.cover_image else None
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
    
    class Meta:
        model = OrganisationMember
        fields = ['id', 'organisation', 'user', 'user_id', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at']


class OrganisationSerializer(serializers.ModelSerializer):
    members = OrganisationMemberSerializer(many=True, read_only=True)
    followers_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    
    class Meta:
        model = Organisation
        fields = ['id', 'name', 'slug', 'description', 'logo', 'banner', 'website', 'twitter', 'youtube', 'is_verified', 'members', 'followers_count', 'is_following', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_verified', 'created_at', 'updated_at']
        
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
    
    class Meta:
        model = OrganisationInvitation
        fields = ['id', 'organisation', 'organisation_details', 'user', 'user_id', 'role', 'invited_by', 'invited_by_details', 'created_at', 'is_active']
        read_only_fields = ['id', 'invited_by', 'created_at', 'is_active']
        
    def get_organisation_details(self, obj):
        return {
            'id': obj.organisation.id,
            'name': obj.organisation.name,
            'slug': obj.organisation.slug,
            'logo': obj.organisation.logo.url if obj.organisation.logo else None
        }


from core.models import WorkspaceState

class WorkspaceStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceState
        fields = ['key', 'data', 'updated_at']

class BlockedUserSerializer(serializers.ModelSerializer):
    blocker = UserSerializer(read_only=True)
    blocked = UserSerializer(read_only=True)

    class Meta:
        from api.models import BlockedUser
        model = BlockedUser
        fields = ['id', 'blocker', 'blocked', 'created_at']

class ConversationReportSerializer(serializers.ModelSerializer):
    reported_by = UserSerializer(read_only=True)

    class Meta:
        from api.models import ConversationReport
        model = ConversationReport
        fields = ['id', 'conversation', 'reported_by', 'reason', 'created_at']
