"""
Single source of truth for the Devs-workspace permission system.

Permission keys are plain, code-defined strings grouped by category (one
category per Devs tool). They are stored as a flat JSON list on
`core.models.Role.permissions` — there is no per-permission DB row, since
the catalog itself is fixed by what the app supports, not user-definable.
"""

PERMISSION_CATALOG = {
    "kanban": [
        ("kanban.view", "View Kanban board"),
        ("kanban.task.create", "Create tasks"),
        ("kanban.task.edit_own", "Edit own tasks"),
        ("kanban.task.edit_any", "Edit any task"),
        ("kanban.task.delete", "Delete tasks"),
        ("kanban.task.comment", "Comment on tasks"),
        ("kanban.comment.delete_any", "Delete any comment"),
        ("kanban.column.manage", "Create/rename/delete columns"),
    ],
    "gdd": [
        ("gdd.view", "View GDD Hub"),
        ("gdd.doc.create", "Create GDD documents"),
        ("gdd.doc.edit", "Edit GDD documents"),
        ("gdd.doc.delete", "Delete GDD documents"),
        ("gdd.comment.create", "Comment on GDD docs"),
        ("gdd.comment.resolve", "Resolve/reopen GDD comments"),
        ("gdd.comment.delete_any", "Delete any GDD comment"),
    ],
    "assets": [
        ("assets.view", "View Asset Registry"),
        ("assets.create", "Add assets"),
        ("assets.delete", "Delete assets"),
    ],
    "localisation": [
        ("localisation.view", "View Localisation Manager"),
        ("localisation.key.create", "Create translation keys"),
        ("localisation.key.delete", "Delete translation keys"),
        ("localisation.suggestion.create", "Suggest translations"),
        ("localisation.suggestion.approve", "Approve translations"),
        ("localisation.glossary.manage", "Manage glossary terms"),
    ],
    "team": [
        ("team.view", "View Team & Roles"),
        ("team.invite", "Invite members"),
        ("team.remove", "Remove members"),
        ("team.role.assign", "Change a member's role"),
        ("team.role.manage", "Create/edit/delete custom roles"),
    ],
    "playtest": [
        ("playtest.view", "View playtest feedback"),
        ("playtest.submit", "Submit playtest feedback"),
        ("playtest.convert_to_task", "Convert feedback to QA task"),
    ],
    "settings": [
        ("settings.edit", "Edit workspace settings"),
    ],
}

ALL_PERMISSION_KEYS = [key for group in PERMISSION_CATALOG.values() for key, _ in group]

