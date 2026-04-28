from django.db import models
from django.conf import settings


class PostInteraction(models.Model):
    """
    Her görüntüleme, paylaşım ve birlikte oynama isteğini izler.
    Like ve Comment zaten mevcut modeller (Like, Post reply) ile takip ediliyor;
    bu model view, share ve play_request gibi ek etkileşimleri kapsar.
    """
    INTERACTION_TYPES = [
        ('view', 'View'),
        ('like', 'Like'),
        ('comment', 'Comment'),
        ('share', 'Share'),
        ('play_request', 'Play Request'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='post_interactions'
    )
    post = models.ForeignKey(
        'core.Post',
        on_delete=models.CASCADE,
        related_name='interactions'
    )
    interaction_type = models.CharField(max_length=20, choices=INTERACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'interaction_type', '-created_at']),
            models.Index(fields=['post', 'interaction_type']),
            models.Index(fields=['post', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user} → {self.interaction_type} → Post {self.post_id}"


class UserActivityProfile(models.Model):
    """
    Kullanıcının aktiflik saatlerini, medya tercihlerini ve
    toplam etkileşim sayısını cache'ler.
    Celery beat ile periyodik olarak güncellenir.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='activity_profile'
    )
    # Kullanıcının en aktif olduğu saatler (UTC, 0-23), örn: [14, 15, 20, 21, 22]
    active_hours = models.JSONField(default=list, blank=True)
    # Medya türü tercihleri, örn: {"video": 0.6, "image": 0.3, "text": 0.1}
    media_preferences = models.JSONField(default=dict, blank=True)
    # Toplam etkileşim sayısı (cold start geçişi için kullanılır)
    interaction_count = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ActivityProfile({self.user})"


class PostScoreCache(models.Model):
    """
    Hesaplanan post skorlarını cache'ler.
    Celery beat veya management command ile periyodik güncellenir (örn. 5 dk).
    """
    post = models.OneToOneField(
        'core.Post',
        on_delete=models.CASCADE,
        related_name='score_cache'
    )
    engagement_score = models.FloatField(default=0.0)
    virality_score = models.FloatField(default=0.0)
    view_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)
    share_count = models.IntegerField(default=0)
    play_request_count = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['-engagement_score']),
        ]

    def __str__(self):
        return f"ScoreCache(Post {self.post_id}, eng={self.engagement_score:.2f})"
