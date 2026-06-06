from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.conf import settings as django_settings

class Interest(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)

    def __str__(self):
        return self.name

def default_user_settings():
    return {
        "privateProfile": False,
        "directMessages": True,
        "shareActivity": True,
        "blurSpoilers": True,
        "matureContent": False,
        "newFollowers": True,
        "mentions": True,
        "jobAlerts": True,
        "language": "English",
        "fontSize": "Medium",
        "accentColor": "Emerald",
        "connected_accounts": {
            "psn": {"connected": False, "username": ""},
            "xbox": {"connected": False, "username": ""},
            "twitch": {"connected": False, "username": ""},
            "epic": {"connected": False, "username": ""},
            "gog": {"connected": False, "username": ""},
            "ea": {"connected": False, "username": ""}
        }
    }

class User(AbstractUser):
    ROLE_CHOICES = (
        ('gamer', 'Gamer'),
        ('dev', 'Developer'),
        ('investor', 'Investor'),
    )
    bio = models.TextField(blank=True, max_length=500)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='covers/', null=True, blank=True)
    
    # Bio Details
    real_name = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=100, blank=True)
    
    # Social Links
    social_links = models.JSONField(default=dict, blank=True)

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='gamer')

    # Contact Info
    phone_number = models.CharField(max_length=20, blank=True)

    # Roles (Boolean for multi-role support)
    is_gamer = models.BooleanField(default=True)
    is_developer = models.BooleanField(default=False)
    is_investor = models.BooleanField(default=False)

    # Demographics
    class GenderChoices(models.TextChoices):
        MALE = 'Male', 'Male'
        FEMALE = 'Female', 'Female'
        NON_BINARY = 'Non-binary', 'Non-binary'
        PREFER_NOT_TO_SAY = 'Prefer not to say', 'Prefer not to say'

    gender = models.CharField(
        max_length=20, 
        choices=GenderChoices.choices, 
        default=GenderChoices.PREFER_NOT_TO_SAY
    )
    birth_date = models.DateField(null=True, blank=True)
    show_birth_date = models.BooleanField(default=False)

    # Interests & Platforms
    interests = models.ManyToManyField(Interest, blank=True)
    platforms = models.JSONField(default=list, blank=True)  # Stores ['PC', 'PS5', etc.]
    top_favorites = models.JSONField(default=list, blank=True)  # Stores [{'slot': 0, 'game_id': 123, ...}]

    # Steam Integration
    steam_id = models.CharField(max_length=20, blank=True)
    settings = models.JSONField(default=default_user_settings, blank=True)

    def __str__(self):
        return self.username

class LibraryEntry(models.Model):
    STATUS_CHOICES = (
        ('unplayed', 'Unplayed'),
        ('plan_to_play', 'Plan to Play'),
        ('playing', 'Playing'),
        ('replaying', 'Replaying'),
        ('completed', 'Completed'),
        ('dropped', 'Dropped'),
    )
    user = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='library', on_delete=models.CASCADE)
    game = models.ForeignKey('core.Game', related_name='library_entries', on_delete=models.CASCADE)
    playtime_forever = models.IntegerField(default=0) # In minutes
    platform = models.CharField(max_length=50, default='Steam')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unplayed', db_index=True)
    added_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'game')

    def __str__(self):
        return f"{self.user} owns {self.game}"

class Follow(models.Model):
    follower = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='following', on_delete=models.CASCADE)
    following = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='followers', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower} follows {self.following}"

class Notification(models.Model):
    recipient = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    actor = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='triggered_notifications', on_delete=models.CASCADE)
    verb = models.CharField(max_length=255)
    
    target_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    target_id = models.PositiveIntegerField(null=True, blank=True)
    target = GenericForeignKey('target_type', 'target_id')
    
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient}: {self.actor} {self.verb}"

@receiver(post_save, sender=Follow)
def create_follow_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            recipient=instance.following,
            actor=instance.follower,
            verb='started following you'
        )

@receiver(post_save, sender='core.Post')
def create_comment_notification(sender, instance, created, **kwargs):
    if created:
        # 1. Reply to another post (comment on post)
        if instance.parent and instance.parent.user != instance.user:
            Notification.objects.create(
                recipient=instance.parent.user,
                actor=instance.user,
                verb='replied to your post',
                target=instance
            )
        # 2. Comment on a review
        elif instance.review_parent and instance.review_parent.user != instance.user:
            Notification.objects.create(
                recipient=instance.review_parent.user,
                actor=instance.user,
                verb='commented on your review',
                target=instance
            )

@receiver(post_save, sender='core.Like')
def create_like_notification(sender, instance, created, **kwargs):
    if created:
        # 1. Like on a post
        if instance.post and instance.post.user != instance.user:
            Notification.objects.create(
                recipient=instance.post.user,
                actor=instance.user,
                verb='liked your post',
                target=instance.post
            )
        # 2. Like on a review
        elif instance.review and instance.review.user != instance.user:
            Notification.objects.create(
                recipient=instance.review.user,
                actor=instance.user,
                verb='liked your review',
                target=instance.review
            )

class Conversation(models.Model):
    participants = models.ManyToManyField(django_settings.AUTH_USER_MODEL, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Conversation {self.id}"

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='sent_messages', on_delete=models.CASCADE)
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender} in {self.conversation}"

class SupportTicket(models.Model):
    TICKET_TYPE_CHOICES = [
        ('support', 'Support Contact'),
        ('bug', 'Bug Report'),
    ]
    user = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='support_tickets')
    ticket_type = models.CharField(max_length=10, choices=TICKET_TYPE_CHOICES, default='support')
    subject = models.CharField(max_length=255)
    category = models.CharField(max_length=50)
    description = models.TextField()
    steps_to_reproduce = models.TextField(blank=True, null=True)
    severity = models.CharField(max_length=20, blank=True, null=True)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.ticket_type.upper()} - {self.subject} by {self.user.username}"
