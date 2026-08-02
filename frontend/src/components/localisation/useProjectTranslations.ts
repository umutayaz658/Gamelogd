'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { CldrCategory, CommunityTranslation } from '@/types';

type SuggestionPayload = { text?: string; plural_forms?: Partial<Record<CldrCategory, string>> };

/**
 * Fetches and mutates every CommunityTranslation row for a project (all languages, non-rejected
 * by default) — the single shared data source behind both the Devs Localisation Manager and the
 * public project page's Localisation tab. A suggestion made or approved on either surface is
 * immediately visible on the other because both read and write through these same backend rows;
 * there is no separate per-surface copy to keep in sync.
 */
export function useProjectTranslations(projectId: number | null) {
    const { user } = useAuth();
    const [contributions, setContributions] = useState<CommunityTranslation[]>([]);
    const [loading, setLoading] = useState(false);

    // Monotonic fetch id: rapid successive mutations each trigger a refetch, and without this
    // the slower (older) response could land last and re-render stale data.
    const refetchSeqRef = useRef(0);

    const refetch = useCallback(() => {
        if (!projectId) { setContributions([]); return; }
        const seq = ++refetchSeqRef.current;
        setLoading(true);
        const fetchAllPages = async () => {
            // The backend paginates (200/page); both surfaces filter by key/language
            // client-side, so follow the pages — with a hard cap as a safety valve.
            const all: CommunityTranslation[] = [];
            let page = 1;
            for (;;) {
                const res = await api.get(`/community-translations/?project=${projectId}&page=${page}`);
                const results: CommunityTranslation[] = res.data.results ?? res.data;
                all.push(...results);
                if (!res.data.next || page >= 25) break;
                page += 1;
            }
            return all;
        };
        fetchAllPages()
            .then((all) => { if (seq === refetchSeqRef.current) setContributions(all); })
            .catch(() => { if (seq === refetchSeqRef.current) setContributions([]); })
            .finally(() => { if (seq === refetchSeqRef.current) setLoading(false); });
    }, [projectId]);

    useEffect(() => { refetch(); }, [refetch]);

    const forKeyLang = useCallback(
        (key: string, language: string) => contributions.filter((c) => c.key === key && c.language === language),
        [contributions],
    );

    const submit = useCallback((key: string, language: string, payload: SuggestionPayload) => (
        api.post('/community-translations/', { project: projectId, key, language, ...payload }).then(() => { refetch(); })
    ), [projectId, refetch]);

    const update = useCallback((contribution: CommunityTranslation, payload: SuggestionPayload) => (
        api.patch(`/community-translations/${contribution.id}/`, payload).then(() => { refetch(); })
    ), [refetch]);

    const vote = useCallback((c: CommunityTranslation) => {
        if (!user) return;
        const wasVoted = c.is_voted;
        setContributions((prev) => prev.map((item) => item.id === c.id
            ? { ...item, is_voted: !wasVoted, votes_count: Math.max(0, item.votes_count + (wasVoted ? -1 : 1)) }
            : item));
        api.post('/likes/', { community_translation: c.id }).catch(() => {
            // Revert only the like fields (inverse of the optimistic delta), matching
            // FeedbackPanel.handleLike's precedent.
            setContributions((prev) => prev.map((item) => item.id === c.id
                ? { ...item, is_voted: wasVoted, votes_count: Math.max(0, item.votes_count + (wasVoted ? 1 : -1)) }
                : item));
        });
    }, [user]);

    const approve = useCallback((c: CommunityTranslation) => (
        api.post(`/community-translations/${c.id}/approve/`).then(() => { refetch(); })
    ), [refetch]);

    const reject = useCallback((c: CommunityTranslation) => (
        api.post(`/community-translations/${c.id}/reject/`).then(() => { refetch(); })
    ), [refetch]);

    const unapprove = useCallback((c: CommunityTranslation) => (
        api.post(`/community-translations/${c.id}/unapprove/`).then(() => { refetch(); })
    ), [refetch]);

    const remove = useCallback((c: CommunityTranslation) => (
        api.delete(`/community-translations/${c.id}/`).then(() => {
            setContributions((prev) => prev.filter((item) => item.id !== c.id));
        })
    ), []);

    return { contributions, loading, refetch, forKeyLang, submit, update, vote, approve, reject, unapprove, remove };
}
