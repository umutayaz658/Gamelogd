'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Mail, Search, UserPlus, X } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import type { Role } from '@/types';

interface MemberUser {
    id: number;
    username: string;
    real_name?: string;
    avatar?: string;
}

interface InviteModalProps {
    scope: 'org' | 'project';
    legacyRoleOptions: string[];
    /** Roles this scope's members can be assigned (org roles for org invites, project roles for project invites) — owner is excluded here. */
    roles: Role[];
    /** Only set for a project that belongs to an organisation — enables the "quick add from
     * organisation" section, letting an admin add an existing org member without a username search. */
    quickAddOrganisationId?: number;
    /** Current members (+ synthesized owner + viewer) to exclude from both panels. */
    excludeUserIds?: number[];
    onClose: () => void;
    onInvite: (targetUser: MemberUser, roleId: number, legacyRole: string) => void;
}

/** A picked custom Role only carries a legacy flat-role fallback for the small number of
 * places the backend still gates on the old flat role string (e.g. "is this project member
 * an admin") rather than granular permissions — anything else maps to the lowest tier. */
function legacyRoleForPick(scope: 'org' | 'project', pickedRole: Role, legacyRoleOptions: string[]) {
    if (pickedRole.is_default_for === 'admin') return 'admin';
    if (pickedRole.is_default_for === 'member') return scope === 'project' ? 'participant' : 'member';
    return legacyRoleOptions[0];
}

