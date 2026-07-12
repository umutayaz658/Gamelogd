'use client';

import { useState } from 'react';
import {
    Plus, X, Bug, Send, CheckSquare, ChevronDown, ChevronRight,
    Lightbulb, AlertTriangle, Zap,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { PlaytestFeedback as PlaytestFeedbackItem } from './WorkspaceTypes';
import { cn } from '@/lib/utils';

const FEEDBACK_TYPE_META = {
    bug: { label: 'Bug', icon: Bug, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    suggestion: { label: 'Suggestion', icon: Lightbulb, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    crash: { label: 'Crash', icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    ui: { label: 'UI', icon: Zap, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
};

const SEVERITY_COLOR = {
    low: 'text-zinc-400', medium: 'text-blue-400', high: 'text-amber-400', critical: 'text-red-500 font-bold',
};

export default function PlaytestFeedback() {
    const { data, setPlaytestFeedback, setTasks, logActivity, hasPermission } = useWorkspace();
    const { playtestFeedback, columns } = data;

    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

    const [fbType, setFbType] = useState<PlaytestFeedbackItem['type']>('bug');
    const [fbSeverity, setFbSeverity] = useState<PlaytestFeedbackItem['severity']>('medium');
    const [fbDesc, setFbDesc] = useState('');
    const [fbBuild, setFbBuild] = useState('');

    const canSubmit = hasPermission('playtest.submit');
    const canConvert = hasPermission('playtest.convert_to_task');

    const handleSubmitFeedback = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fbDesc.trim()) return;
        const fb: PlaytestFeedbackItem = {
            id: `fb-${Date.now()}`,
            author: 'You',
            type: fbType,
            severity: fbSeverity,
            description: fbDesc.trim(),
            buildVersion: fbBuild || 'v0.1.0',
            submittedAt: new Date().toISOString(),
        };
        setPlaytestFeedback((prev) => [fb, ...prev]);
        logActivity('playtest_submitted', `Playtest feedback submitted: "${fb.description.slice(0, 40)}..."`, '🧪');
        setFbDesc('');
        setFbBuild('');
        setShowFeedbackModal(false);
    };

    const convertToTask = (fb: PlaytestFeedbackItem) => {
        const qaColId = columns.find((c) => c.id === 'review')?.id ?? columns[0]?.id;
        const newTask = {
            id: `task-${Date.now()}`,
            title: `[Playtest] ${fb.description.slice(0, 60)}`,
            description: fb.description,
            priority: 'medium' as const,
            category: 'qa' as const,
            columnId: qaColId,
            subtasks: [],
            comments: [],
            createdAt: new Date().toISOString(),
        };
        setTasks((prev) => [...prev, newTask]);
        setPlaytestFeedback((prev) => prev.map((f) => f.id === fb.id ? { ...f, convertedToTaskId: newTask.id } : f));
        logActivity('task_created', `Playtest feedback converted to QA task.`, '📋');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Playtest Feedback</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{playtestFeedback.length} feedback item{playtestFeedback.length !== 1 ? 's' : ''}</p>
                </div>
                {canSubmit && (
                    <button
                        onClick={() => setShowFeedbackModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
                    >
                        <Bug className="w-4 h-4" />
                        Submit Feedback
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {playtestFeedback.length === 0 ? (
                    <div className="text-center py-16 text-zinc-600">
                        <Bug className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No playtest feedback yet. Invite playtesters and share your build!</p>
                    </div>
                ) : (
                    playtestFeedback.map((fb) => {
                        const { icon: TypeIcon, color: typeColor, label: typeLabel } = FEEDBACK_TYPE_META[fb.type];
                        const isExpanded = expandedFeedbackId === fb.id;
                        return (
                            <div key={fb.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setExpandedFeedbackId(isExpanded ? null : fb.id)}
                                    className="w-full flex items-center gap-3 p-4 text-left"
                                >
                                    <span className={cn('flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border flex-shrink-0', typeColor)}>
                                        <TypeIcon className="w-3 h-3" /> {typeLabel}
                                    </span>
                                    <p className="text-sm font-semibold text-zinc-300 flex-1 truncate">{fb.description}</p>
                                    <span className={cn('text-xs font-bold flex-shrink-0', SEVERITY_COLOR[fb.severity])}>{fb.severity}</span>
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />}
                                </button>
                                {isExpanded && (
                                    <div className="border-t border-zinc-800 px-4 pb-4 space-y-3 animate-in fade-in duration-150">
                                        <p className="text-sm text-zinc-400 mt-3">{fb.description}</p>
                                        <div className="flex items-center gap-4 text-xs text-zinc-600">
                                            <span>Build: <span className="text-zinc-400 font-mono">{fb.buildVersion}</span></span>
                                            <span>By: <span className="text-zinc-400">@{fb.author}</span></span>
                                            <span>{new Date(fb.submittedAt).toLocaleDateString()}</span>
                                        </div>
                                        {fb.convertedToTaskId ? (
                                            <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                                                <CheckSquare className="w-3.5 h-3.5" /> Converted to Kanban task
                                            </p>
                                        ) : canConvert && (
                                            <button
                                                onClick={() => convertToTask(fb)}
                                                className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5"
                                            >
                                                <Plus className="w-3 h-3" /> Convert to QA Task
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {showFeedbackModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowFeedbackModal(false); }}>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bug className="w-5 h-5 text-emerald-400" /> Submit Playtest Feedback</h3>
                            <button onClick={() => setShowFeedbackModal(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleSubmitFeedback} className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Type</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(Object.keys(FEEDBACK_TYPE_META) as PlaytestFeedbackItem['type'][]).map((tp) => {
                                        const { label, color } = FEEDBACK_TYPE_META[tp];
                                        return (
                                            <button key={tp} type="button" onClick={() => setFbType(tp)}
                                                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                                    fbType === tp ? color : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600')}>
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Severity</label>
                                <div className="flex gap-2">
                                    {(['low', 'medium', 'high', 'critical'] as PlaytestFeedbackItem['severity'][]).map((sev) => (
                                        <button key={sev} type="button" onClick={() => setFbSeverity(sev)}
                                            className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize',
                                                fbSeverity === sev ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600')}>
                                            {sev}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input value={fbBuild} onChange={(e) => setFbBuild(e.target.value)} placeholder="Build version e.g. v0.1.0"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-mono" />
                            <textarea autoFocus value={fbDesc} onChange={(e) => setFbDesc(e.target.value)}
                                placeholder="Describe the bug, crash, or suggestion in detail..."
                                rows={4}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none transition-all"
                                required />
                            <p className="text-[11px] text-zinc-600">A team member can convert this feedback into a QA task from the list once submitted.</p>
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowFeedbackModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
                                    <Send className="w-4 h-4" /> Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
