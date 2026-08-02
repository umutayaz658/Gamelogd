'use client';

import { useEffect, useState } from 'react';
import { X, Upload, Download, Loader2, AlertCircle, FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import type { LocalisationFormat, LocalisationImportResult } from '@/types';
import type { ProjectLocale } from './WorkspaceTypes';
import { useTranslation } from '@/lib/useTranslation';

const MIDDLE_DOT = '·';

interface LocalisationTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    languages: ProjectLocale[];
    canViewPending: boolean;
    canImportKeys: boolean;
    canImportTranslations: boolean;
    /** The Devs board's current WorkspaceState version — passed through to the import endpoint
     * so a stale-board conflict surfaces as a clear 409 instead of silently clobbering a
     * concurrent Kanban/GDD/asset edit. `null` means the version is unknown (board GET failed
     * or hasn't resolved); in that case the field is omitted so the backend skips the check —
     * sending a made-up number like 0 would 409 against every real board. */
    baseVersion: number | null;
    onImported: () => void;
}

export default function LocalisationTransferModal({
    isOpen, onClose, projectId, languages, canViewPending, canImportKeys, canImportTranslations, baseVersion, onImported,
}: LocalisationTransferModalProps) {
    const { t } = useTranslation();
    const toast = useToast();
    const [tab, setTab] = useState<'export' | 'import'>('export');
    const [formats, setFormats] = useState<LocalisationFormat[]>([]);

    const [exportFmt, setExportFmt] = useState('flat_json');
    const [exportLanguage, setExportLanguage] = useState('all');
    const [scope, setScope] = useState<'approved' | 'approved_pending'>('approved');
    const [exporting, setExporting] = useState(false);

    const [importFmt, setImportFmt] = useState('flat_json');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importKeysFlag, setImportKeysFlag] = useState(canImportKeys);
    const [importTranslationsFlag, setImportTranslationsFlag] = useState(false);
    const [importLanguage, setImportLanguage] = useState(languages[0]?.code ?? '');
    const [preview, setPreview] = useState<LocalisationImportResult | null>(null);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        api.get('/localisation/formats/').then((res) => setFormats(res.data.formats ?? [])).catch(() => setFormats([]));
    }, [isOpen]);

    // `languages` and the permission props load asynchronously (catalog fetch) — the initial
    // useState snapshot can be empty/stale, so re-sync whenever they resolve. Pure state
    // adjustments, done synchronously during render rather than in an effect.
    // See https://react.dev/learn/you-might-not-need-an-effect
    const [prevLanguages, setPrevLanguages] = useState(languages);
    if (languages !== prevLanguages) {
        setPrevLanguages(languages);
        setImportLanguage((current) => {
            if (current && languages.some((l) => l.code === current)) return current;
            return languages[0]?.code ?? '';
        });
    }
    const [prevCanImportKeys, setPrevCanImportKeys] = useState(canImportKeys);
    if (canImportKeys !== prevCanImportKeys) {
        setPrevCanImportKeys(canImportKeys);
        setImportKeysFlag((current) => (canImportKeys ? current : false));
    }

    if (!isOpen) return null;

    const exportFormat = formats.find((f) => f.slug === exportFmt);
    const importFormat = formats.find((f) => f.slug === importFmt);

    const handleExport = () => {
        setExporting(true);
        const params = new URLSearchParams({ fmt: exportFmt, language: exportLanguage, scope });
        api.get(`/projects/${projectId}/localisation/export/?${params.toString()}`, { responseType: 'blob' })
            .then((res) => {
                const disposition: string = res.headers['content-disposition'] || '';
                const match = disposition.match(/filename="?([^"]+)"?/);
                const filename = match ? match[1] : `export.${exportFormat?.extension ?? 'txt'}`;
                const url = URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                // Firefox ignores click() on a detached anchor, and a synchronous revoke can
                // cancel the download before it starts.
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 1000);
            })
            .catch(() => toast.error('Failed to export.'))
            .finally(() => setExporting(false));
    };

    const runImport = (mode: 'preview' | 'commit') => {
        if (!importFile) return;
        setImporting(true);
        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('fmt', importFmt);
        formData.append('language', importLanguage);
        formData.append('mode', mode);
        formData.append('import_keys', String(importKeysFlag));
        formData.append('import_translations', String(importTranslationsFlag));
        if (baseVersion !== null) formData.append('base_version', String(baseVersion));
        // The shared axios instance defaults Content-Type to application/json, which would make
        // axios JSON-serialise the FormData and drop the file — override it so the browser sends
        // real multipart with the correct boundary.
        api.post(`/projects/${projectId}/localisation/import/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
            .then((res) => {
                if (mode === 'preview') {
                    setPreview(res.data);
                } else {
                    setPreview(null);
                    setImportFile(null);
                    toast.success(`Imported: ${res.data.keys_added} key(s) added, ${res.data.translations_created} translation(s) added.`);
                    onImported();
                }
            })
            .catch((err) => toast.error(err.response?.data?.error || 'Import failed.'))
            .finally(() => setImporting(false));
    };

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
                    <h2 className="text-lg font-bold text-white">{t('exportImport')}</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 m-5 mb-0 w-fit flex-shrink-0">
                    {(['export', 'import'] as const).map((tabId) => (
                        <button key={tabId} onClick={() => setTab(tabId)}
                            className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                                tab === tabId ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}>
                            {tabId}
                        </button>
                    ))}
                </div>

                {tab === 'export' ? (
                    <div className="p-5 space-y-4 overflow-y-auto">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('formatLabel')}</label>
                            <select value={exportFmt} onChange={(e) => setExportFmt(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none cursor-pointer" style={{ colorScheme: 'dark' }}>
                                {formats.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('languageLabel')}</label>
                            <select value={exportLanguage} onChange={(e) => setExportLanguage(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none cursor-pointer" style={{ colorScheme: 'dark' }}>
                                <option value="all">{[t('allLanguages'), exportFormat && !exportFormat.supports_multi_language ? t('asAZipSuffix') : ''].join('')}</option>
                                {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                            </select>
                        </div>
                        {canViewPending && (
                            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
                                <input type="checkbox" checked={scope === 'approved_pending'} onChange={(e) => setScope(e.target.checked ? 'approved_pending' : 'approved')} className="accent-blue-600" />
                                {t('includePendingSuggestionsDesc')}
                            </label>
                        )}
                        <button onClick={handleExport} disabled={exporting}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition-all">
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {t('exportAction')}
                        </button>
                    </div>
                ) : (
                    <div className="p-5 space-y-4 overflow-y-auto">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('formatLabel')}</label>
                            <select value={importFmt} onChange={(e) => { setImportFmt(e.target.value); setPreview(null); }}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none cursor-pointer" style={{ colorScheme: 'dark' }}>
                                {formats.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('fileLabel')}</label>
                            <input type="file" accept={importFormat ? `.${importFormat.extension},.zip` : undefined}
                                onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setPreview(null); }}
                                className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-zinc-300 file:text-xs file:font-semibold hover:file:bg-zinc-700" />
                        </div>
                        <div className="space-y-2">
                            <label className={cn('flex items-center gap-2 text-sm cursor-pointer select-none', !canImportKeys && 'opacity-40 cursor-not-allowed')}>
                                <input type="checkbox" checked={importKeysFlag} disabled={!canImportKeys}
                                    onChange={(e) => { setImportKeysFlag(e.target.checked); setPreview(null); }} className="accent-blue-600" />
                                {t('addUpdateKeysDesc')}
                            </label>
                            <label className={cn('flex items-center gap-2 text-sm cursor-pointer select-none', !canImportTranslations && 'opacity-40 cursor-not-allowed')}>
                                <input type="checkbox" checked={importTranslationsFlag} disabled={!canImportTranslations}
                                    onChange={(e) => { setImportTranslationsFlag(e.target.checked); setPreview(null); }} className="accent-blue-600" />
                                {t('importTranslationsAsApprovedDesc')}
                            </label>
                        </div>
                        {importTranslationsFlag && (
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">{t('translationLanguage')}</label>
                                <select value={importLanguage} onChange={(e) => { setImportLanguage(e.target.value); setPreview(null); }}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none cursor-pointer" style={{ colorScheme: 'dark' }}>
                                    {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                                </select>
                            </div>
                        )}

                        {preview && (
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 space-y-2 text-xs">
                                <p className="text-zinc-300">
                                    {[
                                        preview.keys_added, t('keySToAddSuffix'), MIDDLE_DOT,
                                        preview.keys_updated, t('toUpdateLower'), MIDDLE_DOT,
                                        preview.translations_created, t('translationSToAddSuffix'),
                                    ].join(' ')}
                                </p>
                                {preview.warnings.length > 0 && (
                                    <div className="text-amber-400 space-y-1">
                                        {preview.warnings.slice(0, 5).map((w, i) => (
                                            <p key={i} className="flex items-start gap-1.5"><AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />{w}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button onClick={() => runImport('preview')} disabled={!importFile || importing}
                                className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-300 py-2.5 rounded-xl font-bold text-sm transition-all">
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                                {t('previewAction')}
                            </button>
                            <button onClick={() => runImport('commit')} disabled={!importFile || !preview || importing}
                                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition-all">
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {t('commitAction')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
