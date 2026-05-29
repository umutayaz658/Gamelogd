from rest_framework import serializers
from core.models import Game, Review, Post, PostMedia, Like, Bookmark, News, NewsSource, Pitch, InvestorCall, Project, JobPosting, ProjectMember
from api.models import User, Interest, Follow, Notification, Conversation, Message, LibraryEntry

RESERVED_USERNAMES = [
    'admin', 'administrator', 'root', 'settings', 'explore', 'messages', 
    'notifications', 'bookmarks', 'login', 'register', 'api', 'media', 
    'static', 'home', 'news', 'devs', 'invest', 'u', 'user'
]

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
            'followers_count', 'following_count', 'is_following', 'steam_id', 'date_joined'
        ]
        read_only_fields = ['id', 'date_joined']

    def to_representation(self, instance):
        """Override to safely handle mixed Cloudinary and local media paths."""
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
        return representation

    def validate_username(self, value):
        if value.lower() in RESERVED_USERNAMES:
            raise serializers.ValidationError("This username is reserved.")
        if '/' in value or '?' in value or '&' in value or '%' in value:
             raise serializers.ValidationError("Username contains invalid characters.")
        return value
    
    followers_count = serializers.IntegerField(source='followers.count', read_only=True)
    following_count = serializers.IntegerField(source='following.count', read_only=True)
    is_following = serializers.SerializerMethodField()

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Check if request.user is following obj
            # Follow model: follower=request.user, following=obj
            from api.models import Follow
            return Follow.objects.filter(follower=request.user, following=obj).exists()
        return False

class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'actor', 'verb', 'target_type', 'target_id', 'is_read', 'created_at']
        read_only_fields = ['id', 'recipient', 'actor', 'created_at']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    # Explicitly tell DRF to accept a list of strings, not IDs
    interests = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    roles = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'phone_number', 
            'is_gamer', 'is_developer', 'is_investor',
            'gender', 'birth_date', 'platforms', 'interests', 'roles'
        ]
        extra_kwargs = {'password': {'write_only': True}}

    def validate_username(self, value):
        if value.lower() in RESERVED_USERNAMES:
            raise serializers.ValidationError("This username is reserved.")
        if '/' in value or '?' in value or '&' in value or '%' in value:
             raise serializers.ValidationError("Username contains invalid characters.")
        return value

    def validate_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def create(self, validated_data):
        print("DEBUG: Validated Data received:", validated_data)
        
        interests_data = validated_data.pop('interests', [])
        roles_data = validated_data.pop('roles', [])
        password = validated_data.pop('password')
        
        # Map roles to boolean fields if present (optional helper logic)
        if roles_data:
            if 'Gamer' in roles_data: validated_data['is_gamer'] = True
            if 'Developer' in roles_data: validated_data['is_developer'] = True
            if 'Investor' in roles_data: validated_data['is_investor'] = True

        # Create user securely
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
        fields = ['id', 'title', 'cover_image', 'release_date', 'igdb_id']
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

    class Meta:
        model = Review
        fields = ['id', 'user', 'game', 'game_id', 'rating', 'content', 'is_liked', 'is_bookmarked', 'bookmarks_count', 'is_completed', 'contains_spoilers', 'timestamp', 'type']
        read_only_fields = ['id', 'user', 'timestamp']

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Bookmark.objects.filter(user=request.user, review=obj).exists()
        return False

    def validate(self, data):
        request = self.context.get('request')
        if request and request.method == 'POST':
            game = data.get('game')
            # If game is looked up via game_id, it might be in validated_data as 'game' object
            if Review.objects.filter(user=request.user, game=game).exists():
                raise serializers.ValidationError("You have already reviewed this game.")
        return data


class SimplePostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    type = serializers.CharField(default='post', read_only=True)
    replies_count = serializers.IntegerField(source='replies.count', read_only=True)
    reply_to_username = serializers.SerializerMethodField()
    news_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = ['id', 'user', 'title', 'content', 'image', 'media_file', 'media_type', 'gif_url', 'poll_options', 'timestamp', 'parent', 'review_parent', 'news_parent', 'replies_count', 'type', 'reply_to_username', 'news_details']

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


# from core.models import Game, Review, Post, Project, JobPosting, PostMedia (Imported at top)

class PostMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMedia
        fields = ['id', 'file', 'media_type', 'order']

class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
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
            'id', 'user', 'title', 'content', 'image', 'parent', 'review_parent', 'news_parent', 'project_parent',
            'timestamp', 'replies', 'likes', 'replies_count', 'likes_count', 'is_liked', 'is_bookmarked', 'bookmarks_count',
            'review_details', 'news_details', 'project_details', 'parent_details', 'reply_to_username',
            'media_file', 'media_type', 'gif_url', 'poll_options', 'type',
            'media', 'uploaded_media'
        ]
        read_only_fields = ['id', 'user', 'timestamp', 'reply_to_username', 'replies_count', 'parent_details', 'news_details', 'project_details', 'type', 'media']

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

    def get_is_liked(self, obj):
        user = self.context.get('request').user
        if user.is_authenticated:
            return obj.likes.filter(id=user.id).exists()
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.bookmarks.filter(user=request.user).exists()
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


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    is_me = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'content', 'is_read', 'created_at', 'is_me']
        read_only_fields = ['id', 'sender', 'created_at', 'is_me']

    def get_is_me(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender == request.user
        return False

class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'participants', 'other_user', 'last_message', 'unread_count', 'updated_at']
        read_only_fields = ['id', 'participants', 'updated_at']

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
            return {
                'content': last_msg.content,
                'created_at': last_msg.created_at,
                'sender_username': last_msg.sender.username
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0



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
        if request and request.user.is_authenticated:
            return Like.objects.filter(user=request.user, news=obj).exists()
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Bookmark.objects.filter(user=request.user, news=obj).exists()
        return False

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
    members = ProjectMemberSerializer(many=True, read_only=True)
    followers_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = ['id', 'owner', 'title', 'description', 'cover_image', 'tech_stack', 'status', 'members', 'followers_count', 'is_following', 'created_at', 'updated_at']
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.followers.filter(user=request.user).exists()
        return False

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
