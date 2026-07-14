'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Lock, Plus, Search, Settings2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import type { OrganisationMember, PermissionHierarchy, ProjectMember, Role, User } from '@/types';
import ConfirmDeleteModal from '@/components/devs/ConfirmDeleteModal';
import InviteModal from './InviteModal';
import RolesManagerModal from './RolesManagerModal';
import RoleSelectDrawer from './RoleSelectDrawer';
import { useToast } from '@/context/ToastContext';

const LEGACY_ROLE_LABEL: Record<string, string> = {
    owner: 'Owner', admin: 'Admin', member: 'Developer',
    participant: 'Participant', editor: 'Editor',
};

interface DisplayMember {
    id: number | string;
    user: { id: number; username: string; avatar?: string | null; real_name?: string };
    role: string;
    custom_role: number | null;
    custom_role_details: { id: number; name: string; is_system: boolean } | null;
    dateLabel: string;
    isOwner: boolean;
}

function normalizeMembers(
    scope: 'organisation' | 'project',
    members: (OrganisationMember | ProjectMember)[],
    projectOwner?: User
): DisplayMember[] {
    const normalized: DisplayMember[] = members.map((m) => {
        const isPending = 'status' in m && m.status === 'pending';
        const dateValue = 'joined_at' in m ? m.joined_at : m.created_at;
        // A member row can be the owner either because its flat `role` says so (org scope,
        // always a real row) or because its user id matches the project's owner (project
        // scope — the owner may or may not have a real ProjectMember row; either way they're
        // always the owner and never just a regular, editable/removable member).
        const isOwner = m.role === 'owner' || (scope === 'project' && !!projectOwner && m.user.id === projectOwner.id);
        return {
            id: m.id,
            user: { id: m.user.id, username: m.user.username, avatar: m.user.avatar, real_name: m.user.real_name },
            role: isOwner ? 'owner' : m.role,
            custom_role: isOwner ? null : m.custom_role,
            custom_role_details: isOwner ? null : m.custom_role_details,
            dateLabel: isPending ? 'Invite pending' : `Joined ${new Date(dateValue ?? '').toLocaleDateString()}`,
            isOwner,
        };
    });
    if (scope === 'project' && projectOwner && !normalized.some((m) => m.user.id === projectOwner.id)) {
        normalized.unshift({
            id: `owner-${projectOwner.id}`,
            user: { id: projectOwner.id, username: projectOwner.username, avatar: projectOwner.avatar, real_name: projectOwner.real_name },
            role: 'owner',
            custom_role: null,
            custom_role_details: null,
            dateLabel: '',
            isOwner: true,
        });
    }
    // Owner always pinned first, regardless of where it fell in the source list.
    return normalized.sort((a, b) => (b.isOwner ? 1 : 0) - (a.isOwner ? 1 : 0));
}

interface RoleGroup {
    label: string;
    permissionCount: number;
    members: DisplayMember[];
}

/** Groups members by their role label, ranked highest-permission-count first (Owner always
 * leads, since it implicitly holds every permission without a Role row of its own to count). */
function groupByRole(displayMembers: DisplayMember[], roles: Role[]): RoleGroup[] {
    const permCountByRoleId = new Map(roles.map((r) => [r.id, r.permissions.length]));
    const groups = new Map<string, RoleGroup>();
    for (const member of displayMembers) {
        const label = member.isOwner ? 'Owner' : (member.custom_role_details?.name ?? LEGACY_ROLE_LABEL[member.role] ?? member.role);
        const permissionCount = member.isOwner
            ? Number.MAX_SAFE_INTEGER
            : (member.custom_role_details ? permCountByRoleId.get(member.custom_role_details.id) ?? 0 : 0);
        if (!groups.has(label)) groups.set(label, { label, permissionCount, members: [] });
        groups.get(label)!.members.push(member);
    }
    return Array.from(groups.values()).sort((a, b) => b.permissionCount - a.permissionCount);
}

interface MemberManagerProps {
    scope: 'organisation' | 'project';
    organisationId: number | null;
    organisationSlug?: string;
    projectId?: number;
    members: (OrganisationMember | ProjectMember)[];
    projectOwner?: User;
    onRefresh: () => void;
    showInviteButton?: boolean;
}

