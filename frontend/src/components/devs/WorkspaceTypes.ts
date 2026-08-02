// ─── Kanban Types ────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = string;

// Structured replacement for the old free-form `data.categories: string[]` (which encoded custom
// categories as fragile "emoji Label|colorName" strings) — same shape as AssetCategoryItem/
// GDDCategory below, so all three can share one CategoryManager UI. `Task.category` keeps storing
// this `id` as a plain string; only the list-of-categories representation changed.
export interface KanbanCategoryItem {
    id: string;
    label: string;
    color: string;
    bg: string;
    emoji: string;
}

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

// The key catalogue only (key/namespace/base text) — this is the taxonomy the Devs team manages
// (which strings exist, what they say in the source language). Suggestions, votes, and approval
// state live entirely in the backend CommunityTranslation model instead (see
// components/localisation/), shared as the single source of truth by both the Devs Localisation
// Manager and the public project page's Localisation tab. Previously each surface kept its own
// copy (this blob's per-key `suggestions` map vs. the community model) which meant a translation
// made on one surface never appeared on the other — that divergence is why suggestions were
// pulled out of this type entirely rather than kept as a second, easily-out-of-sync store.
// Matches Intl.PluralRules' category names, and backend/api/locale_registry.py's
// LocaleDef.cldr_categories.
export type CldrCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

// A project's configured target/source language — `name` is denormalised purely so the UI can
// render a label without a registry lookup; `code` is the only real identity, matching
// CommunityTranslation.language and backend/api/locale_registry.py's LocaleDef.code.
export interface ProjectLocale {
    code: string;
    name: string;
}

export interface TranslationEntry {
    id: string;
    key: string;
    namespace: string; // auto-derived from key prefix e.g. "mainMenu" from "mainMenu.play"
    baseText: string; // representative form — kept in sync with basePlural.other when isPlural
    isPlural?: boolean;
    basePlural?: Partial<Record<CldrCategory, string>>;
}

export interface GlossaryTerm {
    id: string;
    term: string;
    translations: Record<string, string>; // locale code -> locked translation
}

// Playtest feedback is now backed by a real backend model (core.models.PlaytestFeedback,
// see PlaytestFeedback.tsx) rather than client-only WorkspaceState data — same reasoning as
// Team & Roles below: it needs to be publicly readable and writable by non-members, which the
// member-scoped WorkspaceState blob can't support.

// ─── Activity Types ───────────────────────────────────────────────────────────

export type ActivityType =
    | 'task_created'
    | 'task_completed'
    | 'subtask_checked'
    | 'gdd_edited'
    | 'asset_added'
    | 'translation_approved'
    | 'member_joined'
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
    // Devs-managed, per-project. Absent/empty falls back to the backend's
    // DEFAULT_PROJECT_LOCALE_CODES (see api.locale_registry) — never a frontend-hardcoded list.
    translationLanguages?: ProjectLocale[];
    translationSourceLanguage?: ProjectLocale;
    activities: ActivityItem[];
    // Legacy free-form Kanban categories list (mix of the 5 hardcoded ids and "emoji Label|color"
    // encoded custom strings) — superseded by `kanbanCategories` below; kept only so
    // WorkspaceContext's one-time migration step can read old saved boards. New code should never
    // write to this field.
    categories?: string[];
    kanbanCategories?: KanbanCategoryItem[];
    gddCategories?: GDDCategory[];
    assetCategories?: AssetCategoryItem[];
}

export const DEFAULT_KANBAN_CATEGORIES: KanbanCategoryItem[] = [
    { id: 'code', label: 'Code', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', emoji: '💻' },
    { id: 'art', label: 'Art', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', emoji: '🎨' },
    { id: 'audio', label: 'Audio', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', emoji: '🎵' },
    { id: 'qa', label: 'QA', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', emoji: '🧪' },
    { id: 'other', label: 'Other', color: 'text-zinc-400', bg: 'bg-zinc-700/20 border-zinc-700/30', emoji: '📌' },
];

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
