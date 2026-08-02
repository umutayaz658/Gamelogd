'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import api from '@/lib/api';
import BoardSwitcher from './BoardSwitcher';
import MemberManager from '@/components/team/MemberManager';
import type { OrganisationMember, ProjectMember, User } from '@/types';
import { useTranslation } from '@/lib/useTranslation';

const SLASH_SEPARATOR = '/';

export default function TeamRoles() {
    const { t } = useTranslation();
    const { activeWorkspace, activeBoard } = useWorkspace();

    const projectId = activeBoard.startsWith('project_') ? parseInt(activeBoard.replace('project_', ''), 10) : null;
    const orgId = activeWorkspace.org?.id ?? null;
    const scope: 'solo' | 'org' | 'project' = activeWorkspace.type === 'solo' ? 'solo' : (projectId ? 'project' : 'org');

    const [members, setMembers] = useState<(OrganisationMember | ProjectMember)[]>([]);
    const [projectOwner, setProjectOwner] = useState<User | null>(null);
    const [refetchToken, setRefetchToken] = useState(0);
    const fetchMembers = useCallback(() => setRefetchToken((n) => n + 1), []);

    // Clearing members/owner for solo scope (which never fetches) or clearing projectOwner
    // before an org fetch is a pure state update, so it happens synchronously during render —
    // keyed on scope+orgId+projectId+refetchToken — rather than as the first statement of the
    // effect below, which only performs the actual request and its async callbacks.
    // See https://react.dev/learn/you-might-not-need-an-effect
    const fetchKey = `${scope}:${orgId}:${projectId}:${refetchToken}`;
    const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);
    if (fetchKey !== prevFetchKey) {
        setPrevFetchKey(fetchKey);
        if (scope === 'solo') { setMembers([]); setProjectOwner(null); }
        else if (scope === 'org') { setProjectOwner(null); }
    }

    useEffect(() => {
        if (scope === 'solo') return;
        if (scope === 'project') {
            // Fetch the full project (not just /project-members/) so the owner — who may have no
            // ProjectMember row at all — is always available, the same way the public project
            // page already gets it. This is what keeps the two surfaces in sync.
            api.get(`/projects/${projectId}/`)
                .then((res) => { setMembers(res.data.members ?? []); setProjectOwner(res.data.owner ?? null); })
                .catch(() => { setMembers([]); setProjectOwner(null); });
        } else {
            api.get(`/organisation-members/?organisation=${orgId}`)
                .then((res) => setMembers(res.data.results ?? res.data))
                .catch(() => setMembers([]));
        }
    }, [scope, orgId, projectId, refetchToken]);

    if (scope === 'solo') {
        return (
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <BoardSwitcher />
                    <span className="text-zinc-700 text-lg font-light" aria-hidden="true">{SLASH_SEPARATOR}</span>
                    <h2 className="text-xl font-bold text-white">{t('teamAndRoles')}</h2>
                </div>
                <div className="text-center py-16 text-zinc-600">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t('soloWorkspaceHint')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <BoardSwitcher />
                <span className="text-zinc-700 text-lg font-light" aria-hidden="true">{SLASH_SEPARATOR}</span>
                <h2 className="text-xl font-bold text-white">{t('teamAndRoles')}</h2>
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
