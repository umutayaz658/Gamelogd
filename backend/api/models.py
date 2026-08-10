from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.conf import settings as django_settings
from django.utils import timezone
from datetime import timedelta
import random
import re


class Interest(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)

    def __str__(self):
        return self.name


def extract_hashtags(content):
    """Pulls #tags out of post content — lowercased, deduped, capped at 20 (mirrors the
    @mention cap in create_comment_notification below). Shared by the post-save sync
    signal and the one-off backfill_post_hashtags command so both stay in sync."""
    tags = {tag.lower()[:100] for tag in re.findall(r'#([a-zA-Z0-9_]+)', content or '')}
    return list(tags)[:20]


class PostHashtag(models.Model):
    """One row per (post, hashtag) pair, kept in sync with Post.content by a post_save
    signal (see sync_post_hashtags below). Backs the Explore trending-hashtags endpoint
    with a small, indexed table instead of scanning Post.content live on every request."""
    post = models.ForeignKey('core.Post', on_delete=models.CASCADE, related_name='hashtags')
    tag = models.CharField(max_length=100, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'tag')
        indexes = [
            models.Index(fields=['created_at'], name='posthashtag_created_idx'),
        ]

    def __str__(self):
        return f"#{self.tag} on post {self.post_id}"


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

    # Steam & Xbox Integration
    steam_id = models.CharField(max_length=20, blank=True)
    xbox_gamertag = models.CharField(max_length=50, blank=True, null=True)
    
    settings = models.JSONField(default=default_user_settings, blank=True)
    dnd_mode = models.BooleanField(default=False)

    # Denormalized mirror of settings['privateProfile'], kept in sync in save(). Indexed so the
    # feed/list "exclude private profiles I don't follow" filter can use a plain boolean column
    # instead of a settings__privateProfile JSON lookup that full-scans the users table on every
    # feed/post request.
    is_private = models.BooleanField(default=False, db_index=True)

    def save(self, *args, **kwargs):
        self.is_private = bool((self.settings or {}).get('privateProfile', False))
        update_fields = kwargs.get('update_fields')
        if update_fields is not None and 'settings' in update_fields and 'is_private' not in update_fields:
            kwargs['update_fields'] = list(update_fields) + ['is_private']
        super().save(*args, **kwargs)

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
    steam_playtime = models.IntegerField(default=0) # In minutes
    xbox_playtime = models.IntegerField(default=0) # In minutes
    playtime_forever = models.IntegerField(default=0) # Total combined playtime
    platform = models.CharField(max_length=100, default='Steam')
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
    # Mirrors the NotificationType union in frontend/src/lib/notifications.ts — that file used to
    # be the only source of truth (derived client-side from `verb` text via string matching); this
    # field makes it authoritative server-side going forward. 'unknown' covers legacy/unclassified
    # rows and any verb that doesn't map to a specific type (e.g. the Xbox sync status messages).
    NOTIFICATION_TYPES = [
        ('like', 'Like'),
        ('mention', 'Mention'),
        ('reply', 'Reply'),
        ('comment_review', 'Comment on Review'),
        ('repost', 'Repost'),
        ('quote', 'Quote'),
        ('follow', 'Follow'),
        ('follow_request', 'Follow Request'),
        ('follow_request_accepted', 'Follow Request Accepted'),
        ('project_invite', 'Project Invite'),
        ('project_invite_accepted', 'Project Invite Accepted'),
        ('project_followed', 'Project Followed'),
        ('org_invite', 'Organisation Invite'),
        ('org_invite_accepted', 'Organisation Invite Accepted'),
        ('org_ownership_transfer_to_you', 'Org Ownership Transfer To You'),
        ('org_ownership_transfer_confirmation', 'Org Ownership Transfer Confirmation'),
        ('group_invite', 'Group Chat Invite'),
        ('group_invite_accepted', 'Group Chat Invite Accepted'),
        ('message_request', 'Message Request'),
        ('message_request_accepted', 'Message Request Accepted'),
        ('playtest_feedback', 'Playtest Feedback'),
        ('steam_sync_success', 'Steam Sync Success'),
        ('steam_sync_failed', 'Steam Sync Failed'),
        ('unknown', 'Unknown'),
    ]

    # Notification types eligible for Twitter/Instagram-style write-time aggregation: a new like
    # or follow within the window below bumps the existing row (actor_count/recent_actor_ids)
    # instead of creating a new one. Deliberately narrow — replies/mentions/invites etc. always
    # stay one row per event, matching how those platforms only aggregate engagement notifications.
    GROUPABLE_TYPES = {'like', 'follow'}
    GROUPING_WINDOW = timedelta(hours=24)

    recipient = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    actor = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='triggered_notifications', on_delete=models.CASCADE)
    verb = models.CharField(max_length=255)
    notification_type = models.CharField(max_length=40, choices=NOTIFICATION_TYPES, blank=True, db_index=True)
    # Most-recent-first, capped at 3 — enough for the frontend's stacked-avatar "X, Y and N others"
    # row without needing a join to a separate actor-list table for a fixed small cap.
    recent_actor_ids = models.JSONField(default=list, blank=True)
    actor_count = models.PositiveIntegerField(default=1)

    target_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    target_id = models.PositiveIntegerField(null=True, blank=True)
    target = GenericForeignKey('target_type', 'target_id')

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            # The notification list is always "mine, newest first" — one composite index
            # serves the filter and the sort together (same shape as Post's 0061 indexes).
            models.Index(fields=['recipient', '-created_at'], name='notif_recip_created_idx'),
        ]

    def __str__(self):
        return f"Notification for {self.recipient}: {self.actor} {self.verb}"


