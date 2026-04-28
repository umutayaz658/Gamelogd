from rest_framework import serializers
from api.recommendation_models import PostInteraction, UserActivityProfile, PostScoreCache
from api.models import User


class PostInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostInteraction
        fields = ['id', 'user', 'post', 'interaction_type', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class UserActivityProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserActivityProfile
        fields = ['user', 'active_hours', 'media_preferences', 'interaction_count', 'last_updated']
        read_only_fields = ['user', 'interaction_count', 'last_updated']


class PostScoreCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostScoreCache
        fields = [
            'post', 'engagement_score', 'virality_score',
            'view_count', 'like_count', 'comment_count',
            'share_count', 'play_request_count', 'updated_at',
        ]
        read_only_fields = ['__all__']


class FriendSuggestionSerializer(serializers.Serializer):
    """Arkadaş önerileri için response serializer."""
    user = serializers.SerializerMethodField()
    score = serializers.FloatField()
    common_games = serializers.IntegerField()

    def get_user(self, obj):
        from api.serializers import UserSerializer
        request = self.context.get('request')
        return UserSerializer(obj['user'], context={'request': request}).data
