from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.conf import settings as django_settings
from django.utils import timezone
from datetime import timedelta
import random


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
        "steamStatusPrivate": False,
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
    dnd_mode = models.BooleanField(default=False)

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

class FollowRequest(models.Model):
    sender = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='sent_follow_requests', on_delete=models.CASCADE)
    receiver = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='received_follow_requests', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('sender', 'receiver')

    def __str__(self):
        return f"{self.sender} wants to follow {self.receiver}"

class Notification(models.Model):
    recipient = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    actor = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='triggered_notifications', on_delete=models.CASCADE)
    verb = models.CharField(max_length=255)
    
    target_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    target_id = models.PositiveIntegerField(null=True, blank=True)
    target = GenericForeignKey('target_type', 'target_id')
    
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

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
        
        # 3. Handle mentions
        import re
        mentions = re.findall(r'@([a-zA-Z0-9_-]+)', instance.content or '')
        for username in set(mentions):
            if username.lower() == instance.user.username.lower():
                continue
            try:
                mentioned_user = User.objects.get(username__iexact=username)
                Notification.objects.create(
                    recipient=mentioned_user,
                    actor=instance.user,
                    verb='mentioned you in a post',
                    target=instance
                )
            except User.DoesNotExist:
                pass

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
    is_group = models.BooleanField(default=False)
    name = models.CharField(max_length=255, blank=True, null=True)
    avatar = models.ImageField(upload_to='group_avatars/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Conversation {self.id}"

class ConversationMember(models.Model):
    MEMBERSHIP_STATUS = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('left', 'Left'),
        ('blocked', 'Blocked'),
    ]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversation_memberships')
    is_admin = models.BooleanField(default=False)
    is_muted = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=MEMBERSHIP_STATUS, default='accepted', db_index=True)
    invited_by = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_group_invites')

    class Meta:
        unique_together = ('conversation', 'user')

    def __str__(self):
        return f"{self.user.username} ({self.status}) in Conversation {self.conversation.id}"

@receiver(post_save, sender=ConversationMember)
def create_group_invite_notification(sender, instance, created, **kwargs):
    if created and instance.status == 'pending' and instance.invited_by:
        Notification.objects.create(
            recipient=instance.user,
            actor=instance.invited_by,
            verb='invited you to a group chat',
            target=instance.conversation
        )

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='sent_messages', on_delete=models.CASCADE)
    content = models.TextField(blank=True, default='')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # Attachments
    image = models.ImageField(upload_to='messages/', null=True, blank=True)
    gif_url = models.URLField(max_length=500, null=True, blank=True)
    
    # Shared Items
    shared_post = models.ForeignKey('core.Post', on_delete=models.SET_NULL, null=True, blank=True, related_name='shared_messages')
    shared_review = models.ForeignKey('core.Review', on_delete=models.SET_NULL, null=True, blank=True, related_name='shared_messages')
    shared_news = models.ForeignKey('core.News', on_delete=models.SET_NULL, null=True, blank=True, related_name='shared_messages')

    # Replying
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')

    # Message states
    is_pinned = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender} in {self.conversation}"

class MessageReaction(models.Model):
    message = models.ForeignKey(Message, related_name='reactions', on_delete=models.CASCADE)
    user = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user', 'emoji')

    def __str__(self):
        return f"{self.user.username} reacted {self.emoji} to message {self.message.id}"

class BlockedUser(models.Model):
    blocker = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_chat_users')
    blocked = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by_chat')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')

    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked.username}"

class ConversationReport(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='reports')
    reported_by = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversation_reports')
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report on Conversation {self.conversation.id} by {self.reported_by.username}"

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


class PendingRegistration(models.Model):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=6)
    registration_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    # Wrong-code attempts against this code; used to lock out brute force even from
    # distributed IPs that would slip past request throttling.
    failed_attempts = models.PositiveIntegerField(default=0)

    # After this many wrong codes the pending registration is invalidated and the user
    # must request a fresh code.
    MAX_VERIFY_ATTEMPTS = 5

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=5)
        super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    @classmethod
    def generate_code(cls):
        import secrets
        return "".join(secrets.choice("0123456789") for _ in range(6))

    def __str__(self):
        return f"Pending registration for {self.email} (Code: {self.code})"


class Block(models.Model):
    blocker = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='blocking_users', on_delete=models.CASCADE)
    blocked = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='blocked_users', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')

    def save(self, *args, **kwargs):
        # Automatically clean up any mutual follows when blocking
        from api.models import Follow, FollowRequest
        Follow.objects.filter(
            models.Q(follower=self.blocker, following=self.blocked) |
            models.Q(follower=self.blocked, following=self.blocker)
        ).delete()
        # Automatically clean up any pending follow requests when blocking
        FollowRequest.objects.filter(
            models.Q(sender=self.blocker, receiver=self.blocked) |
            models.Q(sender=self.blocked, receiver=self.blocker)
        ).delete()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.blocker} blocked {self.blocked}"


