'use client';

import { useState, useEffect } from 'react';
import { X, Flag, User, Tag, Calendar, ChevronDown, UserPlus, Search, Pencil, Trash2, Check, Plus } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { Task, TaskPriority, TaskCategory, CATEGORY_EMOJI } from './WorkspaceTypes';
import { cn, getImageUrl } from '@/lib/utils';
import api from '@/lib/api';

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

const COLOR_PRESETS = [
    { name: 'Blue',     color: 'text-blue-405',    bg: 'bg-blue-650/10 border-blue-500/20' },
    { name: 'Violet',   color: 'text-violet-405',  bg: 'bg-violet-650/10 border-violet-500/20' },
    { name: 'Amber',    color: 'text-amber-455',   bg: 'bg-amber-650/10 border-amber-500/20' },
    { name: 'Pink',     color: 'text-pink-450',    bg: 'bg-pink-650/10 border-pink-500/20' },
    { name: 'Emerald',  color: 'text-emerald-450', bg: 'bg-emerald-650/10 border-emerald-500/20' },
    { name: 'Cyan',     color: 'text-cyan-405',    bg: 'bg-cyan-650/10 border-cyan-500/20' },
    { name: 'Zinc',     color: 'text-zinc-400',    bg: 'bg-zinc-800/60 border-zinc-700/60' },
    { name: 'Red',      color: 'text-red-405',     bg: 'bg-red-650/10 border-red-500/20' },
    { name: 'Orange',   color: 'text-orange-450',  bg: 'bg-orange-650/10 border-orange-500/20' },
];

