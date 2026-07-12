// ─── Kanban Types ────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = string;

export interface KanbanColumn {
    id: string;
    label: string;
    color: string;   // Tailwind border color e.g. 'border-blue-500/30'
    dotColor: string; // Tailwind bg color e.g. 'bg-blue-500'
    isDefault?: boolean;
    wipLimit?: number;
}

export interface TaskSubtask {
    id: string;
    title: string;
    done: boolean;
}

export interface TaskComment {
    id: string;
    author: string;
    authorName?: string;
    authorAvatar?: string;
    text: string;
    createdAt: string;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    priority: TaskPriority;
    category: TaskCategory;
    columnId: string;
    assignee?: string;
    dueDate?: string;
    subtasks: TaskSubtask[];
    comments: TaskComment[];
    createdAt: string;
    storyPoints?: number;
    linkedGDDRef?: string; // e.g. "doc-1:paragraph-3" for GDD task link badge
}

// ─── GDD Types ────────────────────────────────────────────────────────────────

export type GDDDocSection = string;

export interface GDDDocRevision {
    id: string;
    content: string;
    editedBy: string;
    editedAt: string;
}

export interface GDDComment {
    id: string;
    author: string;
    authorAvatar?: string;
    text: string;
    lineRef?: number; // which paragraph/line the comment is anchored to
    resolved: boolean;
    createdAt: string;
}

export interface GDDDoc {
    id: string;
    title: string;
    section: GDDDocSection;
    isPublic: boolean;
    content: string; // markdown content
    revisions: GDDDocRevision[];
    linkedTaskIds: string[];
    comments: GDDComment[];
    createdAt: string;
    lastEdited: string;
    sortOrder?: number;
    emoji?: string;
    parentId?: string;
}

export interface BalancingRow {
    id: string;
    [key: string]: string; // dynamic columns
}

export interface BalancingTable {
    id: string;
    name: string;
    columns: string[];
    rows: BalancingRow[];
}

export interface DialogueNode {
    id: string;
    speaker: string;
    message: string;
    choices: { text: string; nextId: string }[];
}

// ─── Asset Types ──────────────────────────────────────────────────────────────

export interface AssetCategoryItem {
    id: string;
    label: string;
    color: string;
    bg: string;
    emoji: string;
}

export interface Asset {
    id: string;
    name: string;
    category: string;
    tags: string[];
    link: string;
    notes: string;
    addedAt: string;
    addedBy: string;
}

// ─── Localisation Types ───────────────────────────────────────────────────────

export interface TranslationSuggestion {
    id: string;
    author: string;
    text: string;
    votes: number; // derived mirror of votedBy.length, kept for old persisted rows without votedBy
    votedBy?: string[]; // usernames who liked this suggestion — optional, absent on old blob data
    approved: boolean;
}

export interface TranslationEntry {
    id: string;
    key: string;
    namespace: string; // auto-derived from key prefix e.g. "mainMenu" from "mainMenu.play"
    baseText: string;
    approved: boolean;
    suggestions: Record<string, TranslationSuggestion[]>; // lang -> suggestions
}

export interface GlossaryTerm {
    id: string;
    term: string;
    translations: Record<string, string>; // lang -> locked translation
}

// ─── Playtest Types ─────────────────────────────────────────────────────────
// Team membership/roles are now backed by the real OrganisationMember/ProjectMember
// + Role models (see TeamRoles.tsx) rather than client-only WorkspaceState data.

export interface PlaytestFeedback {
    id: string;
    author: string;
    type: 'bug' | 'suggestion' | 'crash' | 'ui';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    buildVersion: string;
    submittedAt: string;
    convertedToTaskId?: string;
}

// ─── Activity Types ───────────────────────────────────────────────────────────

export type ActivityType =
    | 'task_created'
    | 'task_completed'
    | 'subtask_checked'
    | 'gdd_edited'
    | 'asset_added'
    | 'translation_approved'
    | 'member_joined'
    | 'playtest_submitted'
    | 'git_push'
    | 'steam_build';

export interface ActivityItem {
    id: string;
    type: ActivityType;
    text: string;
    time: string;
    icon: string;
    actor?: string;
}

// ─── Workspace Global State ───────────────────────────────────────────────────

export interface GDDCategory {
    id: string;
    label: string;
    color: string;
    bg: string;
    emoji: string;
}

export interface WorkspaceData {
    columns: KanbanColumn[];
    tasks: Task[];
    gddDocs: GDDDoc[];
    balancingTables: BalancingTable[];
    dialogueTrees: DialogueNode[][];
    assets: Asset[];
    translationKeys: TranslationEntry[];
    glossary: GlossaryTerm[];
    playtestFeedback: PlaytestFeedback[];
    activities: ActivityItem[];
    categories?: string[];
    gddCategories?: GDDCategory[];
    assetCategories?: AssetCategoryItem[];
}

export const DEFAULT_ASSET_CATEGORIES: AssetCategoryItem[] = [
    { id: '2d', label: '2D Art', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', emoji: '🎨' },
    { id: '3d', label: '3D Model', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', emoji: '📦' },
    { id: 'audio', label: 'Audio', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', emoji: '🎵' },
    { id: 'video', label: 'Video', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', emoji: '🎥' },
    { id: 'code', label: 'Code', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', emoji: '💻' },
    { id: 'other', label: 'Other', color: 'text-zinc-400', bg: 'bg-zinc-700/20 border-zinc-700/30', emoji: '📌' },
];

export const DEFAULT_COLUMNS: KanbanColumn[] = [
    { id: 'backlog', label: 'Backlog', color: 'border-zinc-700/50', dotColor: 'bg-zinc-500', isDefault: true },
    { id: 'inProgress', label: 'In Progress', color: 'border-blue-500/30', dotColor: 'bg-blue-500', isDefault: true, wipLimit: 3 },
    { id: 'review', label: 'Review', color: 'border-amber-500/30', dotColor: 'bg-amber-500', isDefault: true, wipLimit: 2 },
    { id: 'done', label: 'Done', color: 'border-emerald-500/30', dotColor: 'bg-emerald-500', isDefault: true },
];

export const DEFAULT_GDD_CATEGORIES: GDDCategory[] = [
    { id: 'introduction', label: 'Introduction',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',   emoji: '📖' },
    { id: 'mechanics',    label: 'Mechanics',     color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20', emoji: '⚙️' },
    { id: 'story',        label: 'Story & Lore',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',  emoji: '📜' },
    { id: 'art',          label: 'Art Direction', color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20',    emoji: '🎨' },
    { id: 'audio',        label: 'Audio Design',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', emoji: '🎵' },
    { id: 'technical',    label: 'Technical',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20',    emoji: '🔧' },
    { id: 'other',        label: 'Other',         color: 'text-zinc-400',    bg: 'bg-zinc-700/20 border-zinc-700/30',    emoji: '📌' },
];

export const SUPPORTED_LANGS = ['Turkish', 'Spanish', 'French', 'German', 'Japanese', 'Portuguese'];
export const SOURCE_LANG = 'English';

export const CATEGORY_EMOJI: Record<TaskCategory, string> = {
    code: '💻',
    art: '🎨',
    audio: '🎵',
    qa: '🧪',
    other: '📌',
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
    low: 'text-zinc-400 bg-zinc-800 border-zinc-700',
    medium: 'text-blue-400 bg-blue-600/10 border-blue-500/30',
    high: 'text-amber-400 bg-amber-600/10 border-amber-500/30',
    urgent: 'text-red-400 bg-red-600/10 border-red-500/30',
};
