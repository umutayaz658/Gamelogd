'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Heart, Check, X as XIcon, Trash2, Send, Loader2, Sparkles, Pencil, Lock, AlertCircle, RotateCcw } from 'lucide-react';
import { cn, getImageUrl, getRelativeTime } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';
import PluralFormEditor from './PluralFormEditor';
import { containsWholeWord, type GlossaryLockMatch } from './glossaryMatch';
import type { CldrCategory, CommunityTranslation, TranslationKeyCatalogEntry } from '@/types';

type SuggestionPayload = { text?: string; plural_forms?: Partial<Record<CldrCategory, string>> };

const CHECK_MARK = '✓';
const MIDDLE_DOT = '•';

interface KeyManageProps {
    canEdit: boolean;
    canDelete: boolean;
    onEditKey: (newKey: string, newBaseText: string, newBasePlural?: Partial<Record<CldrCategory, string>>) => void;
    onDeleteKey: () => void;
    onCheckKeyAvailable: (candidateKey: string) => boolean;
}

interface TranslationKeyCardProps {
    entry: TranslationKeyCatalogEntry;
    language: string;
    /** The active target language's plural categories (empty when entry isn't pluralisable). */
    pluralCategories: CldrCategory[];
    /** Every CommunityTranslation row for this key+language (any status the caller chose to
     * fetch — official/count/sort are all derived from this single list). */
    contributions: CommunityTranslation[];
    currentUserId: number | null;
    canApprove: boolean;
    canReject: boolean;
    canDeleteAny: boolean;
    busy?: boolean;
    onSubmit: (key: string, payload: SuggestionPayload) => Promise<void> | void;
    onUpdateOwn: (contribution: CommunityTranslation, payload: SuggestionPayload) => Promise<void> | void;
    onVote: (c: CommunityTranslation) => void;
    onApprove: (c: CommunityTranslation) => void;
    onReject: (c: CommunityTranslation) => void;
    /** Demotes an approved translation back to pending without hiding it the way reject does.
     * Optional — surfaces that don't offer moderation-undo simply omit it. */
    onUnapprove?: (c: CommunityTranslation) => void;
    onDelete: (c: CommunityTranslation) => void;
    /** Devs-only: rename/edit base text/delete the key itself — omitted on the public page. */
    manage?: KeyManageProps;
    /** Glossary terms whose source form appears in this key's base text, each with its locked
     * translation for the active language — shared between Devs and the public page (both
     * compute this via `matchGlossaryLocks`). Advisory only: never disables submission. */
    glossaryLocks?: GlossaryLockMatch[];
}

function TranslationText({ isPlural, text, pluralForms }: { isPlural: boolean; text: string; pluralForms?: Partial<Record<CldrCategory, string>> | null }) {
    if (isPlural && pluralForms && Object.keys(pluralForms).length > 0) {
        return (
            <div className="space-y-0.5">
                {Object.entries(pluralForms).map(([category, value]) => (
                    <p key={category}>
                        <span className="text-[10px] font-bold uppercase text-zinc-600 mr-1.5">{category}</span>
                        {value}
                    </p>
                ))}
            </div>
        );
    }
    return <p>{text}</p>;
}

