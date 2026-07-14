'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Bug, Lightbulb, AlertTriangle, Palette, Gauge, HelpCircle,
    Plus, X, Send, Pin, Clock, CheckCircle2, ListChecks,
    Heart, Trash2, ChevronDown, Filter, Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn, getImageUrl, getRelativeTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import { PRIORITY_COLOR, type TaskPriority } from './WorkspaceTypes';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import type { PlaytestFeedback, FeedbackType, FeedbackStatus } from '@/types';

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Bug }> = {
    bug: { label: 'Bug', icon: Bug },
    suggestion: { label: 'Suggestion', icon: Lightbulb },
    crash: { label: 'Crash', icon: AlertTriangle },
    ui_ux: { label: 'UI/UX', icon: Palette },
    performance: { label: 'Performance', icon: Gauge },
    other: { label: 'Other', icon: HelpCircle },
};

// Deliberately reuses Kanban's own TaskPriority + PRIORITY_COLOR (WorkspaceTypes.ts) rather than
// a separate severity scale — when feedback is converted to a Kanban task its priority carries
// over 1:1, and the colors/labels stay identical between the two surfaces.
const PRIORITY_LABEL: Record<TaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const PRIORITY_DOT: Record<TaskPriority, string> = { low: 'bg-zinc-500', medium: 'bg-blue-500', high: 'bg-amber-500', urgent: 'bg-red-500' };
const PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

const STATUS_FILTER_OPTIONS: { key: 'all' | 'pinned' | 'in_progress' | 'resolved'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pinned', label: 'Pinned' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
];

const PRIORITY_FILTER_OPTIONS: { key: 'all' | TaskPriority; label: string }[] = [
    { key: 'all', label: 'All Priorities' },
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' },
    { key: 'urgent', label: 'Urgent' },
];

interface KanbanFirstColumnStatus {
    label: string;
    current: number;
    limit: number | undefined;
    full: boolean;
}

interface FeedbackPanelProps {
    projectId: number | null;
    organisationId: number | null;
    /** Devs-only board picker slot, e.g. <BoardSwitcher projectsOnly /> — omitted on the public project page. */
    headerExtra?: React.ReactNode;
    /** "Convert to Kanban Task" is only ever offered from the Devs workspace, never the public project page. */
    allowConvertToTask?: boolean;
    emptyProjectMessage?: string;
    /** Tailwind sticky offset — public page needs to clear the fixed navbar, Devs workspace doesn't. */
    stickyTopClassName?: string;
    /** Live WIP status of the Kanban board's first column (Devs-only) — lets "Convert to Task"
     * disable itself up front instead of only failing after a click. */
    kanbanFirstColumnStatus?: KanbanFirstColumnStatus | null;
    /** Called after a successful convert/revert so the Devs workspace's in-memory Kanban state
     * (which is otherwise unaware of this direct backend write) can refresh without a page reload. */
    onKanbanChanged?: () => void;
}

