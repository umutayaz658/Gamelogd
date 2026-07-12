'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import api from '@/lib/api';
import BoardSwitcher from './BoardSwitcher';
import MemberManager from '@/components/team/MemberManager';
import type { OrganisationMember, ProjectMember, User } from '@/types';

export default function TeamRoles() {
    const { activeWorkspace, activeBoard } = useWorkspace();

    const projectId = activeBoard.startsWith('project_') ? parseInt(activeBoard.replace('project_', ''), 10) : null;
    const orgId = activeWorkspace.org?.id ?? null;
    const scope: 'solo' | 'org' | 'project' = activeWorkspace.type === 'solo' ? 'solo' : (projectId ? 'project' : 'org');

    const [members, setMembers] = useState<(OrganisationMember | ProjectMember)[]>([]);
    const [projectOwner, setProjectOwner] = useState<User | null>(null);

    const fetchMembers = () => {
        if (scope === 'solo') { setMembers([]); setProjectOwner(null); return; }
        if (scope === 'project') {
            // Fetch the full project (not just /project-members/) so the owner — who may have no
            // ProjectMember row at all — is always available, the same way the public project
            // page already gets it. This is what keeps the two surfaces in sync.
            api.get(`/projects/${projectId}/`)
                .then((res) => { setMembers(res.data.members ?? []); setProjectOwner(res.data.owner ?? null); })
                .catch(() => { setMembers([]); setProjectOwner(null); });
        } else {
            setProjectOwner(null);
            api.get(`/organisation-members/?organisation=${orgId}`)
                .then((res) => setMembers(res.data.results ?? res.data))
                .catch(() => setMembers([]));
        }
    };

    useEffect(() => { fetchMembers(); }, [scope, orgId, projectId]);

    if (scope === 'solo') {
        return (
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <BoardSwitcher />
                    <span className="text-zinc-700 text-lg font-light">/</span>
                    <h2 className="text-xl font-bold text-white">Team & Roles</h2>
                </div>
                <div className="text-center py-16 text-zinc-600">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">This is your personal workspace — just you here. Switch to an organisation to manage a team.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <BoardSwitcher />
                <span className="text-zinc-700 text-lg font-light">/</span>
                <h2 className="text-xl font-bold text-white">Team & Roles</h2>
            </div>

            <MemberManager
                scope={scope === 'project' ? 'project' : 'organisation'}
                organisationId={orgId}
                organisationSlug={activeWorkspace.org?.slug}
                projectId={projectId ?? undefined}
                members={members}
                projectOwner={projectOwner ?? undefined}
                onRefresh={fetchMembers}
            />
        </div>
    );
}
