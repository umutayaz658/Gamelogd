'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
    Plus, X, Search, Download, Upload, Check, ThumbsUp,
    Globe, BookOpen, ChevronDown, FileJson, AlertCircle,
    Trash2, Lock, Pencil, Sword,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { TranslationEntry, TranslationSuggestion, GlossaryTerm, SUPPORTED_LANGS, SOURCE_LANG } from './WorkspaceTypes';
import { cn } from '@/lib/utils';

const RPG_TEMPLATE: Omit<TranslationEntry, 'id'>[] = [
    { key: 'hud.health', namespace: 'hud', baseText: 'Health', approved: false, suggestions: {} },
    { key: 'hud.mana', namespace: 'hud', baseText: 'Mana', approved: false, suggestions: {} },
    { key: 'hud.stamina', namespace: 'hud', baseText: 'Stamina', approved: false, suggestions: {} },
    { key: 'menu.newGame', namespace: 'menu', baseText: 'New Game', approved: false, suggestions: {} },
    { key: 'menu.loadGame', namespace: 'menu', baseText: 'Load Game', approved: false, suggestions: {} },
    { key: 'menu.options', namespace: 'menu', baseText: 'Options', approved: false, suggestions: {} },
    { key: 'menu.quit', namespace: 'menu', baseText: 'Quit', approved: false, suggestions: {} },
    { key: 'status.levelUp', namespace: 'status', baseText: 'Level Up!', approved: false, suggestions: {} },
    { key: 'status.questCompleted', namespace: 'status', baseText: 'Quest Completed!', approved: false, suggestions: {} },
    { key: 'status.itemFound', namespace: 'status', baseText: 'Item Found!', approved: false, suggestions: {} },
];

const MENU_TEMPLATE: Omit<TranslationEntry, 'id'>[] = [
    { key: 'mainMenu.play', namespace: 'mainMenu', baseText: 'Play', approved: false, suggestions: {} },
    { key: 'mainMenu.settings', namespace: 'mainMenu', baseText: 'Settings', approved: false, suggestions: {} },
    { key: 'mainMenu.credits', namespace: 'mainMenu', baseText: 'Credits', approved: false, suggestions: {} },
    { key: 'mainMenu.exit', namespace: 'mainMenu', baseText: 'Exit', approved: false, suggestions: {} },
    { key: 'settings.audio', namespace: 'settings', baseText: 'Audio', approved: false, suggestions: {} },
    { key: 'settings.graphics', namespace: 'settings', baseText: 'Graphics', approved: false, suggestions: {} },
    { key: 'settings.controls', namespace: 'settings', baseText: 'Controls', approved: false, suggestions: {} },
    { key: 'settings.language', namespace: 'settings', baseText: 'Language', approved: false, suggestions: {} },
];

type LocalTab = 'keys' | 'glossary';

// ─── Shared helpers ─────────────────────────────────────────────────────────

function deriveNamespace(key: string): string {
    return key.includes('.') ? key.split('.')[0] : 'other';
}