export default function FeedbackPanel({
    projectId, organisationId, headerExtra, allowConvertToTask = false,
    emptyProjectMessage = 'Select a project to view its feedback.',
    stickyTopClassName = 'top-0',
    kanbanFirstColumnStatus = null,
    onKanbanChanged,
}: FeedbackPanelProps) {
    const { user } = useAuth();
    const { language } = useTranslation();

    const [feedback, setFeedback] = useState<PlaytestFeedback[]>([]);
    const [loading, setLoading] = useState(false);
    const [permissions, setPermissions] = useState<string[]>([]);

    const [statusFilter, setStatusFilter] = useState<'all' | 'pinned' | 'in_progress' | 'resolved'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [showPriorityFilter, setShowPriorityFilter] = useState(false);

    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [fbTitle, setFbTitle] = useState('');
    const [fbType, setFbType] = useState<FeedbackType>('bug');
    const [fbPriority, setFbPriority] = useState<TaskPriority>('medium');
    const [fbBuild, setFbBuild] = useState('');
    const [fbDesc, setFbDesc] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<PlaytestFeedback | null>(null);
    const [confirmRevertTarget, setConfirmRevertTarget] = useState<PlaytestFeedback | null>(null);

    const canPin = permissions.includes('feedback.pin');
    const canMarkInProgress = permissions.includes('feedback.mark_in_progress');
    const canMarkResolved = permissions.includes('feedback.mark_resolved');
    const canConvert = allowConvertToTask && permissions.includes('feedback.convert_to_task');
    const canDeleteAny = permissions.includes('feedback.delete');
    const showModeratorRow = canPin || canMarkInProgress || canMarkResolved || canConvert;

    const fetchFeedback = () => {
        if (!projectId) { setFeedback([]); return; }
        setLoading(true);
        const params = new URLSearchParams({ project: String(projectId) });
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (priorityFilter !== 'all') params.append('priority', priorityFilter);
        api.get(`/playtest-feedback/?${params.toString()}`)
            .then((res) => setFeedback(res.data.results ?? res.data))
            .catch(() => setFeedback([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchFeedback();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, statusFilter, priorityFilter]);

    useEffect(() => {
        if (!user || !projectId) { setPermissions([]); return; }
        const params = new URLSearchParams({ project: String(projectId) });
        if (organisationId) params.append('organisation', String(organisationId));
        api.get(`/my-permissions/?${params.toString()}`)
            .then((res) => setPermissions(res.data?.permissions ?? []))
            .catch(() => setPermissions([]));
    }, [user, projectId, organisationId]);

    const resetForm = () => {
        setFbTitle('');
        setFbType('bug');
        setFbPriority('medium');
        setFbBuild('');
        setFbDesc('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fbDesc.trim() || !projectId || submitting) return;
        setSubmitting(true);
        api.post('/playtest-feedback/', {
            project: projectId, title: fbTitle.trim(), type: fbType, priority: fbPriority,
            description: fbDesc.trim(), build_version: fbBuild.trim(),
        })
            .then(() => { fetchFeedback(); resetForm(); setShowSubmitModal(false); })
            .catch((err) => alert(err.response?.data?.description?.[0] || err.response?.data?.detail || 'Failed to submit feedback.'))
            .finally(() => setSubmitting(false));
    };

    const handleLike = (fb: PlaytestFeedback) => {
        if (!user) return;
        const wasLiked = fb.is_liked;
        setFeedback((prev) => prev.map((f) => f.id === fb.id
            ? { ...f, is_liked: !wasLiked, likes_count: Math.max(0, f.likes_count + (wasLiked ? -1 : 1)) }
            : f));
        api.post('/likes/', { playtest_feedback: fb.id }).catch(() => {
            // Revert only the like fields (inverse of the optimistic delta) rather than
            // restoring a stale snapshot that would discard any concurrent update.
            setFeedback((prev) => prev.map((f) => f.id === fb.id
                ? { ...f, is_liked: wasLiked, likes_count: Math.max(0, f.likes_count + (wasLiked ? 1 : -1)) }
                : f));
        });
    };

    const togglePin = (fb: PlaytestFeedback) => {
        api.post(`/playtest-feedback/${fb.id}/toggle-pin/`)
            // Pinning changes list ordering (pinned first), so refetch to reflect the new order.
            .then(() => fetchFeedback())
            .catch((err) => alert(err.response?.data?.detail || 'Failed to update pin state.'));
    };

    const setStatus = (fb: PlaytestFeedback, newStatus: FeedbackStatus) => {
        const nextStatus = fb.status === newStatus ? 'open' : newStatus;
        api.post(`/playtest-feedback/${fb.id}/set-status/`, { status: nextStatus })
            .then((res) => {
                // If a status filter is active, the item may no longer belong in the current
                // list — refetch so it drops out instead of lingering in the wrong filter.
                if (statusFilter !== 'all') {
                    fetchFeedback();
                } else {
                    setFeedback((prev) => prev.map((f) => f.id === fb.id ? res.data : f));
                }
            })
            .catch((err) => alert(err.response?.data?.detail || 'Failed to update status.'));
    };

    const convertToTask = (fb: PlaytestFeedback) => {
        api.post(`/playtest-feedback/${fb.id}/convert-to-task/`)
            .then((res) => {
                setFeedback((prev) => prev.map((f) => f.id === fb.id ? res.data : f));
                onKanbanChanged?.();
            })
            .catch((err) => alert(err.response?.data?.error || err.response?.data?.detail || 'Failed to convert to task.'));
    };

    const performRevert = () => {
        if (!confirmRevertTarget) return;
        const fb = confirmRevertTarget;
        api.post(`/playtest-feedback/${fb.id}/revert-task/`)
            .then((res) => {
                setFeedback((prev) => prev.map((f) => f.id === fb.id ? res.data : f));
                onKanbanChanged?.();
            })
            .catch((err) => alert(err.response?.data?.error || err.response?.data?.detail || 'Failed to pull back from Kanban.'))
            .finally(() => setConfirmRevertTarget(null));
    };

    const performDelete = () => {
        if (!confirmDeleteTarget) return;
        const fb = confirmDeleteTarget;
        api.delete(`/playtest-feedback/${fb.id}/`)
            .then(() => setFeedback((prev) => prev.filter((f) => f.id !== fb.id)))
            .catch((err) => alert(err.response?.data?.detail || 'Failed to delete feedback.'))
            .finally(() => setConfirmDeleteTarget(null));
    };

    if (!projectId) {
        return (
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    {headerExtra}
                    {headerExtra && <span className="text-zinc-700 text-lg font-light">/</span>}
                    <h2 className="text-xl font-bold text-white">Feedback</h2>
                </div>
                <div className="text-center py-16 text-zinc-600">
                    <Bug className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{emptyProjectMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className={cn('sticky z-20 bg-zinc-950 -mx-1 px-1 pb-4 pt-1', stickyTopClassName)}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        {headerExtra}
                        {headerExtra && <span className="text-zinc-700 text-lg font-light">/</span>}
                        <div>
                            <h2 className="text-xl font-bold text-white">Feedback</h2>
                            <p className="text-xs text-zinc-500 mt-0.5">{feedback.length} item{feedback.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                onClick={() => { setShowStatusFilter(!showStatusFilter); setShowPriorityFilter(false); }}
                                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-300 transition-all"
                            >
                                <Filter className="w-3.5 h-3.5" />
                                {STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.label}
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                            </button>
                            {showStatusFilter && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowStatusFilter(false)} />
                                    <div className="absolute right-0 top-full mt-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-40 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                                        {STATUS_FILTER_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.key}
                                                onClick={() => { setStatusFilter(opt.key); setShowStatusFilter(false); }}
                                                className={cn('w-full text-left px-2.5 py-2 text-xs rounded-lg font-semibold transition-colors',
                                                    statusFilter === opt.key ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-900')}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => { setShowPriorityFilter(!showPriorityFilter); setShowStatusFilter(false); }}
                                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-300 transition-all"
                            >
                                <Filter className="w-3.5 h-3.5" />
                                {PRIORITY_FILTER_OPTIONS.find((o) => o.key === priorityFilter)?.label}
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                            </button>
                            {showPriorityFilter && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowPriorityFilter(false)} />
                                    <div className="absolute right-0 top-full mt-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-40 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                                        {PRIORITY_FILTER_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.key}
                                                onClick={() => { setPriorityFilter(opt.key); setShowPriorityFilter(false); }}
                                                className={cn('w-full text-left px-2.5 py-2 text-xs rounded-lg font-semibold transition-colors',
                                                    priorityFilter === opt.key ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-900')}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        {user && (
                            <button
                                onClick={() => setShowSubmitModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
                            >
                                <Plus className="w-4 h-4" /> Submit Feedback
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {!loading && feedback.length === 0 ? (
                    <div className="text-center py-16 text-zinc-600">
                        <Bug className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No feedback yet.</p>
                    </div>
                ) : (
                    feedback.map((fb) => {
                        const TypeIcon = TYPE_META[fb.type]?.icon ?? HelpCircle;
                        const author = fb.author;
                        const isAuthor = !!user && !!author && user.id === author.id;
                        const canDelete = isAuthor || canDeleteAny;
                        const profileHref = author ? `/${author.username}` : '#';
                        return (
                            <div
                                key={fb.id}
                                className={cn('bg-zinc-900 border rounded-2xl p-4 transition-colors',
                                    fb.is_pinned ? 'border-amber-500/30' : 'border-zinc-800')}
                            >
                                <div className="flex gap-4">
                                    <Link href={profileHref} className="flex-shrink-0">
                                        <img
                                            src={getImageUrl(author?.avatar, author?.username)}
                                            alt=""
                                            className="h-10 w-10 rounded-full bg-zinc-800 object-cover hover:opacity-80 transition-opacity"
                                        />
                                    </Link>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Link href={profileHref} className="font-bold text-white hover:underline text-sm">
                                                    {author?.real_name || author?.username || 'Unknown'}
                                                </Link>
                                                {author && (
                                                    <Link href={profileHref} className="text-zinc-500 text-sm hover:text-zinc-400">
                                                        @{author.username}
                                                    </Link>
                                                )}
                                                <span className="text-zinc-700 text-sm">•</span>
                                                <span className="text-zinc-500 text-sm" title={new Date(fb.submitted_at).toLocaleString()}>
                                                    {new Date(fb.submitted_at).toLocaleDateString('en-GB')} • {getRelativeTime(fb.submitted_at, language)}
                                                </span>
                                                {fb.is_pinned && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                                        <Pin className="w-2.5 h-2.5" /> PINNED
                                                    </span>
                                                )}
                                                {fb.status === 'in_progress' && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                                                        <Clock className="w-2.5 h-2.5" /> IN PROGRESS
                                                    </span>
                                                )}
                                                {fb.status === 'resolved' && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                                        <CheckCircle2 className="w-2.5 h-2.5" /> RESOLVED
                                                    </span>
                                                )}
                                            </div>
                                            {canDelete && (
                                                <button onClick={() => setConfirmDeleteTarget(fb)} title="Delete" className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border bg-zinc-800/60 border-zinc-700 text-zinc-300">
                                                <TypeIcon className="w-3 h-3" /> {TYPE_META[fb.type]?.label ?? fb.type}
                                            </span>
                                            <span className={cn('flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border', PRIORITY_COLOR[fb.priority])}>
                                                <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[fb.priority])} /> {PRIORITY_LABEL[fb.priority]}
                                            </span>
                                            {fb.build_version && <span className="text-xs text-zinc-600 font-mono">Build {fb.build_version}</span>}
                                        </div>

                                        {fb.title && <h3 className="font-bold text-white mt-3 leading-tight">{fb.title}</h3>}
                                        <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed mt-1.5 text-sm">{fb.description}</p>

                                        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                                            <button
                                                onClick={() => handleLike(fb)}
                                                className={cn('flex items-center gap-2 hover:text-pink-500 transition-colors', fb.is_liked ? 'text-pink-500' : 'text-zinc-500')}
                                            >
                                                <Heart className={cn('h-4 w-4', fb.is_liked && 'fill-pink-500')} />
                                                <span className="text-sm">{fb.likes_count}</span>
                                            </button>

                                            {showModeratorRow && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {canPin && (
                                                        <button
                                                            onClick={() => togglePin(fb)}
                                                            className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-all',
                                                                fb.is_pinned ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600')}
                                                        >
                                                            <Pin className="w-3 h-3" /> {fb.is_pinned ? 'Unpin' : 'Pin'}
                                                        </button>
                                                    )}
                                                    {canMarkInProgress && (
                                                        <button
                                                            onClick={() => setStatus(fb, 'in_progress')}
                                                            className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-all',
                                                                fb.status === 'in_progress' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600')}
                                                        >
                                                            <Clock className="w-3 h-3" /> In Progress
                                                        </button>
                                                    )}
                                                    {canMarkResolved && (
                                                        <button
                                                            onClick={() => setStatus(fb, 'resolved')}
                                                            className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-all',
                                                                fb.status === 'resolved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600')}
                                                        >
                                                            <CheckCircle2 className="w-3 h-3" /> Resolved
                                                        </button>
                                                    )}
                                                    {allowConvertToTask && (
                                                        fb.converted_task_id ? (
                                                            canConvert ? (
                                                                <button
                                                                    onClick={() => setConfirmRevertTarget(fb)}
                                                                    title="Pull back — removes it from the Kanban board"
                                                                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border bg-zinc-800/50 border-zinc-800 text-zinc-500 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                                >
                                                                    <ListChecks className="w-3 h-3" /> In Kanban
                                                                </button>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border bg-zinc-800/50 border-zinc-800 text-zinc-500">
                                                                    <ListChecks className="w-3 h-3" /> In Kanban
                                                                </span>
                                                            )
                                                        ) : canConvert && (
                                                            kanbanFirstColumnStatus?.full ? (
                                                                <button
                                                                    disabled
                                                                    title={`Cannot convert: the "${kanbanFirstColumnStatus.label}" column is full (${kanbanFirstColumnStatus.current}/${kanbanFirstColumnStatus.limit}). Raise its WIP limit or move a task out first.`}
                                                                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border bg-zinc-800/40 border-zinc-800 text-zinc-600 cursor-not-allowed"
                                                                >
                                                                    <ListChecks className="w-3 h-3" /> Convert to Task
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => convertToTask(fb)}
                                                                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 transition-all"
                                                                >
                                                                    <ListChecks className="w-3 h-3" /> Convert to Task
                                                                </button>
                                                            )
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {showSubmitModal && (
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowSubmitModal(false); }}
                >
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bug className="w-5 h-5 text-blue-400" /> Submit Feedback</h3>
                            <button onClick={() => setShowSubmitModal(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Title</label>
                                <input
                                    value={fbTitle}
                                    onChange={(e) => setFbTitle(e.target.value)}
                                    placeholder="Short summary..."
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Type</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(Object.keys(TYPE_META) as FeedbackType[]).map((tp) => {
                                        const { label, icon: Icon } = TYPE_META[tp];
                                        return (
                                            <button
                                                key={tp}
                                                type="button"
                                                onClick={() => setFbType(tp)}
                                                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                                    fbType === tp ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600')}
                                            >
                                                <Icon className="w-3.5 h-3.5" /> {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Priority</label>
                                <div className="flex gap-2">
                                    {PRIORITY_ORDER.map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setFbPriority(p)}
                                            className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                                                fbPriority === p ? PRIORITY_COLOR[p] : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600')}
                                        >
                                            {PRIORITY_LABEL[p]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input
                                value={fbBuild}
                                onChange={(e) => setFbBuild(e.target.value)}
                                placeholder="Build version e.g. v0.1.0 (optional)"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-mono"
                            />
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Description</label>
                                <textarea
                                    autoFocus
                                    value={fbDesc}
                                    onChange={(e) => setFbDesc(e.target.value)}
                                    placeholder="Describe the bug, crash, or suggestion in detail..."
                                    rows={10}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y transition-all min-h-[220px]"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowSubmitModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDeleteModal
                isOpen={!!confirmDeleteTarget}
                title="Delete this feedback?"
                description="This will permanently remove the feedback. This cannot be undone."
                onConfirm={performDelete}
                onCancel={() => setConfirmDeleteTarget(null)}
            />
            <ConfirmDeleteModal
                isOpen={!!confirmRevertTarget}
                title="Pull back from Kanban?"
                description="This removes the linked task from the Kanban board and lets this feedback be converted again later."
                confirmLabel="Pull back"
                variant="warning"
                onConfirm={performRevert}
                onCancel={() => setConfirmRevertTarget(null)}
            />
        </div>
    );
}
