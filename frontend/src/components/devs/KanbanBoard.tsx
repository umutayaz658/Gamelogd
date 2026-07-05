'use client';

import { useState, useEffect } from 'react';
import { Plus, PlusCircle, X, Check, Search, Filter, GripVertical, Edit2, Trash2, ChevronDown, Tag, Settings } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { Task, KanbanColumn, TaskPriority, TaskCategory, CATEGORY_EMOJI } from './WorkspaceTypes';
import CreateTaskModal from './CreateTaskModal';
import KanbanCard from './KanbanCard';
import TaskDetailsModal from './TaskDetailsModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { cn, getImageUrl } from '@/lib/utils';
import api from '@/lib/api';

const COLUMN_COLORS = [
    'border-violet-500/30',
    'border-pink-500/30',
    'border-cyan-500/30',
    'border-orange-500/30',
    'border-teal-500/30',
];
const COLUMN_DOTS = [
    'bg-violet-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-teal-500',
];

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

export default function KanbanBoard() {
    const { data, setColumns, setTasks, setCategories, logActivity, activeWorkspace, activeBoard, setActiveBoard } = useWorkspace();
    const { columns, tasks } = data;
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);

    useEffect(() => {
        api.get('/projects/?manageable=true')
            .then((res) => {
                const all = res.data.results ?? res.data;
                if (activeWorkspace.type === 'org' && activeWorkspace.org) {
                    setProjects(all.filter((p: any) => p.organisation === activeWorkspace.org?.id));
                } else {
                    setProjects(all.filter((p: any) => !p.organisation));
                }
            })
            .catch((err) => console.error('Failed to load projects:', err));
    }, [activeWorkspace]);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createColumnId, setCreateColumnId] = useState('backlog');
    
    // Drag states
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [draggedColId, setDraggedColId] = useState<string | null>(null);
    const [dragOverColId, setDragOverColId] = useState<string | null>(null);
    
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Add column state
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColName, setNewColName] = useState('');

    // Rename column
    const [renamingColId, setRenamingColId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Inline task creation
    const [activeInlineColId, setActiveInlineColId] = useState<string | null>(null);
    const [inlineTaskTitle, setInlineTaskTitle] = useState('');

    // Confirmation popups
    const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
    const [confirmDeleteColId, setConfirmDeleteColId] = useState<string | null>(null);

    // Quick filters
    const [searchTaskQuery, setSearchTaskQuery] = useState('');
    const [filterMe, setFilterMe] = useState(false);
    const [filterCats, setFilterCats] = useState<TaskCategory[]>([]);

    const [showBoardDropdown, setShowBoardDropdown] = useState(false);

    const activeBoardInfo = (() => {
        if (activeBoard === 'solo') {
            return {
                name: user?.real_name || user?.username || 'Personal Workspace',
                avatar: user?.avatar,
            };
        }
        if (activeBoard === 'org') {
            return {
                name: activeWorkspace.org?.name || 'Organisation',
                avatar: activeWorkspace.org?.logo,
            };
        }
        if (activeBoard.startsWith('project_')) {
            const pid = parseInt(activeBoard.replace('project_', ''), 10);
            const p = projects.find((proj) => proj.id === pid);
            return {
                name: p?.title || 'Project Board',
                avatar: p?.cover_image,
            };
        }
        return {
            name: 'Board',
            avatar: undefined,
        };
    })();

    const [groupBy, setGroupBy] = useState<'none' | 'assignee' | 'priority'>('none');
    const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
    const [editingWipColId, setEditingWipColId] = useState<string | null>(null);
    const [wipLimitValue, setWipLimitValue] = useState<string>('');

    const categories = data?.categories ?? ['code', 'art', 'audio', 'qa', 'other'];
    const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');
    const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
    const [laneSearchQuery, setLaneSearchQuery] = useState('');
    const [editingCat, setEditingCat] = useState<string | null>(null);
    const [editCatValue, setEditCatValue] = useState<string>('');

    const handleRenameCategory = (oldCat: string, newCat: string) => {
        const cleanNew = newCat.trim();
        if (!cleanNew || cleanNew === oldCat) return;
        setCategories(categories.map(c => c === oldCat ? cleanNew : c));
        if (filterCats.includes(oldCat as TaskCategory)) {
            setFilterCats(filterCats.map(c => c === oldCat ? cleanNew : c) as TaskCategory[]);
        }
        setTasks(prev => prev.map(t => t.category === oldCat ? { ...t, category: cleanNew as TaskCategory } : t));
    };

    const handleAddCustomTag = () => {
        const clean = newTagInput.trim();
        if (!clean) return;
        if (categories.includes(clean)) return;
        setCategories([...categories, clean]);
        setNewTagInput('');
    };

    const handleDeleteCustomTag = (tag: string) => {
        setCategories(categories.filter((c) => c !== tag));
        setFilterCats(filterCats.filter((c) => c !== tag));
    };

    const getAvailableMembers = () => {
        if (activeWorkspace.type === 'solo') {
            return user ? [{ username: user.username, real_name: user.real_name || user.username, avatar: user.avatar }] : [];
        }
        
        if (activeBoard.startsWith('project_')) {
            const pid = parseInt(activeBoard.replace('project_', ''), 10);
            const proj = projects.find((p) => p.id === pid);
            return proj?.members?.map((m: any) => ({
                username: m.user.username,
                real_name: m.user.real_name || m.user.username,
                avatar: m.user.avatar ?? undefined,
            })) || [];
        }

        const orgMembers = activeWorkspace.org?.members ?? [];
        return orgMembers.map((m: any) => ({
            username: m.user.username,
            real_name: m.user.real_name || m.user.username,
            avatar: m.user.avatar ?? undefined,
        }));
    };

    const availableMembers = getAvailableMembers();

    const getLanes = () => {
        let list: {
            id: string;
            label: string;
            avatar?: string;
            filter: (t: Task) => boolean;
            color?: string;
        }[] = [];
        if (groupBy === 'assignee') {
            const assignees = Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))) as string[];
            list = [
                ...assignees.map((username) => {
                    const member = availableMembers.find((m: any) => m.username === username);
                    return {
                        id: username,
                        label: member?.real_name || `@${username}`,
                        avatar: member?.avatar,
                        filter: (t: Task) => t.assignee === username,
                    };
                }),
                {
                    id: 'unassigned',
                    label: 'Unassigned',
                    avatar: undefined,
                    filter: (t: Task) => !t.assignee,
                }
            ];
        } else if (groupBy === 'priority') {
            list = [
                { id: 'urgent', label: 'Urgent Priority', filter: (t: Task) => t.priority === 'urgent', color: 'text-red-400', avatar: undefined },
                { id: 'high', label: 'High Priority', filter: (t: Task) => t.priority === 'high', color: 'text-amber-400', avatar: undefined },
                { id: 'medium', label: 'Medium Priority', filter: (t: Task) => t.priority === 'medium', color: 'text-blue-400', avatar: undefined },
                { id: 'low', label: 'Low Priority', filter: (t: Task) => t.priority === 'low', color: 'text-zinc-400', avatar: undefined },
            ];
        }

        if (laneSearchQuery && groupBy === 'assignee') {
            return list.filter((lane) =>
                lane.label.toLowerCase().includes(laneSearchQuery.toLowerCase())
            );
        }
        return list;
    };

    const lanes = getLanes();

    const toggleLane = (laneId: string) => {
        setCollapsedLanes(prev => ({ ...prev, [laneId]: !prev[laneId] }));
    };

    const getTasksByColumn = (colId: string) => {
        return tasks.filter((t) => {
            if (t.columnId !== colId) return false;

            // Search filter
            if (searchTaskQuery) {
                const q = searchTaskQuery.toLowerCase();
                const matchTitle = t.title.toLowerCase().includes(q);
                const matchDesc = t.description?.toLowerCase().includes(q) ?? false;
                const matchId = `task-${t.id.slice(-4)}`.toLowerCase().includes(q);
                if (!matchTitle && !matchDesc && !matchId) return false;
            }

            // "My Tasks" filter
            if (filterMe && user) {
                if (t.assignee !== user.username) return false;
            }

            // Category filter
            if (filterCats.length > 0) {
                if (!filterCats.includes(t.category)) return false;
            }

            return true;
        });
    };

    // ── Task Drag Handlers ────────────────────────────────────────────────────
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDrop = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        if (draggedId) {
            const task = tasks.find((t) => t.id === draggedId);
            if (task && task.columnId !== colId) {
                setTasks((prev) => prev.map((t) => t.id === draggedId ? { ...t, columnId: colId } : t));
                const col = columns.find((c) => c.id === colId);
                logActivity('task_created', `Task "${task.title}" moved to "${col?.label ?? colId}".`, '📋');
            }
            setDraggedId(null);
            setDragOverId(null);
        } else if (draggedColId) {
            handleColDrop(e, colId);
        }
    };
    const handleDragOver = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        if (draggedId) {
            e.dataTransfer.dropEffect = 'move';
            setDragOverId(colId);
        }
    };
    const handleDragLeave = () => setDragOverId(null);

    // ── Column Drag Handlers ──────────────────────────────────────────────────
    const handleColDragStart = (e: React.DragEvent, colId: string) => {
        if ((e.target as HTMLElement).closest('button, input, select')) {
            e.preventDefault();
            return;
        }
        setDraggedColId(colId);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleColDragOver = (e: React.DragEvent, colId: string) => {
        if (draggedColId) {
            e.preventDefault();
            setDragOverColId(colId);
        }
    };
    const handleColDrop = (e: React.DragEvent, targetColId: string) => {
        e.preventDefault();
        if (draggedColId && draggedColId !== targetColId) {
            const draggedIdx = columns.findIndex((c) => c.id === draggedColId);
            const targetIdx = columns.findIndex((c) => c.id === targetColId);
            if (draggedIdx !== -1 && targetIdx !== -1) {
                const updated = [...columns];
                const [removed] = updated.splice(draggedIdx, 1);
                updated.splice(targetIdx, 0, removed);
                setColumns(updated);
                logActivity('task_created', 'Columns reordered.', '📋');
            }
        }
        setDraggedColId(null);
        setDragOverColId(null);
    };

    // ── Task CRUD ─────────────────────────────────────────────────────────────
    const handleDeleteTask = (id: string) => {
        setConfirmDeleteTaskId(id);
    };

    const executeDeleteTask = (id: string) => {
        const task = tasks.find((t) => t.id === id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        if (task) logActivity('task_created', `Task "${task.title}" deleted.`, '🗑️');
        setConfirmDeleteTaskId(null);
    };

    const handleCreateInlineTask = (colId: string) => {
        if (!inlineTaskTitle.trim()) return;
        const task: Task = {
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: inlineTaskTitle.trim(),
            description: '',
            priority: 'medium',
            category: 'other',
            columnId: colId,
            subtasks: [],
            comments: [],
            createdAt: new Date().toISOString(),
        };
        setTasks((prev) => [...prev, task]);
        logActivity('task_created', `Task "${task.title}" created.`, '📋');
        setInlineTaskTitle('');
        setActiveInlineColId(null);
    };

    // ── Column management ─────────────────────────────────────────────────────
    const handleAddColumn = () => {
        if (!newColName.trim()) return;
        const idx = columns.length - 4; // offset from defaults
        const safeIdx = Math.max(0, idx) % COLUMN_COLORS.length;
        const id = `col-${Date.now()}`;
        const newCol: KanbanColumn = {
            id,
            label: newColName.trim(),
            color: COLUMN_COLORS[safeIdx],
            dotColor: COLUMN_DOTS[safeIdx],
        };
        setColumns([...columns, newCol]);
        setNewColName('');
        setAddingColumn(false);
    };

    const handleRenameColumn = (colId: string) => {
        if (!renameValue.trim()) { setRenamingColId(null); return; }
        setColumns(columns.map((c) => c.id === colId ? { ...c, label: renameValue.trim() } : c));
        setRenamingColId(null);
    };

    const handleDeleteColumn = (colId: string) => {
        setConfirmDeleteColId(colId);
    };

    const executeDeleteColumn = (colId: string) => {
        if (columns.length <= 1) return; // protect last column
        const remaining = columns.filter((c) => c.id !== colId);
        const fallbackColId = remaining[0].id;
        // Move tasks in this column to another column
        setTasks((prev) => prev.map((t) => t.columnId === colId ? { ...t, columnId: fallbackColId } : t));
        setColumns(remaining);
        logActivity('task_created', `Column deleted. Tasks moved to "${remaining[0].label}".`, '📋');
        setConfirmDeleteColId(null);
    };

    const openTaskDetails = (task: Task) => setSelectedTask(task);

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => {
        const doneCol = columns.find((c) => c.id === 'done');
        return doneCol && t.columnId === 'done';
    }).length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        {/* Custom Board Selector on the Left */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowBoardDropdown(!showBoardDropdown)}
                                className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-all rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md cursor-pointer min-w-[200px] justify-between"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-6 h-6 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                        <img
                                            src={getImageUrl(activeBoardInfo.avatar, activeBoardInfo.name)}
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

                                        {/* General Board option */}
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

                                        {/* Projects list */}
                                        {projects.length > 0 && (
                                            <div className="pt-1.5 border-t border-zinc-900/60 mt-1">
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
                                                        <div className="w-5 h-5 rounded-md overflow-hidden bg-zinc-805 border border-zinc-800 flex items-center justify-center flex-shrink-0">
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
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <span className="text-zinc-700 text-lg font-light">/</span>

                        {/* Title on the Right */}
                        <h2 className="text-xl font-extrabold text-zinc-300">Kanban Board</h2>
                    </div>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        {doneTasks}/{totalTasks} tasks done · Drag columns & tasks to reorder
                    </p>
                </div>
                <button
                    onClick={() => { setCreateColumnId('backlog'); setShowCreateModal(true); }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
                >
                    <Plus className="w-4 h-4" />
                    Add Task
                </button>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-550 uppercase tracking-wider flex items-center gap-1.5 mr-2 font-sans">
                        <Filter className="w-3.5 h-3.5" /> Filters:
                    </span>
                    <button
                        onClick={() => setFilterMe(!filterMe)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                            filterMe ? "bg-blue-600/20 border-blue-500/50 text-blue-400 font-bold" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        )}
                    >
                        Assigned to Me
                    </button>

                    {/* Categories Filter Dropdown/Drawer */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                                filterCats.length > 0
                                    ? "bg-blue-600/20 border-blue-500/50 text-blue-400 font-bold"
                                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                            )}
                        >
                            <Tag className="w-3 h-3 text-zinc-405" />
                            <span>Categories {filterCats.length > 0 && `(${filterCats.length})`}</span>
                            <ChevronDown className="w-3 h-3 text-zinc-500" />
                        </button>
                        {showCategoriesDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowCategoriesDropdown(false)} />
                                <div className="absolute left-0 mt-2 z-50 bg-zinc-950/95 backdrop-blur border border-zinc-800 rounded-xl shadow-2xl w-60 p-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                                    <p className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest px-1 pb-1.5 border-b border-zinc-900/60 font-sans">
                                        Filter by Category
                                    </p>
                                    <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin-dark pr-1">
                                        {categories.map((cat) => {
                                            const isSelected = filterCats.includes(cat);
                                            const label = getCategoryLabel(cat);
                                            const emoji = getCategoryEmoji(cat);
                                            
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => {
                                                        setFilterCats(prev =>
                                                            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                                        );
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer",
                                                        isSelected
                                                            ? "bg-blue-600/10 text-blue-400 font-bold"
                                                            : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                                    )}
                                                >
                                                    <span className="flex items-center gap-2 font-sans">
                                                        <span className="text-sm">{emoji || '📌'}</span>
                                                        <span>{label}</span>
                                                    </span>
                                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {(filterMe || filterCats.length > 0 || searchTaskQuery) && (
                        <button
                            onClick={() => {
                                setFilterMe(false);
                                setFilterCats([]);
                                setSearchTaskQuery('');
                            }}
                            className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 font-sans"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Lane Search Input for Assignee lanes */}
                    {groupBy === 'assignee' && (
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-655" />
                            <input
                                value={laneSearchQuery}
                                onChange={(e) => setLaneSearchQuery(e.target.value)}
                                placeholder="Filter lanes..."
                                className="bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-655 focus:outline-none focus:border-blue-500 transition-all w-28 font-sans"
                            />
                        </div>
                    )}

                    {/* Custom Group By Dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowGroupByDropdown(!showGroupByDropdown)}
                            className="bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 rounded-xl px-3 py-1.5 focus:outline-none transition-all flex items-center gap-1.5 font-sans"
                        >
                            <span>Group By: {groupBy === 'none' ? 'None' : groupBy === 'assignee' ? 'Assignee' : 'Priority'}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-550" />
                        </button>
                        {showGroupByDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowGroupByDropdown(false)} />
                                <div className="absolute right-0 mt-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-40 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                    {(['none', 'assignee', 'priority'] as const).map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => {
                                                setGroupBy(opt);
                                                setShowGroupByDropdown(false);
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-2 py-1.5 text-left text-xs font-semibold rounded-lg transition-colors font-sans",
                                                groupBy === opt ? "bg-blue-600/10 text-blue-400 font-bold" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                            )}
                                        >
                                            <span>{opt === 'none' ? 'None' : opt === 'assignee' ? 'Assignee' : 'Priority'}</span>
                                            {groupBy === opt && <Check className="w-3 h-3 text-blue-400 stroke-[3px]" />}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-650" />
                        <input
                            value={searchTaskQuery}
                            onChange={(e) => setSearchTaskQuery(e.target.value)}
                            placeholder="Search tasks..."
                            className="bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-1.5 text-white text-xs placeholder:text-zinc-650 focus:outline-none focus:border-blue-500 transition-all w-40 font-sans"
                        />
                    </div>
                </div>
            </div>

            {/* Unified Board Scroll Container */}
            <div className="flex-1 overflow-x-auto pb-4 scrollbar-thin-dark min-h-[500px] flex flex-col gap-4">
                
                {/* Column Headers for Swimlanes Mode */}
                {groupBy !== 'none' && (
                    <div className="flex gap-4 flex-shrink-0 min-w-max pb-1">
                        {columns.map((col) => {
                            const colTasks = getTasksByColumn(col.id);
                            const totalSP = colTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
                            const isWipExceeded = col.wipLimit !== undefined && colTasks.length > col.wipLimit;
                            return (
                                <div
                                    key={col.id}
                                    className={cn(
                                        "w-72 flex-shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/20 border rounded-xl transition-all",
                                        isWipExceeded ? "border-red-500/50 ring-1 ring-red-500/20" : col.color
                                    )}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', col.dotColor)} />
                                        <span className="text-xs font-bold text-zinc-300 truncate">{col.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {editingWipColId === col.id ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                value={wipLimitValue}
                                                placeholder="Limit"
                                                onChange={(e) => setWipLimitValue(e.target.value.replace(/\D/g, ''))}
                                                onBlur={() => {
                                                    const limit = parseInt(wipLimitValue, 10);
                                                    setColumns(columns.map((c) => c.id === col.id ? { ...c, wipLimit: isNaN(limit) || limit <= 0 ? undefined : limit } : c));
                                                    setEditingWipColId(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const limit = parseInt(wipLimitValue, 10);
                                                        setColumns(columns.map((c) => c.id === col.id ? { ...c, wipLimit: isNaN(limit) || limit <= 0 ? undefined : limit } : c));
                                                        setEditingWipColId(null);
                                                    }
                                                    if (e.key === 'Escape') setEditingWipColId(null);
                                                }}
                                                className="w-14 bg-zinc-950 border border-zinc-800 focus:border-blue-500/80 rounded-lg px-2 py-0.5 text-[10px] font-bold text-center text-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 shadow-inner"
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingWipColId(col.id);
                                                    setWipLimitValue(col.wipLimit?.toString() ?? '');
                                                }}
                                                className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold hover:bg-zinc-700/80 transition-colors select-none",
                                                    isWipExceeded
                                                        ? "bg-red-500/25 text-red-400 font-extrabold ring-1 ring-red-500/40"
                                                        : "bg-zinc-800 text-zinc-400"
                                                )}
                                                title="Click to set WIP limit"
                                            >
                                                {colTasks.length}{col.wipLimit !== undefined ? `/${col.wipLimit}` : ''}
                                            </button>
                                        )}
                                        {totalSP > 0 && (
                                            <span className="text-[9px] bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 px-1.5 py-0.5 rounded-full font-semibold">
                                                {totalSP} SP
                                            </span>
                                        )}
                                        {/* Column Limit Edit Trigger */}
                                        <button
                                            onClick={() => {
                                                setEditingWipColId(col.id);
                                                setWipLimitValue(col.wipLimit?.toString() ?? '');
                                            }}
                                            className="text-zinc-600 hover:text-amber-400 p-0.5 rounded transition-all"
                                            title="Set WIP Limit"
                                        >
                                            <Settings className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="w-64 flex-shrink-0" />
                    </div>
                )}

                {/* Board Content */}
                {groupBy !== 'none' ? (
                    <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1 scrollbar-thin-dark min-w-max">
                        {lanes.map((lane) => {
                            const laneTasks = tasks.filter(lane.filter);
                            if (laneTasks.length === 0 && lane.id !== 'unassigned') return null;
                            const isCollapsed = collapsedLanes[lane.id];
                            const laneSP = laneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

                            return (
                                <div key={lane.id} className="space-y-3 border border-zinc-800/40 bg-zinc-950/20 p-2.5 rounded-2xl">
                                    {/* Collapsible Lane Header (Sticky on scroll) */}
                                    <div className="sticky left-0 z-10 w-fit">
                                        <button
                                            type="button"
                                            onClick={() => toggleLane(lane.id)}
                                            className="flex items-center gap-2 px-3 py-2 bg-zinc-900/90 backdrop-blur hover:bg-zinc-900 border border-zinc-800 transition-colors rounded-xl text-left shadow-lg shadow-black/30"
                                        >
                                            <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", isCollapsed && "-rotate-90")} />
                                            {lane.avatar && (
                                                <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-850 border border-zinc-700 flex-shrink-0">
                                                    <img src={getImageUrl(lane.avatar, lane.label)} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <span className={cn("text-xs font-bold text-white", (lane as any).color)}>
                                                {lane.label}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-semibold ml-1">
                                                {laneTasks.length} tasks · {laneSP} SP
                                            </span>
                                        </button>
                                    </div>

                                    {/* Column Lanes Content */}
                                    {!isCollapsed && (
                                        <div className="flex gap-4">
                                            {columns.map((col) => {
                                                const rawColTasks = getTasksByColumn(col.id);
                                                const filteredColTasks = rawColTasks.filter(lane.filter);
                                                const isOver = dragOverId === col.id;

                                                return (
                                                    <div
                                                        key={col.id}
                                                        onDragOver={(e) => handleDragOver(e, col.id)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, col.id)}
                                                        className={cn(
                                                            "flex flex-col flex-shrink-0 w-72 bg-zinc-905/10 border border-zinc-800/60 rounded-xl p-2.5 space-y-2 min-h-[120px] transition-all",
                                                            isOver && "bg-blue-500/5 ring-1 ring-blue-500/30"
                                                        )}
                                                    >
                                                        {filteredColTasks.map((task) => (
                                                            <div
                                                                key={task.id}
                                                                draggable
                                                                onDragStart={(e) => handleDragStart(e, task.id)}
                                                                className={cn(
                                                                    'transition-opacity duration-150',
                                                                    draggedId === task.id ? 'opacity-40' : 'opacity-100'
                                                                )}
                                                            >
                                                                <KanbanCard
                                                                    task={task}
                                                                    onDelete={handleDeleteTask}
                                                                    onClick={() => openTaskDetails(task)}
                                                                />
                                                            </div>
                                                        ))}

                                                        {filteredColTasks.length === 0 && (
                                                            <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-800/40 rounded-xl py-6">
                                                                <p className="text-[10px] text-zinc-700">Empty Column</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            <div className="w-64 flex-shrink-0" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Standard columns view (all horizontal scrolling synced under the same parent) */
                    <div className="flex gap-4 min-w-max pb-2">
                        {columns.map((col) => {
                            const colTasks = getTasksByColumn(col.id);
                            const totalSP = colTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
                            const isOver = dragOverId === col.id;
                            const isColOver = dragOverColId === col.id;
                            const isWipExceeded = col.wipLimit !== undefined && colTasks.length > col.wipLimit;

                            return (
                                <div
                                    key={col.id}
                                    onDragOver={(e) => handleColDragOver(e, col.id)}
                                    onDrop={(e) => handleDrop(e, col.id)}
                                    className={cn(
                                        'flex flex-col flex-shrink-0 w-72 bg-zinc-900/40 border rounded-2xl overflow-hidden transition-all duration-150',
                                        isWipExceeded ? "border-red-500/50 ring-1 ring-red-500/10" : col.color,
                                        isOver && 'ring-2 ring-blue-500/50 bg-blue-500/5',
                                        isColOver && 'ring-2 ring-violet-500/50 border-violet-500/50',
                                        draggedColId === col.id && 'opacity-40'
                                    )}
                                >
                                    {/* Column Header (Draggable for reordering) */}
                                    <div
                                        draggable={renamingColId !== col.id}
                                        onDragStart={(e) => handleColDragStart(e, col.id)}
                                        className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 flex-shrink-0 cursor-grab active:cursor-grabbing bg-zinc-900/60 hover:bg-zinc-900 transition-colors"
                                    >
                                        {renamingColId === col.id ? (
                                            <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    autoFocus
                                                    value={renameValue}
                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                    onBlur={() => handleRenameColumn(col.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameColumn(col.id);
                                                        if (e.key === 'Escape') setRenamingColId(null);
                                                    }}
                                                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-650 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                                                />
                                                <button onClick={() => handleRenameColumn(col.id)}
                                                    className="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-zinc-800/60">
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setRenamingColId(null)}
                                                    className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800/60">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <GripVertical className="w-3 h-3 text-zinc-655 flex-shrink-0" />
                                                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', col.dotColor)} />
                                                    <button
                                                        onDoubleClick={() => {
                                                            setRenamingColId(col.id);
                                                            setRenameValue(col.label);
                                                        }}
                                                        className="text-sm font-bold text-zinc-300 truncate text-left flex items-center gap-1.5 group/title"
                                                        title="Double-click to rename"
                                                    >
                                                        <span>{col.label}</span>
                                                        <Edit2 className="w-3 h-3 text-zinc-605 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                                                    </button>
                                                    
                                                    {/* WIP Limit Display and Editing */}
                                                    {editingWipColId === col.id ? (
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={wipLimitValue}
                                                            placeholder="Limit"
                                                            onChange={(e) => setWipLimitValue(e.target.value.replace(/\D/g, ''))}
                                                            onBlur={() => {
                                                                const limit = parseInt(wipLimitValue, 10);
                                                                setColumns(columns.map((c) => c.id === col.id ? { ...c, wipLimit: isNaN(limit) || limit <= 0 ? undefined : limit } : c));
                                                                setEditingWipColId(null);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    const limit = parseInt(wipLimitValue, 10);
                                                                    setColumns(columns.map((c) => c.id === col.id ? { ...c, wipLimit: isNaN(limit) || limit <= 0 ? undefined : limit } : c));
                                                                    setEditingWipColId(null);
                                                                }
                                                                if (e.key === 'Escape') setEditingWipColId(null);
                                                            }}
                                                            className="w-14 bg-zinc-950 border border-zinc-750 focus:border-blue-500/80 rounded-lg px-2 py-0.5 text-[10px] font-bold text-center text-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 shadow-inner"
                                                        />
                                                    ) : (
                                                        <span
                                                            onDoubleClick={() => {
                                                                setEditingWipColId(col.id);
                                                                setWipLimitValue(col.wipLimit?.toString() ?? '');
                                                            }}
                                                            className={cn(
                                                                "text-[10px] px-1.5 py-0.5 rounded-full font-bold cursor-pointer hover:bg-zinc-700/80 transition-colors select-none",
                                                                isWipExceeded
                                                                    ? "bg-red-500/25 text-red-400 font-extrabold ring-1 ring-red-500/40"
                                                                    : "bg-zinc-800 text-zinc-500"
                                                            )}
                                                            title="Double-click to set WIP limit"
                                                        >
                                                            {colTasks.length}{col.wipLimit !== undefined ? `/${col.wipLimit}` : ''}
                                                        </span>
                                                    )}
                                                    {totalSP > 0 && (
                                                        <span className="text-[9px] bg-zinc-850/80 border border-zinc-800 text-zinc-550 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                                                            {totalSP} SP
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                                    {/* Column Limit Edit Trigger */}
                                                    <button
                                                        onClick={() => {
                                                            setEditingWipColId(col.id);
                                                            setWipLimitValue(col.wipLimit?.toString() ?? '');
                                                        }}
                                                        className="text-zinc-600 hover:text-amber-405 p-0.5 rounded hover:bg-amber-500/10 transition-all"
                                                        title="Set WIP Limit"
                                                    >
                                                        <Settings className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => { setCreateColumnId(col.id); setShowCreateModal(true); }}
                                                        className="text-zinc-655 hover:text-blue-400 p-1 rounded-lg hover:bg-blue-500/10 transition-all"
                                                        title="Add task to this column"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                    {columns.length > 1 && (
                                                        <button
                                                            onClick={() => handleDeleteColumn(col.id)}
                                                            className="text-zinc-700 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all"
                                                            title="Delete column"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Tasks List */}
                                    <div
                                        onDragOver={(e) => handleDragOver(e, col.id)}
                                        onDragLeave={handleDragLeave}
                                        className="flex-1 p-2.5 flex flex-col gap-2 scrollbar-thin-dark overflow-y-auto min-h-[100px]"
                                    >
                                        {colTasks.length === 0 ? (
                                            <div className="flex-1 flex items-center justify-center text-center text-zinc-700 text-xs py-6">
                                                <div>
                                                    <div className="text-xl mb-1">📋</div>
                                                    Drop tasks here
                                                </div>
                                            </div>
                                        ) : (
                                            colTasks.map((task) => (
                                                <div
                                                    key={task.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, task.id)}
                                                    className={cn(
                                                        'transition-opacity duration-150',
                                                        draggedId === task.id ? 'opacity-40' : 'opacity-100'
                                                    )}
                                                >
                                                    <KanbanCard
                                                        task={task}
                                                        onDelete={handleDeleteTask}
                                                        onClick={() => openTaskDetails(task)}
                                                    />
                                                </div>
                                            ))
                                        )}

                                        {/* Inline task creator */}
                                        {activeInlineColId === col.id ? (
                                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 space-y-2 mt-1">
                                                <input
                                                    autoFocus
                                                    value={inlineTaskTitle}
                                                    onChange={(e) => setInlineTaskTitle(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCreateInlineTask(col.id);
                                                        if (e.key === 'Escape') setActiveInlineColId(null);
                                                    }}
                                                    placeholder="What needs to be done?"
                                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-blue-500 transition-all font-sans"
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleCreateInlineTask(col.id)}
                                                        className="flex-1 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-all shadow-md shadow-blue-900/20">
                                                        Add Task
                                                    </button>
                                                    <button onClick={() => setActiveInlineColId(null)}
                                                        className="flex-1 py-1 rounded-lg border border-zinc-800 text-zinc-550 text-[11px] hover:bg-zinc-900 transition-all">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setActiveInlineColId(col.id);
                                                    setInlineTaskTitle('');
                                                }}
                                                className="w-full py-1.5 flex items-center justify-center gap-1 bg-transparent hover:bg-zinc-900/30 text-zinc-600 hover:text-zinc-450 rounded-xl text-xs font-semibold transition-all mt-1"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Create Task
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add Column */}
                        <div className="flex-shrink-0 w-64">
                            {addingColumn ? (
                                <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-3 space-y-2">
                                    <input
                                        autoFocus
                                        value={newColName}
                                        onChange={(e) => setNewColName(e.target.value)}
                                        onBlur={() => { if (!newColName.trim()) setAddingColumn(false); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddColumn();
                                            if (e.key === 'Escape') setAddingColumn(false);
                                        }}
                                        placeholder="Column name..."
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-650 focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={handleAddColumn}
                                            className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all">
                                            Add
                                        </button>
                                        <button onClick={() => setAddingColumn(false)}
                                            className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-550 text-xs hover:bg-zinc-800 transition-all">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setAddingColumn(true)}
                                    className="w-full h-12 flex items-center justify-center gap-2 bg-zinc-900/30 border border-dashed border-zinc-700 rounded-2xl text-zinc-650 hover:text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800/30 text-sm font-semibold transition-all"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Add Column
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <CreateTaskModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                defaultColumnId={createColumnId}
            />
            {selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    columns={columns}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={(updated) => {
                        setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
                        setSelectedTask(updated);
                    }}
                    onDelete={(id) => {
                        executeDeleteTask(id);
                        setSelectedTask(null);
                    }}
                />
            )}

            <ConfirmDeleteModal
                isOpen={confirmDeleteTaskId !== null}
                title="Delete Task"
                description="Are you sure you want to delete this task? This action will permanently remove it from the board."
                onConfirm={() => {
                    if (confirmDeleteTaskId) {
                        executeDeleteTask(confirmDeleteTaskId);
                    }
                }}
                onCancel={() => setConfirmDeleteTaskId(null)}
            />

            <ConfirmDeleteModal
                isOpen={confirmDeleteColId !== null}
                title="Delete Column"
                description="Are you sure you want to delete this column? All tasks currently in this column will be moved to the first column."
                onConfirm={() => {
                    if (confirmDeleteColId) {
                        executeDeleteColumn(confirmDeleteColId);
                    }
                }}
                onCancel={() => setConfirmDeleteColId(null)}
            />
        </div>
    );
}