export default function TranslationKeyCard({
    entry, language, pluralCategories, contributions, currentUserId,
    canApprove, canReject, canDeleteAny, busy = false,
    onSubmit, onUpdateOwn, onVote, onApprove, onReject, onUnapprove, onDelete,
    manage, glossaryLocks = [],
}: TranslationKeyCardProps) {
    const { language: uiLanguage, t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [showAllContributions, setShowAllContributions] = useState(false);
    const [suggestion, setSuggestion] = useState('');
    const [pluralDraft, setPluralDraft] = useState<Partial<Record<CldrCategory, string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [editingContributionId, setEditingContributionId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [editPluralDraft, setEditPluralDraft] = useState<Partial<Record<CldrCategory, string>>>({});
    const [editingKey, setEditingKey] = useState(false);
    const [editKeyValue, setEditKeyValue] = useState(entry.key);
    const [editBaseValue, setEditBaseValue] = useState(entry.base_text);
    const [editBasePluralDraft, setEditBasePluralDraft] = useState<Partial<Record<CldrCategory, string>>>(entry.base_plural ?? {});

    // The card stays mounted across language switches (it's keyed by the entry, not the
    // language), so every per-language draft must reset — otherwise a suggestion typed for
    // one language gets submitted to whichever language is active when the user hits send.
    useEffect(() => {
        setSuggestion('');
        setPluralDraft({});
        setEditingContributionId(null);
        setEditText('');
        setEditPluralDraft({});
    }, [language]);

    const official = contributions.find((c) => c.status === 'approved');
    const mine = currentUserId ? contributions.find((c) => c.author?.id === currentUserId) : undefined;

    // Approved first, then the viewer's own suggestion (if it isn't already the approved one),
    // then everyone else by vote count.
    const sorted = [...contributions].sort((a, b) => {
        const rank = (c: CommunityTranslation) => (
            c.status === 'approved' ? 0 : (currentUserId && c.author?.id === currentUserId) ? 1 : 2
        );
        const diff = rank(a) - rank(b);
        return diff !== 0 ? diff : b.votes_count - a.votes_count;
    });

    const COLLAPSE_THRESHOLD = 5;
    const visibleContributions = showAllContributions ? sorted : sorted.slice(0, COLLAPSE_THRESHOLD);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        if (entry.is_plural) {
            const cleaned = Object.fromEntries(Object.entries(pluralDraft).filter(([, v]) => v?.trim()));
            if (Object.keys(cleaned).length === 0) return;
            setSubmitting(true);
            try {
                await onSubmit(entry.key, { plural_forms: cleaned });
                setPluralDraft({});
            } finally {
                setSubmitting(false);
            }
            return;
        }
        if (!suggestion.trim()) return;
        setSubmitting(true);
        try {
            await onSubmit(entry.key, { text: suggestion.trim() });
            setSuggestion('');
        } finally {
            setSubmitting(false);
        }
    };

    const startEditingContribution = (c: CommunityTranslation) => {
        setEditingContributionId(c.id);
        setEditText(c.text);
        setEditPluralDraft(c.plural_forms ?? {});
    };

    const saveContributionEdit = async (c: CommunityTranslation) => {
        if (entry.is_plural) {
            const cleaned = Object.fromEntries(Object.entries(editPluralDraft).filter(([, v]) => v?.trim()));
            if (Object.keys(cleaned).length === 0) return;
            await onUpdateOwn(c, { plural_forms: cleaned });
        } else {
            if (!editText.trim()) return;
            await onUpdateOwn(c, { text: editText.trim() });
        }
        setEditingContributionId(null);
    };

    const keyConflict = manage ? editKeyValue.trim() !== entry.key && !manage.onCheckKeyAvailable(editKeyValue.trim()) : false;
    const baseCategories: CldrCategory[] = Object.keys(entry.base_plural ?? {}).length > 0
        ? (Object.keys(entry.base_plural ?? {}) as CldrCategory[])
        : (pluralCategories.length > 0 ? pluralCategories : ['one', 'other']);

    const saveKeyEdit = () => {
        if (!manage) return;
        const trimmedKey = editKeyValue.trim();
        if (!trimmedKey || keyConflict) return;
        if (entry.is_plural) {
            const cleaned = Object.fromEntries(Object.entries(editBasePluralDraft).filter(([, v]) => v?.trim())) as Partial<Record<CldrCategory, string>>;
            if (Object.keys(cleaned).length === 0) return;
            const representative = cleaned.other ?? Object.values(cleaned)[0] ?? '';
            manage.onEditKey(trimmedKey, representative, cleaned);
        } else {
            const trimmedBase = editBaseValue.trim();
            if (!trimmedBase) return;
            manage.onEditKey(trimmedKey, trimmedBase);
        }
        setEditingKey(false);
    };

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-zinc-800/30 transition-all"
            >
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                    official ? 'bg-emerald-500' : contributions.length > 0 ? 'bg-amber-400' : 'bg-zinc-600')} />
                <code className="text-xs font-mono text-zinc-400 flex-shrink-0 w-44 truncate">{entry.key}</code>
                <p className={cn('text-xs text-zinc-300 flex-1', expanded ? 'whitespace-pre-wrap break-words' : 'truncate')}>{entry.base_text}</p>
                {entry.is_plural && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5 flex-shrink-0">{t('pluralLabel')}</span>
                )}
                {official && (
                    <span className="text-xs text-emerald-400 truncate max-w-[160px] flex-shrink-0">{CHECK_MARK} {official.text}</span>
                )}
                {contributions.length > 0 && (
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5 flex-shrink-0">
                        {contributions.length}
                    </span>
                )}
                <ChevronDown className={cn('w-4 h-4 text-zinc-600 flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
            </button>

            {expanded && (
                <div className="border-t border-zinc-800 p-4 space-y-3 bg-zinc-900/20">
                    {manage && editingKey ? (
                        <div className="space-y-2 bg-zinc-900 border border-zinc-700 rounded-xl p-3">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">{t('keyLabel')}</label>
                                <input value={editKeyValue} onChange={(e) => setEditKeyValue(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500 transition-all" />
                                {keyConflict && <p className="text-[11px] text-red-400 mt-1">{t('keyAlreadyExists')}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">{t('baseTextShort')}</label>
                                {entry.is_plural ? (
                                    <PluralFormEditor
                                        localeCode={language}
                                        categories={baseCategories}
                                        value={editBasePluralDraft}
                                        onChange={setEditBasePluralDraft}
                                        placeholderPrefix="Base text"
                                    />
                                ) : (
                                    <textarea value={editBaseValue} onChange={(e) => setEditBaseValue(e.target.value)} rows={2}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs resize-none focus:outline-none focus:border-blue-500 transition-all" />
                                )}
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditingKey(false)} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-all">{t('cancel')}</button>
                                <button onClick={saveKeyEdit} disabled={!editKeyValue.trim() || keyConflict}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-40">{t('save')}</button>
                            </div>
                        </div>
                    ) : (
                        (glossaryLocks.length > 0 || manage?.canEdit) && (
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {glossaryLocks.map((l) => (
                                        <span key={l.term} className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                                            <Lock className="w-2.5 h-2.5" /> {[t('glossaryLabel'), `"${l.locked}"`].join(' ')}
                                        </span>
                                    ))}
                                </div>
                                {manage?.canEdit && (
                                    <button onClick={() => {
                                        setEditingKey(true);
                                        setEditKeyValue(entry.key);
                                        setEditBaseValue(entry.base_text);
                                        setEditBasePluralDraft(entry.base_plural ?? {});
                                    }}
                                        className="text-zinc-600 hover:text-blue-400 p-1 rounded-lg hover:bg-blue-500/10 transition-all flex-shrink-0">
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )
                    )}

                    {official && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 space-y-1">
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <div className="flex-1 text-sm text-emerald-300">
                                    <TranslationText isPlural={entry.is_plural} text={official.text} pluralForms={official.plural_forms} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/70 flex-shrink-0">{t('officialLabel')}</span>
                            </div>
                        </div>
                    )}

                    {sorted.length > 0 && (
                        <div className="space-y-2">
                            {visibleContributions.map((c) => {
                                const isMine = !!currentUserId && c.author?.id === currentUserId;
                                const canDelete = isMine || canDeleteAny;
                                const isEditing = editingContributionId === c.id;
                                const missingLocks = glossaryLocks.filter((l) => !containsWholeWord(c.text, l.locked));
                                return (
                                    <div key={c.id} className={cn('rounded-lg border p-2.5',
                                        c.status === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900 border-zinc-800')}>
                                        <div className="flex items-start gap-2.5">
                                            <Link href={c.author ? `/${c.author.username}` : '#'} className="flex-shrink-0">
                                                <img
                                                    src={getImageUrl(c.author?.avatar, c.author?.username)}
                                                    alt=""
                                                    className="h-7 w-7 rounded-full bg-zinc-800 object-cover"
                                                />
                                            </Link>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                                    <Link href={c.author ? `/${c.author.username}` : '#'} className="font-semibold text-zinc-300 hover:text-white">
                                                        {c.author?.username ?? t('unknownLabel')}
                                                    </Link>
                                                    <span className="text-zinc-700" aria-hidden="true">{MIDDLE_DOT}</span>
                                                    <span className="text-zinc-600" suppressHydrationWarning>{getRelativeTime(c.created_at, uiLanguage)}</span>
                                                    {c.status === 'approved' && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                                            <Sparkles className="w-2.5 h-2.5" /> {t('approved').toUpperCase()}
                                                        </span>
                                                    )}
                                                    {isMine && <span className="text-[10px] font-bold text-blue-400">{t('youLabel')}</span>}
                                                    {missingLocks.length > 0 && (
                                                        <span title={`Missing glossary term(s): ${missingLocks.map((l) => `"${l.locked}"`).join(', ')}`}>
                                                            <AlertCircle className="w-3 h-3 text-amber-500" />
                                                        </span>
                                                    )}
                                                </div>
                                                {isEditing ? (
                                                    <div className="mt-1.5 space-y-1.5">
                                                        {entry.is_plural ? (
                                                            <PluralFormEditor
                                                                localeCode={language}
                                                                categories={pluralCategories}
                                                                value={editPluralDraft}
                                                                onChange={setEditPluralDraft}
                                                            />
                                                        ) : (
                                                            <textarea
                                                                autoFocus
                                                                value={editText}
                                                                onChange={(e) => setEditText(e.target.value)}
                                                                rows={2}
                                                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-y focus:outline-none focus:border-blue-500 transition-all"
                                                            />
                                                        )}
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => setEditingContributionId(null)} className="text-xs px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-all">{t('cancel')}</button>
                                                            <button onClick={() => saveContributionEdit(c)}
                                                                className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-40">{t('save')}</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-white mt-1">
                                                        <TranslationText isPlural={entry.is_plural} text={c.text} pluralForms={c.plural_forms} />
                                                    </div>
                                                )}
                                            </div>
                                            {!isEditing && (
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <button
                                                        onClick={() => onVote(c)}
                                                        disabled={!currentUserId}
                                                        className={cn('flex items-center gap-1 text-xs px-1.5 py-1 rounded-lg transition-colors',
                                                            c.is_voted ? 'text-pink-500' : 'text-zinc-500 hover:text-pink-400')}
                                                    >
                                                        <Heart className={cn('h-3.5 w-3.5', c.is_voted && 'fill-pink-500')} />
                                                        {c.votes_count}
                                                    </button>
                                                    {isMine && (
                                                        <button onClick={() => startEditingContribution(c)} title="Edit" className="text-zinc-500 hover:text-blue-400 transition-colors">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {canApprove && c.status !== 'approved' && (
                                                        <button onClick={() => onApprove(c)} disabled={busy} title="Approve" className="text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-40">
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canApprove && c.status === 'approved' && onUnapprove && (
                                                        <button onClick={() => onUnapprove(c)} disabled={busy} title="Unapprove (back to pending)" className="text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-40">
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {canReject && c.status !== 'rejected' && (
                                                        <button onClick={() => onReject(c)} disabled={busy} title="Reject" className="text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-40">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button onClick={() => onDelete(c)} disabled={busy} title="Delete" className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {sorted.length > COLLAPSE_THRESHOLD && (
                                <button
                                    onClick={() => setShowAllContributions(!showAllContributions)}
                                    className="text-[11px] text-emerald-500 hover:text-emerald-400 hover:underline font-semibold transition-colors"
                                >
                                    {showAllContributions ? t('showLess') : `${t('showMore')} (${sorted.length - COLLAPSE_THRESHOLD})`}
                                </button>
                            )}
                        </div>
                    )}

                    {!mine && (
                        currentUserId ? (
                            entry.is_plural ? (
                                <form onSubmit={handleSubmit} className="space-y-2 pt-1">
                                    <PluralFormEditor
                                        localeCode={language}
                                        categories={pluralCategories}
                                        value={pluralDraft}
                                        onChange={setPluralDraft}
                                        placeholderPrefix={`Suggest ${language} translation`}
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={submitting || !Object.values(pluralDraft).some((v) => v?.trim())}
                                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                                        >
                                            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            {t('submit')}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
                                    <input
                                        value={suggestion}
                                        onChange={(e) => setSuggestion(e.target.value)}
                                        placeholder={glossaryLocks.length > 0 ? `Glossary locks: ${glossaryLocks.map((l) => `"${l.locked}"`).join(', ')}` : `Suggest ${language} translation...`}
                                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!suggestion.trim() || submitting}
                                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                                    >
                                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                        {t('submit')}
                                    </button>
                                </form>
                            )
                        ) : (
                            <p className="text-xs text-zinc-600 text-center pt-1">{t('signInToSuggestTranslation')}</p>
                        )
                    )}

                    {manage?.canDelete && (
                        <div className="flex justify-end">
                            <button onClick={manage.onDeleteKey} className="text-[11px] text-zinc-700 hover:text-red-400 flex items-center gap-1 transition-colors">
                                <Trash2 className="w-3 h-3" /> {t('deleteKey')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
