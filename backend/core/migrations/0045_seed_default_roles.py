from django.db import migrations


def seed_default_roles(apps, schema_editor):
    # Uses the real (non-historical) models rather than apps.get_model — both
    # Role and Organisation are structurally current as of this migration, and
    # create_default_roles already imports the real Role model internally, so
    # mixing in the historical Organisation model would raise a type mismatch.
    from core.models import Organisation
    from api.permission_catalog import create_default_roles
    for organisation in Organisation.objects.all():
        create_default_roles(organisation)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0044_role_custom_role'),
    ]

    operations = [
        migrations.RunPython(seed_default_roles, noop_reverse),
    ]
