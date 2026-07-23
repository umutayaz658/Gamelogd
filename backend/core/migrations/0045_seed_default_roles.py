from django.db import migrations


def seed_default_roles(apps, schema_editor):
    # Must use the historical models (apps.get_model), not the real ones: this RunPython is
    # replayed from scratch on every fresh migrate (new environment, CI, `manage.py test`'s test
    # database). The real Organisation/Role model classes reflect the CURRENT code, which by now
    # includes columns added by migrations that run *after* this one (e.g. extra_links, added in
    # 0058) — querying with the real model here selects a column that doesn't exist yet at this
    # point in a from-scratch replay and raises ProgrammingError. SYSTEM_ROLE_SEEDS is plain
    # data (no model import), so it's safe to reuse directly instead of calling
    # create_default_roles (which internally imports the real Role model).
    from api.permission_catalog import SYSTEM_ROLE_SEEDS

    Organisation = apps.get_model('core', 'Organisation')
    Role = apps.get_model('core', 'Role')

    for organisation in Organisation.objects.all():
        for name, default_for, perms in SYSTEM_ROLE_SEEDS:
            Role.objects.get_or_create(
                organisation_id=organisation.pk,
                project=None,
                is_default_for=default_for,
                defaults={
                    "is_system": True,
                    "name": name,
                    "permissions": perms,
                },
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0044_role_custom_role'),
    ]

    operations = [
        migrations.RunPython(seed_default_roles, noop_reverse),
    ]
