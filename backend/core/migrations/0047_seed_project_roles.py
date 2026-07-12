from django.db import migrations


def seed_project_roles(apps, schema_editor):
    # Same rationale as 0045_seed_default_roles: use the real models, not
    # apps.get_model, since create_default_project_roles imports the real
    # Role model internally.
    from core.models import Project, ProjectMember
    from api.permission_catalog import create_default_project_roles

    for project in Project.objects.filter(organisation__isnull=False):
        create_default_project_roles(project)

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