function downloadBlob(content: string, mime: string, filename: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

// Minimal RFC4180-ish CSV parser — handles quoted fields containing commas/quotes/newlines.
function parseCSV(raw: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (inQuotes) {
            if (c === '"') {
                if (raw[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && raw[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
        } else field += c;
    }
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

type ParsedImportRow = { key: string; baseText: string; translations: Record<string, string> };

const BASE_TEXT_ALIASES = ['basetext', 'base', 'base_en', 'en', 'english', 'source'];

function parseImportJSON(raw: string): { rows: ParsedImportRow[]; warnings: string[] } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Invalid JSON file.');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('JSON file must be an object mapping keys to text or language objects.');
    }
    const rows: ParsedImportRow[] = [];
    const warnings: string[] = [];
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!key.trim()) { warnings.push('Skipped a row with an empty key.'); continue; }
        if (typeof value === 'string') {
            rows.push({ key, baseText: value, translations: {} });
            continue;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            let baseText = '';
            const translations: Record<string, string> = {};
            for (const [field, text] of Object.entries(value as Record<string, unknown>)) {
                if (typeof text !== 'string') continue;
                if (BASE_TEXT_ALIASES.includes(field.toLowerCase()) || field.toLowerCase() === SOURCE_LANG.toLowerCase()) {
                    baseText = text;
                    continue;
                }
                const lang = SUPPORTED_LANGS.find((l) => l.toLowerCase() === field.toLowerCase());
                if (lang) translations[lang] = text;
            }
            if (!baseText && Object.keys(translations).length === 0) {
                warnings.push(`Skipped "${key}": no base text or recognised language field found.`);
                continue;
            }
            rows.push({ key, baseText, translations });
            continue;
        }
        warnings.push(`Skipped "${key}": unsupported value type.`);
    }
    return { rows, warnings };
}

function parseImportCSV(raw: string): { rows: ParsedImportRow[]; warnings: string[] } {
    const table = parseCSV(raw).filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
    if (table.length === 0) throw new Error('CSV file is empty.');
    const header = table[0].map((h) => h.trim());
    const keyIdx = header.findIndex((h) => h.toLowerCase() === 'key');
    if (keyIdx === -1) throw new Error('CSV must have a "key" column.');
    const baseIdx = header.findIndex((h) => BASE_TEXT_ALIASES.includes(h.toLowerCase()) || h.toLowerCase() === SOURCE_LANG.toLowerCase());
    const langCols: { idx: number; lang: string }[] = [];
    header.forEach((h, idx) => {
        const lang = SUPPORTED_LANGS.find((l) => l.toLowerCase() === h.toLowerCase());
        if (lang) langCols.push({ idx, lang });
    });

    const rows: ParsedImportRow[] = [];
    const warnings: string[] = [];
    for (let i = 1; i < table.length; i++) {
        const cols = table[i];
        const key = (cols[keyIdx] ?? '').trim();
        if (!key) { warnings.push(`Row ${i + 1}: skipped, empty key.`); continue; }
        const baseText = baseIdx !== -1 ? (cols[baseIdx] ?? '').trim() : '';
        const translations: Record<string, string> = {};
        langCols.forEach(({ idx, lang }) => {
            const text = (cols[idx] ?? '').trim();
            if (text) translations[lang] = text;
        });
        rows.push({ key, baseText, translations });
    }
    return { rows, warnings };
}

function mergeImportedRows(existing: TranslationEntry[], rows: ParsedImportRow[]): { updated: TranslationEntry[]; addedCount: number; updatedCount: number } {
    const map = new Map(existing.map((e) => [e.key, { ...e }]));
    let addedCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
        const current = map.get(row.key);
        if (current) {
            let changed = false;
            if (row.baseText && row.baseText !== current.baseText) {
                current.baseText = row.baseText;
                changed = true;
            }
            const suggestions = { ...current.suggestions };
            for (const [lang, text] of Object.entries(row.translations)) {
                const existingForLang = suggestions[lang] ?? [];
                const alreadyApproved = existingForLang.some((s) => s.approved);
                if (!alreadyApproved) {
                    suggestions[lang] = [...existingForLang, {
                        id: `sg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        author: 'Import',
                        text,
                        votes: 0,
                        votedBy: [],
                        approved: false,
                    }];
                    changed = true;
                }
            }
            current.suggestions = suggestions;
            if (changed) updatedCount++;
            map.set(row.key, current);
        } else {
            const suggestions: Record<string, TranslationSuggestion[]> = {};
            for (const [lang, text] of Object.entries(row.translations)) {
                suggestions[lang] = [{
                    id: `sg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    author: 'Import',
                    text,
                    votes: 0,
                    votedBy: [],
                    approved: false,
                }];
            }
            map.set(row.key, {
                id: `lk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                key: row.key,
                namespace: deriveNamespace(row.key),
                baseText: row.baseText,
                approved: false,
                suggestions,
            });
            addedCount++;
        }
    }
    return { updated: Array.from(map.values()), addedCount, updatedCount };
}

// ─── Add Key modal ──────────────────────────────────────────────────────────

interface AddKeyModalProps {
    onClose: () => void;
    onSubmit: (key: string, base: string) => void;
}

function AddKeyModal({ onClose, onSubmit }: AddKeyModalProps) {
    const [key, setKey] = useState('');
    const [base, setBase] = useState('');
    const ns = key ? deriveNamespace(key) : '(none)';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-white">Add Translation Key</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (key.trim() && base.trim()) { onSubmit(key.trim(), base.trim()); onClose(); } }} className="p-5 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Programmatic Key *</label>
                        <input autoFocus value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. mainMenu.play or dialogue.merchant.greeting"
                            required className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all" />
                        {key && (
                            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
                                <BookOpen className="w-3 h-3" />
                                Namespace: <span className="text-blue-400 font-mono">{ns}</span>
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Base Text (Source Language) *</label>
                        <textarea value={base} onChange={(e) => setBase(e.target.value)} placeholder="e.g. Welcome traveller! What can I sell you?"
                            rows={3} required className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none transition-all" />
                        <p className="text-[11px] text-zinc-600 mt-1">Can be a single word, a full sentence, or even a multi-line dialogue string.</p>
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">Cancel</button>
                        <button type="submit" disabled={!key.trim() || !base.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40">Add Key</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Key row ────────────────────────────────────────────────────────────────

interface KeyRowProps {
    entry: TranslationEntry;
    activeLang: string;
    glossary: GlossaryTerm[];
    onUpdate: (updated: TranslationEntry) => void;
    onDelete: (id: string) => void;
    onCheckKeyAvailable: (key: string) => boolean;
}

function KeyRow({ entry, activeLang, glossary, onUpdate, onDelete, onCheckKeyAvailable }: KeyRowProps) {
    const { user } = useAuth();
    const { hasPermission } = useWorkspace();
    const currentUser = user?.username ?? 'Anonymous';

    const [expanded, setExpanded] = useState(false);
    const [newSuggestion, setNewSuggestion] = useState('');
    const [editing, setEditing] = useState(false);
    const [editKey, setEditKey] = useState(entry.key);
    const [editBase, setEditBase] = useState(entry.baseText);

    const suggestions = entry.suggestions[activeLang] ?? [];
    const approvedSuggestion = suggestions.find((s) => s.approved);
    const hasTranslation = suggestions.length > 0;

    const addSuggestion = () => {
        if (!newSuggestion.trim()) return;
        const sg: TranslationSuggestion = {
            id: `sg-${Date.now()}`,
            author: currentUser,
            text: newSuggestion.trim(),
            votes: 0,
            votedBy: [],
            approved: false,
        };
        const updatedSuggestions = { ...entry.suggestions, [activeLang]: [...suggestions, sg] };
        onUpdate({ ...entry, suggestions: updatedSuggestions });
        setNewSuggestion('');
    };

    const vote = (sgId: string) => {
        const updatedSuggestions = {
            ...entry.suggestions,
            [activeLang]: suggestions.map((s) => {
                if (s.id !== sgId) return s;
                const votedBy = s.votedBy ?? [];
                const hasVoted = votedBy.includes(currentUser);
                const nextVotedBy = hasVoted ? votedBy.filter((u) => u !== currentUser) : [...votedBy, currentUser];
                return { ...s, votedBy: nextVotedBy, votes: nextVotedBy.length };
            }),
        };
        onUpdate({ ...entry, suggestions: updatedSuggestions });
    };

    const approve = (sgId: string) => {
        const updatedSuggestions = {
            ...entry.suggestions,
            [activeLang]: suggestions.map((s) => ({ ...s, approved: s.id === sgId })),
        };
        onUpdate({ ...entry, suggestions: updatedSuggestions, approved: true });
    };

    const startEditing = () => {
        setEditKey(entry.key);
        setEditBase(entry.baseText);
        setEditing(true);
    };

    const keyConflict = editKey.trim() !== entry.key && !onCheckKeyAvailable(editKey.trim());

    const saveEdit = () => {
        const trimmedKey = editKey.trim();
        const trimmedBase = editBase.trim();
        if (!trimmedKey || !trimmedBase || keyConflict) return;
        onUpdate({ ...entry, key: trimmedKey, namespace: deriveNamespace(trimmedKey), baseText: trimmedBase });
        setEditing(false);
    };

    const cancelEdit = () => {
        setEditKey(entry.key);
        setEditBase(entry.baseText);
        setEditing(false);
    };

    // Glossary lock check
    const glossaryMatch = glossary.find((g) => entry.baseText.toLowerCase().includes(g.term.toLowerCase()));
    const lockedTranslation = glossaryMatch?.translations[activeLang];
    const suggestionMissesLock = !!(lockedTranslation && newSuggestion.trim() && !newSuggestion.toLowerCase().includes(lockedTranslation.toLowerCase()));

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Key Header row */}
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-zinc-800/30 transition-all">
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', hasTranslation ? (entry.approved ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-zinc-600')} />
                <code className="text-xs font-mono text-zinc-400 flex-shrink-0 w-48 truncate">{entry.key}</code>
                <p className="text-xs text-zinc-300 flex-1 truncate">{entry.baseText}</p>
                {approvedSuggestion && (
                    <span className="text-xs text-emerald-400 truncate max-w-[120px] flex-shrink-0">✓ {approvedSuggestion.text}</span>
                )}
                {!hasTranslation && <span className="text-[10px] text-zinc-600 flex-shrink-0">No translation</span>}
                <ChevronDown className={cn('w-4 h-4 text-zinc-600 flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
            </button>

            {/* Expanded translation editor */}
            {expanded && (
                <div className="border-t border-zinc-800 p-4 space-y-3 bg-zinc-900/20">
                    {editing ? (
                        <div className="space-y-2 bg-zinc-900 border border-zinc-700 rounded-xl p-3">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Key</label>
                                <input value={editKey} onChange={(e) => setEditKey(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500 transition-all" />
                                {keyConflict && <p className="text-[11px] text-red-400 mt-1">Key already exists.</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Base Text</label>
                                <textarea value={editBase} onChange={(e) => setEditBase(e.target.value)} rows={2}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs resize-none focus:outline-none focus:border-blue-500 transition-all" />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-all">Cancel</button>
                                <button onClick={saveEdit} disabled={!editKey.trim() || !editBase.trim() || keyConflict}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-40">Save</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-500">Base: <span className="text-zinc-300">&quot;{entry.baseText}&quot;</span></p>
                            {glossaryMatch && lockedTranslation && (
                                <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                                    <Lock className="w-2.5 h-2.5" /> Glossary: &quot;{lockedTranslation}&quot;
                                </span>
                            )}
                            <button onClick={startEditing} className="text-zinc-600 hover:text-blue-400 p-1 rounded-lg hover:bg-blue-500/10 transition-all">
                                <Pencil className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Suggestions list */}
                    {suggestions.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold">Community Suggestions</p>
                            {[...suggestions].sort((a, b) => (b.votedBy?.length ?? b.votes ?? 0) - (a.votedBy?.length ?? a.votes ?? 0)).map((sg) => {
                                const votedBy = sg.votedBy ?? [];
                                const iLiked = votedBy.includes(currentUser);
                                const displayVotes = sg.votedBy ? votedBy.length : sg.votes;
                                const missesLock = !!(lockedTranslation && !sg.text.toLowerCase().includes(lockedTranslation.toLowerCase()));
                                return (
                                    <div key={sg.id} className={cn('flex items-center gap-3 p-2.5 rounded-lg border transition-all',
                                        sg.approved ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900 border-zinc-800')}>
                                        {missesLock && (
                                            <span title={`Missing glossary term: "${lockedTranslation}"`}>
                                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                            </span>
                                        )}
                                        <p className="flex-1 text-sm text-zinc-200">{sg.text}</p>
                                        <span className="text-[11px] text-zinc-500">@{sg.author}</span>
                                        <button onClick={() => vote(sg.id)}
                                            className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors',
                                                iLiked ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10')}>
                                            <ThumbsUp className={cn('w-3 h-3', iLiked && 'fill-blue-400')} /> {displayVotes}
                                        </button>
                                        {sg.approved
                                            ? <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Approved</span>
                                            : hasPermission('localisation.suggestion.approve') && (
                                                <button onClick={() => approve(sg.id)}
                                                    className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-bold transition-all">
                                                    Approve
                                                </button>
                                              )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Add suggestion */}
                    <div className="space-y-1.5">
                        <div className="flex gap-2">
                            <input
                                value={newSuggestion}
                                onChange={(e) => setNewSuggestion(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') addSuggestion(); }}
                                placeholder={lockedTranslation ? `Glossary locks: "${lockedTranslation}"` : `Suggest ${activeLang} translation...`}
                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                            />
                            <button onClick={addSuggestion} disabled={!newSuggestion.trim()}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-xl font-bold transition-all disabled:opacity-40">
                                Suggest
                            </button>
                        </div>
                        {suggestionMissesLock && (
                            <p className="flex items-center gap-1.5 text-[11px] text-amber-400">
                                <AlertCircle className="w-3 h-3" />
                                This suggestion doesn&apos;t include the locked glossary translation &quot;{lockedTranslation}&quot;.
                            </p>
                        )}
                    </div>

                    {hasPermission('localisation.key.delete') && (
                        <div className="flex justify-end">
                            <button onClick={() => onDelete(entry.id)} className="text-[11px] text-zinc-700 hover:text-red-400 flex items-center gap-1 transition-colors">
                                <Trash2 className="w-3 h-3" /> Delete Key
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function LocalisationManager() {
    const { data, setTranslationKeys, setGlossary, logActivity, hasPermission } = useWorkspace();
    const { translationKeys, glossary } = data;

    const [tab, setTab] = useState<LocalTab>('keys');
    const [activeLang, setActiveLang] = useState(SUPPORTED_LANGS[0]);
    const [filterNs, setFilterNs] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'missing'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddKey, setShowAddKey] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importWarnings, setImportWarnings] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [exportAllLangs, setExportAllLangs] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Glossary form
    const [newGlossTerm, setNewGlossTerm] = useState('');
    const [newGlossTranslation, setNewGlossTranslation] = useState('');

    // Namespace list
    const namespaces = useMemo(() => {
        const ns = new Set(translationKeys.map((k) => k.namespace));
        return ['all', ...Array.from(ns)];
    }, [translationKeys]);

    const filtered = translationKeys.filter((k) => {
        if (filterNs !== 'all' && k.namespace !== filterNs) return false;
        if (filterStatus === 'approved' && !k.approved) return false;
        if (filterStatus === 'missing') {
            const sug = k.suggestions[activeLang];
            if (sug && sug.some((s) => s.approved)) return false;
        }
        if (searchQuery && !k.key.toLowerCase().includes(searchQuery.toLowerCase()) && !k.baseText.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const missingCount = translationKeys.filter((k) => {
        const sug = k.suggestions[activeLang];
        return !sug || !sug.some((s) => s.approved);
    }).length;

    const isKeyAvailable = (key: string) => !translationKeys.some((k) => k.key === key);

    const handleAddKey = (key: string, base: string) => {
        const entry: TranslationEntry = {
            id: `lk-${Date.now()}`,
            key,
            namespace: deriveNamespace(key),
            baseText: base,
            approved: false,
            suggestions: {},
        };
        setTranslationKeys((prev) => [...prev, entry]);
        logActivity('translation_approved', `Translation key "${key}" added.`, '🌍');
    };

    const handleUpdateKey = (updated: TranslationEntry) => {
        const previous = translationKeys.find((k) => k.id === updated.id);
        if (previous && filterNs !== 'all' && previous.namespace === filterNs && updated.namespace !== filterNs) {
            setFilterNs(updated.namespace);
        }
        setTranslationKeys((prev) => prev.map((k) => k.id === updated.id ? updated : k));
        if (updated.approved) logActivity('translation_approved', `Translation key "${updated.key}" approved.`, '✅');
    };

    const handleDeleteKey = (id: string) => {
        setTranslationKeys((prev) => prev.filter((k) => k.id !== id));
    };

    const importTemplate = (template: Omit<TranslationEntry, 'id'>[]) => {
        const newKeys = template
            .filter((t) => !translationKeys.some((k) => k.key === t.key))
            .map((t) => ({ ...t, id: `lk-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
        setTranslationKeys((prev) => [...prev, ...newKeys]);
        logActivity('translation_approved', `${newKeys.length} keys imported from template.`, '📥');
        setFilterNs('all');
        setShowImport(false);
    };

    const handleFile = async (file: File) => {
        setImportError(null);
        setImportWarnings([]);
        if (file.size > 5 * 1024 * 1024) {
            setImportError('File is too large (max 5MB).');
            return;
        }
        const lowerName = file.name.toLowerCase();
        const isJson = lowerName.endsWith('.json');
        const isCsv = lowerName.endsWith('.csv');
        if (!isJson && !isCsv) {
            setImportError('Please upload a .json or .csv file.');
            return;
        }
        try {
            const raw = await file.text();
            const { rows, warnings } = isJson ? parseImportJSON(raw) : parseImportCSV(raw);
            const { updated, addedCount, updatedCount } = mergeImportedRows(translationKeys, rows);
            setTranslationKeys(updated);
            logActivity('translation_approved', `Import: ${addedCount} keys added, ${updatedCount} keys updated.`, '📥');
            setFilterNs('all');
            if (warnings.length) setImportWarnings(warnings);
            else setShowImport(false);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Failed to import file.');
        }
    };

    const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    };

    const exportJSON = () => {
        if (exportAllLangs) {
            const result: Record<string, Record<string, string>> = {};
            translationKeys.forEach((k) => {
                const row: Record<string, string> = { [SOURCE_LANG]: k.baseText };
                SUPPORTED_LANGS.forEach((lang) => {
                    const approved = k.suggestions[lang]?.find((s) => s.approved);
                    if (approved) row[lang] = approved.text;
                });
                result[k.key] = row;
            });
            downloadBlob(JSON.stringify(result, null, 2), 'application/json', 'localisation_all.json');
            return;
        }
        const result: Record<string, string> = {};
        translationKeys.forEach((k) => {
            const sug = k.suggestions[activeLang];
            const approved = sug?.find((s) => s.approved);
            result[k.key] = approved?.text ?? k.baseText;
        });
        downloadBlob(JSON.stringify(result, null, 2), 'application/json', `localisation_${activeLang.toLowerCase()}.json`);
    };

    const exportCSV = () => {
        if (exportAllLangs) {
            const header = ['key', SOURCE_LANG, ...SUPPORTED_LANGS].map(csvEscape).join(',');
            const rows = translationKeys.map((k) => {
                const cells = [k.key, k.baseText, ...SUPPORTED_LANGS.map((lang) => k.suggestions[lang]?.find((s) => s.approved)?.text ?? '')];
                return cells.map(csvEscape).join(',');
            });
            downloadBlob([header, ...rows].join('\n'), 'text/csv', 'localisation_all.csv');
            return;
        }
        const header = ['key', SOURCE_LANG, activeLang].map(csvEscape).join(',');
        const rows = translationKeys.map((k) => {
            const sug = k.suggestions[activeLang]?.find((s) => s.approved);
            return [k.key, k.baseText, sug?.text ?? ''].map(csvEscape).join(',');
        });
        downloadBlob([header, ...rows].join('\n'), 'text/csv', `localisation_${activeLang.toLowerCase()}.csv`);
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

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white">Localisation Manager</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        {translationKeys.length} keys · {missingCount} missing in {activeLang} ·
                        <span className="text-xs text-zinc-600 ml-1">Key-value pairs, not word-by-word translation</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowImport(true)}
                        className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-sm font-semibold transition-all">
                        <Upload className="w-4 h-4" /> Import
                    </button>
                    <button onClick={() => setShowAddKey(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20">
                        <Plus className="w-4 h-4" /> Add Key
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
                {(['keys', 'glossary'] as LocalTab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                            tab === t ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}>
                        {t === 'keys' ? 'Translation Keys' : `Glossary (${glossary.length})`}
                    </button>
                ))}
            </div>

            {tab === 'keys' && (
                <div className="flex gap-5 min-h-[500px]">
                    {/* Namespace sidebar */}
                    <aside className="w-44 flex-shrink-0 space-y-1">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold px-2 mb-2">Namespaces</p>
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
                                <select value={activeLang} onChange={(e) => setActiveLang(e.target.value)}
                                    className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                                    style={{ colorScheme: 'dark' }}>
                                    {SUPPORTED_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
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

                            {/* Export */}
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer select-none">
                                    <input type="checkbox" checked={exportAllLangs} onChange={(e) => setExportAllLangs(e.target.checked)}
                                        className="accent-blue-600" />
                                    All languages
                                </label>
                                <div className="flex gap-1.5">
                                    <button onClick={exportJSON}
                                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white transition-all">
                                        <FileJson className="w-3.5 h-3.5" /> JSON
                                    </button>
                                    <button onClick={exportCSV}
                                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white transition-all">
                                        <Download className="w-3.5 h-3.5" /> CSV
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Key list */}
                        {filtered.length === 0 ? (
                            translationKeys.length === 0 ? (
                                <div className="text-center py-16 text-zinc-600">
                                    <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm mb-3">No translation keys yet.</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => setShowAddKey(true)} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">Add your first key</button>
                                        <span className="text-zinc-700">·</span>
                                        <button onClick={() => setShowImport(true)} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">Import keys</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-16 text-zinc-600">
                                    <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm mb-2">No keys match the current filters.</p>
                                    <button onClick={() => { setFilterNs('all'); setFilterStatus('all'); setSearchQuery(''); }}
                                        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">Clear filters</button>
                                </div>
                            )
                        ) : (
                            <div className="space-y-1.5">
                                {filtered.map((entry) => (
                                    <KeyRow
                                        key={entry.id}
                                        entry={entry}
                                        activeLang={activeLang}
                                        glossary={glossary}
                                        onUpdate={handleUpdateKey}
                                        onDelete={handleDeleteKey}
                                        onCheckKeyAvailable={isKeyAvailable}
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
                        Lock specific terms (character names, magic spell names, etc.) to ensure consistent translations across all contributors.
                    </p>

                    {/* Add glossary term */}
                    {hasPermission('localisation.glossary.manage') && (
                        <div className="flex gap-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                            <div className="flex-1 space-y-2">
                                <input value={newGlossTerm} onChange={(e) => setNewGlossTerm(e.target.value)}
                                    placeholder="Term (e.g. Fireball)"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all" />
                                <div className="flex gap-2 items-center">
                                    <select value={activeLang} onChange={(e) => setActiveLang(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-2 text-white text-sm focus:outline-none cursor-pointer"
                                        style={{ colorScheme: 'dark' }}>
                                        {SUPPORTED_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                    <input value={newGlossTranslation} onChange={(e) => setNewGlossTranslation(e.target.value)}
                                        placeholder={`${activeLang} translation (optional)`}
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
                                            <span className="text-zinc-500">{lang}: </span>{tr}
                                        </span>
                                    ))}
                                </div>
                                {hasPermission('localisation.glossary.manage') && (
                                    <button onClick={() => setGlossary((prev) => prev.filter((g) => g.id !== term.id))}
                                        className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all flex-shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {glossary.length === 0 && (
                            <p className="text-sm text-zinc-700 text-center py-8">No glossary terms yet.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Add Key Modal */}
            {showAddKey && <AddKeyModal onClose={() => setShowAddKey(false)} onSubmit={handleAddKey} />}

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowImport(false); }}>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Upload className="w-4 h-4 text-blue-400" /> Import Keys</h2>
                            <button onClick={() => setShowImport(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-zinc-400">Import a template to quickly populate common localisation keys:</p>
                            <div className="space-y-2">
                                <button onClick={() => importTemplate(RPG_TEMPLATE)}
                                    className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-left p-4 rounded-xl transition-all">
                                    <Sword className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-white">RPG Template</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">Health, Mana, quests, level-up, item found...</p>
                                    </div>
                                    <Plus className="w-4 h-4 text-zinc-600 ml-auto" />
                                </button>
                                <button onClick={() => importTemplate(MENU_TEMPLATE)}
                                    className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-left p-4 rounded-xl transition-all">
                                    <BookOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-white">Menu / Settings Template</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">Main menu, options, audio, graphics, language...</p>
                                    </div>
                                    <Plus className="w-4 h-4 text-zinc-600 ml-auto" />
                                </button>
                            </div>
                            <div className="border-t border-zinc-800 pt-4">
                                <p className="text-xs text-zinc-600 mb-2">Or import a JSON or CSV file:</p>
                                <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={handleFileSelected} className="hidden" />
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setIsDragging(false);
                                        const f = e.dataTransfer.files[0];
                                        if (f) handleFile(f);
                                    }}
                                    className={cn('border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                                        isDragging ? 'border-blue-500 bg-blue-500/5 text-blue-400' : 'border-zinc-700 text-zinc-600 hover:border-zinc-600')}>
                                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs">Drag a JSON or CSV file here, or click to browse</p>
                                </div>
                                {importError && (
                                    <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{importError}</p>
                                )}
                                {importWarnings.length > 0 && (
                                    <div className="mt-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 space-y-1">
                                        {importWarnings.map((w, i) => <p key={i}>{w}</p>)}
                                        <button onClick={() => setShowImport(false)} className="text-[11px] font-bold underline">Done</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
