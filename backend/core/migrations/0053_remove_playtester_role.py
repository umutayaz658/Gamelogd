from django.db import migrations


def remove_playtester_role(apps, schema_editor):
    # The dedicated "Playtester" guest role has been retired (see permission_catalog.py) — anyone
    # with an app account can submit playtest feedback directly now, and Steam Store reviews are
    # ingested automatically, so there's no more need to invite someone specifically as a
    # playtester. Mirrors RoleViewSet.perform_destroy's reassign-to-Member-then-delete pattern.
    Role = apps.get_model('core', 'Role')
    OrganisationMember = apps.get_model('core', 'OrganisationMember')
    ProjectMember = apps.get_model('core', 'ProjectMember')
    OrganisationInvitation = apps.get_model('core', 'OrganisationInvitation')

    for playtester_role in Role.objects.filter(is_default_for='playtester'):
        member_role = Role.objects.filter(
            organisation=playtester_role.organisation,
            project=playtester_role.project,
            is_default_for='member',
        ).first()
        if member_role:
            OrganisationMember.objects.filter(custom_role=playtester_role).update(custom_role=member_role)
            ProjectMember.objects.filter(custom_role=playtester_role).update(custom_role=member_role)
            OrganisationInvitation.objects.filter(custom_role=playtester_role, is_active=True).update(custom_role=member_role)
        else:
            # No Member role for this scope (shouldn't happen — Member is always seeded alongside
            # Playtester) — fall back to just clearing the reference rather than leaving a dangling
            # assignment to a role we're about to delete.
            OrganisationMember.objects.filter(custom_role=playtester_role).update(custom_role=None)
            ProjectMember.objects.filter(custom_role=playtester_role).update(custom_role=None)
            OrganisationInvitation.objects.filter(custom_role=playtester_role, is_active=True).update(custom_role=None)

    Role.objects.filter(is_default_for='playtester').delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0052_playtest_feedback_model'),
    ]

    operations = [
        migrations.RunPython(remove_playtester_role, noop_reverse),
    ]
