'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X, Users, Shield, Building2, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import api from '@/lib/api';
import { cn, getImageUrl, formatHandle } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';
import FilterDropdown from './FilterDropdown';
import { useCatalog } from './useCatalog';
import type { ContributorSummary, ContributorListResponse } from '@/types';

const PAGE_SIZE = 50;

// Dark-mode categorical palette (this app is dark-mode-only), fixed hue order per the dataviz
// skill's validated default — slot assignment is by rank within a single contributor's own
// language breakdown, not a globally-shared language->color mapping.
const CHART_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const OTHER_COLOR = '#898781';

function badgeFor(role: ContributorSummary['role_badge']) {
    if (role === 'team') return { label: 'Team', icon: Shield, className: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    if (role === 'org') return { label: 'Org', icon: Building2, className: 'text-violet-400 bg-violet-500/10 border-violet-500/20' };
    return null;
}

function ContributorDetailModal({ contributor, localeName, onClose }: {
    contributor: ContributorSummary;
    localeName: (code: string) => string;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const entries = useMemo(
        () => Object.entries(contributor.by_language).sort((a, b) => b[1] - a[1]),
        [contributor],
    );
    const total = contributor.total_characters || 1;

    const R = 40;
    const C = 2 * Math.PI * R;
    const segments = entries.reduce<{ cumulative: number; list: Array<{ code: string; chars: number; pct: number; dasharray: string; dashoffset: number; color: string }> }>(
        (state, [code, chars], i) => {
            const pct = chars / total;
            const dasharray = `${pct * C} ${C - pct * C}`;
            const dashoffset = -state.cumulative * C;
            const color = i < CHART_COLORS.length ? CHART_COLORS[i] : OTHER_COLOR;
            return {
                cumulative: state.cumulative + pct,
                list: [...state.list, { code, chars, pct, dasharray, dashoffset, color }],
            };
        },
        { cumulative: 0, list: [] },
    ).list;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={getImageUrl(contributor.user.avatar, contributor.user.username)} alt="" className="h-10 w-10 rounded-full bg-zinc-800 object-cover" />
                        <div>
                            <p className="text-sm font-bold text-white">{contributor.user.real_name || contributor.user.username}</p>
                            <p className="text-xs text-zinc-500">{formatHandle(contributor.user.username)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative w-32 h-32 flex-shrink-0">
                        <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
                            {segments.length === 0 ? (
                                <circle cx="50" cy="50" r={R} fill="none" stroke="#2c2c2a" strokeWidth="16" />
                            ) : segments.map((s) => (
                                <circle key={s.code} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="16"
                                    strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset} strokeLinecap="butt">
                                    <title>{[`${localeName(s.code)}:`, s.chars, t('charsUnit'), `(${Math.round(s.pct * 100)}%)`].join(' ')}</title>
                                </circle>
                            ))}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg font-bold text-white">{contributor.total_characters}</span>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('charsUnit')}</span>
                        </div>
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                        {segments.map((s) => (
                            <div key={s.code} className="flex items-center gap-2 text-xs">
                                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                                <span className="text-zinc-300 truncate flex-1">{localeName(s.code)}</span>
                                <span className="text-zinc-500 font-mono flex-shrink-0">{s.chars}</span>
                            </div>
                        ))}
                        {segments.length === 0 && <p className="text-xs text-zinc-600">{t('noApprovedContributionsYet')}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Shared Contributors leaderboard — mounted identically by the Devs Localisation Manager (as a
 * tab) and the public project page's Localisation panel (as a view), both backed by the same
 * `/projects/:id/localisation/contributors/` endpoint, so the two surfaces can never disagree on
 * who contributed what. */
export default function ContributorsPanel({ projectId }: { projectId: number | null }) {
    const { t } = useTranslation();
    const { catalog } = useCatalog(projectId);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [language, setLanguage] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<ContributorListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<ContributorSummary | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset to page 1 whenever the filters change, and flip "loading" on right before a fetch
    // starts (or clear stale data when there's no project) — pure state updates, done
    // synchronously during render rather than as the effects' first statements, which only
    // perform the actual request and its async callbacks.
    // See https://react.dev/learn/you-might-not-need-an-effect
    const filterKey = `${language}:${debouncedSearch}:${projectId}`;
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (filterKey !== prevFilterKey) {
        setPrevFilterKey(filterKey);
        setPage(1);
    }

    const fetchKey = `${projectId}:${page}:${language}:${debouncedSearch}`;
    const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);
    if (fetchKey !== prevFetchKey) {
        setPrevFetchKey(fetchKey);
        if (projectId) setLoading(true);
        else setData(null);
    }

    useEffect(() => {
        if (!projectId) return;
        api.get(`/projects/${projectId}/localisation/contributors/`, {
            params: { page, page_size: PAGE_SIZE, language: language || undefined, q: debouncedSearch || undefined },
        })
            .then((res) => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [projectId, page, language, debouncedSearch]);

    const localeName = (code: string) => catalog?.languages.find((l) => l.code === code)?.name ?? code;

    const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search contributors..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                    />
                </div>
                <FilterDropdown
                    label="All languages"
                    value={language}
                    options={[{ key: '', label: 'All languages' }, ...(catalog?.languages ?? []).map((l) => ({ key: l.code, label: l.name }))]}
                    onChange={setLanguage}
                />
            </div>

            <div className="space-y-2">
                {!loading && data?.results.length === 0 && (
                    <div className="text-center py-16 text-zinc-600">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{t('noContributorsMatchFilter')}</p>
                    </div>
                )}
                {data?.results.map((c) => {
                    const badge = badgeFor(c.role_badge);
                    const displayValue = language ? (c.by_language[language] ?? 0) : c.total_characters;
                    const goToProfile = (e: React.MouseEvent) => e.stopPropagation();
                    return (
                        <div
                            key={c.user.id}
                            onClick={() => setDetail(c)}
                            title="View contribution breakdown"
                            className="w-full flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 transition-all cursor-pointer"
                        >
                            <Link href={`/${c.user.username}`} onClick={goToProfile} className="flex-shrink-0">
                                <img src={getImageUrl(c.user.avatar, c.user.username)} alt="" className="h-9 w-9 rounded-full bg-zinc-800 object-cover" />
                            </Link>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Link href={`/${c.user.username}`} onClick={goToProfile} className="text-sm font-bold text-white truncate hover:underline">
                                        {c.user.real_name || c.user.username}
                                    </Link>
                                    {badge && (
                                        <span className={cn('flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-0.5 flex-shrink-0', badge.className)}>
                                            <badge.icon className="w-2.5 h-2.5" /> {badge.label}
                                        </span>
                                    )}
                                </div>
                                <Link href={`/${c.user.username}`} onClick={goToProfile} className="text-xs text-zinc-500 truncate hover:underline block w-fit">
                                    {formatHandle(c.user.username)}
                                </Link>
                            </div>
                            <span className="flex items-center gap-1.5 flex-shrink-0 text-zinc-300">
                                <span className="text-sm font-mono font-bold">{displayValue}</span>
                                <Info className="w-3.5 h-3.5 text-zinc-600" />
                            </span>
                        </div>
                    );
                })}
            </div>

            {data && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                        className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 disabled:opacity-30 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-zinc-500 px-2">{[t('page'), page, '/', totalPages].join(' ')}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                        className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 disabled:opacity-30 transition-all">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Keeps extra scrollable room below the list even when there are very few (or zero)
                results, so an open FilterDropdown always has space to render fully instead of
                getting clipped by the viewport edge or the fixed-position MessagesDrawer. */}
            <div className="h-40" aria-hidden="true" />

            {detail && <ContributorDetailModal contributor={detail} localeName={localeName} onClose={() => setDetail(null)} />}
        </div>
    );
}
