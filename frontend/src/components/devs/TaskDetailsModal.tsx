'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    X, Flag, User, Tag, Calendar, CheckSquare, Square, Plus,
    Trash2, MessageSquare, Clock, ChevronDown, UserPlus, Search, Check,
} from 'lucide-react';
import { Task, KanbanColumn, TaskSubtask, TaskComment, TaskPriority, TaskCategory, CATEGORY_EMOJI, PRIORITY_COLOR } from './WorkspaceTypes';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { cn, getImageUrl } from '@/lib/utils';
import api from '@/lib/api';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface TaskDetailsModalProps {
    task: Task;
    columns: KanbanColumn[];
    onClose: () => void;
    onUpdate: (task: Task) => void;
    onDelete: (id: string) => void;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

const PRIORITY_LABEL: Record<TaskPriority, string> = {
    low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
};

const getCategoryStyles = (cat: string) => {
    const styles: Record<string, { label: string; emoji: string; color: string }> = {
        code: { label: 'Code', emoji: '💻', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
        art: { label: 'Art', emoji: '🎨', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
        audio: { label: 'Audio', emoji: '🎵', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        qa: { label: 'QA', emoji: '🧪', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
        other: { label: 'Other', emoji: '📌', color: 'text-zinc-400 bg-zinc-700/20 border-zinc-700/30' },
    };
    if (styles[cat] !== undefined) return styles[cat];

    let colorName = 'zinc';
    let baseCat = cat;
    if (cat.includes('|')) {
        const parts = cat.split('|');
        baseCat = parts[0];
        colorName = parts[1] || 'zinc';
    }

    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
    const match = baseCat.match(emojiRegex);
    const emoji = match ? match[0] : '';

    const labelRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u;
    const label = baseCat.replace(labelRegex, '');

    const colorMap: Record<string, string> = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        pink: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        zinc: 'text-zinc-400 bg-zinc-700/20 border-zinc-700/30',
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
        orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    };

    return {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        emoji: emoji || '📌',
        color: colorMap[colorName.toLowerCase()] || colorMap.zinc,
    };
};

export default function TaskDetailsModal({ task, columns, onClose, onUpdate, onDelete }: TaskDetailsModalProps) {
    const { data, logActivity, activeWorkspace, activeBoard } = useWorkspace();
    const { user } = useAuth();
    
    const [editingTitle, setEditingTitle] = useState(false);
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description);
    const [editingDesc, setEditingDesc] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);

    // Subtask
    const [newSubtask, setNewSubtask] = useState('');
    const [addingSubtask, setAddingSubtask] = useState(false);

    // Comment
    const [newComment, setNewComment] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState<string>('');

    // Confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Assignee dropdown and search state
    const [projectMembers, setProjectMembers] = useState<{ username: string; real_name?: string; avatar?: string }[]>([]);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');

    useEffect(() => {
        if (activeWorkspace.type === 'org' && activeWorkspace.org && activeBoard.startsWith('project_')) {
            const projectId = activeBoard.replace('project_', '');
            api.get(`/projects/${projectId}/`)
                .then((res) => {
                    const members = res.data.members ?? [];
                    const mapped = members.map((m: any) => ({
                        username: m.user.username,
                        real_name: m.user.real_name || m.user.username,
                        avatar: m.user.avatar ?? undefined,
                    }));
                    setProjectMembers(mapped);
                })
                .catch((err) => console.error('Failed to load project members:', err));
        }
    }, [activeWorkspace, activeBoard]);

    const getAvailableMembers = () => {
        if (activeWorkspace.type === 'solo') {
            return user ? [{ username: user.username, real_name: user.real_name || user.username, avatar: user.avatar }] : [];
        }
        
        if (activeBoard.startsWith('project_')) {
            return projectMembers;
        }

        const orgMembers = activeWorkspace.org?.members ?? [];
        if (orgMembers.length > 0) {
            return orgMembers.map((m: any) => ({
                username: m.user.username,
                real_name: m.user.real_name || m.user.username,
                avatar: m.user.avatar ?? undefined,
            }));
        }

        const localTeam = data?.teamMembers ?? [];
        return localTeam.map((m) => ({
            username: m.username,
            real_name: m.username,
            avatar: m.avatar,
        }));
    };

    const availableMembers = getAvailableMembers();
    const filteredMembers = availableMembers.filter(
        (m) =>
            m.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
            (m.real_name && m.real_name.toLowerCase().includes(memberSearch.toLowerCase()))
    );

    const update = (partial: Partial<Task>) => {
        onUpdate({ ...task, ...partial });
    };

    // ── Title ─────────────────────────────────────────────────────────────────
    const saveTitle = () => {
        if (title.trim()) update({ title: title.trim() });
        setEditingTitle(false);
    };

    // ── Description ───────────────────────────────────────────────────────────
    const saveDesc = () => {
        update({ description });
        setEditingDesc(false);
    };

    // ── Subtasks ──────────────────────────────────────────────────────────────
    const addSubtask = () => {
        if (!newSubtask.trim()) return;
        const st: TaskSubtask = { id: `st-${Date.now()}`, title: newSubtask.trim(), done: false };
        update({ subtasks: [...task.subtasks, st] });
        setNewSubtask('');
        setAddingSubtask(false);
    };
    const toggleSubtask = (id: string) => {
        const updated = task.subtasks.map((s) => s.id === id ? { ...s, done: !s.done } : s);
        update({ subtasks: updated });
        const st = task.subtasks.find((s) => s.id === id);
        if (st && !st.done) logActivity('subtask_checked', `Subtask "${st.title}" checked.`, '✅');
    };
    const deleteSubtask = (id: string) => {
        update({ subtasks: task.subtasks.filter((s) => s.id !== id) });
    };

    // ── Comments ──────────────────────────────────────────────────────────────
    const addComment = () => {
        if (!newComment.trim()) return;
        const c: TaskComment = {
            id: `c-${Date.now()}`,
            author: user?.username ?? 'Anonymous',
            authorName: user?.real_name ?? user?.username ?? 'Anonymous',
            authorAvatar: user?.avatar ?? undefined,
            text: newComment.trim(),
            createdAt: new Date().toISOString(),
        };
        update({ comments: [...task.comments, c] });
        setNewComment('');
    };

    const isManagerOrAdmin = () => {
        if (activeWorkspace.type === 'solo') return true;
        const currentMember = activeWorkspace.org?.members?.find((m: any) => m.user.username === user?.username);
        return currentMember?.role === 'owner' || currentMember?.role === 'admin';
    };

    const handleDeleteComment = (commentId: string) => {
        update({ comments: task.comments.filter(c => c.id !== commentId) });
    };

    const handleStartEditComment = (c: TaskComment) => {
        setEditingCommentId(c.id);
        setEditingCommentText(c.text);
    };

    const handleSaveEditComment = (commentId: string) => {
        const clean = editingCommentText.trim();
        if (!clean) return;
        update({ comments: task.comments.map(c => c.id === commentId ? { ...c, text: clean } : c) });
        setEditingCommentId(null);
    };

    const doneSubtasks = task.subtasks.filter((s) => s.done).length;
    const progress = task.subtasks.length > 0 ? Math.round((doneSubtasks / task.subtasks.length) * 100) : 0;

    // Get column status styles based on its dotColor
    const getStatusStyle = (colId: string) => {
        const col = columns.find((c) => c.id === colId);
        const dotColor = col?.dotColor ?? 'bg-blue-500';
        
        if (dotColor.includes('zinc')) {
            return 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400';
        } else if (dotColor.includes('blue')) {
            return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
        } else if (dotColor.includes('amber')) {
            return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
        } else if (dotColor.includes('emerald')) {
            return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-405';
        } else if (dotColor.includes('violet')) {
            return 'bg-violet-500/10 border-violet-500/30 text-violet-400';
        } else if (dotColor.includes('pink')) {
            return 'bg-pink-500/10 border-pink-500/30 text-pink-400';
        } else if (dotColor.includes('cyan')) {
            return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
        } else if (dotColor.includes('orange')) {
            return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
        } else if (dotColor.includes('teal')) {
            return 'bg-teal-500/10 border-teal-500/30 text-teal-400';
        }
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    };

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Centered Modal */}
            <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-650 font-mono tracking-wider font-semibold">TASK-{task.id.slice(-4).toUpperCase()}</span>
                        {/* Status dropdown styled dynamically */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                className={cn(
                                    "text-xs font-bold border rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer transition-all focus:outline-none hover:brightness-110",
                                    getStatusStyle(task.columnId)
                                )}
                            >
                                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', columns.find(c => c.id === task.columnId)?.dotColor || 'bg-blue-500')} />
                                <span>{columns.find(c => c.id === task.columnId)?.label || 'Status'}</span>
                                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                            </button>
                            {showStatusDropdown && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowStatusDropdown(false)} />
                                    <div className="absolute left-0 mt-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 w-48 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                        {columns.map((col) => {
                                            const isActive = task.columnId === col.id;
                                            return (
                                                <button
                                                    key={col.id}
                                                    type="button"
                                                    onClick={() => {
                                                        update({ columnId: col.id });
                                                        setShowStatusDropdown(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer",
                                                        isActive
                                                            ? "bg-blue-600/10 text-blue-400 font-bold"
                                                            : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                                    )}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', col.dotColor)} />
                                                        <span>{col.label}</span>
                                                    </span>
                                                    {isActive && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="p-2 text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                            title="Delete task"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content Area with dynamic grid & scrollbar */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin-dark min-h-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left / Main Section (Description, Subtasks, Activity) */}
                        <div className="md:col-span-2 space-y-6">
                            {/* Title */}
                            <div>
                                {editingTitle ? (
                                    <input
                                        autoFocus
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        onBlur={saveTitle}
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(task.title); setEditingTitle(false); } }}
                                        className="text-xl font-bold text-white w-full bg-transparent border-b-2 border-blue-500 focus:outline-none pb-1 font-sans"
                                    />
                                ) : (
                                    <h2
                                        className="text-xl font-extrabold text-white cursor-pointer hover:text-zinc-200 transition-colors font-sans"
                                        onClick={() => setEditingTitle(true)}
                                        title="Click to edit"
                                    >
                                        {task.title}
                                    </h2>
                                )}
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Description</p>
                                {editingDesc ? (
                                    <div className="space-y-2">
                                        <textarea
                                            autoFocus
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={4}
                                            className="w-full bg-zinc-900/60 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all font-sans"
                                            placeholder="Add a description..."
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={saveDesc} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-xl font-bold transition-all shadow-md shadow-blue-900/20">Save</button>
                                            <button onClick={() => { setDescription(task.description); setEditingDesc(false); }}
                                                className="px-3.5 py-2 text-zinc-400 text-xs hover:text-white transition-all">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => setEditingDesc(true)}
                                        className={cn(
                                            'text-sm leading-relaxed cursor-pointer rounded-xl p-3 border transition-all min-h-[70px]',
                                            task.description
                                                ? 'text-zinc-350 border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900/30'
                                                : 'text-zinc-500 border-dashed border-zinc-800 hover:border-zinc-700'
                                        )}
                                    >
                                        {task.description || 'Click to add a description...'}
                                    </div>
                                )}
                            </div>

                            {/* Subtasks */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                                        Subtasks {task.subtasks.length > 0 && `— ${progress}% Done`}
                                    </p>
                                    <button onClick={() => setAddingSubtask(true)}
                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors font-bold">
                                        <Plus className="w-3 h-3" /> Add Subtask
                                    </button>
                                </div>

                                {task.subtasks.length > 0 && (
                                    <div className="h-1.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn('h-full rounded-full transition-all duration-500', progress === 100 ? 'bg-emerald-500' : 'bg-blue-500')}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    {task.subtasks.map((st) => (
                                        <div key={st.id} className="flex items-center gap-2 group/st rounded-xl p-2 hover:bg-zinc-900/40 border border-transparent hover:border-zinc-800 transition-all">
                                            <button onClick={() => toggleSubtask(st.id)} className="flex-shrink-0">
                                                {st.done
                                                    ? <CheckSquare className="w-4 h-4 text-emerald-400" />
                                                    : <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-400" />}
                                            </button>
                                            <span className={cn('flex-1 text-sm', st.done ? 'text-zinc-500 line-through' : 'text-zinc-300')}>
                                                {st.title}
                                            </span>
                                            <button onClick={() => deleteSubtask(st.id)}
                                                className="opacity-0 group-hover/st:opacity-100 text-zinc-700 hover:text-red-400 transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}

                                    {addingSubtask && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                autoFocus
                                                value={newSubtask}
                                                onChange={(e) => setNewSubtask(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') addSubtask();
                                                    if (e.key === 'Escape') setAddingSubtask(false);
                                                }}
                                                placeholder="Subtask title..."
                                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                                            />
                                            <button onClick={addSubtask}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-xl font-bold transition-all shadow-md shadow-blue-900/20">Add</button>
                                            <button onClick={() => setAddingSubtask(false)}
                                                className="text-zinc-500 hover:text-white transition-all"><X className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Comments/Activity */}
                            <div className="space-y-3.5 pt-2">
                                <p className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-zinc-400" /> Activity / Comments
                                </p>

                                <div className="space-y-3.5">
                                    {task.comments.length === 0 && (
                                        <p className="text-xs text-zinc-500 italic">No comments yet. Start the conversation!</p>
                                    )}
                                    {task.comments.map((c) => {
                                        const isYou = c.author === 'You' || c.author === user?.username;
                                        const displayAuthor = isYou ? (user?.username ?? c.author) : c.author;
                                        const displayName = c.authorName || (isYou ? (user?.real_name || user?.username) : c.author);
                                        const avatarUrl = c.authorAvatar || (isYou ? user?.avatar : undefined);
                                        const canEdit = isYou;
                                        const canDelete = isYou || isManagerOrAdmin();

                                        return (
                                            <div key={c.id} className="flex gap-3 bg-zinc-900/25 border border-zinc-900/60 p-3 rounded-xl group/comment animate-in fade-in duration-100">
                                                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-850 border border-zinc-800 flex items-center justify-center">
                                                    <img
                                                        src={getImageUrl(avatarUrl, displayName)}
                                                        alt={displayAuthor}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <Link
                                                                href={`/${displayAuthor}`}
                                                                className="text-xs text-zinc-300 hover:text-blue-400 hover:underline transition-colors"
                                                            >
                                                                <span className="font-bold">{displayName}</span>
                                                                <span className="text-[10px] text-zinc-550 ml-1 font-normal">@{displayAuthor}</span>
                                                            </Link>
                                                            <span className="text-[10px] text-zinc-500 font-medium">
                                                                {new Date(c.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-1.5 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                                            {canEdit && editingCommentId !== c.id && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEditComment(c)}
                                                                    className="text-[10px] font-semibold text-zinc-500 hover:text-blue-450 px-1 py-0.5 rounded transition-all"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteComment(c.id)}
                                                                    className="text-[10px] font-semibold text-zinc-500 hover:text-red-450 px-1 py-0.5 rounded transition-all"
                                                                >
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {editingCommentId === c.id ? (
                                                        <div className="space-y-1.5 pt-1">
                                                            <input
                                                                value={editingCommentText}
                                                                onChange={(e) => setEditingCommentText(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleSaveEditComment(c.id);
                                                                    if (e.key === 'Escape') setEditingCommentId(null);
                                                                }}
                                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                                                                autoFocus
                                                            />
                                                            <div className="flex gap-2 text-[10px]">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEditComment(c.id)}
                                                                    className="text-blue-400 hover:text-blue-300 font-bold"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingCommentId(null)}
                                                                    className="text-zinc-500 hover:text-zinc-400 font-bold"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-zinc-400 break-words leading-relaxed">{c.text}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex gap-2 pt-1.5">
                                    <input
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                                        placeholder="Write a comment... (Enter to send)"
                                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-sans"
                                    />
                                    <button
                                        onClick={addComment}
                                        disabled={!newComment.trim()}
                                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl font-bold transition-all disabled:opacity-40 shadow-lg shadow-blue-900/20"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Section: Details Panel */}
                        <div className="space-y-6 bg-zinc-900/10 border border-zinc-800/60 rounded-2xl p-4 h-fit">
                            {/* Priority */}
                            <div>
                                <p className="text-[10px] text-zinc-550 uppercase tracking-wider font-bold mb-2">Priority</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {PRIORITIES.map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => update({ priority: p })}
                                            className={cn(
                                                'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                                task.priority === p ? PRIORITY_COLOR[p] : 'text-zinc-500 border-zinc-850 bg-zinc-900/20 hover:border-zinc-700'
                                            )}
                                        >
                                            <Flag className="w-3 h-3" /> {PRIORITY_LABEL[p]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <p className="text-[10px] text-zinc-550 uppercase tracking-wider font-bold mb-2">Category</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(data?.categories ?? ['code', 'art', 'audio', 'qa', 'other']).map((cat) => {
                                        const { label, emoji, color } = getCategoryStyles(cat);
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => update({ category: cat })}
                                                className={cn(
                                                    'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                                                    task.category === cat ? color : 'text-zinc-500 border-zinc-805 bg-zinc-900/20 hover:border-zinc-700'
                                                )}
                                            >
                                                {emoji && <span className="text-xs">{emoji}</span>}
                                                <span>{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Story Points */}
                            <div>
                                <p className="text-[10px] text-zinc-550 uppercase tracking-wider font-bold mb-2">Story Points</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {[1, 2, 3, 5, 8].map((pts) => (
                                        <button
                                            key={pts}
                                            onClick={() => update({ storyPoints: task.storyPoints === pts ? undefined : pts })}
                                            className={cn(
                                                'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                                                task.storyPoints === pts
                                                    ? 'bg-blue-600/15 border-blue-500/30 text-blue-400 font-bold shadow-inner'
                                                    : 'text-zinc-500 border-zinc-805 bg-zinc-900/20 hover:border-zinc-700'
                                            )}
                                        >
                                            {pts}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Assignee */}
                            <div className="relative">
                                <p className="text-[10px] text-zinc-100 uppercase tracking-wider font-bold mb-1.5 font-sans">Assignee</p>
                                <button
                                    type="button"
                                    onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                                    className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-455 hover:text-zinc-355 transition-all font-sans text-left focus:outline-none"
                                >
                                    <div className="flex items-center gap-2">
                                        <User className="w-3.5 h-3.5 text-zinc-500" />
                                        <span className={task.assignee ? "text-zinc-300 font-semibold" : "text-zinc-500"}>
                                            {task.assignee ? `@${task.assignee}` : 'Unassigned'}
                                        </span>
                                    </div>
                                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                                </button>

                                {showAssigneeDropdown && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-45 cursor-default"
                                            onClick={() => setShowAssigneeDropdown(false)}
                                        />
                                        <div className="absolute left-0 top-full mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-full max-h-56 flex flex-col p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                                            {/* Search input */}
                                            <div className="relative mb-2 flex-shrink-0">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-650" />
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="Search member..."
                                                    value={memberSearch}
                                                    onChange={(e) => setMemberSearch(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                                                />
                                            </div>

                                            {/* List of members */}
                                            <div className="flex-1 overflow-y-auto scrollbar-thin-dark space-y-0.5 max-h-36">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        update({ assignee: undefined });
                                                        setShowAssigneeDropdown(false);
                                                    }}
                                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-white rounded-lg transition-colors"
                                                >
                                                    Unassigned
                                                </button>
                                                
                                                {filteredMembers.map((member) => (
                                                    <button
                                                        key={member.username}
                                                        type="button"
                                                        onClick={() => {
                                                            update({ assignee: member.username });
                                                            setShowAssigneeDropdown(false);
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left",
                                                            task.assignee === member.username
                                                                ? "bg-blue-600/10 text-blue-400 font-bold"
                                                                : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 max-w-[70%]">
                                                            <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-800 border border-zinc-705 flex items-center justify-center text-[10px] text-zinc-400 font-bold flex-shrink-0">
                                                                <img src={getImageUrl(member.avatar, member.real_name || member.username)} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <span className="truncate text-zinc-350 font-semibold">{member.real_name || member.username}</span>
                                                        </div>
                                                        <span className="text-[10px] text-zinc-550 truncate max-w-[30%] font-normal">@{member.username}</span>
                                                    </button>
                                                ))}
                                                {filteredMembers.length === 0 && (
                                                    <p className="text-[10px] text-zinc-700 text-center py-4 italic">No members found</p>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Due Date */}
                            <div>
                                <p className="text-[10px] text-zinc-550 uppercase tracking-wider font-bold mb-1.5">Due Date</p>
                                <input
                                    type="date"
                                    defaultValue={task.dueDate ?? ''}
                                    onChange={(e) => update({ dueDate: e.target.value || undefined })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-405 focus:outline-none focus:border-blue-500 transition-all font-sans font-semibold"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>

                            {/* Metadata */}
                            <div className="border-t border-zinc-800 pt-4 flex items-center justify-between text-[11px] text-zinc-550">
                                <span>Created</span>
                                <span className="flex items-center gap-1 font-medium text-zinc-400">
                                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                    {new Date(task.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <ConfirmDeleteModal
                isOpen={showDeleteConfirm}
                title="Delete Task"
                description="Are you sure you want to delete this task? This action will permanently remove it from the board."
                onConfirm={() => {
                    api.delete(`/tasks/${task.id}/`)
                        .then(() => {
                            onDelete(task.id);
                            setShowDeleteConfirm(false);
                        })
                        .catch((err) => console.error('Failed to delete task:', err));
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}