const getCategoryStyles = (cat: string) => {
    const styles: Record<string, { label: string; emoji: string; color: string }> = {
        code: { label: 'Code', emoji: '💻', color: 'text-blue-400/90 bg-blue-600/10 border-blue-500/30' },
        art: { label: 'Art', emoji: '🎨', color: 'text-violet-400/90 bg-violet-600/10 border-violet-500/30' },
        audio: { label: 'Audio', emoji: '🎵', color: 'text-emerald-400/90 bg-emerald-600/10 border-emerald-500/30' },
        qa: { label: 'QA', emoji: '🧪', color: 'text-orange-400/90 bg-orange-600/10 border-orange-500/30' },
        other: { label: 'Other', emoji: '📌', color: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
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
        blue: 'text-blue-405 bg-blue-650/10 border-blue-500/20',
        violet: 'text-violet-405 bg-violet-650/10 border-violet-500/20',
        amber: 'text-amber-455 bg-amber-650/10 border-amber-500/20',
        pink: 'text-pink-450 bg-pink-650/10 border-pink-500/20',
        emerald: 'text-emerald-450 bg-emerald-650/10 border-emerald-500/20',
        cyan: 'text-cyan-405 bg-cyan-650/10 border-cyan-500/20',
        zinc: 'text-zinc-350 bg-zinc-800/60 border-zinc-700/60',
        red: 'text-red-405 bg-red-650/10 border-red-500/20',
        orange: 'text-orange-450 bg-orange-650/10 border-orange-500/20',
    };

    return {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        emoji: emoji || '📌',
        color: colorMap[colorName] || colorMap['zinc']
    };
};

export default function CreateTaskModal({ isOpen, onClose, defaultColumnId = 'backlog' }: CreateTaskModalProps) {
    const { data, setTasks, setCategories, logActivity, activeWorkspace, activeBoard } = useWorkspace();
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [category, setCategory] = useState<TaskCategory>('code');
    const [assignee, setAssignee] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [storyPoints, setStoryPoints] = useState<number | undefined>(undefined);

    // Category Manager sub-states
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [catManagerView, setCatManagerView] = useState<'list' | 'add' | 'edit'>('list');
    const [catName, setCatName] = useState('');
    const [catEmoji, setCatEmoji] = useState('📌');
    const [catColorIdx, setCatColorIdx] = useState(0);
    const [editingCatId, setEditingCatId] = useState<string | null>(null);

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
            (m.real_name ?? '').toLowerCase().includes(memberSearch.toLowerCase())
    );

    const selectedMember = availableMembers.find((m) => m.username === assignee);

    if (!isOpen) return null;

    const handleSaveCategory = () => {
        if (!catName.trim()) return;
        const colorPreset = COLOR_PRESETS[catColorIdx] || COLOR_PRESETS[0];
        const colorName = colorPreset.name.toLowerCase();
        const formatted = `${catEmoji.trim() || '📌'} ${catName.trim()}|${colorName}`;
        
        const currentCats = data.categories ?? ['code', 'art', 'audio', 'qa', 'other'];
        if (catManagerView === 'add') {
            setCategories([...currentCats, formatted]);
            setCategory(formatted);
        } else if (catManagerView === 'edit' && editingCatId) {
            setCategories(currentCats.map(c => c === editingCatId ? formatted : c));
            if (category === editingCatId) {
                setCategory(formatted);
            }
        }
        setCatManagerView('list');
    };

    const handleDeleteCategory = (catToDelete: string) => {
        const currentCats = data.categories ?? ['code', 'art', 'audio', 'qa', 'other'];
        if (currentCats.length <= 1) return;
        setCategories(currentCats.filter(c => c !== catToDelete));
        if (category === catToDelete) {
            const nextCat = currentCats.find(c => c !== catToDelete);
            setCategory(nextCat || 'other');
        }
    };

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
                                         onClick={() => {
                                             setCatManagerView('list');
                                             setShowCategoryManager(true);
                                         }}
                                         className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer transition-all hover:underline"
                                     >
                                         Manage Categories
                                     </button>
                                 </div>
                                 <div className="flex flex-wrap gap-1.5">
                                     {(data?.categories ?? ['code', 'art', 'audio', 'qa', 'other']).map((cat) => {
                                         const { label, emoji, color } = getCategoryStyles(cat);
                                         return (
                                             <button
                                                 key={cat}
                                                 type="button"
                                                 onClick={() => setCategory(cat)}
                                                 className={cn(
                                                     'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                                                     category === cat ? color : 'bg-zinc-900 border-zinc-805 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                                                 )}
                                             >
                                                 {emoji && <span>{emoji}</span>}
                                                 <span>{label}</span>
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
                <div 
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={(e) => { if (e.target === e.currentTarget && catManagerView === 'list') setShowCategoryManager(false); }}
                >
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh] overflow-hidden">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
                            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-sans">
                                {catManagerView === 'list' && 'Manage Categories'}
                                {catManagerView === 'add' && 'Add Category'}
                                {catManagerView === 'edit' && 'Edit Category'}
                            </h3>
                            <button 
                                type="button"
                                onClick={() => {
                                    if (catManagerView !== 'list') setCatManagerView('list');
                                    else setShowCategoryManager(false);
                                }}
                                className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {/* List View */}
                        {catManagerView === 'list' && (
                            <>
                                <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 scrollbar-thin-dark">
                                    <div className="space-y-2">
                                        {(data?.categories ?? ['code', 'art', 'audio', 'qa', 'other']).map((cat) => {
                                            const { label, emoji, color } = getCategoryStyles(cat);
                                            return (
                                                <div key={cat} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3">
                                                    <div className="flex items-center gap-3 font-sans">
                                                        <span className="text-lg">{emoji}</span>
                                                        <span className={cn("text-sm font-bold", color.split(' ').find(c => c.startsWith('text-')))}>{label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingCatId(cat);
                                                                setCatName(label);
                                                                setCatEmoji(emoji);
                                                                
                                                                let colorName = 'zinc';
                                                                if (cat.includes('|')) {
                                                                    colorName = cat.split('|')[1] || 'zinc';
                                                                } else {
                                                                    const defaultColors: Record<string, string> = {
                                                                        code: 'blue',
                                                                        art: 'violet',
                                                                        audio: 'emerald',
                                                                        qa: 'orange',
                                                                        other: 'zinc'
                                                                    };
                                                                    colorName = defaultColors[cat] || 'zinc';
                                                                }
                                                                const idx = COLOR_PRESETS.findIndex(p => p.name.toLowerCase() === colorName.toLowerCase());
                                                                setCatColorIdx(idx >= 0 ? idx : 6);
                                                                
                                                                setCatManagerView('edit');
                                                            }}
                                                            className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                                                            title="Edit category"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5 text-zinc-500" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteCategory(cat)}
                                                            className="p-1.5 text-zinc-550 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                                            title="Delete category"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCatName('');
                                            setCatEmoji('📌');
                                            setCatColorIdx(6); // default to Zinc
                                            setEditingCatId(null);
                                            setCatManagerView('add');
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-xs font-semibold transition-all cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" /> Add Custom Category
                                    </button>
                                </div>
                                <div className="p-5 border-t border-zinc-800 flex gap-3 flex-shrink-0">
                                    <button 
                                        type="button"
                                        onClick={() => setShowCategoryManager(false)} 
                                        className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold hover:bg-zinc-850 transition-all cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </>
                        )}
                        
                        {/* Form View (Add / Edit) */}
                        {(catManagerView === 'add' || catManagerView === 'edit') && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 scrollbar-thin-dark">
                                    {/* Name & Emoji input */}
                                    <div className="flex gap-3">
                                        <div className="w-20">
                                            <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1.5 font-sans">Emoji</label>
                                            <input
                                                type="text"
                                                maxLength={4}
                                                value={catEmoji}
                                                onChange={(e) => setCatEmoji(e.target.value)}
                                                placeholder="📌"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-center text-white text-sm placeholder:text-zinc-655 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-sans font-semibold"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1.5 font-sans">Category Name</label>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={catName}
                                                onChange={(e) => setCatName(e.target.value)}
                                                placeholder="e.g. Physics"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white text-sm placeholder:text-zinc-655 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-sans font-semibold"
                                                required
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Color Preset Pick */}
                                    <div>
                                        <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-2 font-sans">Color Theme</label>
                                        <div className="flex flex-wrap gap-2.5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5 justify-center">
                                            {COLOR_PRESETS.map((preset, idx) => (
                                                <button
                                                    key={preset.name}
                                                    type="button"
                                                    onClick={() => setCatColorIdx(idx)}
                                                    className={cn(
                                                        'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer',
                                                        preset.bg,
                                                        catColorIdx === idx ? 'border-white scale-110' : 'border-transparent'
                                                    )}
                                                    title={preset.name}
                                                >
                                                    <span className={cn('w-3.5 h-3.5 rounded-full bg-current', preset.color)} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 border-t border-zinc-800 flex gap-3 flex-shrink-0">
                                    <button 
                                        type="button" 
                                        onClick={() => setCatManagerView('list')} 
                                        className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold hover:bg-zinc-850 transition-all cursor-pointer"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={handleSaveCategory}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-650/10 cursor-pointer"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        )}
                        
                    </div>
                </div>
            )}
        </div>
    );
}
