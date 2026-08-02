# Manually written. 0064 and 0067 backfilled new permission keys onto existing roles by
# capability heuristics, which (combined with _member_permissions() auto-including every new
# non-delete key) silently granted the seeded baseline "Member" role moderation of the PUBLIC
# community-translation surface and project language configuration. api.permission_catalog now
# excludes those keys from the Member baseline; this strips them from already-seeded Member
# rows. Deliberately scoped to system roles with is_default_for='member' — custom roles and
# Owner/Admin keep whatever they have, since those grants were either explicit or intended.

from django.db import migrations

_REVOKED_KEYS = [
    'community_translation.approve',
    'community_translation.reject',
    'localisation.language.manage',
]


def tighten_member_roles(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for role in Role.objects.filter(is_system=True, is_default_for='member'):
        perms = role.permissions or []
        cleaned = [p for p in perms if p not in _REVOKED_KEYS]
        if cleaned != perms:
            role.permissions = cleaned
            role.save(update_fields=['permissions'])


def regrant_member_roles(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    for role in Role.objects.filter(is_system=True, is_default_for='member'):
        perms = role.permissions or []
        changed = False
        for key in _REVOKED_KEYS:
            if key not in perms:
                perms.append(key)
                changed = True
        if changed:
            role.permissions = perms
            role.save(update_fields=['permissions'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0067_localisation_language_permission'),
    ]

    operations = [
        migrations.RunPython(tighten_member_roles, regrant_member_roles),
    ]
