from rest_framework import serializers
from core.models import Game, Review, Post
from api.models import User, Interest, Follow, Notification, Conversation, Message

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
    # interest_ids removed as we are simplifying


    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'avatar', 'cover_image', 'bio', 'real_name', 'location', 'social_links', 'role',
            'phone_number', 'is_gamer', 'is_developer', 'is_investor',
            'gender', 'birth_date', 'show_birth_date', 'interests', 'platforms', 'top_favorites',
            'followers_count', 'following_count', 'is_following', 'steam_id'
        ]
        read_only_fields = ['id']

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
    class Meta:
        model = Game
        fields = ['id', 'title', 'cover_image', 'release_date', 'igdb_id']
        read_only_fields = ['id']

class ReviewSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    game = GameSerializer(read_only=True)
    game_id = serializers.PrimaryKeyRelatedField(queryset=Game.objects.all(), source='game', write_only=True)

    class Meta:
        model = Review
        fields = ['id', 'user', 'game', 'game_id', 'rating', 'text_comment', 'timestamp']
        read_only_fields = ['id', 'user', 'timestamp']



class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'user', 'content', 'image', 'media_file', 'media_type', 'gif_url', 'poll_options', 'timestamp']
        read_only_fields = ['id', 'user', 'timestamp']

    def validate_poll_options(self, value):
        if value:
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

from api.models import LibraryEntry

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
