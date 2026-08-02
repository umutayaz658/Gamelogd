'use client';

import { useMemo, useState } from 'react';
import {
    Plus, X, Search, Globe, BookOpen, Trash2, Lock, Sword, Languages as LanguagesIcon, ArrowLeftRight,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useToast } from '@/context/ToastContext';
import api from '@/lib/api';
import BoardSwitcher from './BoardSwitcher';
import { TranslationEntry, GlossaryTerm } from './WorkspaceTypes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import TranslationKeyCard from '@/components/localisation/TranslationKeyCard';
import { useProjectTranslations } from '@/components/localisation/useProjectTranslations';
import { useCatalog } from '@/components/localisation/useCatalog';
import { matchGlossaryLocks } from '@/components/localisation/glossaryMatch';
import ContributorsPanel from '@/components/localisation/ContributorsPanel';
import PluralFormEditor from '@/components/localisation/PluralFormEditor';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import LanguageSettingsModal from './LanguageSettingsModal';
import LocalisationTransferModal from './LocalisationTransferModal';
import type { CldrCategory, CommunityTranslation } from '@/types';
import { useTranslation } from '@/lib/useTranslation';

const MIDDLE_DOT = '·';
const SLASH_SEPARATOR = '/';
const COLON = ':';

type LocalTab = 'keys' | 'glossary' | 'contributors';
type SuggestionPayload = { text?: string; plural_forms?: Partial<Record<CldrCategory, string>> };

// ─── Shared helpers ─────────────────────────────────────────────────────────

function deriveNamespace(key: string): string {
    return key.includes('.') ? key.split('.')[0] : 'other';
}

const RPG_TEMPLATE: Omit<TranslationEntry, 'id'>[] = [
    { key: 'hud.health', namespace: 'hud', baseText: 'Health' },
    { key: 'hud.mana', namespace: 'hud', baseText: 'Mana' },
    { key: 'hud.stamina', namespace: 'hud', baseText: 'Stamina' },
    { key: 'menu.newGame', namespace: 'menu', baseText: 'New Game' },
    { key: 'menu.loadGame', namespace: 'menu', baseText: 'Load Game' },
    { key: 'menu.options', namespace: 'menu', baseText: 'Options' },
    { key: 'menu.quit', namespace: 'menu', baseText: 'Quit' },
    { key: 'status.levelUp', namespace: 'status', baseText: 'Level Up!' },
    { key: 'status.questCompleted', namespace: 'status', baseText: 'Quest Completed!' },
    { key: 'status.itemFound', namespace: 'status', baseText: 'Item Found!' },
];

const MENU_TEMPLATE: Omit<TranslationEntry, 'id'>[] = [
    { key: 'mainMenu.play', namespace: 'mainMenu', baseText: 'Play' },
    { key: 'mainMenu.settings', namespace: 'mainMenu', baseText: 'Settings' },
    { key: 'mainMenu.credits', namespace: 'mainMenu', baseText: 'Credits' },
    { key: 'mainMenu.exit', namespace: 'mainMenu', baseText: 'Exit' },
    { key: 'settings.audio', namespace: 'settings', baseText: 'Audio' },
    { key: 'settings.graphics', namespace: 'settings', baseText: 'Graphics' },
    { key: 'settings.controls', namespace: 'settings', baseText: 'Controls' },
    { key: 'settings.language', namespace: 'settings', baseText: 'Language' },
];

// ─── Add Key modal ──────────────────────────────────────────────────────────

interface AddKeyModalProps {
    onClose: () => void;
    onSubmit: (key: string, base: string, isPlural: boolean, basePlural?: Partial<Record<CldrCategory, string>>) => void;
    sourceLocaleCode: string;
    sourceCategories: CldrCategory[];
    isKeyAvailable: (key: string) => boolean;
}

