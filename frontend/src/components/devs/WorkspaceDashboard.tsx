'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    KanbanSquare,
    FolderOpen,
    BookOpen,
    Globe,
    Activity,
    Zap,
    Clock,
    ArrowUpRight,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useTranslation } from '@/lib/useTranslation';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl, getRelativeTime } from '@/lib/utils';

const QUICK_ACTIONS: { labelKey: string; icon: React.ElementType; tool: string; color: string }[] = [
    { labelKey: 'kanbanBoard', icon: KanbanSquare, tool: 'kanban', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { labelKey: 'gddHub', icon: BookOpen, tool: 'gdd', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { labelKey: 'assetRegistry', icon: FolderOpen, tool: 'assets', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
    { labelKey: 'localisationManager', icon: Globe, tool: 'localisation', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
];

export default function WorkspaceDashboard() {
    const { t, language } = useTranslation();
    const { user } = useAuth();
    const { activeWorkspace, data, setActiveTool } = useWorkspace();
    const [visibleActivityCount, setVisibleActivityCount] = useState(20);

    const workspaceName =
        activeWorkspace.type === 'solo'
            ? (user?.username || t('soloWorkspace'))
            : (activeWorkspace.org?.name || t('workspace'));

    const workspaceLogo =
        activeWorkspace.type === 'org' && activeWorkspace.org?.logo
            ? getImageUrl(activeWorkspace.org.logo)
            : null;

    const profileHref =
        activeWorkspace.type === 'org'
            ? (activeWorkspace.org?.slug ? `/organisations/${activeWorkspace.org.slug}` : null)
            : (user?.username ? `/${user.username}` : null);

    const logoEl = workspaceLogo ? (
        <img
            src={workspaceLogo}
            alt={workspaceName}
            className="w-14 h-14 rounded-2xl object-cover border border-zinc-700/50 shadow-lg"
        />
    ) : (
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-blue-800/30 border border-blue-500/20 flex items-center justify-center shadow-lg">
            <KanbanSquare className="w-7 h-7 text-blue-400" />
        </div>
    );

    const nameEl = (
        <div>
            <h1 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">{workspaceName}</h1>
            {activeWorkspace.type === 'solo' && (
                <p className="text-sm text-zinc-500">{t('soloWorkspace')}</p>
            )}
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Workspace Header */}
            <div className="flex items-center gap-3">
                {profileHref ? (
                    <Link href={profileHref} className="flex items-center gap-4 group">
                        {logoEl}
                        {nameEl}
                    </Link>
                ) : (
                    <div className="flex items-center gap-4">
                        {logoEl}
                        {nameEl}
                    </div>
                )}
                {profileHref && (
                    <Link
                        href={profileHref}
                        className="flex items-center gap-1 text-sm font-bold text-zinc-500 hover:text-blue-400 transition-colors"
                    >
                        {t('goToProfile')}
                        <ArrowUpRight className="w-4 h-4" />
                    </Link>
                )}
            </div>

            {/* Quick Actions */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-zinc-500" />
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('quickActions')}</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {QUICK_ACTIONS.map(({ labelKey, icon: Icon, tool, color }) => (
                        <button
                            key={tool}
                            onClick={() => setActiveTool(tool as any)}
                            className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border ${color} hover:scale-[1.02] transition-all duration-200 group`}
                        >
                            <Icon className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                            <span className="text-sm font-semibold">{t(labelKey as any)}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-zinc-500" />
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('recentActivity')}</h2>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl max-h-[420px] overflow-y-auto scrollbar-thin-dark">
                    {data.activities.length > 0 ? (
                        <div className="divide-y divide-zinc-800/60">
                            {data.activities.slice(0, visibleActivityCount).map((item) => (
                                <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                                    <p className="text-sm text-zinc-300 flex-1">{item.text}</p>
                                    <div className="flex items-center gap-1.5 text-zinc-600 text-xs flex-shrink-0">
                                        <Clock className="w-3 h-3" />
                                        {item.createdAt ? getRelativeTime(item.createdAt, language) : item.time}
                                    </div>
                                </div>
                            ))}
                            {data.activities.length > visibleActivityCount && (
                                <button
                                    onClick={() => setVisibleActivityCount((n) => n + 20)}
                                    className="w-full px-4 py-3 text-center text-sm font-semibold text-blue-400 hover:text-blue-300 hover:bg-zinc-800/40 transition-colors"
                                >
                                    {t('showMore')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-sm text-zinc-600">{t('noActivityYet')}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
