'use client';

import { useEffect, useMemo, useState } from 'react';
import { Languages, Search, ArrowRight, ArrowLeft, Users } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import ConfirmDeleteModal from '@/components/devs/ConfirmDeleteModal';
import TranslationKeyCard from './TranslationKeyCard';
import FilterDropdown from './FilterDropdown';
import ContributorsPanel from './ContributorsPanel';
import { useProjectTranslations } from './useProjectTranslations';
import { useCatalog } from './useCatalog';
import { matchGlossaryLocks } from './glossaryMatch';
import type { CldrCategory, CommunityTranslation, TranslationKeyCatalogEntry } from '@/types';

type SuggestionPayload = { text?: string; plural_forms?: Partial<Record<CldrCategory, string>> };

const SLASH_SEPARATOR = '/';

interface CommunityLocalisationPanelProps {
    projectId: number | null;
    organisationId: number | null;
    /** Devs-only slot (e.g. a board switcher) — omitted on the public project page. Kept for
     * parity with FeedbackPanel's headerExtra in case this is ever mounted inside Devs too. */
    headerExtra?: React.ReactNode;
    stickyTopClassName?: string;
    emptyProjectMessage?: string;
}

type StatusFilter = 'all' | 'needs_translation' | 'has_official';
type PanelView = 'strings' | 'contributors';

