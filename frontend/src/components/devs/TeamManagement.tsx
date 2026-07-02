'use client';

import { useState } from 'react';
import {
    Users, Crown, Shield, User, Beaker, Plus, X, Mail,
    CheckSquare, FileText, Globe, Trophy, Send, Bug, Lightbulb,
    AlertTriangle, Zap, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { TeamMember, TeamMemberRole, PlaytestFeedback } from './WorkspaceTypes';
import { cn } from '@/lib/utils';

const ROLE_META: Record<TeamMemberRole, { label: string; icon: React.ElementType; color: string }> = {
    owner: { label: 'Owner', icon: Crown, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    admin: { label: 'Admin', icon: Shield, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    member: { label: 'Member', icon: User, color: 'text-zinc-300 bg-zinc-800 border-zinc-700' },
    playtester: { label: 'Playtester', icon: Beaker, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
};

const FEEDBACK_TYPE_META = {
    bug: { label: 'Bug', icon: Bug, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    suggestion: { label: 'Suggestion', icon: Lightbulb, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    crash: { label: 'Crash', icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    ui: { label: 'UI', icon: Zap, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
};

const SEVERITY_COLOR = {
    low: 'text-zinc-400', medium: 'text-blue-400', high: 'text-amber-400', critical: 'text-red-500 font-bold',
};

type Tab = 'team' | 'playtest';

export default function TeamManagement() {
    const { data, setTeamMembers, setPlaytestFeedback, setTasks, logActivity } = useWorkspace();
    const { teamMembers, playtestFeedback, columns, tasks } = data;

    const [tab, setTab] = useState<Tab>('team');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [inviteUsername, setInviteUsername] = useState('');
    const [inviteRole, setInviteRole] = useState<TeamMemberRole>('member');
    const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

    // Playtest feedback form
    const [fbType, setFbType] = useState<PlaytestFeedback['type']>('bug');
    const [fbSeverity, setFbSeverity] = useState<PlaytestFeedback['severity']>('medium');
    const [fbDesc, setFbDesc] = useState('');
    const [fbBuild, setFbBuild] = useState('');

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteUsername.trim()) return;
        const member: TeamMember = {
            id: `tm-${Date.now()}`,
            username: inviteUsername.trim(),
            role: inviteRole,
            joinedAt: 'just now',
            stats: { tasksCompleted: 0, gddPagesEdited: 0, localisationsApproved: 0 },
        };
        setTeamMembers((prev) => [...prev, member]);
        logActivity('member_joined', `${inviteUsername} joined as ${inviteRole}.`, '👋', inviteUsername);
        setInviteUsername('');
        setShowInviteModal(false);
    };

    const handleRemoveMember = (id: string) => {
        const m = teamMembers.find((m) => m.id === id);
        if (m?.role === 'owner') return;
        setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    };

    const handleChangeRole = (id: string, newRole: TeamMemberRole) => {
        setTeamMembers((prev) => prev.map((m) => m.id === id ? { ...m, role: newRole } : m));
    };

    const handleSubmitFeedback = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fbDesc.trim()) return;
        const fb: PlaytestFeedback = {
            id: `fb-${Date.now()}`,
            author: 'You',
            type: fbType,
            severity: fbSeverity,
            description: fbDesc.trim(),
            buildVersion: fbBuild || 'v0.1.0',
            submittedAt: new Date().toISOString(),
        };
        setPlaytestFeedback((prev) => [fb, ...prev]);
        // Also auto-create a Kanban task in review column if there's a QA column
        const qaColId = columns.find((c) => c.id === 'review')?.id ?? columns[0]?.id;
        const newTask = {
            id: `task-${Date.now()}`,
            title: `[Playtest ${fb.type.toUpperCase()}] ${fb.description.slice(0, 60)}`,
            description: `Submitted by: ${fb.author}\nBuild: ${fb.buildVersion}\n\n${fb.description}`,
            priority: fb.severity === 'critical' ? 'urgent' as const : fb.severity === 'high' ? 'high' as const : 'medium' as const,
            category: 'qa' as const,
            columnId: qaColId,
            subtasks: [],
            comments: [],
            createdAt: new Date().toISOString(),
        };
        setTasks((prev) => [...prev, newTask]);
        logActivity('playtest_submitted', `Playtest feedback submitted: "${fb.description.slice(0, 40)}..."`, '🧪');
        setFbDesc('');
        setFbBuild('');
        setShowFeedbackModal(false);
    };

    const convertToTask = (fb: PlaytestFeedback) => {
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Team & Roles</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} · Playtest portal</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFeedbackModal(true)}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all"
                    >
                        <Bug className="w-4 h-4" />
                        Submit Feedback
                    </button>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="w-4 h-4" />
                        Invite Member
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
                {(['team', 'playtest'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                            tab === t ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                        )}
                    >
                        {t === 'team' ? 'Team Members' : `Playtest Feedback ${playtestFeedback.length > 0 ? `(${playtestFeedback.length})` : ''}`}
                    </button>
                ))}
            </div>

            {/* Team Members tab */}
            {tab === 'team' && (
                <div className="space-y-3">
                    {teamMembers.map((member) => {
                        const { icon: RoleIcon, color: roleColor, label: roleLabel } = ROLE_META[member.role];
                        return (
                            <div key={member.id} className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300 text-sm flex-shrink-0">
                                    {member.avatar
                                        ? <img src={member.avatar} className="w-full h-full rounded-xl object-cover" alt="" />
                                        : member.username[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white">@{member.username}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">Joined {member.joinedAt}</p>
                                </div>

                                {/* Contribution stats */}
                                <div className="hidden md:flex items-center gap-4 text-center">
                                    <div>
                                        <p className="text-base font-bold text-white">{member.stats.tasksCompleted}</p>
                                        <p className="text-[10px] text-zinc-600">Tasks</p>
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-white">{member.stats.gddPagesEdited}</p>
                                        <p className="text-[10px] text-zinc-600">GDD Edits</p>
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-white">{member.stats.localisationsApproved}</p>
                                        <p className="text-[10px] text-zinc-600">Translations</p>
                                    </div>
                                </div>

                                {/* Role selector */}
                                {member.role !== 'owner' ? (
                                    <select
                                        value={member.role}
                                        onChange={(e) => handleChangeRole(member.id, e.target.value as TeamMemberRole)}
                                        className={cn('text-xs font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-none', roleColor)}
                                        style={{ colorScheme: 'dark' }}
                                    >
                                        {(['admin', 'member', 'playtester'] as TeamMemberRole[]).map((r) => (
                                            <option key={r} value={r} className="bg-zinc-950 text-white">{ROLE_META[r].label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className={cn('flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border', roleColor)}>
                                        <RoleIcon className="w-3 h-3" /> {roleLabel}
                                    </span>
                                )}

                                {member.role !== 'owner' && (
                                    <button
                                        onClick={() => handleRemoveMember(member.id)}
                                        className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all flex-shrink-0"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Playtest Feedback tab */}
            {tab === 'playtest' && (
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
                                            ) : (
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
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowInviteModal(false); }}>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Mail className="w-5 h-5 text-blue-400" /> Invite Member</h3>
                            <button onClick={() => setShowInviteModal(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleInvite} className="p-5 space-y-4">
                            <input
                                autoFocus
                                value={inviteUsername}
                                onChange={(e) => setInviteUsername(e.target.value)}
                                placeholder="Gamelogd @username"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                                required
                            />
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Role</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(['member', 'admin', 'playtester'] as TeamMemberRole[]).map((r) => {
                                        const { label, color } = ROLE_META[r];
                                        return (
                                            <button key={r} type="button" onClick={() => setInviteRole(r)}
                                                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                                    inviteRole === r ? color : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600')}>
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowInviteModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
                                    <Send className="w-4 h-4" /> Send Invite
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Submit Feedback Modal */}
            {showFeedbackModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowFeedbackModal(false); }}>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bug className="w-5 h-5 text-emerald-400" /> Submit Playtest Feedback</h3>
                            <button onClick={() => setShowFeedbackModal(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleSubmitFeedback} className="p-5 space-y-4">
                            {/* Type */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Type</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(Object.keys(FEEDBACK_TYPE_META) as PlaytestFeedback['type'][]).map((tp) => {
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
                            {/* Severity */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Severity</label>
                                <div className="flex gap-2">
                                    {(['low', 'medium', 'high', 'critical'] as PlaytestFeedback['severity'][]).map((sev) => (
                                        <button key={sev} type="button" onClick={() => setFbSeverity(sev)}
                                            className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize',
                                                fbSeverity === sev ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600')}>
                                            {sev}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Build */}
                            <input value={fbBuild} onChange={(e) => setFbBuild(e.target.value)} placeholder="Build version e.g. v0.1.0"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all font-mono" />
                            {/* Description */}
                            <textarea autoFocus value={fbDesc} onChange={(e) => setFbDesc(e.target.value)}
                                placeholder="Describe the bug, crash, or suggestion in detail..."
                                rows={4}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none transition-all"
                                required />
                            <p className="text-[11px] text-zinc-600">Feedback is automatically converted to a QA task in the Kanban board.</p>
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
