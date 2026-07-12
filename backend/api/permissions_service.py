"""
Effective-permission resolution for the Devs-workspace Team & Roles system.

Resolution order for a given (user, organisation, project) scope:
  1. Solo workspace (no organisation at all) -> always fully permissive.
  2. Project scope: project owner -> that org's Owner role (or full access for
     an orgless personal project); else an active ProjectMember's custom_role,
     falling back to their legacy flat `role`; else (not a direct project
     member) an org owner/admin's org-level permissions, mirroring the
     `manageable=true` access precedent in ProjectViewSet.get_queryset.
  3. Org-wide scope: OrganisationMember's custom_role, falling back to their
     legacy flat `role`.
No access at all (not a member, no ownership) -> None.
"""

from core.models import OrganisationMember, ProjectMember
from .permission_catalog import (
    ALL_PERMISSION_KEYS,
    create_default_roles,
    create_default_project_roles,
    legacy_role_permissions,
    map_legacy_role,
)


def _resolve_org_member_permissions(organisation, org_member):
    if org_member.custom_role_id:
        return list(org_member.custom_role.permissions)
    roles = create_default_roles(organisation)
    return list(roles[map_legacy_role(org_member.role)].permissions)


def get_effective_permissions(user, organisation=None, project=None):
    """Returns list[str] of permission keys, or None if the user has no access to this scope."""
    if project is not None:
        if project.owner_id == user.id:
            if project.organisation_id:
                roles = create_default_roles(project.organisation)
                return list(roles["owner"].permissions)
            return list(ALL_PERMISSION_KEYS)

        member = ProjectMember.objects.filter(project=project, user=user, status="active").select_related("custom_role").first()
        if member:
            if member.custom_role_id:
                return list(member.custom_role.permissions)
            if project.organisation_id:
                roles = create_default_project_roles(project)
                return list(roles[map_legacy_role(member.role)].permissions)
            return legacy_role_permissions(member.role)

        # Not a direct project member: org owner/admin get implicit access to
        # every project in their org (mirrors ProjectViewSet's manageable filter).
        if project.organisation_id:
            org_member = OrganisationMember.objects.filter(
                organisation=project.organisation, user=user
            ).select_related("custom_role").first()
            if org_member and org_member.role in ("owner", "admin"):
                return _resolve_org_member_permissions(project.organisation, org_member)
        return None

    if organisation is not None:
        org_member = OrganisationMember.objects.filter(
            organisation=organisation, user=user
        ).select_related("custom_role").first()
        if not org_member:
            return None
        return _resolve_org_member_permissions(organisation, org_member)

    # Pure solo workspace — no org, no project.
    return list(ALL_PERMISSION_KEYS)


def user_has_permission(user, permission_key, organisation=None, project=None):
    perms = get_effective_permissions(user, organisation=organisation, project=project)
    return perms is not None and permission_key in perms


def user_has_any_permission(user, permission_keys, organisation=None, project=None):
    perms = get_effective_permissions(user, organisation=organisation, project=project)
    if perms is None:
        return False
    return any(key in perms for key in permission_keys)
