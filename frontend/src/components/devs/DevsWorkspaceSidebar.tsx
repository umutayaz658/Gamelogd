'use client';

import { useState } from 'react';
import {
    LayoutDashboard,
    KanbanSquare,
    BookOpen,
    FolderOpen,
    Globe,
    Users,
    Settings,
    FileText,
    Bug,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useWorkspace, WorkspaceTool } from './WorkspaceContext';
import WorkspaceSelector from './WorkspaceSelector';
import { useTranslation } from '@/lib/useTranslation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface NavItem {
    key: WorkspaceTool;
    icon: React.ElementType;
    labelKey: keyof ReturnType<typeof useTranslation>['t'] extends (key: infer K) => string ? K : never;
}

const NAV_ITEMS: { key: WorkspaceTool; icon: React.ElementType; labelKey: string }[] = [
    { key: 'dashboard', icon: LayoutDashboard, labelKey: 'workspaceDashboard' },
    { key: 'kanban', icon: KanbanSquare, labelKey: 'kanbanBoard' },
    { key: 'devlogs', icon: FileText, labelKey: 'devlogsPublisher' },
    { key: 'projects', icon: FolderOpen, labelKey: 'projects' },
    { key: 'gdd', icon: BookOpen, labelKey: 'gddHub' },
    { key: 'assets', icon: FolderOpen, labelKey: 'assetRegistry' },
    // Still under active development — hidden in production, same as /collabs and /invest.
    ...(process.env.NODE_ENV === 'production' ? [] : [{ key: 'localisation' as WorkspaceTool, icon: Globe, labelKey: 'localisationManager' }]),
    { key: 'members', icon: Users, labelKey: 'teamAndRoles' },
    { key: 'playtest', icon: Bug, labelKey: 'playtestFeedback' },
    { key: 'settings', icon: Settings, labelKey: 'workspaceSettings' },
];

export default function DevsWorkspaceSidebar() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { activeTool, setActiveTool } = useWorkspace();

    return (
        <aside className="flex flex-col h-full gap-2">
            {/* Workspace Selector */}
            <div className="mb-2">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1 mb-2">
                    {t('workspace')}
                </p>
                <WorkspaceSelector />
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-800/70 mb-1" />

            {/* Navigation */}
            <nav className="flex flex-col gap-0.5">
                {NAV_ITEMS.map(({ key, icon: Icon, labelKey }) => {
                    const isActive = activeTool === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveTool(key)}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full group',
                                isActive
                                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent'
                            )}
                        >
                            <Icon
                                className={cn(
                                    'w-4 h-4 flex-shrink-0 transition-colors',
                                    isActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'
                                )}
                            />
                            <span className="truncate">{t(labelKey as any)}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom: Back to social */}
            <div className="mt-auto pt-4 border-t border-zinc-800/70">
                <Link
                    href="/"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all border border-transparent w-full"
                >
                    <ChevronRight className="w-4 h-4 rotate-180 flex-shrink-0" />
                    <span>{t('home')}</span>
                </Link>
            </div>
        </aside>
    );
}
