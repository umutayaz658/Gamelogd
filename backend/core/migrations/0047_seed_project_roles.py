from django.db import migrations


def seed_project_roles(apps, schema_editor):
    # Must use the historical models (apps.get_model), not the real ones — see 0045's comment
    # for why: the real model classes reflect columns added by migrations that run after this
    # one, and querying with them breaks a from-scratch replay (fresh env / CI / `manage.py
    # test`). PROJECT_ROLE_SEEDS is plain data (no model import), so it's reused directly instead
    # of calling create_default_project_roles (which internally imports the real Role model).
    from api.permission_catalog import PROJECT_ROLE_SEEDS

    Project = apps.get_model('core', 'Project')
    Role = apps.get_model('core', 'Role')
    ProjectMember = apps.get_model('core', 'ProjectMember')

    for project in Project.objects.filter(organisation__isnull=False):
        for name, default_for, perms in PROJECT_ROLE_SEEDS:
            Role.objects.get_or_create(
                organisation_id=project.organisation_id,
                project_id=project.pk,
                is_default_for=default_for,
                defaults={
                    "is_system": True,
                    "name": name,
                    "permissions": perms,
                },
            )

    # Any ProjectMember.custom_role pointing at an organisation-scoped role
    # (project IS NULL) is no longer valid now that project roles are their
    # own separate catalog — fall back those members to their legacy flat
    # role until an admin explicitly assigns one of the new project roles.
    ProjectMember.objects.filter(custom_role__project__isnull=True).update(custom_role=None)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0046_role_project_scope'),
    ]

    operations = [
        migrations.RunPython(seed_project_roles, noop_reverse),
    ]
