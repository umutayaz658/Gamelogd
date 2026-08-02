'use client';

import { useState } from 'react';
import { X, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocaleRegistry } from '@/components/localisation/useLocaleRegistry';
import type { ProjectLocale } from './WorkspaceTypes';
import { useTranslation } from '@/lib/useTranslation';

const OPEN_PAREN = '(';
const CLOSE_PAREN = ')';

interface LanguageSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLanguages: ProjectLocale[];
    currentSourceLanguage: ProjectLocale;
    /** Number of existing CommunityTranslation rows per language code — used to warn before
     * removing a language that already has contributions (they're hidden, not deleted). */
    contributionCountByLanguage: Record<string, number>;
    onSave: (languages: ProjectLocale[], source: ProjectLocale) => void;
}

export default function LanguageSettingsModal({
    isOpen, onClose, currentLanguages, currentSourceLanguage, contributionCountByLanguage, onSave,
}: LanguageSettingsModalProps) {
    const { t } = useTranslation();
    const { registry, loading } = useLocaleRegistry();
    const [selected, setSelected] = useState<ProjectLocale[]>(currentLanguages);
    const [source, setSource] = useState<ProjectLocale>(currentSourceLanguage);
    const [search, setSearch] = useState('');
    // The current* props resolve asynchronously (catalog fetch): keep syncing them into local
    // state until the user actually edits, or a modal opened before the fetch resolved would
    // start from an empty list and Save would wipe the configured languages.
    const [dirty, setDirty] = useState(false);
    // Sync local editable state from the async-resolving props (until the user edits) as a
    // pure state update, done synchronously during render rather than in an effect.
    // See https://react.dev/learn/you-might-not-need-an-effect
    const [prevCurrentLanguages, setPrevCurrentLanguages] = useState(currentLanguages);
    if (currentLanguages !== prevCurrentLanguages) {
        setPrevCurrentLanguages(currentLanguages);
        if (!dirty) setSelected(currentLanguages);
    }
    const [prevCurrentSourceLanguage, setPrevCurrentSourceLanguage] = useState(currentSourceLanguage);
    if (currentSourceLanguage !== prevCurrentSourceLanguage) {
        setPrevCurrentSourceLanguage(currentSourceLanguage);
        if (!dirty) setSource(currentSourceLanguage);
    }

    if (!isOpen) return null;

    const selectedCodes = new Set(selected.map((l) => l.code));
    const filtered = (registry?.locales ?? []).filter((l) => {
        if (l.code === source.code) return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return l.name.toLowerCase().includes(q) || l.native_name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
    });

    const toggle = (code: string, name: string) => {
        setDirty(true);
        if (selectedCodes.has(code)) {
            setSelected((prev) => prev.filter((l) => l.code !== code));
        } else {
            setSelected((prev) => [...prev, { code, name }]);
        }
    };

    const handleSave = () => {
        // The source language must never also be a target: filtering here (not just in the
        // picker list) covers the case where an already-selected target is promoted to source.
        onSave(selected.filter((l) => l.code !== source.code), source);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
                    <h2 className="text-lg font-bold text-white">{t('languages')}</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('sourceLanguage')}</label>
                        <select
                            value={source.code}
                            onChange={(e) => {
                                const loc = registry?.locales.find((l) => l.code === e.target.value);
                                if (loc) {
                                    setDirty(true);
                                    setSource({ code: loc.code, name: loc.name });
                                    // If the new source was a selected target, drop it there.
                                    setSelected((prev) => prev.filter((l) => l.code !== loc.code));
                                }
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                        >
                            {(registry?.locales ?? []).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('targetLanguages')}</label>
                        {selected.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selected.map((l) => (
                                    <span key={l.code} className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-full pl-3 pr-1.5 py-1">
                                        {l.name}
                                        <button onClick={() => toggle(l.code, l.name)} className="hover:text-white p-0.5 rounded-full hover:bg-blue-500/20 transition-colors">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search languages..."
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-0.5 border border-zinc-800 rounded-xl p-1.5">
                            {loading ? (
                                <p className="text-xs text-zinc-600 text-center py-4">{t('loadingEllipsis')}</p>
                            ) : filtered.length === 0 ? (
                                <p className="text-xs text-zinc-600 text-center py-4">{t('noLanguagesMatchDesc')}</p>
                            ) : (
                                filtered.map((l) => {
                                    const isSelected = selectedCodes.has(l.code);
                                    return (
                                        <button
                                            key={l.code}
                                            onClick={() => toggle(l.code, l.name)}
                                            className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors',
                                                isSelected ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-900')}
                                        >
                                            <span>{l.name} <span className="text-zinc-600 text-xs">{[OPEN_PAREN, l.native_name, CLOSE_PAREN].join('')}</span></span>
                                            {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {currentLanguages.filter((l) => !selectedCodes.has(l.code) && (contributionCountByLanguage[l.code] ?? 0) > 0).length > 0 && (
                        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 space-y-1">
                            {currentLanguages.filter((l) => !selectedCodes.has(l.code) && (contributionCountByLanguage[l.code] ?? 0) > 0).map((l) => (
                                <p key={l.code}>
                                    {[contributionCountByLanguage[l.code], t('translationSExistInSuffix'), l.name, t('hiddenNotDeletedSuffixDesc')].join(' ')}
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 p-5 border-t border-zinc-800 flex-shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">{t('cancel')}</button>
                    <button onClick={handleSave} disabled={selected.length === 0}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40">{t('save')}</button>
                </div>
            </div>
        </div>
    );
}
