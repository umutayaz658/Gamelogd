'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Plus, ExternalLink, X, Pencil, Trash2, Tag, Link2, StickyNote, ChevronDown, Check, FileText
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { Asset, AssetCategoryItem, DEFAULT_ASSET_CATEGORIES } from './WorkspaceTypes';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import ConfirmDeleteModal from './ConfirmDeleteModal';

const COLOR_PRESETS = [
    { name: 'Blue',     color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
    { name: 'Violet',   color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
    { name: 'Amber',    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
    { name: 'Pink',     color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20' },
    { name: 'Emerald',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { name: 'Cyan',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { name: 'Zinc',     color: 'text-zinc-400',    bg: 'bg-zinc-700/20 border-zinc-700/30' },
    { name: 'Red',      color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
    { name: 'Orange',   color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
];

const getTextColorOnly = (colorStr: string) => {
    if (!colorStr) return '';
    return colorStr.split(' ').filter(c => c.startsWith('text-')).join(' ');
};

const getCategoryBg = (cat: AssetCategoryItem) => {
    if (cat.bg) return cat.bg;
    const parts = (cat.color || '').split(' ');
    const bgPart = parts.find(c => c.startsWith('bg-'));
    const borderPart = parts.find(c => c.startsWith('border-'));
    if (bgPart && borderPart) {
        return `${bgPart} ${borderPart}`;
    }
    const textClr = getTextColorOnly(cat.color);
    const colorName = textClr.replace('text-', '').replace('-400', '');
    if (colorName && colorName !== 'zinc') {
        return `bg-${colorName}-500/10 border-${colorName}-500/20`;
    }
    return 'bg-zinc-700/20 border-zinc-700/30';
};

type FormState = {
    name: string;
    category: string;
    link: string;
    tags: string;
    notes: string;
};

interface AssetFormModalProps {
    title: string;
    initial: FormState;
    categories: AssetCategoryItem[];
    onSubmit: (form: FormState) => void;
    onClose: () => void;
    onManageCategories: () => void;
}

function AssetFormModal({ title, initial, categories, onSubmit, onClose, onManageCategories }: AssetFormModalProps) {
    const [form, setForm] = useState<FormState>(initial);

    // Auto update selected category if active category is deleted
    useEffect(() => {
        if (categories.length > 0 && !categories.some(c => c.id === form.category)) {
            setForm(f => ({ ...f, category: categories[0].id }));
        }
    }, [categories, form.category]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
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
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-605 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    {/* Category with Customize link */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Tag className="w-3 h-3" /> Category
                            </label>
                            <button
                                type="button"
                                onClick={onManageCategories}
                                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                            >
                                <ChevronDown className="w-3 h-3 inline rotate-185" /> Customize
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 scrollbar-thin-dark">
                            {categories.map((cat) => (
                                <button key={cat.id} type="button" onClick={() => setForm((f) => ({ ...f, category: cat.id }))}
                                    className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5',
                                        form.category === cat.id ? `${getTextColorOnly(cat.color)} ${getCategoryBg(cat)}` : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600')}>
                                    <span>{cat.emoji || '📌'}</span>
                                    <span>{cat.label}</span>
                                </button>
                            ))}
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
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-605 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    {/* Tags */}
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Tags (comma separated)</label>
                        <input
                            value={form.tags}
                            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                            placeholder="character, animation, idle"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-605 focus:outline-none focus:border-blue-500 transition-all"
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
                            rows={3}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-650 focus:outline-none focus:border-blue-500 resize-none transition-all"
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

interface CategoryManagerModalProps {
    categories: AssetCategoryItem[];
    onSave: (categories: AssetCategoryItem[]) => void;
    onClose: () => void;
}

function CategoryManagerModal({ categories: initialCategories, onSave, onClose }: CategoryManagerModalProps) {
    const [cats, setCats] = useState<AssetCategoryItem[]>(initialCategories);
    const [view, setView] = useState<'manage' | 'add_category' | 'edit_category'>('manage');
    
    // Subform states
    const [catName, setCatName] = useState('');
    const [catEmoji, setCatEmoji] = useState('📌');
    const [catColorIdx, setCatColorIdx] = useState(0);
    const [editingCatId, setEditingCatId] = useState<string | null>(null);

    const handleOpenAdd = () => {
        setCatName('');
        setCatEmoji('📌');
        setCatColorIdx(0);
        setEditingCatId(null);
        setView('add_category');
    };

    const handleOpenEdit = (cat: AssetCategoryItem) => {
        setCatName(cat.label);
        setCatEmoji(cat.emoji || '📌');
        
        const idx = COLOR_PRESETS.findIndex(p => p.color === cat.color);
        setCatColorIdx(idx >= 0 ? idx : 0);
        
        setEditingCatId(cat.id);
        setView('edit_category');
    };

    const handleSaveCategory = () => {
        if (!catName.trim()) return;
        const colorPreset = COLOR_PRESETS[catColorIdx] || COLOR_PRESETS[0];
        
        if (view === 'add_category') {
            const newCat: AssetCategoryItem = {
                id: `cat-${Date.now()}`,
                label: catName.trim(),
                color: colorPreset.color,
                bg: colorPreset.bg,
                emoji: catEmoji.trim() || '📌',
            };
            setCats([...cats, newCat]);
        } else if (view === 'edit_category' && editingCatId) {
            setCats(cats.map(c => c.id === editingCatId ? {
                ...c,
                label: catName.trim(),
                color: colorPreset.color,
                bg: colorPreset.bg,
                emoji: catEmoji.trim() || '📌',
            } : c));
        }
        setView('manage');
    };

    const handleDeleteCategory = (id: string) => {
        if (cats.length <= 1) return;
        setCats(cats.filter(c => c.id !== id));
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
             onClick={(e) => { if (e.target === e.currentTarget && view === 'manage') onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]">
                
                {/* ── Manage Categories View ── */}
                {view === 'manage' && (
                    <>
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
                            <h2 className="text-lg font-bold text-white">Customize Categories</h2>
                            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 scrollbar-thin-dark">
                            <div className="space-y-2">
                                {cats.map((cat) => (
                                    <div key={cat.id} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-805 rounded-xl p-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{cat.emoji || '📌'}</span>
                                            <span className={cn("text-sm font-bold", getTextColorOnly(cat.color))}>{cat.label}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(cat)}
                                                className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                                                title="Edit category"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                                title="Delete category"
                                                disabled={cats.length <= 1}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <button
                                type="button"
                                onClick={handleOpenAdd}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-xs font-semibold transition-all cursor-pointer"
                            >
                                <Plus className="w-4 h-4" /> Add Custom Category
                            </button>
                        </div>
                        
                        <div className="p-5 border-t border-zinc-800 flex gap-3 flex-shrink-0">
                            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold hover:bg-zinc-800 transition-all">
                                Cancel
                            </button>
                            <button onClick={() => { onSave(cats); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-900/20">
                                Save Changes
                            </button>
                        </div>
                    </>
                )}

                {/* ── Add / Edit Category Subform ── */}
                {(view === 'add_category' || view === 'edit_category') && (
                    <>
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Tag className="w-4 h-4 text-blue-400" /> {view === 'add_category' ? 'Add Category' : 'Edit Category'}
                            </h2>
                            <button onClick={() => setView('manage')} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <form onSubmit={(e) => { e.preventDefault(); handleSaveCategory(); }} className="p-5 space-y-4 flex-1 overflow-y-auto">
                            <div className="flex gap-3">
                                <div className="w-16">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Emoji</label>
                                    <input
                                        value={catEmoji}
                                        onChange={(e) => setCatEmoji(e.target.value)}
                                        placeholder="📌"
                                        maxLength={2}
                                        className="w-full text-center bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-2.5 text-xl focus:outline-none focus:border-blue-500 transition-all text-white"
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
                                                'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer',
                                                preset.bg,
                                                catColorIdx === idx ? 'border-white scale-110' : 'border-transparent'
                                            )}
                                            title={preset.name}
                                        >
                                            <span className={cn('w-3.5 h-3.5 rounded-full bg-current', preset.color)} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pt-4 border-t border-zinc-850">
                                <button
                                    type="button"
                                    onClick={() => setView('manage')}
                                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!catName.trim()}
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40"
                                >
                                    {view === 'add_category' ? 'Add Category' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

interface AssetDetailModalProps {
    asset: Asset;
    category?: AssetCategoryItem;
    onClose: () => void;
}

function AssetDetailModal({ asset, category, onClose }: AssetDetailModalProps) {
    const catColor = category ? `${getTextColorOnly(category.color)} ${getCategoryBg(category)}` : 'text-zinc-400 bg-zinc-850 border-zinc-800';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
             onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
                 onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-905 transition-all cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>
                
                <div className="space-y-6">
                    {/* Category and Title */}
                    <div className="space-y-2">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border", catColor)}>
                            <span>{category?.emoji || '📌'}</span>
                            <span>{category?.label || 'Uncategorized'}</span>
                        </span>
                        <h2 className="text-xl font-extrabold text-white leading-snug break-words pr-6">{asset.name}</h2>
                    </div>

                    {/* External Link */}
                    <div className="bg-zinc-900/60 border border-zinc-800/85 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <Link2 className="w-4 h-4 text-zinc-550 flex-shrink-0" />
                            <span className="text-xs text-zinc-405 truncate">{asset.link}</span>
                        </div>
                        <a
                            href={asset.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all flex-shrink-0"
                        >
                            Open Link <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    {/* Tags */}
                    {asset.tags.length > 0 && (
                        <div className="space-y-1.5">
                            <h3 className="text-xs font-bold text-zinc-550 uppercase tracking-wider">Tags</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {asset.tags.map((tag) => (
                                    <span key={tag} className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-1 rounded-full font-medium">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <h3 className="text-xs font-bold text-zinc-550 uppercase tracking-wider">Notes & Description</h3>
                        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 min-h-[100px] overflow-y-auto max-h-[250px] scrollbar-thin-dark">
                            {asset.notes ? (
                                <p className="text-sm text-zinc-350 whitespace-pre-wrap leading-relaxed">{asset.notes}</p>
                            ) : (
                                <p className="text-xs text-zinc-600 italic">No notes provided for this asset.</p>
                            )}
                        </div>
                    </div>

                    {/* Meta info */}
                    <div className="border-t border-zinc-850 pt-4 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>Added {asset.addedAt}</span>
                        <span>By @{asset.addedBy}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AssetRegistry() {
    const { user } = useAuth();
    const {
        data, setAssets, logActivity, activeWorkspace, activeBoard, setActiveBoard, setAssetCategories
    } = useWorkspace();
    const { assets } = data;

    const categories = useMemo(() => data.assetCategories ?? DEFAULT_ASSET_CATEGORIES, [data.assetCategories]);

    const [filterCat, setFilterCat] = useState<string | 'all'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [showBoardDropdown, setShowBoardDropdown] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [selectedDetailAsset, setSelectedDetailAsset] = useState<Asset | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const [projects, setProjects] = useState<any[]>([]);

    // Fetch projects for active workspace board switching
    useEffect(() => {
        api.get('/projects/?manageable=true')
            .then((res) => {
                const all = res.data.results ?? res.data;
                if (activeWorkspace.type === 'org' && activeWorkspace.org) {
                    setProjects(all.filter((p: any) => p.organisation === activeWorkspace.org?.id));
                } else {
                    setProjects(all.filter((p: any) => !p.organisation));
                }
            })
            .catch((err) => console.error('Failed to load projects:', err));
    }, [activeWorkspace]);

    // Track active board title and avatar info
    const activeBoardInfo = useMemo(() => {
        if (activeBoard === 'solo') {
            return {
                name: user?.real_name || user?.username || 'Personal Workspace',
                avatar: user?.avatar,
            };
        }
        if (activeBoard === 'org') {
            return {
                name: activeWorkspace.org?.name || 'Organisation',
                avatar: activeWorkspace.org?.logo,
            };
        }
        if (activeBoard.startsWith('project_')) {
            const pid = parseInt(activeBoard.replace('project_', ''), 10);
            const p = projects.find((proj) => proj.id === pid);
            return {
                name: p?.title || 'Project Board',
                avatar: p?.cover_image,
            };
        }
        return {
            name: 'Board',
            avatar: undefined,
        };
    }, [activeBoard, user, activeWorkspace, projects]);

    const filtered = assets.filter((a) => {
        const matchCat = filterCat === 'all' || a.category === filterCat;
        const matchSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase())
            || a.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchCat && matchSearch;
    });

    // Group matching assets by category
    const grouped = useMemo(() => {
        const result: Record<string, Asset[]> = {};
        filtered.forEach((asset) => {
            if (!result[asset.category]) {
                result[asset.category] = [];
            }
            result[asset.category].push(asset);
        });
        return result;
    }, [filtered]);

    // Track any assets belonging to deleted categories
    const activeCategoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
    const uncategorizedAssets = useMemo(() => filtered.filter((a) => !activeCategoryIds.has(a.category)), [filtered, activeCategoryIds]);

    const handleAdd = (form: FormState) => {
        const newAsset: Asset = {
            id: `asset-${Date.now()}`,
            name: form.name.trim(),
            category: form.category,
            tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
            link: form.link.trim(),
            notes: form.notes.trim(),
            addedAt: 'just now',
            addedBy: user?.username || 'You',
        };
        setAssets((prev) => [newAsset, ...prev]);
        logActivity('asset_added', `Asset "${newAsset.name}" added to assets.`, '📦');
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
        if (asset) logActivity('asset_added', `Asset "${asset.name}" removed from assets.`, '🗑️');
    };

    return (
        <div className="space-y-5">
            {/* Header with Switch Workspace Board selector */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowBoardDropdown(!showBoardDropdown)}
                                className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-all rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md cursor-pointer min-w-[200px] justify-between"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-6 h-6 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                        <img
                                            src={getImageUrl(activeBoardInfo.avatar, activeBoardInfo.name)}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <span className="truncate max-w-[120px]">{activeBoardInfo.name}</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                            </button>

                            {showBoardDropdown && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowBoardDropdown(false)}
                                    />
                                    <div className="absolute left-0 top-full mt-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-64 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2.5 py-1.5 border-b border-zinc-900/60 mb-1">
                                            Switch Workspace Board
                                        </p>
                                        
                                        {/* Solo/Org Root Board */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveBoard(activeWorkspace.type === 'solo' ? 'solo' : 'org');
                                                setShowBoardDropdown(false);
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors text-left font-semibold",
                                                (activeBoard === 'solo' || activeBoard === 'org')
                                                    ? "bg-blue-600/10 text-blue-400 font-bold"
                                                    : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                            )}
                                        >
                                            <div className="w-5 h-5 rounded-md overflow-hidden bg-zinc-800 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                                <img
                                                    src={getImageUrl(activeWorkspace.type === 'solo' ? user?.avatar : activeWorkspace.org?.logo, activeWorkspace.type === 'solo' ? user?.real_name || user?.username : activeWorkspace.org?.name)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <span className="truncate">
                                                {activeWorkspace.type === 'solo' ? 'Personal' : activeWorkspace.org?.name}
                                            </span>
                                        </button>

                                        {/* Projects list */}
                                        {projects.length > 0 && (
                                            <div className="pt-1.5 border-t border-zinc-900/60 mt-1">
                                                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-2.5 py-1">
                                                    Projects
                                                </p>
                                                {projects.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveBoard(`project_${p.id}`);
                                                            setShowBoardDropdown(false);
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors text-left font-semibold",
                                                            activeBoard === `project_${p.id}`
                                                                ? "bg-blue-600/10 text-blue-400 font-bold"
                                                                : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                                        )}
                                                    >
                                                        <div className="w-5 h-5 rounded-md overflow-hidden bg-zinc-800 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                                            <img
                                                                src={getImageUrl(p.cover_image, p.title)}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <span className="truncate">{p.title}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <span className="text-zinc-655 text-lg font-light">/</span>
                        <h2 className="text-xl font-bold text-white">Assets</h2>
                    </div>
                    <p className="text-xs text-zinc-550 mt-1.5">{assets.length} asset{assets.length !== 1 ? 's' : ''} catalogued · External links, no storage costs</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20 cursor-pointer"
                >
                    <Plus className="w-4 h-4" /> Add Asset
                </button>
            </div>

            {/* Filters bar */}
            <div className="flex items-center gap-3 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-3.5">
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search assets by name or tags..."
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all flex-1"
                />
                
                {/* Unified Category Filter Dropdown Drawer */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className={cn(
                            "px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2 cursor-pointer",
                            filterCat !== 'all'
                                ? "bg-blue-600/20 border-blue-500/50 text-blue-400 font-bold shadow-lg shadow-blue-900/10"
                                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        )}
                    >
                        <Tag className="w-4 h-4 text-zinc-555" />
                        <span>
                            Category: {filterCat === 'all' ? 'All' : (categories.find(c => c.id === filterCat)?.label || 'All')}
                        </span>
                        <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    </button>
                    {showFilterDropdown && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
                            <div className="absolute right-0 mt-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 w-60 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                <button
                                    onClick={() => { setFilterCat('all'); setShowFilterDropdown(false); }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer",
                                        filterCat === 'all'
                                            ? "bg-blue-600/10 text-blue-400 font-bold"
                                            : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                    )}
                                >
                                    <span className="flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5 text-zinc-500" /> All Assets
                                    </span>
                                    {filterCat === 'all' && <Check className="w-3.5 h-3.5" />}
                                </button>
                                <div className="border-t border-zinc-900/60 my-1" />
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => { setFilterCat(cat.id); setShowFilterDropdown(false); }}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer",
                                            filterCat === cat.id
                                                ? "bg-blue-600/10 text-blue-400 font-bold"
                                                : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="text-sm">{cat.emoji || '📌'}</span>
                                            <span className={getTextColorOnly(cat.color)}>{cat.label}</span>
                                        </span>
                                        {filterCat === cat.id && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Grouped layout by Category */}
            {filtered.length === 0 ? (
                <div className="text-center py-24 text-zinc-650 bg-zinc-900/10 border border-zinc-800/80 rounded-2xl">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-zinc-500" />
                    <p className="text-sm font-semibold">No assets found matching current criteria.</p>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-200">
                    {/* Render matching assets categorized */}
                    {categories.map((cat) => {
                        const catAssets = grouped[cat.id] || [];
                        if (catAssets.length === 0) return null;
                        
                        return (
                            <div key={cat.id} className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{cat.emoji || '📌'}</span>
                                    <h3 className={cn("text-sm font-extrabold font-sans", getTextColorOnly(cat.color))}>
                                        {cat.label}
                                    </h3>
                                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900/50 px-2 py-0.5 rounded-full border border-zinc-800/80">
                                        {catAssets.length}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {catAssets.map((asset) => (
                                        <div
                                            key={asset.id}
                                            onClick={() => setSelectedDetailAsset(asset)}
                                            className="group bg-zinc-900/40 border border-zinc-800/70 hover:border-zinc-700/80 hover:bg-zinc-900/60 rounded-2xl p-4.5 space-y-3 transition-all hover:shadow-lg cursor-pointer flex flex-col justify-between"
                                        >
                                            <div className="space-y-2">
                                                {/* Header row with pencil/trash buttons */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm font-bold text-white leading-snug group-hover:text-blue-400 transition-colors break-words flex-1">
                                                        {asset.name}
                                                    </p>
                                                    <div
                                                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                                        onClick={(e) => e.stopPropagation()} // Prevent opening details modal when editing/deleting
                                                    >
                                                        <button
                                                            onClick={() => setEditingAsset(asset)}
                                                            className="p-1.5 text-zinc-500 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-all cursor-pointer"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteId(asset.id)}
                                                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Tags */}
                                                {asset.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {asset.tags.map((tag) => (
                                                            <span key={tag} className="text-[10px] bg-zinc-900 border border-zinc-800/60 text-zinc-500 px-2 py-0.5 rounded-full font-medium">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Notes */}
                                                {asset.notes && (
                                                    <p className="text-xs text-zinc-550 line-clamp-2 leading-relaxed">
                                                        {asset.notes}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40 mt-1">
                                                <span className="text-[9px] text-zinc-500">Added {asset.addedAt} by @{asset.addedBy}</span>
                                                <a
                                                    href={asset.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()} // Prevent details modal on link click
                                                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors flex-shrink-0"
                                                >
                                                    Open <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Uncategorized assets fallback section */}
                    {uncategorizedAssets.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📌</span>
                                <h3 className="text-sm font-extrabold text-zinc-400 font-sans">
                                    Uncategorized
                                </h3>
                                <span className="text-[10px] font-bold text-zinc-555 bg-zinc-900/50 px-2 py-0.5 rounded-full border border-zinc-800/80">
                                    {uncategorizedAssets.length}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {uncategorizedAssets.map((asset) => (
                                    <div
                                        key={asset.id}
                                        onClick={() => setSelectedDetailAsset(asset)}
                                        className="group bg-zinc-900/40 border border-zinc-800/70 hover:border-zinc-700/80 hover:bg-zinc-900/60 rounded-2xl p-4.5 space-y-3 transition-all hover:shadow-lg cursor-pointer flex flex-col justify-between"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="text-sm font-bold text-white leading-snug group-hover:text-blue-400 transition-colors break-words flex-1">
                                                    {asset.name}
                                                </p>
                                                <div
                                                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={() => setEditingAsset(asset)}
                                                        className="p-1.5 text-zinc-500 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-all cursor-pointer"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteId(asset.id)}
                                                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {asset.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {asset.tags.map((tag) => (
                                                        <span key={tag} className="text-[10px] bg-zinc-900 border border-zinc-800/60 text-zinc-500 px-2 py-0.5 rounded-full font-medium">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {asset.notes && (
                                                <p className="text-xs text-zinc-550 line-clamp-2 leading-relaxed">
                                                    {asset.notes}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40 mt-1">
                                            <span className="text-[9px] text-zinc-500">Added {asset.addedAt} by @{asset.addedBy}</span>
                                            <a
                                                href={asset.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors flex-shrink-0"
                                            >
                                                Open <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add Asset Modal */}
            {showAddModal && (
                <AssetFormModal
                    title="Add Asset"
                    initial={{
                        name: '',
                        category: categories[0]?.id || 'other',
                        link: '',
                        tags: '',
                        notes: ''
                    }}
                    categories={categories}
                    onSubmit={handleAdd}
                    onClose={() => setShowAddModal(false)}
                    onManageCategories={() => setShowCategoryManager(true)}
                />
            )}

            {/* Edit Asset Modal */}
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
                    categories={categories}
                    onSubmit={handleEdit}
                    onClose={() => setEditingAsset(null)}
                    onManageCategories={() => setShowCategoryManager(true)}
                />
            )}

            {/* Customize Categories Modal */}
            {showCategoryManager && (
                <CategoryManagerModal
                    categories={categories}
                    onSave={(updatedCats) => setAssetCategories(updatedCats)}
                    onClose={() => setShowCategoryManager(false)}
                />
            )}

            {/* Asset Detail Popup Modal */}
            {selectedDetailAsset && (
                <AssetDetailModal
                    asset={selectedDetailAsset}
                    category={categories.find(c => c.id === selectedDetailAsset.category)}
                    onClose={() => setSelectedDetailAsset(null)}
                />
            )}

            {/* Deletion Onay Penceresi (ConfirmDeleteModal) */}
            <ConfirmDeleteModal
                isOpen={confirmDeleteId !== null}
                title="Delete Asset"
                description="Are you sure you want to permanently delete this asset? This action cannot be undone."
                onConfirm={() => {
                    if (confirmDeleteId) {
                        handleDelete(confirmDeleteId);
                        setConfirmDeleteId(null);
                    }
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
}
