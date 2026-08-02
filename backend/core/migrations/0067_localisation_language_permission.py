# Manually written, mirroring 0064_community_translation.py's
# grant_community_translation_permissions — a new permission key must be backfilled onto already-
# seeded Role rows, since Role.permissions is a frozen-at-creation flat list, not derived live
# from PERMISSION_CATALOG.

from django.db import migrations

_NEW_KEY = 'localisation.language.manage'


def grant_localisation_language_permission(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for role in Role.objects.all():
        perms = role.permissions or []
        # Anyone who could already create translation keys has the same editorial authority to
        # configure which languages the project supports.
        if 'localisation.key.create' not in perms or _NEW_KEY in perms:
            continue
        perms.append(_NEW_KEY)
        role.permissions = perms
        role.save(update_fields=['permissions'])


def revoke_localisation_language_permission(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for role in Role.objects.all():
        perms = role.permissions or []
        if _NEW_KEY not in perms:
            continue
        role.permissions = [p for p in perms if p != _NEW_KEY]
        role.save(update_fields=['permissions'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0066_translation_plurals_and_locale_codes'),
    ]

    operations = [
        migrations.RunPython(grant_localisation_language_permission, revoke_localisation_language_permission),
    ]