# UI-only grouping on top of PERMISSION_CATALOG: within a category, each tier
# implies every key in the tiers below it (e.g. picking "Delete" also grants
# "Manage all tasks", "Contribute" and "View board"). Storage is unaffected —
# Role.permissions stays a flat list of keys; this only drives the
# Manage Roles permission drawer's auto-check/lock behaviour.
PERMISSION_HIERARCHY = {
    "kanban": [
        {"label": "View board", "description": "See the Kanban board and its tasks.", "keys": ["kanban.view"]},
        {"label": "Contribute", "description": "Create tasks, comment, and edit your own tasks.", "keys": ["kanban.task.create", "kanban.task.comment", "kanban.task.edit_own"]},
        {"label": "Manage all tasks", "description": "Edit any task and manage board columns.", "keys": ["kanban.task.edit_any", "kanban.column.manage"]},
        {"label": "Delete", "description": "Delete tasks and any comment on them.", "keys": ["kanban.task.delete", "kanban.comment.delete_any"]},
    ],
    "gdd": [
        {"label": "View docs", "description": "Read GDD Hub documents.", "keys": ["gdd.view"]},
        {"label": "Comment", "description": "Comment on documents and resolve/reopen threads.", "keys": ["gdd.comment.create", "gdd.comment.resolve"]},
        {"label": "Write", "description": "Create and edit GDD documents.", "keys": ["gdd.doc.create", "gdd.doc.edit"]},
        {"label": "Delete", "description": "Delete documents and any comment on them.", "keys": ["gdd.doc.delete", "gdd.comment.delete_any"]},
    ],
    "assets": [
        {"label": "View", "description": "Browse the Asset Registry.", "keys": ["assets.view"]},
        {"label": "Upload", "description": "Add new assets.", "keys": ["assets.create"]},
        {"label": "Delete", "description": "Remove assets from the registry.", "keys": ["assets.delete"]},
    ],
    "localisation": [
        {"label": "View", "description": "Browse the Localisation Manager.", "keys": ["localisation.view"]},
        {"label": "Suggest", "description": "Suggest translations for existing keys.", "keys": ["localisation.suggestion.create"]},
        {"label": "Manage keys", "description": "Create keys, approve suggestions, and manage the glossary.", "keys": ["localisation.key.create", "localisation.suggestion.approve", "localisation.glossary.manage"]},
        {"label": "Delete keys", "description": "Delete translation keys.", "keys": ["localisation.key.delete"]},
    ],
    "team": [
        {"label": "View team", "description": "See the Team & Roles member list.", "keys": ["team.view"]},
        {"label": "Invite", "description": "Invite new members.", "keys": ["team.invite"]},
        {"label": "Manage roles", "description": "Assign member roles and create/edit/delete custom roles.", "keys": ["team.role.assign", "team.role.manage"]},
        {"label": "Remove members", "description": "Remove members from the team.", "keys": ["team.remove"]},
    ],
    "playtest": [
        {"label": "View", "description": "See playtest feedback.", "keys": ["playtest.view"]},
        {"label": "Submit feedback", "description": "Submit new playtest feedback.", "keys": ["playtest.submit"]},
        {"label": "Convert to task", "description": "Convert feedback into a QA task on the Kanban board.", "keys": ["playtest.convert_to_task"]},
    ],
    "settings": [
        {"label": "Edit settings", "description": "Edit workspace settings.", "keys": ["settings.edit"]},
    ],
}

# Coarse "does this user have write access to this tool" permission set,
# used by WorkspaceStateViewSet's coarse server-side check. One blanket
# permission-OR-of-list per tool category — not row/task/doc-level.
TOOL_WRITE_PERMISSIONS = {
    "kanban": ["kanban.task.create", "kanban.task.edit_own", "kanban.task.edit_any", "kanban.column.manage"],
    "gdd": ["gdd.doc.create", "gdd.doc.edit"],
    "assets": ["assets.create"],
    "localisation": ["localisation.key.create", "localisation.suggestion.create"],
    "members": ["team.invite", "team.role.assign", "team.role.manage", "team.remove"],
    "playtest": ["playtest.submit"],
    "settings": ["settings.edit"],
}

TOOL_VIEW_PERMISSIONS = {
    "kanban": ["kanban.view"],
    "gdd": ["gdd.view"],
    "assets": ["assets.view"],
    "localisation": ["localisation.view"],
    "members": ["team.view"],
    "playtest": ["playtest.view"],
    "settings": ["settings.edit"],
}

_MEMBER_EXCLUDED_PREFIXES = ("team.", "settings.")


def _member_permissions():
    return [
        key for key in ALL_PERMISSION_KEYS
        if not key.endswith(".delete") and not key.endswith(".delete_any")
        and not key.startswith(_MEMBER_EXCLUDED_PREFIXES)
    ]


PLAYTESTER_PERMISSIONS = ["playtest.view", "playtest.submit", "kanban.view", "gdd.view"]

