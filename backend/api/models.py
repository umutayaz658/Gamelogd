from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.conf import settings

class Interest(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)

    def __str__(self):
        return self.name

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

    def __str__(self):
        return self.username

class LibraryEntry(models.Model):
    STATUS_CHOICES = (
        ('unplayed', 'Unplayed'),
        ('playing', 'Playing'),
        ('replaying', 'Replaying'),
        ('completed', 'Completed'),
        ('dropped', 'Dropped'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='library', on_delete=models.CASCADE)
    game = models.ForeignKey('core.Game', related_name='library_entries', on_delete=models.CASCADE)
    playtime_forever = models.IntegerField(default=0) # In minutes
    platform = models.CharField(max_length=50, default='Steam')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unplayed')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'game')

    def __str__(self):
        return f"{self.user} owns {self.game}"

class Follow(models.Model):
    follower = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='following', on_delete=models.CASCADE)
    following = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='followers', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower} follows {self.following}"

class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='triggered_notifications', on_delete=models.CASCADE)
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

class Conversation(models.Model):
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Conversation {self.id}"

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='sent_messages', on_delete=models.CASCADE)
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender} in {self.conversation}"
