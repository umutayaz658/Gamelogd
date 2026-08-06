from django.db import migrations


# Ports frontend/src/lib/notifications.ts's resolveNotificationType() to Python so pre-existing
# rows (created before the notification_type field existed) get classified the same way the
# frontend has always classified them client-side from the free-text `verb`. New rows going
# forward are typed at creation time by api.models.create_notification() instead.
def classify(verb, is_self_actor):
    v = verb.lower()

    if v.startswith('your steam library sync'):
        return 'steam_sync_success'
    if v.startswith('steam library sync failed'):
        return 'steam_sync_failed'
    if 'transferred ownership of' in v:
        return 'org_ownership_transfer_confirmation' if is_self_actor else 'org_ownership_transfer_to_you'

    if 'requested to follow' in v:
        return 'follow_request'
    if 'accepted your follow request' in v:
        return 'follow_request_accepted'
    if 'accepted your invite to join the project' in v:
        return 'project_invite_accepted'
    if 'invited you to join the project' in v:
        return 'project_invite'
    if 'followed your project' in v:
        return 'project_followed'
    if 'accepted your invitation to join' in v:
        return 'org_invite_accepted'
    if 'invited you to a group chat' in v:
        return 'group_invite'
    if 'sent you a message request' in v:
        return 'message_request'
    if 'invited you to join' in v:
        return 'org_invite'
    if 'started following' in v or 'followed you' in v or 'following you' in v:
        return 'follow'
    if 'commented on your review' in v:
        return 'comment_review'
    if 'replied' in v:
        return 'reply'
    if 'liked' in v:
        return 'like'
    if 'mentioned' in v:
        return 'mention'
    if 'quoted' in v:
        return 'quote'
    if 'reposted' in v:
        return 'repost'

    return 'unknown'


def backfill_notification_type(apps, schema_editor):
    Notification = apps.get_model('api', 'Notification')
    batch = []
    for notif in Notification.objects.filter(notification_type='').iterator():
        notif.notification_type = classify(notif.verb, notif.actor_id == notif.recipient_id)
        notif.recent_actor_ids = [notif.actor_id]
        batch.append(notif)
        if len(batch) >= 1000:
            Notification.objects.bulk_update(batch, ['notification_type', 'recent_actor_ids'])
            batch = []
    if batch:
        Notification.objects.bulk_update(batch, ['notification_type', 'recent_actor_ids'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0030_notification_actor_count_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_notification_type, noop_reverse),
    ]