# name -> (is_default_for, permissions) seed spec for the 4 system roles created per-organisation.
# is_default_for is a stable, rename-safe identifier (see create_default_roles) — it must stay
# unique and non-empty per scope, which is why "Playtester" gets its own "playtester" key rather
# than the empty string a bare display-name lookup would otherwise be tempted to rely on.
SYSTEM_ROLE_SEEDS = [
    ("Owner", "owner", list(ALL_PERMISSION_KEYS)),
    ("Admin", "admin", list(ALL_PERMISSION_KEYS)),
    ("Member", "member", _member_permissions()),
    ("Playtester", "playtester", PLAYTESTER_PERMISSIONS),
]

# Same idea, per-project: project roles never include an "owner" entry —
# project ownership is always inherited from the organisation owner, never a
# separate per-project role (see permissions_service.get_effective_permissions).
PROJECT_ROLE_SEEDS = [
    ("Admin", "admin", list(ALL_PERMISSION_KEYS)),
    ("Member", "member", _member_permissions()),
    ("Playtester", "playtester", PLAYTESTER_PERMISSIONS),
]


_LEGACY_ROLE_MAP = {
    # flat OrganisationMember/ProjectMember.role -> key used in create_default_roles()'s dict
    "owner": "owner",
    "admin": "admin",
    "member": "member",
    "participant": "member",
    "editor": "admin",
}

_LEGACY_FLAT_PERMISSIONS = {
    "owner": list(ALL_PERMISSION_KEYS),
    "admin": list(ALL_PERMISSION_KEYS),
    "editor": list(ALL_PERMISSION_KEYS),
    "member": _member_permissions(),
    "participant": _member_permissions(),
}


def map_legacy_role(flat_role):
    """Maps a legacy flat role string to the seeded-system-role dict key (see create_default_roles)."""
    return _LEGACY_ROLE_MAP.get(flat_role, "member")


def legacy_role_permissions(flat_role):
    """
    Synthetic permission list for a legacy flat role with no Organisation to seed
    real Role rows from (e.g. a personal/orgless project's ProjectMember).
    """
    return list(_LEGACY_FLAT_PERMISSIONS.get(flat_role, _member_permissions()))


def create_default_roles(organisation):
    """
    Get-or-create the 4 seeded system Role rows for `organisation`.
    Safe to call repeatedly (idempotent) — used both at org-creation time
    and as a defensive fallback from the permission resolver for
    organisations that pre-date this system.
    Returns {is_default_for-or-name: Role}.
    """
    from core.models import Role

    roles = {}
    for name, default_for, perms in SYSTEM_ROLE_SEEDS:
        # Looked up by (organisation, project=None, is_default_for) rather than name: a system
        # role's name is user-renameable (see RoleViewSet.perform_update), so matching on name
        # would create a duplicate the next time this idempotent seeder runs after a rename.
        # is_default_for is the stable identifier instead.
        role, created = Role.objects.get_or_create(
            organisation=organisation,
            project=None,
            is_default_for=default_for,
            defaults={
                "is_system": True,
                "name": name,
                "permissions": perms,
            },
        )
        roles[default_for] = role
    return roles


def create_default_project_roles(project):
    """
    Get-or-create the 3 seeded system Role rows for `project` (Admin/Member/
    Playtester — no Owner, see PROJECT_ROLE_SEEDS). Only meaningful for
    projects that belong to an organisation; orgless personal projects have
    no custom-role support (mirrors the pre-existing legacy_role_permissions
    fallback). Idempotent — safe to call repeatedly.
    Returns {is_default_for-or-name: Role}.
    """
    from core.models import Role

    if not project.organisation_id:
        return {}

    roles = {}
    for name, default_for, perms in PROJECT_ROLE_SEEDS:
        # See create_default_roles: looked up by is_default_for, not name, so renaming a
        # project's system role doesn't cause this idempotent seeder to create a duplicate.
        role, created = Role.objects.get_or_create(
            organisation=project.organisation,
            project=project,
            is_default_for=default_for,
            defaults={
                "is_system": True,
                "name": name,
                "permissions": perms,
            },
        )
        roles[default_for] = role
    return roles