export default function InviteModal({ scope, legacyRoleOptions, roles, quickAddOrganisationId, excludeUserIds, onClose, onInvite }: InviteModalProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MemberUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [quickAddCandidates, setQuickAddCandidates] = useState<MemberUser[]>([]);
    const [orgSearchQuery, setOrgSearchQuery] = useState('');

    const [step, setStep] = useState<'browse' | 'role'>('browse');
    const [pendingUser, setPendingUser] = useState<MemberUser | null>(null);
    const [pickedRoleId, setPickedRoleId] = useState<number | null>(null);

    useEffect(() => {
        const delay = setTimeout(() => {
            if (!query.trim()) { setResults([]); return; }
            setSearching(true);
            api.get(`/users/?search=${encodeURIComponent(query.trim())}`)
                .then((res) => setResults(res.data.results ?? res.data))
                .catch(() => setResults([]))
                .finally(() => setSearching(false));
        }, 400);
        return () => clearTimeout(delay);
    }, [query]);

    useEffect(() => {
        if (!quickAddOrganisationId) { setQuickAddCandidates([]); return; }
        api.get(`/organisation-members/?organisation=${quickAddOrganisationId}`)
            .then((res) => {
                const members = res.data.results ?? res.data;
                const exclude = new Set(excludeUserIds ?? []);
                setQuickAddCandidates(
                    members
                        .filter((m: { user: MemberUser }) => !exclude.has(m.user.id))
                        .map((m: { user: MemberUser }) => m.user)
                );
            })
            .catch(() => setQuickAddCandidates([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quickAddOrganisationId]);

    // The free-text search intentionally does NOT hide users who are already reachable via the
    // "Add from organisation" panel — the same person can legitimately show up in both, since
    // they're two different ways of finding the same pool of users, not two different pools.
    const excludeIds = new Set(excludeUserIds ?? []);
    const filteredResults = results.filter((u) => !excludeIds.has(u.id));
    const filteredQuickAdd = quickAddCandidates.filter((u) =>
        !orgSearchQuery.trim() || (u.real_name || u.username).toLowerCase().includes(orgSearchQuery.trim().toLowerCase())
    );

    const openRoleStep = (u: MemberUser) => {
        setPendingUser(u);
        setPickedRoleId(null);
        setStep('role');
    };
    const backToBrowse = () => { setStep('browse'); setPendingUser(null); };
    const confirmInvite = () => {
        if (!pendingUser || pickedRoleId === null) return;
        const pickedRole = roles.find((r) => r.id === pickedRoleId);
        if (!pickedRole) return;
        onInvite(pendingUser, pickedRoleId, legacyRoleForPick(scope, pickedRole, legacyRoleOptions));
    };

    const assignableRoles = roles.filter((r) => r.is_default_for !== 'owner');

    const UserRow = ({ u, actionLabel, actionClassName }: { u: MemberUser; actionLabel: string; actionClassName: string }) => (
        <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-2.5">
            <div className="w-9 h-9 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                <img src={getImageUrl(u.avatar, u.username)} className="w-full h-full object-cover" alt="" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{u.real_name || u.username}</p>
                <p className="text-xs text-zinc-500 truncate">@{u.username}</p>
            </div>
            <button onClick={() => openRoleStep(u)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all flex-shrink-0 ${actionClassName}`}>
                <UserPlus className="w-3 h-3" /> {actionLabel}
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 h-[75vh] max-h-[680px] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {step === 'role' && (
                            <button onClick={backToBrowse} className="text-zinc-500 hover:text-white p-1 -ml-1 rounded-lg hover:bg-zinc-900 transition-all">
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <Mail className="w-5 h-5 text-blue-400" /> {step === 'role' ? `Role for @${pendingUser?.username}` : `Invite ${scope === 'project' ? 'to Project' : 'Member'}`}
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                    <motion.div
                        className="flex h-full w-[200%]"
                        animate={{ x: step === 'browse' ? '0%' : '-50%' }}
                        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                    >
                        <div className={`w-1/2 h-full grid ${quickAddOrganisationId ? 'md:grid-cols-2' : 'grid-cols-1'} divide-y md:divide-y-0 md:divide-x divide-zinc-800`}>
                            <div className="p-5 flex flex-col min-h-0">
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Search users</p>
                                <div className="relative mb-3">
                                    <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username..."
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all" />
                                </div>
                                <div className="space-y-1.5 overflow-y-auto scrollbar-thin-dark flex-1">
                                    {searching && <p className="text-xs text-zinc-600 text-center py-4">Searching...</p>}
                                    {!searching && query.trim() && filteredResults.length === 0 && (
                                        <p className="text-xs text-zinc-600 text-center py-4">No users found.</p>
                                    )}
                                    {!searching && filteredResults.map((u) => (
                                        <UserRow key={u.id} u={u} actionLabel="Invite" actionClassName="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400" />
                                    ))}
                                </div>
                            </div>

                            {quickAddOrganisationId && (
                                <div className="p-5 flex flex-col min-h-0">
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Add from organisation</p>
                                    <div className="relative mb-3">
                                        <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input value={orgSearchQuery} onChange={(e) => setOrgSearchQuery(e.target.value)} placeholder="Filter organisation members..."
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all" />
                                    </div>
                                    <div className="space-y-1.5 overflow-y-auto scrollbar-thin-dark flex-1">
                                        {filteredQuickAdd.length === 0 && (
                                            <p className="text-xs text-zinc-600 text-center py-4">No matching organisation members.</p>
                                        )}
                                        {filteredQuickAdd.map((u) => (
                                            <UserRow key={u.id} u={u} actionLabel="Add" actionClassName="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400" />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="w-1/2 h-full flex flex-col">
                            {pendingUser && (
                                <>
                                    <div className="p-5 flex items-center gap-3 border-b border-zinc-800 flex-shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                                            <img src={getImageUrl(pendingUser.avatar, pendingUser.username)} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{pendingUser.real_name || pendingUser.username}</p>
                                            <p className="text-xs text-zinc-500 truncate">@{pendingUser.username}</p>
                                        </div>
                                    </div>
                                    <div className="p-5 space-y-2 overflow-y-auto scrollbar-thin-dark flex-1">
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Pick a role to invite with</p>
                                        {assignableRoles.map((role) => (
                                            <button key={role.id} onClick={() => setPickedRoleId(role.id)}
                                                className={`w-full flex items-start gap-3 text-left p-3.5 rounded-xl border transition-all ${
                                                    pickedRoleId === role.id ? 'bg-blue-600/10 border-blue-500/40' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                                                }`}>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white">{role.name}</p>
                                                    <p className="text-xs text-zinc-400 mt-0.5">{role.description || `${role.permissions.length} permissions`}</p>
                                                </div>
                                                {pickedRoleId === role.id && <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-3 p-5 border-t border-zinc-800 flex-shrink-0">
                                        <button onClick={backToBrowse} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">Back</button>
                                        <button onClick={confirmInvite} disabled={pickedRoleId === null}
                                            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40">
                                            Send Invite
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
