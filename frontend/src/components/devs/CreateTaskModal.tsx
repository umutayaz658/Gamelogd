'use client';

import { useState, useEffect } from 'react';
import { X, Flag, User, Tag, Calendar, ChevronDown, UserPlus, Search, Settings } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { Task, TaskPriority, TaskCategory, DEFAULT_KANBAN_CATEGORIES } from './WorkspaceTypes';
import { cn, getImageUrl } from '@/lib/utils';
import api from '@/lib/api';
import CategoryManager from './CategoryManager';

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultColumnId?: string;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: 'text-zinc-350 bg-zinc-800/60 border-zinc-700' },
    { value: 'medium', label: 'Medium', color: 'text-blue-400/90 bg-blue-600/10 border-blue-500/30' },
    { value: 'high', label: 'High', color: 'text-amber-400/90 bg-amber-600/10 border-amber-500/30' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-400/90 bg-red-600/10 border-red-500/30' },
];

export default function CreateTaskModal({ isOpen, onClose, defaultColumnId = 'backlog' }: CreateTaskModalProps) {
    const { data, setTasks, setKanbanCategories, logActivity, activeWorkspace, activeBoard } = useWorkspace();
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [category, setCategory] = useState<TaskCategory>('code');
    const [assignee, setAssignee] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [storyPoints, setStoryPoints] = useState<number | undefined>(undefined);

    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const categories = data.kanbanCategories ?? DEFAULT_KANBAN_CATEGORIES;

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
        return orgMembers.map((m: any) => ({
            username: m.user.username,
            real_name: m.user.real_name || m.user.username,
            avatar: m.user.avatar ?? undefined,
        }));
    };

    const availableMembers = getAvailableMembers();
    const filteredMembers = availableMembers.filter(
        (m) =>
            m.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
            (m.real_name ?? '').toLowerCase().includes(memberSearch.toLowerCase())
    );

    const selectedMember = availableMembers.find((m) => m.username === assignee);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        const task: Task = {
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: title.trim(),
            description: description.trim(),
            priority,
            category,
            columnId: defaultColumnId,
            assignee: assignee.trim() || undefined,
            dueDate: dueDate || undefined,
            subtasks: [],
            comments: [],
            createdAt: new Date().toISOString(),
            storyPoints,
        };
        setTasks((prev) => [...prev, task]);
        logActivity('task_created', `Task "${task.title}" created.`, '📋');
        setTitle('');
        setDescription('');
        setPriority('medium');
        setCategory('code');
        setAssignee('');
        setDueDate('');
        setStoryPoints(undefined);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl shadow-black/60 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-white">Create Task</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left Column - Main Details */}
                        <div className="flex-1 space-y-4 min-w-0">
                            {/* Title */}
                            <div>
                                <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1.5 font-sans">Task Title *</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Implement double jump mechanic"
                                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-655 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-sans font-semibold"
                                    required
                                />
                            </div>
                                              {/* Description */}
                            <div>
                                <label className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider block mb-1.5 font-sans">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Optional description..."
                                    rows={6}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-655 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none font-sans font-medium"
                                />
                            </div>

                             {/* Category */}
                             <div>
                                  <div className="flex items-center justify-between mb-2">
                                      <label className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                          <Tag className="w-3.5 h-3.5 text-zinc-500" /> Category
                                      </label>
                                      <button
                                          type="button"
                                          onClick={() => setShowCategoryManager(true)}
                                          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer transition-all hover:underline"
                                      >
                                          <Settings className="w-3 h-3" /> Manage
                                      </button>
                                  </div>
                                 <div className="flex flex-wrap gap-1.5">
                                     {categories.map((cat) => {
                                         return (
                                             <button
                                                 key={cat.id}
                                                 type="button"
                                                 onClick={() => setCategory(cat.id)}
                                                 className={cn(
                                                     'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                                                     category === cat.id ? `${cat.color} ${cat.bg}` : 'bg-zinc-900 border-zinc-805 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                                                 )}
                                             >
                                                 {cat.emoji && <span>{cat.emoji}</span>}
                                                 <span>{cat.label}</span>
                                             </button>
                                         );
                                     })}
                                 </div>
                             </div>
                        </div>

                        {/* Right Column - Metadata / Sidebar */}
                        <div className="w-full md:w-72 flex-shrink-0 space-y-4 border-t md:border-t-0 md:border-l border-zinc-800/80 pt-4 md:pt-0 md:pl-6">
                            {/* Priority */}
                            <div>
                                <label className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider block mb-2 flex items-center gap-1.5 font-sans">
                                    <Flag className="w-3.5 h-3.5 text-zinc-500" /> Priority
                                </label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {PRIORITY_OPTIONS.map(({ value, label, color }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setPriority(value)}
                                            className={cn(
                                                'py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                                                priority === value ? color : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Story Points */}
                            <div>
                                <label className="text-[10px] font-extrabold text-zinc-555 uppercase tracking-wider block mb-2 font-sans">
                                    Story Points (Complexity)
                                </label>
                                <div className="flex gap-1.5">
                                    {[1, 2, 3, 5, 8].map((pts) => (
                                        <button
                                            key={pts}
                                            type="button"
                                            onClick={() => setStoryPoints(storyPoints === pts ? undefined : pts)}
                                            className={cn(
                                                'flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                                                storyPoints === pts
                                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-450 font-extrabold shadow-inner'
                                                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                                            )}
                                        >
                                            {pts}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Assignee */}
                            <div className="relative">
                                <label className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5 font-sans">
                                    <User className="w-3.5 h-3.5 text-zinc-500" /> Assignee
                                </label>
                                
                                <button
                                    type="button"
                                    onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                                    className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2.5 text-left text-xs text-zinc-300 focus:outline-none transition-all cursor-pointer font-sans font-semibold"
                                >
                                    {selectedMember ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-850 border border-zinc-800 flex-shrink-0">
                                                <img
                                                    src={getImageUrl(selectedMember.avatar, selectedMember.real_name || selectedMember.username)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <span className="truncate max-w-[120px] text-zinc-300">
                                                {selectedMember.real_name || selectedMember.username}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-zinc-500">Unassigned</span>
                                    )}
                                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                                </button>

                                {showAssigneeDropdown && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-45"
                                            onClick={() => setShowAssigneeDropdown(false)}
                                        />
                                        <div className="absolute left-0 bottom-full mb-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full p-1.5 space-y-1 max-h-48 overflow-y-auto scrollbar-thin-dark animate-in fade-in slide-in-from-bottom-2 duration-150">
                                            <div className="relative p-1">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-650" />
                                                <input
                                                    value={memberSearch}
                                                    onChange={(e) => setMemberSearch(e.target.value)}
                                                    placeholder="Search members..."
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAssignee('');
                                                    setShowAssigneeDropdown(false);
                                                    setMemberSearch('');
                                                }}
                                                className={cn(
                                                    "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg transition-all",
                                                    !assignee ? "bg-blue-600/15 text-blue-400 font-bold" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                                )}
                                            >
                                                <UserPlus className="w-3.5 h-3.5 text-zinc-500" />
                                                <span>Unassigned</span>
                                            </button>

                                            {filteredMembers.map((m) => (
                                                <button
                                                    key={m.username}
                                                    type="button"
                                                    onClick={() => {
                                                        setAssignee(m.username);
                                                        setShowAssigneeDropdown(false);
                                                        setMemberSearch('');
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg transition-all",
                                                        assignee === m.username
                                                            ? "bg-blue-600/15 text-blue-400 font-bold"
                                                            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                                    )}
                                                >
                                                    <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-805 border border-zinc-800 flex-shrink-0">
                                                        <img
                                                            src={getImageUrl(m.avatar, m.real_name || m.username)}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <span className="truncate">
                                                        {m.real_name || m.username}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5 font-sans">
                                    <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Due Date
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-sans font-semibold"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/60">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim()}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 cursor-pointer"
                        >
                            Create Task
                        </button>
                    </div>
                </form>
            </div>

            {showCategoryManager && (
                <CategoryManager
                    title="Manage Task Categories"
                    categories={categories}
                    onSave={(cats) => setKanbanCategories(cats)}
                    onDeleteReassign={(deletedId, fallbackId) => {
                        if (category === deletedId) setCategory(fallbackId);
                        setTasks(prevTasks => prevTasks.map(t => t.category === deletedId ? { ...t, category: fallbackId } : t));
                    }}
                    onClose={() => setShowCategoryManager(false)}
                />
            )}
        </div>
    );
}
