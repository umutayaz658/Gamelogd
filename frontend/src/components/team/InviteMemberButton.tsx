'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Role } from '@/types';
import InviteModal from './InviteModal';

interface InviteMemberButtonProps {
    scope: 'organisation' | 'project';
    organisationId: number | null;
    organisationSlug?: string;
    projectId?: number;
    /** User ids to exclude from the search/quick-add results (current members + self). */
    excludeUserIds: number[];
    /** Called after a successful invite is sent — refetch whatever pending-invite list you show. */
    onInvited: () => void;
    className?: string;
}

/**
 * Self-contained "Invite Member" button + role fetch + InviteModal — the single shared
 * implementation for sending org/project invites. Used by MemberManager (Team & Roles) and by
 * the Organisation/Project dashboard's "Invite & Outgoing" tab, so the org-vs-project invite
 * flow (quick-add-from-org, legacy role options — see InviteModal.tsx) never diverges between
 * the two surfaces.
 */
export default function InviteMemberButton({
    scope, organisationId, organisationSlug, projectId, excludeUserIds, onInvited, className,
}: InviteMemberButtonProps) {
    const { user: currentUser } = useAuth();
    const toast = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);

    useEffect(() => {
        if (!currentUser) { setRoles([]); return; }
        // Organisation roles and project roles are separate catalogs — mirrors MemberManager's
        // own fetchRoles (a project's invite picker must only ever offer that project's roles).
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
    }, [scope, organisationId, projectId, currentUser]);

    const handleInvite = (targetUser: { id: number; username: string }, roleId: number, legacyRole: string) => {
        if (scope === 'project') {
            api.post('/project-members/', { project: projectId, user_id: targetUser.id, role: legacyRole, custom_role: roleId })
                .then(() => { onInvited(); setShowInviteModal(false); })
                .catch((err) => toast.error(err.response?.data?.detail || err.response?.data?.error || (Array.isArray(err.response?.data) ? err.response.data[0] : null) || 'Failed to invite.'));
        } else if (organisationSlug) {
            api.post(`/organisations/${organisationSlug}/invite/`, { user_id: targetUser.id, role: legacyRole, custom_role: roleId })
                .then(() => { onInvited(); setShowInviteModal(false); })
                .catch((err) => toast.error(err.response?.data?.error || 'Failed to invite.'));
        }
    };

    return (
        <>
            <button
                onClick={() => setShowInviteModal(true)}
                className={className ?? 'flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20'}
            >
                <Plus className="w-4 h-4" /> Invite Member
            </button>
            {showInviteModal && (
                <InviteModal
                    scope={scope === 'project' ? 'project' : 'org'}
                    legacyRoleOptions={scope === 'project' ? ['participant', 'editor', 'admin'] : ['member', 'admin']}
                    roles={roles}
                    quickAddOrganisationId={scope === 'project' ? organisationId ?? undefined : undefined}
                    excludeUserIds={[...excludeUserIds, ...(currentUser ? [currentUser.id] : [])]}
                    onClose={() => setShowInviteModal(false)}
                    onInvite={handleInvite}
                />
            )}
        </>
    );
}
