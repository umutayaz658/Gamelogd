'use client';

import { useState } from 'react';
import { X, Tag, Edit3, Trash2, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CategoryItem {
    id: string;
    label: string;
    emoji: string;
    color: string;
    bg: string;
}

export const COLOR_PRESETS = [
    { name: 'Blue', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { name: 'Violet', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
    { name: 'Amber', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { name: 'Pink', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
    { name: 'Emerald', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { name: 'Cyan', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { name: 'Zinc', color: 'text-zinc-400', bg: 'bg-zinc-700/20 border-zinc-700/30' },
    { name: 'Red', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    { name: 'Orange', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
];

interface CategoryManagerProps<T extends CategoryItem> {
    title: string;
    categories: T[];
    onSave: (categories: T[]) => void;
    onClose: () => void;
    /** Called (before onSave) when a category is deleted, so the caller can reassign whatever
     * items reference it (docs/assets/tasks) to the fallback category's id. */
    onDeleteReassign?: (deletedId: string, fallbackId: string) => void;
    minCount?: number;
}

/** Shared add/edit/delete UI for the three near-identical category systems in the Devs workspace
 * (Kanban task categories, GDD sections, Asset categories) — all use the same {id,label,emoji,
 * color,bg} shape. Opened either standalone (Workspace Settings) or from within another modal's
 * "Manage" link (GDDHub/AssetRegistry/KanbanBoard's creation dialogs). */
export default function CategoryManager<T extends CategoryItem>({
    title, categories, onSave, onClose, onDeleteReassign, minCount = 1,
}: CategoryManagerProps<T>) {
    const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
    const [catName, setCatName] = useState('');
    const [catEmoji, setCatEmoji] = useState('');
    const [catColorIdx, setCatColorIdx] = useState(0);
    const [editingCatId, setEditingCatId] = useState<string | null>(null);

    const startAdd = () => {
        setCatName('');
        setCatEmoji('📌');
        setCatColorIdx(0);
        setEditingCatId(null);
        setView('add');
    };

    const startEdit = (cat: T) => {
        setEditingCatId(cat.id);
        setCatName(cat.label);
        setCatEmoji(cat.emoji);
        const presetIdx = COLOR_PRESETS.findIndex((p) => p.color === cat.color);
        setCatColorIdx(presetIdx >= 0 ? presetIdx : 0);
        setView('edit');
    };

    const handleSave = () => {
        if (!catName.trim()) return;
        const preset = COLOR_PRESETS[catColorIdx];
        const newCat = {
            id: editingCatId || `cat-${Date.now()}`,
            label: catName.trim(),
            emoji: catEmoji || '📌',
            color: preset.color,
            bg: preset.bg,
        } as T;

        if (editingCatId) {
            onSave(categories.map((c) => (c.id === editingCatId ? newCat : c)));
        } else {
            onSave([...categories, newCat]);
        }
        setView('list');
    };

    const handleDelete = (catId: string) => {
        if (categories.length <= minCount) return;
        const fallback = categories.find((c) => c.id !== catId);
        const fallbackId = fallback?.id ?? 'other';
        onDeleteReassign?.(catId, fallbackId);
        onSave(categories.filter((c) => c.id !== catId));
    };

    return (
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {view === 'list' && (
                    <>
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Settings className="w-4 h-4 text-zinc-400" /> {title}
                            </h2>
                            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin-dark">
                                {categories.map((cat) => (
                                    <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 group">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{cat.emoji}</span>
                                            <span className={cn('text-xs font-semibold', cat.color)}>{cat.label}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => startEdit(cat)}
                                                className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
                                                title="Edit category"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(cat.id)}
                                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none"
                                                title="Delete category"
                                                disabled={categories.length <= minCount}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={startAdd}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-xs font-semibold transition-all"
                            >
                                <Plus className="w-4 h-4" /> Add Category
                            </button>
                        </div>
                    </>
                )}

                {(view === 'add' || view === 'edit') && (
                    <>
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Tag className="w-4 h-4 text-blue-400" /> {view === 'add' ? 'Add Category' : 'Edit Category'}
                            </h2>
                            <button onClick={() => setView('list')} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-5 space-y-4">
                            <div className="flex gap-3">
                                <div className="w-16">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Emoji</label>
                                    <input
                                        value={catEmoji}
                                        onChange={(e) => setCatEmoji(e.target.value)}
                                        placeholder="📌"
                                        maxLength={2}
                                        className="w-full text-center bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-2.5 text-xl focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Category Name *</label>
                                    <input
                                        autoFocus
                                        value={catName}
                                        onChange={(e) => setCatName(e.target.value)}
                                        placeholder="e.g. Combat"
                                        required
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Color Theme</label>
                                <div className="flex flex-wrap gap-2.5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
                                    {COLOR_PRESETS.map((preset, idx) => (
                                        <button
                                            key={preset.name}
                                            type="button"
                                            onClick={() => setCatColorIdx(idx)}
                                            className={cn(
                                                'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95',
                                                preset.bg,
                                                catColorIdx === idx ? 'border-white scale-110' : 'border-transparent',
                                            )}
                                            title={preset.name}
                                        >
                                            <span className={cn('w-3.5 h-3.5 rounded-full bg-current', preset.color)} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setView('list')}
                                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!catName.trim()}
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40"
                                >
                                    {view === 'add' ? 'Add Category' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
