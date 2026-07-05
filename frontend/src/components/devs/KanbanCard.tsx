'use client';

import { useState, useEffect } from 'react';
import { Flag, User, Tag, Trash2, CheckSquare, Square, Calendar, UserPlus } from 'lucide-react';
import { Task, TaskPriority, TaskCategory, CATEGORY_EMOJI, PRIORITY_COLOR } from './WorkspaceTypes';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface KanbanCardProps {
    task: Task;
    onDelete: (id: string) => void;
    onClick: () => void;
}

const getCategoryEmoji = (cat: string) => {
    const emojis: Record<string, string> = {
        code: '💻', art: '🎨', audio: '🎵', qa: '🧪', other: '📌'
    };
    if (emojis[cat] !== undefined) return emojis[cat];
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
    const match = cat.match(emojiRegex);
    return match ? match[0] : '';
};

const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
        code: 'Code', art: 'Art', audio: 'Audio', qa: 'QA', other: 'Other'
    };
    if (labels[cat] !== undefined) return labels[cat];
    
    let clean = cat;
    if (cat.includes('|')) {
        clean = cat.split('|')[0];
    }
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u;
    const label = clean.replace(emojiRegex, '');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
        code: 'text-blue-450',
        art: 'text-violet-450',
        audio: 'text-emerald-450',
        qa: 'text-orange-405',
        other: 'text-zinc-400',
    };
    if (colors[cat] !== undefined) return colors[cat];
    
    if (cat.includes('|')) {
        const parts = cat.split('|');
        const colorName = parts[1];
        const colorMap: Record<string, string> = {
            blue: 'text-blue-405',
            violet: 'text-violet-405',
            amber: 'text-amber-455',
            pink: 'text-pink-405',
            emerald: 'text-emerald-450',
            cyan: 'text-cyan-405',
            zinc: 'text-zinc-400',
            red: 'text-red-405',
            orange: 'text-orange-405',
        };
        if (colorMap[colorName]) return colorMap[colorName];
    }
    return 'text-zinc-400';
};

export default function KanbanCard({ task, onDelete, onClick }: KanbanCardProps) {
    const { data, setTasks, activeWorkspace, activeBoard } = useWorkspace();
    const { user } = useAuth();
    const [projectMembers, setProjectMembers] = useState<{ username: string; real_name?: string }[]>([]);
    const [showAssignDropdown, setShowAssignDropdown] = useState(false);

    useEffect(() => {
        if (activeWorkspace.type === 'org' && activeWorkspace.org && activeBoard.startsWith('project_')) {
            const projectId = activeBoard.replace('project_', '');
            api.get(`/projects/${projectId}/`)
                .then((res) => {
                    const members = res.data.members ?? [];
                    setProjectMembers(members.map((m: any) => ({
                        username: m.user.username,
                        real_name: m.user.real_name || m.user.username,
                    })));
                })
                .catch((err) => console.error('Failed to load project members:', err));
        }
    }, [activeWorkspace, activeBoard]);

    const getAvailableMembers = () => {
        if (activeWorkspace.type === 'solo') {
            return user ? [{ username: user.username, real_name: user.real_name || user.username }] : [];
        }
        if (activeBoard.startsWith('project_')) {
            return projectMembers;
        }
        const orgMembers = activeWorkspace.org?.members ?? [];
        if (orgMembers.length > 0) {
            return orgMembers.map((m: any) => ({
                username: m.user.username,
                real_name: m.user.real_name || m.user.username,
            }));
        }
        const localTeam = data?.teamMembers ?? [];
        return localTeam.map((m) => ({
            username: m.username,
            real_name: m.username,
        }));
    };

    const availableMembers = getAvailableMembers();

    const doneSubtasks = task.subtasks.filter((s) => s.done).length;
    const totalSubtasks = task.subtasks.length;
    const progress = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

    const isDueSoon = task.dueDate && new Date(task.dueDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

    const handleAssign = (username: string | undefined) => {
        setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, assignee: username } : t));
    };

    return (
        <div
            onClick={onClick}
            className="group bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 cursor-pointer transition-all duration-150 shadow-sm hover:shadow-md space-y-2.5 relative"
        >
            {/* Category row */}
            <div className="flex items-center justify-between">
                <span className={cn('text-[11px] font-bold flex items-center gap-1', getCategoryColor(task.category))}>
                    {getCategoryEmoji(task.category) ? <span>{getCategoryEmoji(task.category)}</span> : null}
                    <span>{getCategoryLabel(task.category)}</span>
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-0.5 rounded transition-all"
                    aria-label="Delete task"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>

            {/* Title */}
            <p className="text-sm font-semibold text-white leading-snug">{task.title}</p>

            {/* Subtask progress bar */}
            {totalSubtasks > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                            {doneSubtasks === totalSubtasks
                                ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                                : <Square className="w-3.5 h-3.5 text-zinc-650" />}
                            {doneSubtasks}/{totalSubtasks} subtasks
                        </span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-emerald-500' : 'bg-blue-500')}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                    {task.storyPoints && (
                        <span className="flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-black w-5 h-5 rounded-full shadow-inner" title={`${task.storyPoints} Story Points`}>
                            {task.storyPoints}
                        </span>
                    )}
                    <span className={cn(
                        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                        PRIORITY_COLOR[task.priority]
                    )}>
                        <Flag className="w-2.5 h-2.5" />
                        {task.priority}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {task.dueDate && (
                        <span className={cn(
                            'flex items-center gap-1 text-[10px] font-semibold',
                            isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-zinc-500'
                        )}>
                            <Calendar className="w-3 h-3" />
                            {new Date(task.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                    )}

                    {/* Quick Assign Dropdown */}
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAssignDropdown(!showAssignDropdown);
                            }}
                            className={cn(
                                "flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all text-[10px] font-semibold",
                                task.assignee
                                    ? "bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700"
                                    : "bg-zinc-950/20 border-zinc-800/55 text-zinc-500 hover:text-zinc-350 hover:bg-zinc-905/50 hover:border-zinc-750"
                            )}
                            title="Assign to member"
                        >
                            {task.assignee ? <User className="w-3 h-3 text-blue-400" /> : <UserPlus className="w-3 h-3" />}
                            <span className="truncate max-w-[70px]">
                                {task.assignee ? `@${task.assignee}` : 'Assign'}
                            </span>
                        </button>

                        {showAssignDropdown && (
                            <>
                                <div
                                    className="fixed inset-0 z-40 cursor-default"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAssignDropdown(false);
                                    }}
                                />
                                <div className="absolute right-0 bottom-full mb-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-40 max-h-48 overflow-y-auto scrollbar-thin-dark py-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAssign(undefined);
                                            setShowAssignDropdown(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-550 hover:bg-zinc-900 hover:text-white transition-colors"
                                    >
                                        Unassigned
                                    </button>
                                    {user && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAssign(user.username);
                                                setShowAssignDropdown(false);
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs text-blue-400 hover:bg-zinc-900 hover:text-blue-300 font-semibold transition-colors border-b border-zinc-900"
                                        >
                                            Assign to me
                                        </button>
                                    )}
                                    {availableMembers.filter(m => m.username !== user?.username).map((member) => (
                                        <button
                                            key={member.username}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAssign(member.username);
                                                setShowAssignDropdown(false);
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors truncate"
                                        >
                                            {member.real_name ? `${member.real_name} (@${member.username})` : `@${member.username}`}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {task.comments.length > 0 && (
                        <span className="text-[10px] text-zinc-500 font-semibold">💬 {task.comments.length}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
