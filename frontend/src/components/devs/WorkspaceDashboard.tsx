'use client';

import { useState, useEffect } from 'react';
import {
    KanbanSquare,
    FileText,
    FolderOpen,
    Globe,
    PlusCircle,
    Activity,
    Layers,
    Users,
    Zap,
    ArrowRight,
    Clock,
    TrendingUp,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useTranslation } from '@/lib/useTranslation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

interface ActivityItem {
    id: number;
    type: 'devlog' | 'project' | 'member' | 'task';
    text: string;
    time: string;
    avatar?: string;
}

const QUICK_ACTIONS: { labelKey: string; icon: React.ElementType; tool: string; color: string }[] = [
    { labelKey: 'kanbanBoard', icon: KanbanSquare, tool: 'kanban', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { labelKey: 'devlogsPublisher', icon: FileText, tool: 'devlogs', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { labelKey: 'gddHub', icon: FolderOpen, tool: 'gdd', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { labelKey: 'localisationManager', icon: Globe, tool: 'localisation', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
];

export default function WorkspaceDashboard() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { activeWorkspace, setActiveTool } = useWorkspace();
    const [stats, setStats] = useState({ projects: 0, members: 1, openTasks: 0, devlogs: 0 });
    const [loading, setLoading] = useState(true);

    const workspaceName =
        activeWorkspace.type === 'solo'
            ? (user?.username || t('soloWorkspace'))
            : (activeWorkspace.org?.name || t('workspace'));

    const workspaceLogo =
        activeWorkspace.type === 'org' && activeWorkspace.org?.logo
            ? getImageUrl(activeWorkspace.org.logo)
            : null;

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.append('manageable', 'true');
                if (activeWorkspace.type === 'org' && activeWorkspace.org) {
                    params.append('organisation', String(activeWorkspace.org.id));
                }
                const [projectsRes, postsRes] = await Promise.all([
                    api.get(`/projects/?${params.toString()}`),
                    api.get(`/posts/?${params.toString()}`),
                ]);
                const projects = projectsRes.data.results || projectsRes.data;
                const posts = postsRes.data.results || postsRes.data;
                const memberCount =
                    activeWorkspace.type === 'org'
                        ? (activeWorkspace.org?.members?.length ?? 1)
                        : 1;
                setStats({
                    projects: projects.length,
                    members: memberCount,
                    openTasks: 0, // Kanban tasks are local state for now
                    devlogs: posts.length,
                });
            } catch {
                // silently fail stats
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [activeWorkspace]);

    const STAT_CARDS = [
        { label: t('projects'), value: stats.projects, icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/8' },
        { label: t('devlogs'), value: stats.devlogs, icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
        { label: t('teamAndRoles'), value: stats.members, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/8' },
        { label: t('openTasks'), value: stats.openTasks, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/8' },
    ];

    return (
        <div className="space-y-8">
            {/* Workspace Header */}
            <div className="flex items-center gap-4">
                {workspaceLogo ? (
                    <img
                        src={workspaceLogo}
                        alt={workspaceName}
                        className="w-14 h-14 rounded-2xl object-cover border border-zinc-700/50 shadow-lg"
                    />
                ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-blue-800/30 border border-blue-500/20 flex items-center justify-center shadow-lg">
                        <KanbanSquare className="w-7 h-7 text-blue-400" />
                    </div>
                )}
                <div>
                    <h1 className="text-2xl font-bold text-white">{workspaceName}</h1>
                    <p className="text-sm text-zinc-500">
                        {activeWorkspace.type === 'solo' ? t('soloWorkspace') : t('organisations')}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
                    <div
                        key={label}
                        className={`${bg} border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3`}
                    >
                        <div className={`${color} flex items-center gap-2`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</span>
                        </div>
                        <p className={`text-3xl font-bold ${color}`}>
                            {loading ? '–' : value}
                        </p>
                    </div>
                ))}
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
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl divide-y divide-zinc-800/60">
                    {/* Placeholder activity items */}
                    {[
                        { text: 'Welcome to your Developer Workspace!', time: 'just now', icon: '🚀' },
                        { text: 'Use the sidebar to navigate your tools.', time: '1 min ago', icon: '💡' },
                        { text: 'Create a Kanban task to track your work.', time: '2 min ago', icon: '📋' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                            <span className="text-lg flex-shrink-0">{item.icon}</span>
                            <p className="text-sm text-zinc-300 flex-1">{item.text}</p>
                            <div className="flex items-center gap-1.5 text-zinc-600 text-xs flex-shrink-0">
                                <Clock className="w-3 h-3" />
                                {item.time}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
