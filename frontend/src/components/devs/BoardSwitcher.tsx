'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { cn, getImageUrl } from '@/lib/utils';
import api from '@/lib/api';

interface BoardSwitcherProps {
    /** Feedback is always project-specific — there's no such thing as org-wide feedback — so its
     * picker hides the "General Board" (org/solo) option entirely and only lists projects. */
    projectsOnly?: boolean;
}

interface BoardProject {
    id: number;
    title?: string;
    cover_image?: string | null;
    organisation?: number | null;
}

/**
 * Org-vs-project board switcher, shared across every Devs tool that scopes its
 * data by `activeBoard` (Kanban, GDD Hub, Asset Registry, Team & Roles, Feedback).
 * Self-contained: reads useWorkspace()/useAuth() directly, no props needed beyond `projectsOnly`.
 */
export default function BoardSwitcher({ projectsOnly = false }: BoardSwitcherProps) {
    const { activeWorkspace, activeBoard, setActiveBoard } = useWorkspace();
    const { user } = useAuth();
    const [projects, setProjects] = useState<BoardProject[]>([]);
    const [showBoardDropdown, setShowBoardDropdown] = useState(false);

    useEffect(() => {
        api.get('/projects/?manageable=true')
            .then((res) => {
                const all: BoardProject[] = res.data.results ?? res.data;
                if (activeWorkspace.type === 'org' && activeWorkspace.org) {
                    setProjects(all.filter((p) => p.organisation === activeWorkspace.org?.id));
                } else {
                    setProjects(all.filter((p) => !p.organisation));
                }
            })
            .catch((err) => console.error('Failed to load projects:', err));
    }, [activeWorkspace]);

    const activeBoardInfo = useMemo(() => {
        if (projectsOnly && !activeBoard.startsWith('project_')) {
            return { name: 'Select a project', avatar: undefined, avatarSeed: undefined };
        }
        if (activeBoard === 'solo') {
            return {
                name: user?.real_name || user?.username || 'Personal Workspace',
                avatar: user?.avatar,
                // Fallback initials are always seeded from username (not real_name) so this
                // matches the avatar-less placeholder shown everywhere else in the app (e.g.
                // the navbar) for the same account — otherwise the same user shows different
                // initials in different corners of the UI.
                avatarSeed: user?.username,
            };
        }
        if (activeBoard === 'org') {
            return {
                name: activeWorkspace.org?.name || 'Organisation',
                avatar: activeWorkspace.org?.logo,
                avatarSeed: activeWorkspace.org?.name,
            };
        }
        if (activeBoard.startsWith('project_')) {
            const pid = parseInt(activeBoard.replace('project_', ''), 10);
            const p = projects.find((proj) => proj.id === pid);
            return {
                name: p?.title || 'Project Board',
                avatar: p?.cover_image,
                avatarSeed: p?.title,
            };
        }
        return {
            name: 'Board',
            avatar: undefined,
            avatarSeed: undefined,
        };
    }, [activeBoard, activeWorkspace, projects, user, projectsOnly]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowBoardDropdown(!showBoardDropdown)}
                className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-all rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md cursor-pointer min-w-[200px] justify-between"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                        <img
                            src={getImageUrl(activeBoardInfo.avatar, activeBoardInfo.avatarSeed)}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <span className="truncate max-w-[120px]">{activeBoardInfo.name}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
            </button>

            {showBoardDropdown && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowBoardDropdown(false)}
                    />
                    <div className="absolute left-0 top-full mt-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-64 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2.5 py-1.5 border-b border-zinc-900/60 mb-1">
                            Switch Workspace Board
                        </p>

                        {/* General Board option — hidden for projectsOnly pickers (Feedback has no org-wide scope) */}
                        {!projectsOnly && (
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveBoard(activeWorkspace.type === 'solo' ? 'solo' : 'org');
                                    setShowBoardDropdown(false);
                                }}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors text-left font-semibold",
                                    (activeBoard === 'solo' || activeBoard === 'org')
                                        ? "bg-blue-600/10 text-blue-400 font-bold"
                                        : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                )}
                            >
                                <div className="w-5 h-5 rounded-md overflow-hidden bg-zinc-800 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                    <img
                                        src={getImageUrl(
                                            activeWorkspace.type === 'solo' ? user?.avatar : activeWorkspace.org?.logo,
                                            activeWorkspace.type === 'solo' ? (user?.real_name || user?.username) : activeWorkspace.org?.name
                                        )}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="truncate">
                                    {activeWorkspace.type === 'solo' ? 'Personal' : activeWorkspace.org?.name}
                                </span>
                            </button>
                        )}

                        {/* Projects list */}
                        {projects.length > 0 ? (
                            <div className={cn(!projectsOnly && "pt-1.5 border-t border-zinc-900/60 mt-1")}>
                                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-2.5 py-1">
                                    Projects
                                </p>
                                {projects.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveBoard(`project_${p.id}`);
                                            setShowBoardDropdown(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors text-left font-semibold",
                                            activeBoard === `project_${p.id}`
                                                ? "bg-blue-600/10 text-blue-400 font-bold"
                                                : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                        )}
                                    >
                                        <div className="w-5 h-5 rounded-md overflow-hidden bg-zinc-800 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                            <img
                                                src={getImageUrl(p.cover_image, p.title)}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span className="truncate">{p.title}</span>
                                    </button>
                                ))}
                            </div>
                        ) : projectsOnly ? (
                            <p className="px-2.5 py-3 text-xs text-zinc-500 text-center">No projects yet</p>
                        ) : null}
                    </div>
                </>
            )}
        </div>
    );
}
