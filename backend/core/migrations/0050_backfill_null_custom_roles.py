from django.db import migrations


def _get_or_create_role(Role, *, organisation_id, project_id, default_for, name, perms):
    role, _ = Role.objects.get_or_create(
        organisation_id=organisation_id,
        project_id=project_id,
        is_default_for=default_for,
        defaults={"is_system": True, "name": name, "permissions": perms},
    )
    return role


def backfill_null_custom_roles(apps, schema_editor):
    # Must use the historical models (apps.get_model), not the real ones — see 0045's comment
    # for why: the real model classes reflect columns added by migrations that run after this
    # one, and querying with them breaks a from-scratch replay (fresh env / CI / `manage.py
    # test`). SYSTEM_ROLE_SEEDS/PROJECT_ROLE_SEEDS/map_legacy_role are plain data/functions (no
    # model import), so they're reused directly instead of calling create_default_roles /
    # create_default_project_roles (which internally import the real Role model).
    from api.permission_catalog import SYSTEM_ROLE_SEEDS, PROJECT_ROLE_SEEDS, map_legacy_role

    OrganisationMember = apps.get_model('core', 'OrganisationMember')
    ProjectMember = apps.get_model('core', 'ProjectMember')
    Role = apps.get_model('core', 'Role')

    # A member with no custom_role used to silently fall back to a legacy-role-derived
    # permission set with no explicit Role row backing it — confusing ("why does this person
    # have no role?") for no real benefit now that role selection is mandatory going forward.
    # Every existing member gets an explicit, equivalent Role assigned instead. Owners are
    # skipped: ownership is never expressed via custom_role, only the flat 'owner' field.
    for member in OrganisationMember.objects.filter(custom_role__isnull=True).exclude(role='owner').select_related('organisation'):
        target = map_legacy_role(member.role)
        name, default_for, perms = next(s for s in SYSTEM_ROLE_SEEDS if s[1] == target)
        member.custom_role = _get_or_create_role(
            Role, organisation_id=member.organisation_id, project_id=None,
            default_for=default_for, name=name, perms=perms,
        )
        member.save(update_fields=['custom_role'])

    for member in ProjectMember.objects.filter(custom_role__isnull=True).select_related('project__organisation'):
        if not member.project.organisation_id:
            continue  # personal (org-less) projects don't support custom roles at all
        target = map_legacy_role(member.role)
        # Project roles have no 'owner' entry (see PROJECT_ROLE_SEEDS) — an owner-mapped legacy
        # role on a ProjectMember falls back to Admin, the highest project-level role available.
        seed_target = 'admin' if target == 'owner' else target
        name, default_for, perms = next(s for s in PROJECT_ROLE_SEEDS if s[1] == seed_target)
        member.custom_role = _get_or_create_role(
            Role, organisation_id=member.project.organisation_id, project_id=member.project_id,
            default_for=default_for, name=name, perms=perms,
        )
        member.save(update_fields=['custom_role'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0049_org_invitation_custom_role'),
    ]

    operations = [
        migrations.RunPython(backfill_null_custom_roles, noop_reverse),
    ]
