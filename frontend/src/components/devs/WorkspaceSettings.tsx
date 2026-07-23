'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Settings, Trash2, AlertTriangle, X, RefreshCw, ArrowRight,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import api from '@/lib/api';
import BoardSwitcher from './BoardSwitcher';
import type { Project } from '@/types';

function IdentityCard({
    avatarUrl, avatarSeed, title, subtitle, badge, href, linkLabel,
}: {
    avatarUrl?: string | null; avatarSeed?: string; title: string; subtitle?: string;
    badge?: string; href: string; linkLabel: string;
}) {
    return (
        <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
                <img
                    src={getImageUrl(avatarUrl ?? undefined, avatarSeed)}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover bg-zinc-800 border border-zinc-800 flex-shrink-0"
                />
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-white truncate">{title}</p>
                        {badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                                {badge}
                            </span>
                        )}
                    </div>
                    {subtitle && <p className="text-xs text-zinc-500 truncate">{subtitle}</p>}
                </div>
            </div>
            <Link
                href={href}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 flex-shrink-0"
            >
                {linkLabel} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
        </div>
    );
}

type DangerAction = 'clear' | 'delete-org' | 'delete-project' | null;

export default function WorkspaceSettings() {
    const { user } = useAuth();
    const {
        activeWorkspace, setActiveWorkspace, setActiveBoard, activeBoard, hasPermission,
        refetchOrgs, clearWorkspaceData,
    } = useWorkspace();

    const projectId = activeBoard.startsWith('project_') ? parseInt(activeBoard.replace('project_', ''), 10) : null;
    const isOrgRoot = activeWorkspace.type === 'org' && !projectId;
    const canEdit = hasPermission('settings.edit');
    const isOrgOwner = activeWorkspace.type === 'org'
        && !!activeWorkspace.org?.members?.find((m) => m.user.id === user?.id && m.role === 'owner');

    const [projectDetails, setProjectDetails] = useState<Project | null>(null);

    useEffect(() => {
        if (!projectId) { setProjectDetails(null); return; }
        api.get(`/projects/${projectId}/`).then((res) => setProjectDetails(res.data)).catch(() => setProjectDetails(null));
    }, [projectId]);

    const isProjectOwner = !!projectId && !!projectDetails && !!user && projectDetails.owner.id === user.id;

    // ── Danger Zone ────────────────────────────────────────────────────────
    const [confirmAction, setConfirmAction] = useState<DangerAction>(null);
    const [confirmText, setConfirmText] = useState('');
    const [processing, setProcessing] = useState(false);

    const requiredConfirmText = confirmAction === 'delete-org'
        ? (activeWorkspace.org?.name ?? '')
        : confirmAction === 'delete-project'
            ? (projectDetails?.title ?? '')
            : 'CLEAR';

    const closeConfirm = () => { setConfirmAction(null); setConfirmText(''); };

    const executeClear = async () => {
        setProcessing(true);
        try {
            await clearWorkspaceData();
            closeConfirm();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to clear workspace data.');
        } finally {
            setProcessing(false);
        }
    };

    const executeDeleteOrg = async () => {
        if (!activeWorkspace.org) return;
        setProcessing(true);
        try {
            await api.delete(`/organisations/${activeWorkspace.org.slug}/`);
            refetchOrgs();
            setActiveWorkspace({ type: 'solo' });
            closeConfirm();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to delete organisation.');
        } finally {
            setProcessing(false);
        }
    };

    const executeDeleteProject = async () => {
        if (!projectId) return;
        setProcessing(true);
        try {
            await api.delete(`/projects/${projectId}/`);
            setActiveBoard(activeWorkspace.type === 'org' ? 'org' : 'solo');
            closeConfirm();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to delete project.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-8 max-w-3xl">
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <BoardSwitcher />
                    <span className="text-zinc-700 text-lg font-light">/</span>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-zinc-400" /> Workspace Settings
                    </h2>
                </div>
                <p className="text-sm text-zinc-500">
                    {projectId
                        ? `Settings for this project's Devs workspace — separate from every other project.`
                        : isOrgRoot
                            ? `Settings for "${activeWorkspace.org?.name}"'s general workspace — separate from any of its individual projects.`
                            : 'Settings for your personal workspace.'}
                </p>
            </div>

            {/* Identity */}
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                {projectId ? (
                    <IdentityCard
                        avatarUrl={projectDetails?.cover_image}
                        avatarSeed={projectDetails?.title}
                        title={projectDetails?.title ?? 'Loading…'}
                        subtitle={projectDetails ? `Status: ${projectDetails.status.replace('_', ' ')}` : undefined}
                        href={`/projects/${projectId}/dashboard`}
                        linkLabel="Edit identity & members"
                    />
                ) : isOrgRoot ? (
                    <IdentityCard
                        avatarUrl={activeWorkspace.org?.logo}
                        avatarSeed={activeWorkspace.org?.name}
                        title={activeWorkspace.org?.name ?? ''}
                        subtitle={`@${activeWorkspace.org?.slug}`}
                        badge={activeWorkspace.org?.is_verified ? 'Verified' : undefined}
                        href={`/organisations/${activeWorkspace.org?.slug}/dashboard`}
                        linkLabel="Edit identity & members"
                    />
                ) : (
                    <IdentityCard
                        avatarUrl={user?.avatar}
                        avatarSeed={user?.username}
                        title={user?.real_name || user?.username || ''}
                        subtitle={user?.username ? `@${user.username}` : undefined}
                        href="/settings"
                        linkLabel="Manage your account"
                    />
                )}
            </section>

            {/* Danger Zone */}
            <section className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-sm font-semibold text-zinc-300">Clear Workspace Data</p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                            Permanently deletes this board&apos;s Kanban tasks, GDD docs, assets, and activity history. Columns and categories are kept. This cannot be undone.
                        </p>
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => setConfirmAction('clear')}
                            className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 px-4 py-2 rounded-xl text-sm font-bold transition-all flex-shrink-0"
                        >
                            <Trash2 className="w-4 h-4" /> Clear Data
                        </button>
                    )}
                </div>

                {isOrgRoot && (
                    <div className="flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-red-900/30">
                        <div>
                            <p className="text-sm font-semibold text-zinc-300">Delete Organisation</p>
                            <p className="text-xs text-zinc-600 mt-0.5">
                                Permanently deletes &quot;{activeWorkspace.org?.name}&quot;, its roles, and removes all members. Its projects are <span className="text-zinc-400 font-semibold">not</span> deleted — they just become independent, still owned by their creators. This cannot be undone.
                            </p>
                        </div>
                        {isOrgOwner ? (
                            <button
                                onClick={() => setConfirmAction('delete-org')}
                                className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 px-4 py-2 rounded-xl text-sm font-bold transition-all flex-shrink-0"
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        ) : (
                            <p className="text-xs text-zinc-600 italic flex-shrink-0">Only the owner can do this.</p>
                        )}
                    </div>
                )}

                {projectId && (
                    <div className="flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-red-900/30">
                        <div>
                            <p className="text-sm font-semibold text-zinc-300">Delete Project</p>
                            <p className="text-xs text-zinc-600 mt-0.5">
                                Permanently deletes &quot;{projectDetails?.title}&quot; and all its data — devlogs, feedback, and this board&apos;s Kanban/GDD/assets. This cannot be undone.
                            </p>
                        </div>
                        {isProjectOwner ? (
                            <button
                                onClick={() => setConfirmAction('delete-project')}
                                className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 px-4 py-2 rounded-xl text-sm font-bold transition-all flex-shrink-0"
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        ) : (
                            <p className="text-xs text-zinc-600 italic flex-shrink-0">Only the owner can do this.</p>
                        )}
                    </div>
                )}
            </section>

            {/* Confirm Modal */}
            {confirmAction && (
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) closeConfirm(); }}
                >
                    <div className="bg-zinc-950 border border-red-900/50 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300 p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-red-500/10 rounded-xl">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white">
                                    {confirmAction === 'delete-org' ? 'Delete Organisation?' : confirmAction === 'delete-project' ? 'Delete Project?' : 'Clear Workspace Data?'}
                                </h3>
                            </div>
                            <button onClick={closeConfirm} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-sm text-zinc-400">
                            Type <span className="font-bold text-white font-mono">&quot;{requiredConfirmText}&quot;</span> to confirm:
                        </p>
                        <input
                            autoFocus
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={requiredConfirmText}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-all"
                        />
                        <div className="flex gap-3">
                            <button onClick={closeConfirm} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">
                                Cancel
                            </button>
                            <button
                                disabled={confirmText !== requiredConfirmText || processing}
                                onClick={confirmAction === 'delete-org' ? executeDeleteOrg : confirmAction === 'delete-project' ? executeDeleteProject : executeClear}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : (confirmAction === 'clear' ? 'Clear Forever' : 'Delete Forever')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
