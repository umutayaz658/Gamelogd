from django.db import migrations, models


def migrate_critical_to_urgent(apps, schema_editor):
    PlaytestFeedback = apps.get_model('core', 'PlaytestFeedback')
    PlaytestFeedback.objects.filter(priority='critical').update(priority='urgent')


def reverse_migrate_urgent_to_critical(apps, schema_editor):
    PlaytestFeedback = apps.get_model('core', 'PlaytestFeedback')
    PlaytestFeedback.objects.filter(priority='urgent').update(priority='critical')


# Old blanket permission -> the granular set it's split into. Preserves existing role
# capabilities exactly (anyone who could convert-to-task before can still do everything
# they could before), while making each action independently assignable going forward.
_OLD_MANAGER_KEY = 'playtest.convert_to_task'
_NEW_MANAGER_KEYS = [
    'feedback.pin',
    'feedback.mark_in_progress',
    'feedback.mark_resolved',
    'feedback.convert_to_task',
    'feedback.delete',
]
_REMOVED_KEYS = ['playtest.view', 'playtest.submit']


def migrate_role_permissions_forward(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for role in Role.objects.all():
        perms = role.permissions or []
        if _OLD_MANAGER_KEY not in perms and not any(k in perms for k in _REMOVED_KEYS):
            continue
        new_perms = [p for p in perms if p not in _REMOVED_KEYS]
        if _OLD_MANAGER_KEY in new_perms:
            new_perms = [p for p in new_perms if p != _OLD_MANAGER_KEY]
            # feedback.delete is a delete-tier capability that the fresh seed deliberately
            # withholds from the "Member" role (_member_permissions() drops every .delete
            # key). The old world had no server-side feedback delete at all, so granting it
            # here would hand a *new* destructive power to roles that shouldn't have it and
            # would make migrated orgs behave differently from freshly-created ones. Only
            # grant feedback.delete to roles that are already delete-capable (admin/owner
            # tier, or holding some other .delete key); everyone else who could
            # convert-to-task before gets the non-destructive feedback keys only.
            already_delete_capable = (
                getattr(role, 'is_default_for', None) in ('owner', 'admin')
                or any(p.endswith('.delete') or p.endswith('.delete_any') for p in new_perms)
            )
            keys_to_add = [
                k for k in _NEW_MANAGER_KEYS
                if k != 'feedback.delete' or already_delete_capable
            ]
            for key in keys_to_add:
                if key not in new_perms:
                    new_perms.append(key)
        role.permissions = new_perms
        role.save(update_fields=['permissions'])


def migrate_role_permissions_reverse(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for role in Role.objects.all():
        perms = role.permissions or []
        if not any(k in perms for k in _NEW_MANAGER_KEYS):
            continue
        new_perms = [p for p in perms if p not in _NEW_MANAGER_KEYS]
        new_perms.append(_OLD_MANAGER_KEY)
        role.permissions = new_perms
        role.save(update_fields=['permissions'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0054_feedback_redesign_remove_steam'),
    ]

    operations = [
        migrations.RenameField(
            model_name='playtestfeedback',
            old_name='severity',
            new_name='priority',
        ),
        migrations.RunPython(migrate_critical_to_urgent, reverse_migrate_urgent_to_critical),
        migrations.AlterField(
            model_name='playtestfeedback',
            name='priority',
            field=models.CharField(choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('urgent', 'Urgent')], max_length=20),
        ),
        migrations.RunPython(migrate_role_permissions_forward, migrate_role_permissions_reverse),
    ]