def create_notification(recipient, actor, verb, target=None, target_type=None, target_id=None, notification_type=None):
    """
    Central entry point for creating a Notification. Every notification-creation call site in the
    codebase (signals below, plus the ones in views.py) should go through this rather than calling
    Notification.objects.create() directly, so that mute-suppression and write-time grouping only
    need to live in one place. Returns None (no-op) if the recipient has muted the actor — mirrors
    Twitter's mute semantics, where muting someone also silences their notifications.

    Accepts either `target` (a model instance, resolved via the GenericForeignKey) or an explicit
    `target_type`/`target_id` pair, matching however the call site already had the reference handy.

    For `notification_type` in Notification.GROUPABLE_TYPES, reuses (and "re-opens" — bumps back to
    unread) an existing unread-or-read notification for the same (recipient, type, target) within
    the last 24h instead of creating a new row, so ten likes on one post surface as a single grouped
    notification/unread-count bump rather than ten separate rows.
    """
    from api.models import Mute
    if Mute.objects.filter(muter=recipient, muted=actor).exists():
        return None

    if target is not None and target_type is None and target_id is None:
        target_type = ContentType.objects.get_for_model(target)
        target_id = target.pk

    if notification_type in Notification.GROUPABLE_TYPES:
        window_start = timezone.now() - Notification.GROUPING_WINDOW
        existing = Notification.objects.filter(
            recipient=recipient, notification_type=notification_type,
            target_type=target_type, target_id=target_id,
            created_at__gte=window_start,
        ).order_by('-created_at').first()
        if existing:
            if existing.actor_id != actor.id:
                existing.actor_count += 1
                existing.recent_actor_ids = ([actor.id] + [i for i in existing.recent_actor_ids if i != actor.id])[:3]
            existing.actor = actor
            existing.verb = verb
            existing.is_read = False
            existing.created_at = timezone.now()
            existing.save(update_fields=['actor_count', 'recent_actor_ids', 'actor', 'verb', 'is_read', 'created_at'])
            return existing

    return Notification.objects.create(
        recipient=recipient, actor=actor, verb=verb,
        target_type=target_type, target_id=target_id,
        notification_type=notification_type or '',
        recent_actor_ids=[actor.id],
    )


@receiver(post_save, sender=Follow)
def create_follow_notification(sender, instance, created, **kwargs):
    if created:
        create_notification(
            recipient=instance.following,
            actor=instance.follower,
            verb='started following you',
            notification_type='follow',
        )

@receiver(post_save, sender='core.Post')
def create_comment_notification(sender, instance, created, **kwargs):
    if created:
        # 1. Reply to another post (comment on post)
        if instance.parent and instance.parent.user != instance.user:
            create_notification(
                recipient=instance.parent.user,
                actor=instance.user,
                verb='replied to your post',
                target=instance,
                notification_type='reply',
            )
        # 2. Comment on a review
        elif instance.review_parent and instance.review_parent.user != instance.user:
            create_notification(
                recipient=instance.review_parent.user,
                actor=instance.user,
                verb='commented on your review',
                target=instance,
                notification_type='comment_review',
            )

        # 3. Handle mentions — resolve all usernames in one query and bulk-create the
        # notifications, instead of a User.objects.get() + Notification.objects.create() pair
        # per @mention (an unbounded query loop on a long post with many mentions).
        import re
        from django.db.models import Q
        from django.contrib.contenttypes.models import ContentType
        mentions = set(re.findall(r'@([a-zA-Z0-9_-]+)', instance.content or ''))
        mentions.discard(instance.user.username)
        # Cap so a post crafted with dozens of @mentions can't be used to spam notifications.
        mentions = list(mentions)[:20]
        if mentions:
            username_filter = Q()
            for username in mentions:
                username_filter |= Q(username__iexact=username)
            mentioned_users = User.objects.filter(username_filter).exclude(
                username__iexact=instance.user.username
            ).distinct()

            muted_by_ids = set(Mute.objects.filter(
                muter__in=mentioned_users, muted=instance.user
            ).values_list('muter_id', flat=True))

            content_type = ContentType.objects.get_for_model(instance)
            Notification.objects.bulk_create([
                Notification(
                    recipient=u,
                    actor=instance.user,
                    verb='mentioned you in a post',
                    target_type=content_type,
                    target_id=instance.id,
                    notification_type='mention',
                    recent_actor_ids=[instance.user.id],
                )
                for u in mentioned_users if u.id not in muted_by_ids
            ])

