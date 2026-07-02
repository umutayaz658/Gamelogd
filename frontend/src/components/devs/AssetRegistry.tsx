'use client';

import { useState } from 'react';
import {
    Plus, ExternalLink, X, Image, Box, Music, Video, Code, FileText,
    Pencil, Trash2, Tag, Link2, StickyNote,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { Asset, AssetCategory } from './WorkspaceTypes';
import { cn } from '@/lib/utils';

const CATEGORY_META: Record<AssetCategory, { label: string; icon: React.ElementType; color: string }> = {
    '2d': { label: '2D Art', icon: Image, color: 'text-violet-400 bg-violet-500/10 border-violet-500/25' },
    '3d': { label: '3D Model', icon: Box, color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
    audio: { label: 'Audio', icon: Music, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
    video: { label: 'Video', icon: Video, color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
    code: { label: 'Code', icon: Code, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25' },
    other: { label: 'Other', icon: FileText, color: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
};

const CATEGORY_KEYS = Object.keys(CATEGORY_META) as AssetCategory[];

type FormState = {
    name: string;
    category: AssetCategory;
    link: string;
    tags: string;
    notes: string;
};

const EMPTY_FORM: FormState = { name: '', category: '2d', link: '', tags: '', notes: '' };

interface AssetFormModalProps {
    title: string;
    initial: FormState;
    onSubmit: (form: FormState) => void;
    onClose: () => void;
}

function AssetFormModal({ title, initial, onSubmit, onClose }: AssetFormModalProps) {
    const [form, setForm] = useState<FormState>(initial);
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="p-5 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Asset Name *</label>
                        <input
                            autoFocus
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Player Character Sprite Sheet"
                            required
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    {/* Category */}
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                            <Tag className="w-3 h-3" /> Category
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {CATEGORY_KEYS.map((cat) => {
                                const { label, color } = CATEGORY_META[cat];
                                return (
                                    <button key={cat} type="button" onClick={() => setForm((f) => ({ ...f, category: cat }))}
                                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                            form.category === cat ? color : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600')}>
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {/* Link */}
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                            <Link2 className="w-3 h-3" /> External Link (Drive, Dropbox, GitHub...) *
                        </label>
                        <input
                            value={form.link}
                            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                            placeholder="https://drive.google.com/file/..."
                            required
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    {/* Tags */}
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Tags (comma separated)</label>
                        <input
                            value={form.tags}
                            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                            placeholder="character, animation, idle"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    {/* Notes */}
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                            <StickyNote className="w-3 h-3" /> Notes
                        </label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Optional notes about this asset..."
                            rows={2}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none transition-all"
                        />
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold hover:bg-zinc-800 transition-all">
                            Cancel
                        </button>
                        <button type="submit" disabled={!form.name.trim() || !form.link.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20">
                            {title.includes('Edit') ? 'Save Changes' : 'Add Asset'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function AssetRegistry() {
    const { data, setAssets, logActivity } = useWorkspace();
    const { assets } = data;

    const [filterCat, setFilterCat] = useState<AssetCategory | 'all'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = assets.filter((a) => {
        const matchCat = filterCat === 'all' || a.category === filterCat;
        const matchSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase())
            || a.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchCat && matchSearch;
    });

    const handleAdd = (form: FormState) => {
        const newAsset: Asset = {
            id: `asset-${Date.now()}`,
            name: form.name.trim(),
            category: form.category,
            tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
            link: form.link.trim(),
            notes: form.notes.trim(),
            addedAt: 'just now',
            addedBy: 'You',
        };
        setAssets((prev) => [newAsset, ...prev]);
        logActivity('asset_added', `Asset "${newAsset.name}" added to registry.`, '📦');
        setShowAddModal(false);
    };

    const handleEdit = (form: FormState) => {
        if (!editingAsset) return;
        setAssets((prev) => prev.map((a) => a.id === editingAsset.id ? {
            ...a,
            name: form.name.trim(),
            category: form.category,
            tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
            link: form.link.trim(),
            notes: form.notes.trim(),
        } : a));
        setEditingAsset(null);
    };

    const handleDelete = (id: string) => {
        const asset = assets.find((a) => a.id === id);
        setAssets((prev) => prev.filter((a) => a.id !== id));
        if (asset) logActivity('asset_added', `Asset "${asset.name}" removed.`, '🗑️');
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Asset Registry</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{assets.length} asset{assets.length !== 1 ? 's' : ''} catalogued · External links, no storage costs</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
                >
                    <Plus className="w-4 h-4" /> Add Asset
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search assets..."
                    className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all w-48"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        onClick={() => setFilterCat('all')}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                            filterCat === 'all' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600')}
                    >
                        All ({assets.length})
                    </button>
                    {CATEGORY_KEYS.map((cat) => {
                        const { label, color } = CATEGORY_META[cat];
                        const count = assets.filter((a) => a.category === cat).length;
                        if (count === 0) return null;
                        return (
                            <button key={cat} onClick={() => setFilterCat(cat)}
                                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                    filterCat === cat ? color : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600')}>
                                {label} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 text-zinc-600">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No assets found. Add your first asset!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((asset) => {
                        const { label, icon: Icon, color } = CATEGORY_META[asset.category];
                        return (
                            <div key={asset.id}
                                className="group bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 space-y-3 transition-all hover:shadow-lg">
                                {/* Category badge */}
                                <div className="flex items-center justify-between">
                                    <span className={cn('flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border', color)}>
                                        <Icon className="w-3 h-3" /> {label}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => setEditingAsset(asset)}
                                            className="p-1.5 text-zinc-500 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-all">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(asset.id)}
                                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Name */}
                                <p className="text-sm font-bold text-white leading-snug">{asset.name}</p>

                                {/* Tags */}
                                {asset.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {asset.tags.map((tag) => (
                                            <span key={tag} className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Notes */}
                                {asset.notes && (
                                    <p className="text-xs text-zinc-600 line-clamp-2">{asset.notes}</p>
                                )}

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-[10px] text-zinc-600">Added {asset.addedAt} by @{asset.addedBy}</span>
                                    <a href={asset.link} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                                        Open <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <AssetFormModal
                    title="Add Asset"
                    initial={EMPTY_FORM}
                    onSubmit={handleAdd}
                    onClose={() => setShowAddModal(false)}
                />
            )}

            {/* Edit Modal */}
            {editingAsset && (
                <AssetFormModal
                    title="Edit Asset"
                    initial={{
                        name: editingAsset.name,
                        category: editingAsset.category,
                        link: editingAsset.link,
                        tags: editingAsset.tags.join(', '),
                        notes: editingAsset.notes,
                    }}
                    onSubmit={handleEdit}
                    onClose={() => setEditingAsset(null)}
                />
            )}
        </div>
    );
}