export default function CommunityLocalisationPanel({
    projectId, organisationId, headerExtra,
    stickyTopClassName = 'top-0',
    emptyProjectMessage = 'Select a project to view its translations.',
}: CommunityLocalisationPanelProps) {
    const { user } = useAuth();
    const toast = useToast();
    const { t } = useTranslation();

    const { catalog, loading: catalogLoading } = useCatalog(projectId);
    const { contributions, forKeyLang, submit, update, vote, approve, reject, remove } = useProjectTranslations(projectId);

    const [language, setLanguage] = useState('');
    const activeLanguage = language || catalog?.languages[0]?.code || '';
    const activeLocale = catalog?.languages.find((l) => l.code === activeLanguage);
    const pluralCategories = activeLocale?.plural_categories ?? [];

    const [namespaceFilter, setNamespaceFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [search, setSearch] = useState('');
    const [view, setView] = useState<PanelView>('strings');
    const [permissions, setPermissions] = useState<string[]>([]);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CommunityTranslation | null>(null);

    const canApprove = permissions.includes('community_translation.approve');
    const canReject = permissions.includes('community_translation.reject');
    const canDeleteAny = permissions.includes('community_translation.delete');

    // Clearing permissions when there's no user/project is a pure state update, done
    // synchronously during render rather than as the effect's first branch below.
    // See https://react.dev/learn/you-might-not-need-an-effect
    const permsFetchKey = `${!!user}:${projectId}`;
    const [prevPermsFetchKey, setPrevPermsFetchKey] = useState(permsFetchKey);
    if (permsFetchKey !== prevPermsFetchKey) {
        setPrevPermsFetchKey(permsFetchKey);
        if (!user || !projectId) setPermissions([]);
    }

    useEffect(() => {
        if (!user || !projectId) return;
        const params = new URLSearchParams({ project: String(projectId) });
        if (organisationId) params.append('organisation', String(organisationId));
        api.get(`/my-permissions/?${params.toString()}`)
            .then((res) => setPermissions(res.data?.permissions ?? []))
            .catch(() => setPermissions([]));
    }, [user, projectId, organisationId]);

    const namespaces = useMemo(() => {
        if (!catalog) return ['all'];
        return ['all', ...Array.from(new Set(catalog.keys.map((k) => k.namespace).filter(Boolean)))];
    }, [catalog]);

    const approvedKeySet = useMemo(
        () => new Set(contributions.filter((c) => c.language === activeLanguage && c.status === 'approved').map((c) => c.key)),
        [contributions, activeLanguage],
    );

    const filteredKeys = useMemo(() => {
        if (!catalog) return [];
        return catalog.keys.filter((k) => {
            if (namespaceFilter !== 'all' && k.namespace !== namespaceFilter) return false;
            if (statusFilter === 'needs_translation' && approvedKeySet.has(k.key)) return false;
            if (statusFilter === 'has_official' && !approvedKeySet.has(k.key)) return false;
            if (search.trim()) {
                const q = search.trim().toLowerCase();
                if (!k.key.toLowerCase().includes(q) && !k.base_text.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [catalog, namespaceFilter, statusFilter, search, approvedKeySet]);

    const translatedCount = catalog?.keys.filter((k) => approvedKeySet.has(k.key)).length ?? 0;

    const handleSubmit = (key: string, payload: SuggestionPayload) => (
        submit(key, activeLanguage, payload).catch((err) => {
            toast.error(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || err.response?.data?.text?.[0] || err.response?.data?.plural_forms?.[0] || 'Failed to submit translation.');
        })
    );

    const handleUpdateOwn = (c: CommunityTranslation, payload: SuggestionPayload) => (
        update(c, payload).catch((err) => toast.error(err.response?.data?.text?.[0] || err.response?.data?.plural_forms?.[0] || err.response?.data?.detail || 'Failed to update translation.'))
    );

    const handleApprove = (c: CommunityTranslation) => {
        setBusyId(c.id);
        approve(c).catch((err) => toast.error(err.response?.data?.detail || 'Failed to approve translation.')).finally(() => setBusyId(null));
    };

    const handleReject = (c: CommunityTranslation) => {
        setBusyId(c.id);
        reject(c).catch((err) => toast.error(err.response?.data?.detail || 'Failed to reject translation.')).finally(() => setBusyId(null));
    };

    const performDelete = () => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        remove(target)
            .catch((err) => toast.error(err.response?.data?.detail || 'Failed to delete translation.'))
            .finally(() => setDeleteTarget(null));
    };

    if (!projectId) {
        return (
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    {headerExtra}
                    {headerExtra && <span className="text-zinc-700 text-lg font-light" aria-hidden="true">{SLASH_SEPARATOR}</span>}
                    <h2 className="text-xl font-bold text-white">{t('localisation')}</h2>
                </div>
                <div className="text-center py-16 text-zinc-600">
                    <Languages className="w-10 h-10 mx-auto mb-3 opacity-30" />
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
                        {headerExtra && <span className="text-zinc-700 text-lg font-light" aria-hidden="true">{SLASH_SEPARATOR}</span>}
                        <div>
                            {view === 'contributors' ? (
                                <button onClick={() => setView('strings')} className="flex items-center gap-1.5 text-xl font-bold text-white hover:text-zinc-300 transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> {t('contributors')}
                                </button>
                            ) : (
                                <h2 className="text-xl font-bold text-white">{t('localisation')}</h2>
                            )}
                            {view === 'strings' && catalog && (
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    {[translatedCount, '/', catalog.keys.length, t('translatedCount')].join(' ')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {view === 'strings' && (
                    <div className="flex items-center gap-2 flex-wrap mt-3">
                        <div className="relative flex-1 min-w-[180px] max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search strings..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                        <FilterDropdown
                            label="Language"
                            icon={Languages}
                            value={activeLanguage}
                            options={(catalog?.languages ?? []).map((l) => ({ key: l.code, label: l.name }))}
                            onChange={setLanguage}
                        />
                        <FilterDropdown
                            label="Namespace"
                            value={namespaceFilter}
                            options={namespaces.map((ns) => ({ key: ns, label: ns === 'all' ? 'All namespaces' : ns }))}
                            onChange={setNamespaceFilter}
                        />
                        <FilterDropdown
                            label="Status"
                            value={statusFilter}
                            options={[
                                { key: 'all' as StatusFilter, label: 'All' },
                                { key: 'needs_translation' as StatusFilter, label: 'Needs translation' },
                                { key: 'has_official' as StatusFilter, label: 'Translated' },
                            ]}
                            onChange={setStatusFilter}
                        />
                        <button
                            onClick={() => setView('contributors')}
                            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-300 transition-all ml-auto"
                        >
                            <Users className="w-3.5 h-3.5" /> {t('contributors')} <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                    </div>
                )}
            </div>

            {view === 'contributors' ? (
                <ContributorsPanel projectId={projectId} />
            ) : (
                <>
                    <div className="space-y-2.5">
                        {!catalogLoading && catalog && !catalog.has_key_catalog ? (
                            <div className="text-center py-16 text-zinc-600">
                                <Languages className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">{t('teamHasntPublishedStrings')}</p>
                            </div>
                        ) : !catalogLoading && filteredKeys.length === 0 ? (
                            <div className="text-center py-16 text-zinc-600">
                                <Languages className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">{t('noStringsMatchFilter')}</p>
                            </div>
                        ) : (
                            filteredKeys.map((entry: TranslationKeyCatalogEntry) => (
                                <TranslationKeyCard
                                    key={entry.key}
                                    entry={entry}
                                    language={activeLanguage}
                                    pluralCategories={pluralCategories}
                                    glossaryLocks={matchGlossaryLocks(entry.base_text, catalog?.glossary ?? [], activeLanguage)}
                                    contributions={forKeyLang(entry.key, activeLanguage)}
                                    currentUserId={user?.id ?? null}
                                    canApprove={canApprove}
                                    canReject={canReject}
                                    canDeleteAny={canDeleteAny}
                                    busy={busyId !== null}
                                    onSubmit={handleSubmit}
                                    onUpdateOwn={handleUpdateOwn}
                                    onVote={vote}
                                    onApprove={handleApprove}
                                    onReject={handleReject}
                                    onDelete={(c) => setDeleteTarget(c)}
                                />
                            ))
                        )}
                    </div>

                    <ConfirmDeleteModal
                        isOpen={!!deleteTarget}
                        title="Delete this suggestion?"
                        description="This will permanently remove the translation suggestion. This cannot be undone."
                        onConfirm={performDelete}
                        onCancel={() => setDeleteTarget(null)}
                    />
                </>
            )}
        </div>
    );
}
