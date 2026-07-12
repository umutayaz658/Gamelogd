from django.db import migrations


def backfill_playtester_default_for(apps, schema_editor):
    # Playtester used to be seeded with is_default_for='' (no stable identifier). We now key
    # the idempotent role-seeder lookup on is_default_for so that renaming a system role's
    # display name doesn't cause it to be re-created as a duplicate — Playtester needs its own
    # non-empty key ('playtester') for that to work. Scoped tightly by is_system+name so this
    # can't touch a user's own custom role that happens to also have an empty is_default_for.
    Role = apps.get_model('core', 'Role')
    Role.objects.filter(is_system=True, is_default_for='', name='Playtester').update(is_default_for='playtester')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0047_seed_project_roles'),
    ]

    operations = [
        migrations.RunPython(backfill_playtester_default_for, noop_reverse),
    ]