export default function MemberManager({
    scope, organisationId, organisationSlug, projectId, members, projectOwner, onRefresh, showInviteButton = true,
}: MemberManagerProps) {
    const { user: currentUser } = useAuth();
    const toast = useToast();

    const [permissions, setPermissions] = useState<string[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [hierarchy, setHierarchy] = useState<PermissionHierarchy>({});
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showRolesModal, setShowRolesModal] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState<DisplayMember | null>(null);
    const [roleDrawerFor, setRoleDrawerFor] = useState<DisplayMember | null>(null);
    const [confirmTransferTo, setConfirmTransferTo] = useState<DisplayMember | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!currentUser) { setPermissions([]); return; }
        const params = new URLSearchParams();
        if (organisationId) params.append('organisation', String(organisationId));
        if (projectId) params.append('project', String(projectId));
        api.get(`/my-permissions/?${params.toString()}`)
            .then((res) => setPermissions(res.data?.permissions ?? []))
            .catch(() => setPermissions([]));
    }, [currentUser, organisationId, projectId]);

    const fetchRoles = () => {
        if (!currentUser) { setRoles([]); return; }
        // Organisation roles and project roles are separate catalogs — a project's role
        // picker must only ever offer that project's own roles, never the org's.
        if (scope === 'project') {
            if (!projectId) { setRoles([]); return; }
            api.get(`/organisation-roles/?project=${projectId}`)
                .then((res) => setRoles(res.data.results ?? res.data))
                .catch(() => setRoles([]));
        } else {
            if (!organisationId) { setRoles([]); return; }
            api.get(`/organisation-roles/?organisation=${organisationId}`)
                .then((res) => setRoles(res.data.results ?? res.data))
                .catch(() => setRoles([]));
        }
    };
    useEffect(() => { fetchRoles(); }, [scope, organisationId, projectId, currentUser]);

    useEffect(() => {
        if (!showRolesModal || !currentUser || Object.keys(hierarchy).length > 0) return;
        api.get('/permission-catalog/').then((res) => setHierarchy(res.data?.hierarchy ?? {})).catch(() => setHierarchy({}));
    }, [showRolesModal, currentUser]);

    const hasPermission = (key: string) => permissions.includes(key);
    const canAssignRoles = hasPermission('team.role.assign');
    const canManageRoles = hasPermission('team.role.manage');
    const canInvite = hasPermission('team.invite');
    const canRemove = hasPermission('team.remove');

    const displayMembers = normalizeMembers(scope, members, projectOwner);
    const viewerIsOwner = scope === 'organisation' && displayMembers.some((m) => m.isOwner && m.user.id === currentUser?.id);
    const roleManagementScopeId = scope === 'project' ? projectId : organisationId;

    const query = searchQuery.trim().toLowerCase();
    const searchedMembers = query
        ? displayMembers.filter((m) => m.user.username.toLowerCase().includes(query) || (m.user.real_name ?? '').toLowerCase().includes(query))
        : displayMembers;
    const roleGroups = groupByRole(searchedMembers, roles);
    const toggleGroup = (label: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label); else next.add(label);
            return next;
        });
    };

    const memberEndpoint = (id: number | string) => scope === 'project' ? `/project-members/${id}/` : `/organisation-members/${id}/`;

    const handleChangeRole = (member: DisplayMember, roleId: number) => {
        if (member.isOwner) return;
        api.patch(memberEndpoint(member.id), { custom_role: roleId })
            .then(() => { onRefresh(); setRoleDrawerFor(null); })
            .catch((err) => toast.error(err.response?.data?.error || err.response?.data?.custom_role?.[0] || err.response?.data?.detail || 'Failed to update role.'));
    };

    const handleRemoveMember = (member: DisplayMember) => {
        if (member.isOwner) return;
        api.delete(memberEndpoint(member.id))
            .then(onRefresh)
            .catch((err) => toast.error(err.response?.data?.error || 'Failed to remove member.'))
            .finally(() => setConfirmRemove(null));
    };

    const handleTransferOwnership = (member: DisplayMember) => {
        if (!organisationSlug) return;
        api.post(`/organisations/${organisationSlug}/transfer-ownership/`, { new_owner_user_id: member.user.id })
            .then(onRefresh)
            .catch((err) => toast.error(err.response?.data?.error || 'Failed to transfer ownership.'))
            .finally(() => setConfirmTransferTo(null));
    };

    const handleInvite = (targetUser: { id: number; username: string }, roleId: number, legacyRole: string) => {
        if (scope === 'project') {
            api.post('/project-members/', { project: projectId, user_id: targetUser.id, role: legacyRole, custom_role: roleId })
                .then(() => { onRefresh(); setShowInviteModal(false); })
                .catch((err) => toast.error(err.response?.data?.detail || err.response?.data?.error || (Array.isArray(err.response?.data) ? err.response.data[0] : null) || 'Failed to invite.'));
        } else if (organisationSlug) {
            api.post(`/organisations/${organisationSlug}/invite/`, { user_id: targetUser.id, role: legacyRole, custom_role: roleId })
                .then(() => setShowInviteModal(false))
                .catch((err) => toast.error(err.response?.data?.error || 'Failed to invite.'));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search members..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all" />
                </div>
                {((showInviteButton && canInvite) || (roleManagementScopeId && canManageRoles)) && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {roleManagementScopeId && canManageRoles && (
                            <button onClick={() => setShowRolesModal(true)}
                                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-sm font-semibold transition-all">
                                <Settings2 className="w-4 h-4" /> Manage Roles
                            </button>
                        )}
                        {showInviteButton && canInvite && (
                            <button onClick={() => setShowInviteModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20">
                                <Plus className="w-4 h-4" /> Invite Member
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-5">
                {roleGroups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.label);
                    return (
                        <div key={group.label}>
                            <button onClick={() => toggleGroup(group.label)}
                                className="flex items-center gap-1.5 mb-2 text-zinc-400 hover:text-white transition-colors">
                                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
                                <span className="text-xs font-bold uppercase tracking-wider">{group.label}</span>
                                <span className="text-[11px] text-zinc-600">({group.members.length})</span>
                            </button>
                            {!isCollapsed && (
                                <div className="space-y-3">
                                    {group.members.map((member) => {
                                        const effectiveLabel = member.custom_role_details?.name ?? LEGACY_ROLE_LABEL[member.role] ?? member.role;
                                        const canPickRole = !member.isOwner && canAssignRoles && roles.length > 0;
                                        return (
                                            <div key={member.id} className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                                                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0">
                                                    <img src={getImageUrl(member.user.avatar, member.user.username)} className="w-full h-full object-cover" alt="" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{member.user.real_name || member.user.username}</p>
                                                    <p className="text-xs text-zinc-500 truncate">@{member.user.username}</p>
                                                    {member.dateLabel && <p className="text-xs text-zinc-500 mt-0.5">{member.dateLabel}</p>}
                                                </div>

                                                <button
                                                    onClick={() => canPickRole && setRoleDrawerFor(member)}
                                                    disabled={!canPickRole}
                                                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                                                        canPickRole ? 'cursor-pointer hover:border-zinc-600 text-zinc-200 bg-zinc-900 border-zinc-700' : 'cursor-default text-amber-400 bg-amber-500/10 border-amber-500/20'
                                                    }`}
                                                >
                                                    {member.custom_role_details?.is_system && <Lock className="w-3 h-3" />}
                                                    {effectiveLabel}
                                                </button>

                                                {!member.isOwner && canRemove && (
                                                    <button onClick={() => setConfirmRemove(member)}
                                                        className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all flex-shrink-0">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                {searchedMembers.length === 0 && (
                    <p className="text-sm text-zinc-700 text-center py-8">
                        {query ? 'No members match your search.' : (scope === 'project' ? 'No members on this project yet.' : 'No members found.')}
                    </p>
                )}
            </div>

            {showInviteModal && (
                <InviteModal
                    scope={scope === 'project' ? 'project' : 'org'}
                    legacyRoleOptions={scope === 'project' ? ['participant', 'editor', 'admin'] : ['member', 'admin']}
                    roles={roles}
                    quickAddOrganisationId={scope === 'project' ? organisationId ?? undefined : undefined}
                    excludeUserIds={[...displayMembers.map((m) => m.user.id), ...(currentUser ? [currentUser.id] : [])]}
                    onClose={() => setShowInviteModal(false)}
                    onInvite={handleInvite}
                />
            )}

            {showRolesModal && roleManagementScopeId && (
                <RolesManagerModal
                    roleScope={
                        scope === 'project'
                            ? { type: 'project', id: roleManagementScopeId, organisationId: organisationId ?? 0 }
                            : { type: 'organisation', id: roleManagementScopeId }
                    }
                    roles={roles}
                    hierarchy={hierarchy}
                    canManage={canManageRoles}
                    viewerIsOwner={viewerIsOwner}
                    onClose={() => setShowRolesModal(false)}
                    onChanged={fetchRoles}
                />
            )}

            {roleDrawerFor && (
                <RoleSelectDrawer
                    isOpen={true}
                    title={`Role for @${roleDrawerFor.user.username}`}
                    roles={roles}
                    selectedRoleId={roleDrawerFor.custom_role}
                    onSelect={(roleId) => handleChangeRole(roleDrawerFor, roleId)}
                    onClose={() => setRoleDrawerFor(null)}
                    onTransferOwnership={
                        viewerIsOwner
                            ? () => { setConfirmTransferTo(roleDrawerFor); setRoleDrawerFor(null); }
                            : undefined
                    }
                />
            )}

            <ConfirmDeleteModal
                isOpen={confirmRemove !== null}
                title="Remove Member"
                description={`Are you sure you want to remove @${confirmRemove?.user.username} from this ${scope === 'project' ? 'project' : 'organisation'}?`}
                onConfirm={() => confirmRemove && handleRemoveMember(confirmRemove)}
                onCancel={() => setConfirmRemove(null)}
            />

            <ConfirmDeleteModal
                isOpen={confirmTransferTo !== null}
                variant="warning"
                confirmLabel="Transfer Ownership"
                title="Transfer Ownership"
                description={`Are you sure you want to make @${confirmTransferTo?.user.username} the owner of this organisation? You will become an Admin and lose owner privileges.`}
                onConfirm={() => confirmTransferTo && handleTransferOwnership(confirmTransferTo)}
                onCancel={() => setConfirmTransferTo(null)}
            />
        </div>
    );
}