@receiver(post_save, sender='core.Post')
def sync_post_hashtags(sender, instance, created, **kwargs):
    # Separate from create_comment_notification above: that one is deliberately gated
    # `if created` (notifications shouldn't refire on every edit), but hashtags must stay
    # in sync across edits too since Post.content is editable via PATCH after creation.
    update_fields = kwargs.get('update_fields')
    if update_fields is not None and 'content' not in update_fields:
        # This save didn't touch content (e.g. a trending_score or category-only update)
        # — hashtags can't have changed, skip the resync.
        return

    tags = extract_hashtags(instance.content)
    PostHashtag.objects.filter(post=instance).delete()
    if tags:
        PostHashtag.objects.bulk_create([PostHashtag(post=instance, tag=t) for t in tags])

@receiver(post_save, sender='core.Like')
def create_like_notification(sender, instance, created, **kwargs):
    if created:
        # 1. Like on a post
        if instance.post and instance.post.user != instance.user:
            create_notification(
                recipient=instance.post.user,
                actor=instance.user,
                verb='liked your post',
                target=instance.post,
                notification_type='like',
            )
        # 2. Like on a review
        elif instance.review and instance.review.user != instance.user:
            create_notification(
                recipient=instance.review.user,
                actor=instance.user,
                verb='liked your review',
                target=instance.review,
                notification_type='like',
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
        if instance.conversation.is_group:
            create_notification(
                recipient=instance.user,
                actor=instance.invited_by,
                verb='invited you to a group chat',
                target=instance.conversation,
                notification_type='group_invite',
            )
        else:
            # 1:1 DM request (Area 3 — start_chat sets the recipient's membership to 'pending'
            # instead of force-accepting it when no follow relationship exists between the two).
            create_notification(
                recipient=instance.user,
                actor=instance.invited_by,
                verb='sent you a message request',
                target=instance.conversation,
                notification_type='message_request',
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
    pinned_at = models.DateTimeField(null=True, blank=True)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            # Every chat open filters by conversation and sorts by created_at — the separate
            # FK index + created_at index can't serve that in one scan.
            models.Index(fields=['conversation', 'created_at'], name='msg_conv_created_idx'),
        ]

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


class PendingEmailChange(models.Model):
    """One pending email-change request per user, verified the same way
    PendingRegistration verifies a fresh signup: a 6-digit code sent to the new
    address, with the same expiry + brute-force lockout behavior."""
    user = models.OneToOneField(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pending_email_change')
    new_email = models.EmailField()
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    failed_attempts = models.PositiveIntegerField(default=0)

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
        return f"Pending email change for {self.user.username} -> {self.new_email} (Code: {self.code})"


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


class Mute(models.Model):
    """
    Content-only suppression, distinct from Block: a muted user's posts/reviews/notifications are
    hidden from the muter's feeds, but (unlike Block) Follow/FollowRequest are left untouched and
    the muted user can still message/view/follow the muter, matching Twitter's mute semantics.
    """
    muter = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='muting_users', on_delete=models.CASCADE)
    muted = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='muted_by_users', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('muter', 'muted')

    def __str__(self):
        return f"{self.muter} muted {self.muted}"


class Report(models.Model):
    """
    Generic report against any content type (post, review, user, conversation, ...). Uses a
    GenericForeignKey (same pattern as Notification.target above) since the reportable-type set
    is expected to grow, unlike the fixed few target types Like/Bookmark cover.
    """
    REASON_CHOICES = [
        ('spam', 'Spam'),
        ('harassment', 'Harassment or bullying'),
        ('hate_speech', 'Hate speech'),
        ('nudity', 'Nudity or sexual content'),
        ('violence', 'Violence or dangerous content'),
        ('misinformation', 'Misinformation'),
        ('self_harm', 'Self-harm'),
        ('impersonation', 'Impersonation'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('reviewed', 'Reviewed'),
        ('dismissed', 'Dismissed'),
        ('actioned', 'Actioned'),
    ]

    reporter = models.ForeignKey(django_settings.AUTH_USER_MODEL, related_name='reports_filed', on_delete=models.CASCADE)

    target_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    target_id = models.PositiveIntegerField()
    target = GenericForeignKey('target_type', 'target_id')

    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [models.Index(fields=['target_type', 'target_id'], name='report_target_idx')]
        constraints = [
            models.UniqueConstraint(fields=['reporter', 'target_type', 'target_id'], name='unique_report_per_reporter_target'),
        ]

    def __str__(self):
        return f"Report by {self.reporter} on {self.target_type}:{self.target_id} ({self.reason})"


@receiver(post_save, sender=Notification)
def trigger_notification_websocket_update(sender, instance, created, **kwargs):
    from api.consumers import send_user_update
    send_user_update(instance.recipient_id)

@receiver(post_delete, sender=Notification)
def trigger_notification_websocket_delete(sender, instance, **kwargs):
    from api.consumers import send_user_update
    send_user_update(instance.recipient_id)

@receiver(post_save, sender=Message)
def trigger_message_websocket_update(sender, instance, created, **kwargs):
    if created:
        from api.consumers import send_user_update
        # Notify all participants in the conversation except the sender
        for participant in instance.conversation.participants.all():
            if participant.id != instance.sender_id:
                send_user_update(participant.id)



