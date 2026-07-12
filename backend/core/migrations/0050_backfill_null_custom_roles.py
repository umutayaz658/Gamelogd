from django.db import migrations


def backfill_null_custom_roles(apps, schema_editor):
    # Uses the real models (see 0045/0047's rationale) since create_default_roles/
    # create_default_project_roles import the real Role model internally.
    from core.models import OrganisationMember, ProjectMember
    from api.permission_catalog import create_default_roles, create_default_project_roles, map_legacy_role

    # A member with no custom_role used to silently fall back to a legacy-role-derived
    # permission set with no explicit Role row backing it — confusing ("why does this person
    # have no role?") for no real benefit now that role selection is mandatory going forward.
    # Every existing member gets an explicit, equivalent Role assigned instead. Owners are
    # skipped: ownership is never expressed via custom_role, only the flat 'owner' field.
    for member in OrganisationMember.objects.filter(custom_role__isnull=True).exclude(role='owner').select_related('organisation'):
        roles = create_default_roles(member.organisation)
        member.custom_role = roles[map_legacy_role(member.role)]
        member.save(update_fields=['custom_role'])

    for member in ProjectMember.objects.filter(custom_role__isnull=True).select_related('project__organisation'):
        if not member.project.organisation_id:
            continue  # personal (org-less) projects don't support custom roles at all
        roles = create_default_project_roles(member.project)
        member.custom_role = roles[map_legacy_role(member.role)]
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