function AddKeyModal({ onClose, onSubmit, sourceLocaleCode, sourceCategories, isKeyAvailable }: AddKeyModalProps) {
    const { t } = useTranslation();
    const [key, setKey] = useState('');
    const [base, setBase] = useState('');
    const [isPlural, setIsPlural] = useState(false);
    const [basePluralDraft, setBasePluralDraft] = useState<Partial<Record<CldrCategory, string>>>({});
    const [keyError, setKeyError] = useState<string | null>(null);
    const ns = key ? deriveNamespace(key) : '(none)';

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedKey = key.trim();
        if (!trimmedKey) return;
        if (!isKeyAvailable(trimmedKey)) {
            setKeyError('A key with this name already exists.');
            return;
        }
        if (isPlural) {
            const cleaned = Object.fromEntries(Object.entries(basePluralDraft).filter(([, v]) => v?.trim())) as Partial<Record<CldrCategory, string>>;
            if (Object.keys(cleaned).length === 0) return;
            const representative = cleaned.other ?? Object.values(cleaned)[0] ?? '';
            onSubmit(trimmedKey, representative, true, cleaned);
        } else {
            const trimmedBase = base.trim();
            if (!trimmedBase) return;
            onSubmit(trimmedKey, trimmedBase, false);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-white">{t('addTranslationKey')}</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('programmaticKeyRequired')}</label>
                        <input autoFocus value={key} onChange={(e) => { setKey(e.target.value); setKeyError(null); }} placeholder="e.g. mainMenu.play or dialogue.merchant.greeting"
                            required className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all" />
                        {keyError && <p className="text-[11px] text-red-400 mt-1">{keyError}</p>}
                        {key && (
                            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
                                <BookOpen className="w-3 h-3" />
                                {[t('namespaceColon'), ns].join(' ')}
                            </p>
                        )}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                        <input type="checkbox" checked={isPlural} onChange={(e) => setIsPlural(e.target.checked)} className="accent-blue-600" />
                        {t('hasPluralFormsHint')}
                    </label>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('baseTextSourceLanguageRequired')}</label>
                        {isPlural ? (
                            <PluralFormEditor
                                localeCode={sourceLocaleCode}
                                categories={sourceCategories}
                                value={basePluralDraft}
                                onChange={setBasePluralDraft}
                                placeholderPrefix="Base text"
                            />
                        ) : (
                            <>
                                <textarea value={base} onChange={(e) => setBase(e.target.value)} placeholder="e.g. Welcome traveller! What can I sell you?"
                                    rows={3} required className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none transition-all" />
                                <p className="text-[11px] text-zinc-600 mt-1">{t('baseTextFreeformHint')}</p>
                            </>
                        )}
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">{t('cancel')}</button>
                        <button type="submit" disabled={!key.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40">{t('addKey')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Templates modal ────────────────────────────────────────────────────────

function TemplatesModal({ onClose, onPick }: { onClose: () => void; onPick: (template: Omit<TranslationEntry, 'id'>[]) => void }) {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-white">{t('importATemplate')}</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-2">
                    <p className="text-sm text-zinc-400 mb-1">{t('quicklyPopulateKeysDesc')}</p>
                    <button onClick={() => { onPick(RPG_TEMPLATE); onClose(); }}
                        className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-left p-4 rounded-xl transition-all">
                        <Sword className="w-5 h-5 text-amber-400 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-white">{t('rpgTemplate')}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{t('rpgTemplateDesc')}</p>
                        </div>
                        <Plus className="w-4 h-4 text-zinc-600 ml-auto" />
                    </button>
                    <button onClick={() => { onPick(MENU_TEMPLATE); onClose(); }}
                        className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-left p-4 rounded-xl transition-all">
                        <BookOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-white">{t('menuSettingsTemplate')}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{t('menuTemplateDesc')}</p>
                        </div>
                        <Plus className="w-4 h-4 text-zinc-600 ml-auto" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LocalisationManager() {
    const { t } = useTranslation();
    const {
        activeBoard, data, setTranslationKeys, setGlossary,
        setTranslationLanguages, setTranslationSourceLanguage, getBoardVersion, flushPendingSave,
        refreshWorkspaceData, logActivity, hasPermission,
    } = useWorkspace();
    const { user } = useAuth();
    const toast = useToast();
    const { translationKeys, glossary } = data;

    const projectId = activeBoard.startsWith('project_') ? parseInt(activeBoard.replace('project_', ''), 10) : null;

    // The single shared source of every suggestion/vote/approval — same model, same rows, same
    // API the public project page's Localisation tab reads and writes. A team member suggesting
    // a translation here is visible to the public immediately, and vice versa.
    const { contributions, refetch: refetchContributions, forKeyLang, submit, update, vote, approve, reject, unapprove, remove } = useProjectTranslations(projectId);
    // Read-only, resolved (fallback-applied) language list + plural categories — the exact same
    // endpoint/shape the public panel uses, so the two surfaces can never disagree on which
    // languages a project supports or which plural forms a given language needs.
    const { catalog, refetch: refetchCatalog } = useCatalog(projectId);

    const canEditKey = hasPermission('localisation.key.create');
    const canApprove = hasPermission('community_translation.approve');
    const canReject = hasPermission('community_translation.reject');
    const canDeleteAny = hasPermission('community_translation.delete');
    const canDeleteKey = hasPermission('localisation.key.delete');
    const canManageGlossary = hasPermission('localisation.glossary.manage');
    const canManageLanguages = hasPermission('localisation.language.manage');
    const canViewPending = hasPermission('localisation.view');
    const canImportKeys = hasPermission('localisation.key.create');
    const canImportTranslations = hasPermission('community_translation.approve');

    const [tab, setTab] = useState<LocalTab>('keys');
    const [activeLangState, setActiveLangState] = useState('');
    const activeLang = activeLangState || catalog?.languages[0]?.code || '';
    const activeLocale = catalog?.languages.find((l) => l.code === activeLang);
    const pluralCategories = activeLocale?.plural_categories ?? [];
    const sourceCategories = catalog?.source_language.plural_categories ?? ['one', 'other'];
    const sourceCode = catalog?.source_language.code ?? 'en';

    const [filterNs, setFilterNs] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'missing'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddKey, setShowAddKey] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showLanguages, setShowLanguages] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CommunityTranslation | null>(null);

    // Glossary form
    const [newGlossTerm, setNewGlossTerm] = useState('');
    const [newGlossTranslation, setNewGlossTranslation] = useState('');

    const approvedKeySet = useMemo(
        () => new Set(contributions.filter((c) => c.language === activeLang && c.status === 'approved').map((c) => c.key)),
        [contributions, activeLang],
    );

    const contributionCountByLanguage = useMemo(() => {
        const counts: Record<string, number> = {};
        contributions.forEach((c) => { counts[c.language] = (counts[c.language] ?? 0) + 1; });
        return counts;
    }, [contributions]);

    // Namespace list
    const namespaces = useMemo(() => {
        const ns = new Set(translationKeys.map((k) => k.namespace));
        return ['all', ...Array.from(ns)];
    }, [translationKeys]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return translationKeys.filter((k) => {
            if (filterNs !== 'all' && k.namespace !== filterNs) return false;
            if (filterStatus === 'approved' && !approvedKeySet.has(k.key)) return false;
            if (filterStatus === 'missing' && approvedKeySet.has(k.key)) return false;
            if (q && !k.key.toLowerCase().includes(q) && !k.baseText.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [translationKeys, filterNs, filterStatus, searchQuery, approvedKeySet]);

    const missingCount = translationKeys.filter((k) => !approvedKeySet.has(k.key)).length;

    const isKeyAvailable = (key: string) => !translationKeys.some((k) => k.key === key);

    const handleAddKey = (key: string, base: string, isPlural: boolean, basePlural?: Partial<Record<CldrCategory, string>>) => {
        const entry: TranslationEntry = {
            id: `lk-${Date.now()}`,
            key,
            namespace: deriveNamespace(key),
            baseText: base,
            ...(isPlural ? { isPlural: true, basePlural } : {}),
        };
        setTranslationKeys((prev) => [...prev, entry]);
        logActivity('translation_approved', `Translation key "${key}" added.`, '🌍');
    };

    const handleEditKeyMeta = (id: string, newKey: string, newBaseText: string, newBasePlural?: Partial<Record<CldrCategory, string>>) => {
        const previous = translationKeys.find((k) => k.id === id);
        if (!previous) return;
        const updated: TranslationEntry = {
            ...previous, key: newKey, namespace: deriveNamespace(newKey), baseText: newBaseText,
            ...(newBasePlural ? { basePlural: newBasePlural } : {}),
        };
        if (filterNs !== 'all' && previous.namespace === filterNs && updated.namespace !== filterNs) {
            setFilterNs(updated.namespace);
        }
        setTranslationKeys((prev) => prev.map((k) => k.id === id ? updated : k));
        // CommunityTranslation rows reference the key by string (no FK) — without this backend
        // rename, every existing suggestion/vote/approval for the key would silently vanish
        // from both surfaces while the rows lived on forever.
        if (previous.key !== newKey && projectId) {
            api.post(`/projects/${projectId}/localisation/rename-key/`, { old_key: previous.key, new_key: newKey })
                .then(() => refetchContributions())
                .catch((err) => toast.error(err.response?.data?.error || 'Renamed the key, but its existing translations could not be carried over.'));
        }
    };

    const handleDeleteKey = (id: string) => {
        const previous = translationKeys.find((k) => k.id === id);
        setTranslationKeys((prev) => prev.filter((k) => k.id !== id));
        // Clean up the key's CommunityTranslation rows too — orphaned rows would keep counting
        // toward contributor totals while being unreachable from any UI.
        if (previous && projectId) {
            api.post(`/projects/${projectId}/localisation/delete-key-translations/`, { key: previous.key })
                .then(() => refetchContributions())
                .catch(() => { /* the key itself is gone; orphan cleanup is best-effort */ });
        }
    };

    const importTemplate = (template: Omit<TranslationEntry, 'id'>[]) => {
        const newKeys = template
            .filter((t) => !translationKeys.some((k) => k.key === t.key))
            .map((t) => ({ ...t, id: `lk-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
        setTranslationKeys((prev) => [...prev, ...newKeys]);
        logActivity('translation_approved', `${newKeys.length} keys imported from template.`, '📥');
        setFilterNs('all');
    };

    const addGlossTerm = () => {
        if (!newGlossTerm.trim()) return;
        const term: GlossaryTerm = {
            id: `gl-${Date.now()}`,
            term: newGlossTerm.trim(),
            translations: newGlossTranslation.trim() ? { [activeLang]: newGlossTranslation.trim() } : {},
        };
        setGlossary((prev) => [...prev, term]);
        setNewGlossTerm('');
        setNewGlossTranslation('');
    };

    const handleSubmit = (key: string, payload: SuggestionPayload) => (
        submit(key, activeLang, payload).catch((err) => {
            toast.error(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || err.response?.data?.text?.[0] || err.response?.data?.plural_forms?.[0] || 'Failed to submit translation.');
        })
    );

    const handleUpdateOwn = (c: CommunityTranslation, payload: SuggestionPayload) => (
        update(c, payload).catch((err) => toast.error(err.response?.data?.text?.[0] || err.response?.data?.plural_forms?.[0] || err.response?.data?.detail || 'Failed to update translation.'))
    );

    const handleApprove = (c: CommunityTranslation) => {
        setBusyId(c.id);
        approve(c)
            .then(() => logActivity('translation_approved', `"${c.key}" approved for ${c.language}.`, '✅'))
            .catch((err) => toast.error(err.response?.data?.detail || 'Failed to approve translation.'))
            .finally(() => setBusyId(null));
    };

    const handleReject = (c: CommunityTranslation) => {
        setBusyId(c.id);
        reject(c).catch((err) => toast.error(err.response?.data?.detail || 'Failed to reject translation.')).finally(() => setBusyId(null));
    };

    const handleUnapprove = (c: CommunityTranslation) => {
        setBusyId(c.id);
        unapprove(c).catch((err) => toast.error(err.response?.data?.detail || 'Failed to unapprove translation.')).finally(() => setBusyId(null));
    };

    const performDelete = () => {
        if (!deleteTarget) return;
        remove(deleteTarget)
            .catch((err) => toast.error(err.response?.data?.detail || 'Failed to delete translation.'))
            .finally(() => setDeleteTarget(null));
    };

    const handleSaveLanguages = (languages: { code: string; name: string }[], source: { code: string; name: string }) => {
        setTranslationLanguages(languages);
        setTranslationSourceLanguage(source);
        // The catalog endpoint derives its language list from the persisted blob, so the
        // debounced save must actually reach the backend before refetching — otherwise the
        // newly added language doesn't appear until some unrelated later refetch.
        flushPendingSave().then(refetchCatalog);
    };

    if (!projectId) {
        return (
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <BoardSwitcher projectsOnly />
                    <span className="text-zinc-655 text-lg font-light" aria-hidden="true">{SLASH_SEPARATOR}</span>
                    <h2 className="text-xl font-bold text-white">{t('localisationManager')}</h2>
                </div>
                <div className="text-center py-16 text-zinc-600">
                    <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t('selectProjectToManageLocalisationDesc')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <BoardSwitcher projectsOnly />
                        <span className="text-zinc-655 text-lg font-light" aria-hidden="true">{SLASH_SEPARATOR}</span>
                        <h2 className="text-xl font-bold text-white">{t('localisationManager')}</h2>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1.5">
                        {[translationKeys.length, t('keysLower'), MIDDLE_DOT, missingCount, t('missingInLower'), activeLocale?.name ?? activeLang, MIDDLE_DOT].join(' ')}
                        <span className="text-xs text-zinc-600 ml-1">{t('keyValuePairsNotWordByWordDesc')}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {canManageLanguages && (
                        <button onClick={() => setShowLanguages(true)}
                            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-sm font-semibold transition-all">
                            <LanguagesIcon className="w-4 h-4" /> {t('languages')}
                        </button>
                    )}
                    <button onClick={() => setShowTransfer(true)}
                        className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-sm font-semibold transition-all">
                        <ArrowLeftRight className="w-4 h-4" /> {t('exportImport')}
                    </button>
                    <button onClick={() => setShowAddKey(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20">
                        <Plus className="w-4 h-4" /> {t('addKey')}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
                {(['keys', 'glossary', 'contributors'] as LocalTab[]).map((tabId) => (
                    <button key={tabId} onClick={() => setTab(tabId)}
                        className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                            tab === tabId ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}>
                        {tabId === 'keys' ? t('translationKeysLabel') : tabId === 'glossary' ? t('glossary') : t('contributors')}
                    </button>
                ))}
            </div>

            {tab === 'keys' && (
                <div className="flex gap-5 min-h-[500px]">
                    {/* Namespace sidebar */}
                    <aside className="w-44 flex-shrink-0 space-y-1">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold px-2 mb-2">{t('namespaces')}</p>
                        {namespaces.map((ns) => {
                            const count = ns === 'all' ? translationKeys.length : translationKeys.filter((k) => k.namespace === ns).length;
                            return (
                                <button key={ns} onClick={() => setFilterNs(ns)}
                                    className={cn('w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left',
                                        filterNs === ns ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900')}>
                                    <span className="truncate">{ns === 'all' ? 'All' : ns}</span>
                                    <span className="text-[11px] text-zinc-600">{count}</span>
                                </button>
                            );
                        })}
                    </aside>

                    {/* Main keys area */}
                    <div className="flex-1 min-w-0 space-y-4">
                        {/* Language + filter bar */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Language selector */}
                            <div className="flex items-center gap-1.5">
                                <Globe className="w-4 h-4 text-zinc-500" />
                                <select value={activeLang} onChange={(e) => setActiveLangState(e.target.value)}
                                    className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                                    style={{ colorScheme: 'dark' }}>
                                    {(catalog?.languages ?? []).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                                </select>
                            </div>

                            {/* Status filter */}
                            <div className="flex gap-1">
                                {(['all', 'missing', 'approved'] as const).map((s) => (
                                    <button key={s} onClick={() => setFilterStatus(s)}
                                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize',
                                            filterStatus === s ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600')}>
                                        {s === 'missing' ? `Missing (${missingCount})` : s}
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="relative ml-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search keys..."
                                    className="bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all w-44" />
                            </div>
                        </div>

                        {/* Key list */}
                        {filtered.length === 0 ? (
                            translationKeys.length === 0 ? (
                                <div className="text-center py-16 text-zinc-600">
                                    <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm mb-3">{t('noTranslationKeysYet')}</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => setShowAddKey(true)} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">{t('addYourFirstKey')}</button>
                                        <span className="text-zinc-700" aria-hidden="true">{MIDDLE_DOT}</span>
                                        <button onClick={() => setShowTemplates(true)} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">{t('useATemplate')}</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-16 text-zinc-600">
                                    <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm mb-2">{t('noKeysMatchFiltersDesc')}</p>
                                    <button onClick={() => { setFilterNs('all'); setFilterStatus('all'); setSearchQuery(''); }}
                                        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">{t('clearFilters')}</button>
                                </div>
                            )
                        ) : (
                            <div className="space-y-1.5">
                                {filtered.map((entry) => (
                                    <TranslationKeyCard
                                        key={entry.id}
                                        entry={{
                                            key: entry.key, namespace: entry.namespace, base_text: entry.baseText,
                                            is_plural: !!entry.isPlural, base_plural: entry.basePlural ?? null,
                                        }}
                                        language={activeLang}
                                        pluralCategories={pluralCategories}
                                        contributions={forKeyLang(entry.key, activeLang)}
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
                                        onUnapprove={handleUnapprove}
                                        onDelete={(c) => setDeleteTarget(c)}
                                        glossaryLocks={matchGlossaryLocks(entry.baseText, glossary, activeLang)}
                                        manage={{
                                            canEdit: canEditKey,
                                            canDelete: canDeleteKey,
                                            onEditKey: (newKey, newBaseText, newBasePlural) => handleEditKeyMeta(entry.id, newKey, newBaseText, newBasePlural),
                                            onDeleteKey: () => handleDeleteKey(entry.id),
                                            onCheckKeyAvailable: isKeyAvailable,
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'glossary' && (
                <div className="space-y-4 max-w-2xl">
                    <p className="text-sm text-zinc-500">
                        {t('lockGlossaryTermsDesc')}
                    </p>

                    {/* Add glossary term */}
                    {canManageGlossary && (
                        <div className="flex gap-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                            <div className="flex-1 space-y-2">
                                <input value={newGlossTerm} onChange={(e) => setNewGlossTerm(e.target.value)}
                                    placeholder="Term (e.g. Fireball)"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all" />
                                <div className="flex gap-2 items-center">
                                    <select value={activeLang} onChange={(e) => setActiveLangState(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-2 text-white text-sm focus:outline-none cursor-pointer"
                                        style={{ colorScheme: 'dark' }}>
                                        {(catalog?.languages ?? []).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                                    </select>
                                    <input value={newGlossTranslation} onChange={(e) => setNewGlossTranslation(e.target.value)}
                                        placeholder={`${activeLocale?.name ?? activeLang} translation (optional)`}
                                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all" />
                                </div>
                            </div>
                            <button onClick={addGlossTerm} disabled={!newGlossTerm.trim()}
                                className="px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40 self-end py-3">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Glossary list */}
                    <div className="space-y-2">
                        {glossary.map((term) => (
                            <div key={term.id} className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3.5">
                                <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                <span className="text-sm font-bold text-white flex-shrink-0 w-28">{term.term}</span>
                                <div className="flex flex-wrap gap-2 flex-1">
                                    {Object.entries(term.translations).map(([lang, tr]) => (
                                        <span key={lang} className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-300">
                                            <span className="text-zinc-500">{[catalog?.languages.find((l) => l.code === lang)?.name ?? lang, COLON].join('')} </span>{tr}
                                        </span>
                                    ))}
                                </div>
                                {canManageGlossary && (
                                    <button onClick={() => setGlossary((prev) => prev.filter((g) => g.id !== term.id))}
                                        className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all flex-shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {glossary.length === 0 && (
                            <p className="text-sm text-zinc-700 text-center py-8">{t('noGlossaryTermsYet')}</p>
                        )}
                    </div>
                </div>
            )}

            {tab === 'contributors' && <ContributorsPanel projectId={projectId} />}

            {/* Add Key Modal */}
            {showAddKey && (
                <AddKeyModal
                    onClose={() => setShowAddKey(false)}
                    onSubmit={handleAddKey}
                    sourceLocaleCode={sourceCode}
                    sourceCategories={sourceCategories}
                    isKeyAvailable={isKeyAvailable}
                />
            )}

            {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onPick={importTemplate} />}

            {showLanguages && (
                <LanguageSettingsModal
                    isOpen={showLanguages}
                    onClose={() => setShowLanguages(false)}
                    currentLanguages={data.translationLanguages ?? (catalog?.languages.map((l) => ({ code: l.code, name: l.name })) ?? [])}
                    currentSourceLanguage={data.translationSourceLanguage ?? (catalog?.source_language ? { code: catalog.source_language.code, name: catalog.source_language.name } : { code: 'en', name: 'English' })}
                    contributionCountByLanguage={contributionCountByLanguage}
                    onSave={handleSaveLanguages}
                />
            )}

            {showTransfer && (
                <LocalisationTransferModal
                    isOpen={showTransfer}
                    onClose={() => setShowTransfer(false)}
                    projectId={projectId}
                    languages={(catalog?.languages ?? []).map((l) => ({ code: l.code, name: l.name }))}
                    canViewPending={canViewPending}
                    canImportKeys={canImportKeys}
                    canImportTranslations={canImportTranslations}
                    baseVersion={getBoardVersion()}
                    onImported={() => { refreshWorkspaceData(); refetchCatalog(); }}
                />
            )}

            <ConfirmDeleteModal
                isOpen={!!deleteTarget}
                title="Delete this suggestion?"
                description="This will permanently remove the translation suggestion. This cannot be undone."
                onConfirm={performDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
