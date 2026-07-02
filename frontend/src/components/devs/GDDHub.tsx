'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';

const GDDEditor = dynamic(() => import('./GDDEditor'), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex items-center justify-center bg-zinc-950">
            <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-zinc-600">Loading editor…</p>
            </div>
        </div>
    ),
});
import {
    Plus, X, FileText, ChevronRight, Globe, Lock, Download, Clock,
    Eye, Edit3, Trash2, MessageSquare, BookOpen, RotateCcw,
    Bold, Italic, Heading1, Heading2, Heading3, Code, Quote, List,
    Table, Minus, CheckSquare, Link2, ArrowLeft, Save, Wand2,
    ChevronDown, ChevronUp, Search, Filter, Hash, Sparkles,
    AlertCircle, Check, ExternalLink, Tag, StickyNote, Settings,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import {
    GDDDoc, GDDDocSection, GDDComment, GDDDocRevision,
    BalancingTable, BalancingRow, DialogueNode, Task,
    GDDCategory, DEFAULT_GDD_CATEGORIES,
} from './WorkspaceTypes';

import { cn } from '@/lib/utils';

// Helper to format ISO timestamp as relative time
function formatRelativeTime(isoString: string): string {
    if (!isoString) return 'Just now';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        if (isNaN(diffMs) || diffMs < 0) return 'Just now';
        
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    } catch {
        return 'Just now';
    }
}

// ─── Section Metadata ─────────────────────────────────────────────────────────



// ─── Markdown Toolbar ─────────────────────────────────────────────────────────

interface ToolbarAction {
    icon: React.ElementType;
    label: string;
    prefix?: string;
    suffix?: string;
    block?: string;
    wrap?: [string, string];
}

const TOOLBAR: (ToolbarAction | 'sep')[] = [
    { icon: Bold,       label: 'Bold',        wrap: ['**', '**'] },
    { icon: Italic,     label: 'Italic',      wrap: ['*', '*'] },
    'sep',
    { icon: Heading1,   label: 'Heading 1',   block: '# ' },
    { icon: Heading2,   label: 'Heading 2',   block: '## ' },
    { icon: Heading3,   label: 'Heading 3',   block: '### ' },
    'sep',
    { icon: List,       label: 'List',        block: '- ' },
    { icon: CheckSquare,label: 'Task List',   block: '- [ ] ' },
    { icon: Quote,      label: 'Blockquote',  block: '> ' },
    'sep',
    { icon: Code,       label: 'Code',        wrap: ['`', '`'] },
    { icon: Table,      label: 'Table',       block: '| Col 1 | Col 2 | Col 3 |\n|-------|-------|-------|\n| Cell  | Cell  | Cell  |' },
    { icon: Minus,      label: 'Divider',     block: '\n---\n' },
    { icon: Link2,      label: 'Link',        wrap: ['[', '](url)'] },
];

// ─── Built-in Markdown Renderer ──────────────────────────────────────────────
// Zero external dependencies — full GFM support rendered as React elements

type MDNode =
    | { t: 'h1' | 'h2' | 'h3' | 'h4'; children: MDNode[] }
    | { t: 'p'; children: MDNode[] }
    | { t: 'blockquote'; children: MDNode[] }
    | { t: 'ul'; items: MDNode[][] }
    | { t: 'ol'; items: MDNode[][] }
    | { t: 'tasklist'; items: { done: boolean; children: MDNode[] }[] }
    | { t: 'code'; lang: string; content: string }
    | { t: 'table'; head: string[]; rows: string[][] }
    | { t: 'hr' }
    | { t: 'br' }
    | { t: 'bold'; children: MDNode[] }
    | { t: 'italic'; children: MDNode[] }
    | { t: 'inlinecode'; content: string }
    | { t: 'link'; href: string; children: MDNode[] }
    | { t: 'badge'; id: string; taskTitle: string; status: 'done' | 'inProgress' | 'other' }
    | { t: 'text'; content: string };

function parseInline(text: string, tasks: Task[]): MDNode[] {
    const nodes: MDNode[] = [];
    // Process token by token using regex
    const re = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[GML-([a-zA-Z0-9]+)\]|\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) nodes.push({ t: 'text', content: text.slice(last, m.index) });
        if (m[1] !== undefined) nodes.push({ t: 'bold', children: [{ t: 'text', content: m[1] }] });
        else if (m[2] !== undefined) nodes.push({ t: 'italic', children: [{ t: 'text', content: m[2] }] });
        else if (m[3] !== undefined) nodes.push({ t: 'inlinecode', content: m[3] });
        else if (m[4] !== undefined) {
            const id = m[4];
            const task = tasks.find(t => t.id.slice(-4).toUpperCase() === id.toUpperCase() || t.id === id);
            if (task) {
                const status = task.columnId === 'done' ? 'done' : task.columnId === 'inProgress' ? 'inProgress' : 'other';
                nodes.push({ t: 'badge', id, taskTitle: task.title, status });
            } else {
                nodes.push({ t: 'text', content: m[0] });
            }
        }
        else if (m[5] !== undefined) nodes.push({ t: 'link', href: m[6], children: [{ t: 'text', content: m[5] }] });
        last = m.index + m[0].length;
    }
    if (last < text.length) nodes.push({ t: 'text', content: text.slice(last) });
    return nodes;
}

function parseMarkdown(md: string, tasks: Task[]): MDNode[] {
    const lines = md.split('\n');
    const nodes: MDNode[] = [];
    let i = 0;

    const consumeParagraph = (): MDNode[] => {
        const content: string[] = [];
        while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^#{1,4}\s|^[-*]\s|^\d+\.\s|^```|^>\s|^\|/) && lines[i] !== '---') {
            content.push(lines[i]);
            i++;
        }
        return parseInline(content.join(' '), tasks);
    };

    while (i < lines.length) {
        const line = lines[i];

        // Heading
        const hm = line.match(/^(#{1,4})\s+(.+)$/);
        if (hm) {
            const level = hm[1].length as 1 | 2 | 3 | 4;
            const t = (['h1','h2','h3','h4'] as const)[level - 1];
            nodes.push({ t, children: parseInline(hm[2], tasks) });
            i++; continue;
        }

        // Fenced code block
        if (line.startsWith('```')) {
            const lang = line.slice(3).trim();
            i++;
            const code: string[] = [];
            while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
            i++;
            nodes.push({ t: 'code', lang, content: code.join('\n') });
            continue;
        }

        // Horizontal rule
        if (line.match(/^---+$|^\*\*\*+$|^___+$/)) {
            nodes.push({ t: 'hr' }); i++; continue;
        }

        // Blockquote
        if (line.startsWith('> ')) {
            const bqLines: string[] = [];
            while (i < lines.length && lines[i].startsWith('> ')) {
                bqLines.push(lines[i].slice(2)); i++;
            }
            nodes.push({ t: 'blockquote', children: parseInline(bqLines.join(' '), tasks) });
            continue;
        }

        // Table
        if (line.startsWith('|')) {
            const rows: string[][] = [];
            while (i < lines.length && lines[i].startsWith('|')) {
                const row = lines[i].split('|').slice(1, -1).map(c => c.trim());
                if (!row.every(c => /^[-: ]+$/.test(c))) rows.push(row);
                i++;
            }
            if (rows.length >= 1) {
                nodes.push({ t: 'table', head: rows[0], rows: rows.slice(1) });
            }
            continue;
        }

        // Task list
        if (line.match(/^- \[[ x]\] /i)) {
            const items: { done: boolean; children: MDNode[] }[] = [];
            while (i < lines.length && lines[i].match(/^- \[[ x]\] /i)) {
                const done = lines[i][3].toLowerCase() === 'x';
                const text = lines[i].slice(6);
                items.push({ done, children: parseInline(text, tasks) });
                i++;
            }
            nodes.push({ t: 'tasklist', items });
            continue;
        }

        // Unordered list
        if (line.match(/^[-*] .+/)) {
            const items: MDNode[][] = [];
            while (i < lines.length && lines[i].match(/^[-*] .+/)) {
                items.push(parseInline(lines[i].slice(2), tasks)); i++;
            }
            nodes.push({ t: 'ul', items });
            continue;
        }

        // Ordered list
        if (line.match(/^\d+\. .+/)) {
            const items: MDNode[][] = [];
            while (i < lines.length && lines[i].match(/^\d+\. .+/)) {
                items.push(parseInline(lines[i].replace(/^\d+\.\s/, ''), tasks)); i++;
            }
            nodes.push({ t: 'ol', items });
            continue;
        }

        // Empty line
        if (line.trim() === '') { i++; continue; }

        // Paragraph
        const pChildren = consumeParagraph();
        if (pChildren.length > 0) nodes.push({ t: 'p', children: pChildren });
    }
    return nodes;
}

function renderNode(node: MDNode, idx: number): React.ReactNode {
    const ri = (nodes: MDNode[]) => nodes.map((n, i) => renderNode(n, i));

    switch (node.t) {
        case 'h1': return <h1 key={idx} className="text-2xl font-black text-white mt-8 mb-4 pb-2 border-b border-zinc-800">{ri(node.children)}</h1>;
        case 'h2': return <h2 key={idx} className="text-xl font-bold text-white mt-6 mb-3 flex items-center gap-2"><span className="w-1 h-5 rounded-full bg-blue-500 inline-block flex-shrink-0" />{ri(node.children)}</h2>;
        case 'h3': return <h3 key={idx} className="text-base font-bold text-zinc-200 mt-4 mb-2">{ri(node.children)}</h3>;
        case 'h4': return <h4 key={idx} className="text-sm font-bold text-zinc-300 mt-3 mb-1.5">{ri(node.children)}</h4>;
        case 'p': return <p key={idx} className="text-zinc-300 leading-7 mb-4 text-sm">{ri(node.children)}</p>;
        case 'bold': return <strong key={idx} className="text-white font-bold">{ri(node.children)}</strong>;
        case 'italic': return <em key={idx} className="text-zinc-300 italic">{ri(node.children)}</em>;
        case 'inlinecode': return <code key={idx} className="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded text-xs font-mono border border-zinc-700">{node.content}</code>;
        case 'code': return (
            <pre key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto my-4">
                <code className="text-emerald-400 text-xs font-mono">{node.content}</code>
            </pre>
        );
        case 'blockquote': return (
            <blockquote key={idx} className="border-l-4 border-blue-500/60 pl-4 py-2 my-4 bg-blue-500/5 rounded-r-lg text-zinc-400 italic">
                {ri(node.children)}
            </blockquote>
        );
        case 'hr': return <hr key={idx} className="border-zinc-800 my-6" />;
        case 'ul': return (
            <ul key={idx} className="space-y-1 my-3">
                {node.items.map((item, i) => (
                    <li key={i} className="text-zinc-300 text-sm leading-6 flex gap-2 items-start">
                        <span className="text-blue-400 mt-1.5 flex-shrink-0">•</span>
                        <span>{ri(item)}</span>
                    </li>
                ))}
            </ul>
        );
        case 'ol': return (
            <ol key={idx} className="space-y-1 my-3 pl-1">
                {node.items.map((item, i) => (
                    <li key={i} className="text-zinc-300 text-sm leading-6 flex gap-2 items-start">
                        <span className="text-blue-500 font-bold flex-shrink-0 w-5 text-right">{i + 1}.</span>
                        <span>{ri(item)}</span>
                    </li>
                ))}
            </ol>
        );
        case 'tasklist': return (
            <ul key={idx} className="space-y-1.5 my-3">
                {node.items.map((item, i) => (
                    <li key={i} className="text-zinc-300 text-sm leading-6 flex gap-2.5 items-start">
                        <span className={cn(
                            'w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center text-[10px]',
                            item.done ? 'bg-blue-500 border-blue-500 text-white' : 'border-zinc-600'
                        )}>{item.done ? '✓' : ''}</span>
                        <span className={item.done ? 'line-through text-zinc-500' : ''}>{ri(item.children)}</span>
                    </li>
                ))}
            </ul>
        );
        case 'table': return (
            <div key={idx} className="overflow-x-auto my-4 rounded-xl border border-zinc-800">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-900/80">
                        <tr>{node.head.map((h, i) => <th key={i} className="text-left px-4 py-2.5 text-xs font-bold text-zinc-400 uppercase tracking-wider">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {node.rows.map((row, ri2) => (
                            <tr key={ri2} className="hover:bg-zinc-900/40 transition-colors">
                                {row.map((cell, ci) => <td key={ci} className="px-4 py-2.5 text-zinc-300 text-sm">{cell}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
        case 'link': return <a key={idx} href={node.href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-500/40">{ri(node.children)}</a>;
        case 'badge': {
            const cls = node.status === 'done'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : node.status === 'inProgress'
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400';
            const icon = node.status === 'done' ? '✓' : node.status === 'inProgress' ? '⟳' : '○';
            return (
                <span key={idx} title={node.taskTitle}
                    className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border', cls)}>
                    {icon} GML-{node.id}
                </span>
            );
        }
        case 'text': return <span key={idx}>{node.content}</span>;
        default: return null;
    }
}

function GDDMarkdownRenderer({ content, tasks }: { content: string; tasks: Task[] }) {
    const nodes = useMemo(() => parseMarkdown(content, tasks), [content, tasks]);
    return (
        <div className="max-w-none space-y-0">
            {nodes.map((n, i) => renderNode(n, i))}
        </div>
    );
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function applyFormat(
    textarea: HTMLTextAreaElement,
    action: ToolbarAction,
    setValue: (v: string) => void
) {
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    const selected = value.slice(start, end);

    if (action.wrap) {
        const [pre, post] = action.wrap;
        const replacement = `${pre}${selected || 'text'}${post}`;
        setValue(value.slice(0, start) + replacement + value.slice(end));
        setTimeout(() => {
            textarea.selectionStart = start + pre.length;
            textarea.selectionEnd = start + pre.length + (selected || 'text').length;
            textarea.focus();
        }, 0);
    } else if (action.block) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', end);
        const safeEnd = lineEnd === -1 ? value.length : lineEnd;
        const currentLine = value.slice(lineStart, safeEnd);
        const newLine = action.block.includes('\n')
            ? '\n' + action.block + '\n'
            : action.block + currentLine;
        setValue(value.slice(0, lineStart) + newLine + value.slice(safeEnd));
    }
}

// ─── Create Doc Modal ─────────────────────────────────────────────────────────

interface CreateDocModalProps {
    onClose: () => void;
    onSubmit: (title: string, section: string, emoji: string) => void;
    defaultSection?: string;
}

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

function CreateDocModal({ onClose, onSubmit, defaultSection = 'introduction' }: CreateDocModalProps) {
    const { data: workspaceData, setGDDCategories, setGDDDocs } = useWorkspace();
    const categories = workspaceData.gddCategories ?? DEFAULT_GDD_CATEGORIES;

    const [view, setView] = useState<'create' | 'manage' | 'add_category' | 'edit_category'>('create');
    const [title, setTitle] = useState('');
    const [section, setSection] = useState<string>(defaultSection || 'introduction');
    const [emoji, setEmoji] = useState('');

    // Category form state
    const [catName, setCatName] = useState('');
    const [catEmoji, setCatEmoji] = useState('');
    const [catColorIdx, setCatColorIdx] = useState(0);
    const [editingCatId, setEditingCatId] = useState<string | null>(null);

    // Get current section meta helper
    const activeCat = categories.find(c => c.id === section) || categories[0];

    const handleSaveCategory = () => {
        if (!catName.trim()) return;
        const selectedPreset = COLOR_PRESETS[catColorIdx];
        const newCat: GDDCategory = {
            id: editingCatId || `cat-${Date.now()}`,
            label: catName.trim(),
            emoji: catEmoji || '📌',
            color: selectedPreset.color,
            bg: selectedPreset.bg,
        };

        if (editingCatId) {
            setGDDCategories(prev => prev.map(c => c.id === editingCatId ? newCat : c));
        } else {
            setGDDCategories(prev => [...prev, newCat]);
            // Automatically select the newly created category
            setSection(newCat.id);
        }

        // Reset and back to manage view
        setCatName('');
        setCatEmoji('');
        setCatColorIdx(0);
        setEditingCatId(null);
        setView('manage');
    };

    const handleStartEditCategory = (cat: GDDCategory) => {
        setEditingCatId(cat.id);
        setCatName(cat.label);
        setCatEmoji(cat.emoji);
        // Find matching preset index
        const presetIdx = COLOR_PRESETS.findIndex(p => p.color === cat.color) ?? 0;
        setCatColorIdx(presetIdx >= 0 ? presetIdx : 0);
        setView('edit_category');
    };

    const handleDeleteCategory = (catId: string) => {
        // Remove from list
        setGDDCategories(prev => prev.filter(c => c.id !== catId));
        // If the deleted category was currently selected, select another one (or fallback to 'other' / first category)
        if (section === catId) {
            const nextCat = categories.find(c => c.id !== catId);
            setSection(nextCat ? nextCat.id : 'other');
        }
        
        // Also re-assign any documents belonging to deleted category to 'other' (or next available category)
        setGDDDocs(prevDocs => prevDocs.map(d => {
            if (d.section === catId) {
                const fallbackId = categories.find(c => c.id !== catId)?.id || 'other';
                return { ...d, section: fallbackId };
            }
            return d;
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                
                {/* ── Normal Create View ── */}
                {view === 'create' && (
                    <>
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-400" /> New GDD Page
                            </h2>
                            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (title.trim()) {
                                onSubmit(title.trim(), section, emoji || activeCat?.emoji || '📌');
                                onClose();
                            }
                        }} className="p-5 space-y-4">
                            <div className="flex gap-3">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Icon</label>
                                    <input
                                        value={emoji}
                                        onChange={(e) => setEmoji(e.target.value)}
                                        placeholder={activeCat?.emoji || '📌'}
                                        className="w-14 text-center bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-2.5 text-xl focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Page Title *</label>
                                    <input
                                        autoFocus
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Double Jump Mechanic"
                                        required
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Category</label>
                                    <button
                                        type="button"
                                        onClick={() => setView('manage')}
                                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                                    >
                                        <Settings className="w-3 h-3" /> Manage
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin-dark">
                                    {categories.map((cat) => (
                                        <button key={cat.id} type="button" onClick={() => setSection(cat.id)}
                                            className={cn('px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center gap-2',
                                                section === cat.id ? `${cat.color} ${cat.bg}` : 'text-zinc-400 border-zinc-800 hover:border-zinc-700 bg-zinc-900/50')}>
                                            <span>{cat.emoji}</span> {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={onClose}
                                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={!title.trim()}
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40">
                                    Create Page
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {/* ── Manage Categories View ── */}
                {view === 'manage' && (
                    <>
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Settings className="w-4 h-4 text-zinc-400" /> Manage Categories
                            </h2>
                            <button onClick={() => setView('create')} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin-dark">
                                {categories.map((cat) => (
                                    <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 group">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{cat.emoji}</span>
                                            <span className={cn('text-xs font-semibold', cat.color)}>{cat.label}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleStartEditCategory(cat)}
                                                className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
                                                title="Edit category"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="Delete category"
                                                disabled={categories.length <= 1}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setCatName('');
                                    setCatEmoji('📌');
                                    setCatColorIdx(0);
                                    setEditingCatId(null);
                                    setView('add_category');
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-xs font-semibold transition-all"
                            >
                                <Plus className="w-4 h-4" /> Add Custom Category
                            </button>
                            <div className="pt-2 border-t border-zinc-800 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setView('create')}
                                    className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all"
                                >
                                    Back to Create
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* ── Add / Edit Category Sub-Form View ── */}
                {(view === 'add_category' || view === 'edit_category') && (
                    <>
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Tag className="w-4 h-4 text-blue-400" /> {view === 'add_category' ? 'Add Category' : 'Edit Category'}
                            </h2>
                            <button onClick={() => setView('manage')} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSaveCategory(); }} className="p-5 space-y-4">
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
                                                catColorIdx === idx ? 'border-white scale-110' : 'border-transparent'
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

// ─── Comment Panel ────────────────────────────────────────────────────────────

function CommentPanel({
    comments,
    onAdd,
    onResolve,
    onDelete,
    currentUser,
}: {
    comments: GDDComment[];
    onAdd: (text: string) => void;
    onResolve: (id: string) => void;
    onDelete: (id: string) => void;
    currentUser: string;
}) {
    const [text, setText] = useState('');
    const active = comments.filter(c => !c.resolved);
    const resolved = comments.filter(c => c.resolved);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 p-4 border-b border-zinc-800 flex-shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Comments</span>
                {active.length > 0 && (
                    <span className="ml-auto text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded-full">
                        {active.length}
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin-dark p-3 space-y-3">
                {active.length === 0 && resolved.length === 0 && (
                    <div className="text-center py-8 text-zinc-600">
                        <StickyNote className="w-7 h-7 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">No comments yet</p>
                    </div>
                )}

                {active.map(comment => (
                    <div key={comment.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-300">@{comment.author}</span>
                            <span className="text-[10px] text-zinc-600">
                                {new Date(comment.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{comment.text}</p>
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={() => onResolve(comment.id)}
                                className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                                <Check className="w-3 h-3" /> Resolve
                            </button>
                            {comment.author === currentUser && (
                                <button
                                    onClick={() => onDelete(comment.id)}
                                    className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors ml-auto"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {resolved.length > 0 && (
                    <details className="group">
                        <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors list-none flex items-center gap-1.5 py-1">
                            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                            {resolved.length} resolved
                        </summary>
                        <div className="mt-2 space-y-2">
                            {resolved.map(comment => (
                                <div key={comment.id} className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-3 opacity-60">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <span className="text-[10px] text-zinc-500">@{comment.author}</span>
                                    </div>
                                    <p className="text-xs text-zinc-600 line-through leading-relaxed">{comment.text}</p>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>

            {/* New comment */}
            <div className="p-3 border-t border-zinc-800 flex-shrink-0">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none transition-all"
                />
                <button
                    onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(''); } }}
                    disabled={!text.trim()}
                    className="mt-2 w-full py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold transition-all disabled:opacity-40"
                >
                    Post Comment
                </button>
            </div>
        </div>
    );
}

// ─── Version History Panel ────────────────────────────────────────────────────

function VersionHistoryPanel({
    revisions,
    currentContent,
    onRestore,
}: {
    revisions: GDDDocRevision[];
    currentContent: string;
    onRestore: (content: string) => void;
}) {
    const [previewRev, setPreviewRev] = useState<string | null>(null);

    if (revisions.length === 0) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 p-4 border-b border-zinc-800 flex-shrink-0">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Version History</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-center text-zinc-600 p-4">
                    <div>
                        <RotateCcw className="w-7 h-7 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">Versions are saved<br />automatically on each save</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 p-4 border-b border-zinc-800 flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Version History</span>
                <span className="ml-auto text-[10px] text-zinc-600">{revisions.length} saved</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin-dark p-3 space-y-2">
                {/* Current version */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-blue-400">Current</span>
                        <span className="text-[10px] text-zinc-500">v{revisions.length + 1}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">{currentContent.length} chars</p>
                </div>

                {revisions.map((rev, i) => (
                    <div key={rev.id}
                        className={cn(
                            "group bg-zinc-900 border rounded-xl p-3 space-y-1.5 transition-all cursor-pointer",
                            previewRev === rev.id ? "border-amber-500/30 bg-amber-500/5" : "border-zinc-800 hover:border-zinc-700"
                        )}
                        onClick={() => setPreviewRev(previewRev === rev.id ? null : rev.id)}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-400">v{revisions.length - i}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRestore(rev.content); }}
                                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-all font-bold"
                            >
                                <RotateCcw className="w-2.5 h-2.5" /> Restore
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-600">By @{rev.editedBy}</p>
                        <p className="text-[10px] text-zinc-700">
                            {new Date(rev.editedAt).toLocaleDateString('en', {
                                month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </p>
                        {previewRev === rev.id && (
                            <div className="pt-2 border-t border-zinc-800 mt-2">
                                <p className="text-[10px] text-zinc-500 line-clamp-4 font-mono leading-relaxed">
                                    {rev.content.slice(0, 200)}...
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── GDD Document Editor ──────────────────────────────────────────────────────

type EditorMode = 'edit' | 'preview' | 'split';
type RightPanel = 'history' | 'comments' | null;

function DocEditor({
    doc,
    tasks,
    onUpdate,
    onBack,
    currentUser,
}: {
    doc: GDDDoc;
    tasks: Task[];
    onUpdate: (doc: GDDDoc) => void;
    onBack: () => void;
    currentUser: string;
}) {
    const [content, setContent] = useState(doc.content);
    const [mode, setMode] = useState<EditorMode>('split');
    const [isPublic, setIsPublic] = useState(doc.isPublic);
    const [rightPanel, setRightPanel] = useState<RightPanel>('history');
    const [isDirty, setIsDirty] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [showConvertTask, setShowConvertTask] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Word count
    const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
    const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 200)), [wordCount]);

    // Auto-save debounce
    useEffect(() => {
        if (!isDirty) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            handleSave(false);
        }, 2000);
        return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    }, [content, isDirty]);

    const handleSave = useCallback((explicit = true) => {
        const revision: GDDDocRevision = {
            id: `rev-${Date.now()}`,
            content: doc.content,
            editedBy: currentUser,
            editedAt: new Date().toISOString(),
        };
        onUpdate({
            ...doc,
            content,
            isPublic,
            lastEdited: 'just now',
            revisions: explicit
                ? [revision, ...doc.revisions].slice(0, 20)
                : doc.revisions,
        });
        setIsDirty(false);
    }, [doc, content, isPublic, currentUser, onUpdate]);

    const handleContentChange = (val: string) => {
        setContent(val);
        setIsDirty(true);
    };

    const handleTextSelect = () => {
        const sel = window.getSelection()?.toString().trim() || '';
        setSelectedText(sel);
        setShowConvertTask(sel.length > 5);
    };

    const convertToTask = useCallback(() => {
        if (!selectedText) return;
        return selectedText; // returned for parent to create task
    }, [selectedText]);

    const applyToolbar = (action: ToolbarAction) => {
        if (!textareaRef.current) return;
        applyFormat(textareaRef.current, action, (val) => {
            handleContentChange(val);
        });
    };

    const addComment = (text: string) => {
        const comment: GDDComment = {
            id: `cmt-${Date.now()}`,
            author: currentUser,
            text,
            resolved: false,
            createdAt: new Date().toISOString(),
        };
        onUpdate({ ...doc, comments: [...(doc.comments ?? []), comment] });
    };

    const resolveComment = (id: string) => {
        onUpdate({
            ...doc,
            comments: doc.comments.map(c => c.id === id ? { ...c, resolved: true } : c),
        });
    };

    const deleteComment = (id: string) => {
        onUpdate({ ...doc, comments: doc.comments.filter(c => c.id !== id) });
    };

    const exportMD = () => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${doc.title}.md`; a.click();
        URL.revokeObjectURL(url);
    };

    const { data: wsData } = useWorkspace();
    const categories = wsData.gddCategories ?? DEFAULT_GDD_CATEGORIES;
    const meta = categories.find(c => c.id === doc.section) || categories.find(c => c.id === 'other') || categories[0] || { label: 'Other', color: 'text-zinc-400', bg: 'bg-zinc-700/20 border-zinc-700/30', emoji: '📌' };
    const activeComments = (doc.comments ?? []).filter(c => !c.resolved).length;

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* ── Top Bar ── */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 flex-shrink-0 bg-zinc-950/80 backdrop-blur-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => { if (isDirty) handleSave(true); onBack(); }}
                        className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-all flex-shrink-0"
                        title="Back to documents"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-lg">{doc.emoji || meta.emoji}</span>
                    <span className="text-sm font-bold text-white truncate">{doc.title}</span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0', meta.color, meta.bg)}>
                        {meta.label}
                    </span>
                    {isDirty && (
                        <span className="text-[10px] text-amber-400 animate-pulse flex-shrink-0">● Unsaved</span>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Public toggle */}
                    <button
                        onClick={() => { setIsPublic(!isPublic); setIsDirty(true); }}
                        className={cn('flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all',
                            isPublic
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                : 'text-zinc-500 bg-zinc-900 border-zinc-800 hover:border-zinc-700')}
                    >
                        {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {isPublic ? 'Public' : 'Private'}
                    </button>

                    {/* View mode */}
                    <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                        {(['edit', 'split', 'preview'] as EditorMode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn('px-2.5 py-1 text-[10px] font-bold rounded-md transition-all capitalize',
                                    mode === m ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {/* Export */}
                    <div className="relative group">
                        <button className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white transition-all">
                            <Download className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-10 w-36">
                            <button onClick={exportMD} className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-all">.md Markdown</button>
                            <button onClick={() => window.print()} className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-all">Print / PDF</button>
                        </div>
                    </div>

                    {/* Save */}
                    <button
                        onClick={() => handleSave(true)}
                        className={cn(
                            'flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg transition-all',
                            isDirty
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                                : 'bg-zinc-800 text-zinc-500 cursor-default'
                        )}
                    >
                        <Save className="w-3.5 h-3.5" /> Save
                    </button>
                </div>
            </div>

            {/* ── Toolbar ── */}
            {(mode === 'edit' || mode === 'split') && (
                <div className="flex items-center gap-0.5 px-4 py-2 border-b border-zinc-800 flex-shrink-0 overflow-x-auto bg-zinc-950/60">
                    {TOOLBAR.map((item, i) => {
                        if (item === 'sep') {
                            return <div key={`sep-${i}`} className="w-px h-4 bg-zinc-800 mx-1 flex-shrink-0" />;
                        }
                        const action = item as ToolbarAction;
                        const Icon = action.icon;
                        return (
                            <button
                                key={action.label}
                                title={action.label}
                                onClick={() => applyToolbar(action)}
                                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all flex-shrink-0"
                            >
                                <Icon className="w-3.5 h-3.5" />
                            </button>
                        );
                    })}

                    {/* Stats */}
                    <div className="ml-auto flex items-center gap-3 text-[10px] text-zinc-600 flex-shrink-0 pl-2">
                        <span>{wordCount} words</span>
                        <span>{readingTime} min read</span>
                    </div>
                </div>
            )}

            {/* ── Main Editor Area ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Editor pane */}
                {(mode === 'edit' || mode === 'split') && (
                    <div className={cn("flex flex-col relative", mode === 'split' ? 'w-1/2 border-r border-zinc-800' : 'flex-1')}>
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => handleContentChange(e.target.value)}
                            onMouseUp={handleTextSelect}
                            onKeyUp={handleTextSelect}
                            className="flex-1 bg-zinc-950 text-zinc-200 text-sm leading-7 px-8 py-6 focus:outline-none resize-none font-mono scrollbar-thin-dark"
                            placeholder={`# ${doc.title}\n\nStart writing your GDD page...\n\nUse Markdown for formatting:\n## Heading\n**bold** *italic* \`code\`\n- list item\n- [ ] task item\n\n> Blockquote\n\n| Column | Value |\n|--------|-------|\n| Row    | Data  |`}
                            spellCheck={false}
                        />

                        {/* Convert to task floating button */}
                        {showConvertTask && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <button
                                    onClick={() => {
                                        // Create task from selection — handled in parent
                                        const event = new CustomEvent('gdd-convert-task', { detail: { text: selectedText, docId: doc.id, docTitle: doc.title } });
                                        window.dispatchEvent(event);
                                        setShowConvertTask(false);
                                    }}
                                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl shadow-violet-900/40 transition-all"
                                >
                                    <Wand2 className="w-3.5 h-3.5" /> Convert to Kanban Task
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Preview pane */}
                {(mode === 'preview' || mode === 'split') && (
                    <div className={cn(
                        "overflow-y-auto px-10 py-8 scrollbar-thin-dark",
                        mode === 'split' ? 'w-1/2' : 'flex-1'
                    )}>
                        {isPublic && (
                            <div className="mb-6 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                                <Globe className="w-3.5 h-3.5" />
                                <span className="font-semibold">Public Wiki View</span>
                                <span className="text-emerald-600">— visible to everyone</span>
                            </div>
                        )}
                        <GDDMarkdownRenderer content={content} tasks={tasks} />
                    </div>
                )}

                {/* Right panel */}
                {rightPanel && (
                    <div className="w-64 border-l border-zinc-800 flex flex-col flex-shrink-0 bg-zinc-950/40">
                        {/* Panel toggle tabs */}
                        <div className="flex border-b border-zinc-800 flex-shrink-0">
                            <button
                                onClick={() => setRightPanel('history')}
                                className={cn('flex-1 py-2 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5',
                                    rightPanel === 'history' ? 'text-zinc-200 border-b-2 border-blue-500' : 'text-zinc-600 hover:text-zinc-400')}
                            >
                                <Clock className="w-3 h-3" /> History
                            </button>
                            <button
                                onClick={() => setRightPanel('comments')}
                                className={cn('flex-1 py-2 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 relative',
                                    rightPanel === 'comments' ? 'text-zinc-200 border-b-2 border-blue-500' : 'text-zinc-600 hover:text-zinc-400')}
                            >
                                <MessageSquare className="w-3 h-3" /> Comments
                                {activeComments > 0 && (
                                    <span className="absolute top-1 right-2 w-4 h-4 bg-blue-500 text-white text-[9px] rounded-full flex items-center justify-center">
                                        {activeComments}
                                    </span>
                                )}
                            </button>
                        </div>

                        {rightPanel === 'history' && (
                            <VersionHistoryPanel
                                revisions={doc.revisions}
                                currentContent={content}
                                onRestore={(c) => { handleContentChange(c); }}
                            />
                        )}
                        {rightPanel === 'comments' && (
                            <CommentPanel
                                comments={doc.comments ?? []}
                                onAdd={addComment}
                                onResolve={resolveComment}
                                onDelete={deleteComment}
                                currentUser={currentUser}
                            />
                        )}
                    </div>
                )}

                {/* Right panel toggle button */}
                <div className="flex flex-col border-l border-zinc-800 flex-shrink-0">
                    <button
                        onClick={() => setRightPanel(rightPanel === 'history' ? null : 'history')}
                        className={cn('p-2 transition-all', rightPanel === 'history' ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-600 hover:text-zinc-400')}
                        title="Version History"
                    >
                        <Clock className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setRightPanel(rightPanel === 'comments' ? null : 'comments')}
                        className={cn('p-2 relative transition-all', rightPanel === 'comments' ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-600 hover:text-zinc-400')}
                        title="Comments"
                    >
                        <MessageSquare className="w-4 h-4" />
                        {activeComments > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Document Outline (Google Docs / Notion Style Hierarchy) ──────────────────

interface OutlineItem {
    type: 'heading' | 'page';
    text: string;
    level: number;
    pageId?: string;
    pageEmoji?: string;
}

function DocumentOutline({
    content,
    onSelectPage,
}: {
    content: string;
    onSelectPage: (id: string) => void;
}) {
    const outlineItems = useMemo(() => {
        const items: OutlineItem[] = [];
        if (!content) return items;

        const lines = content.split('\n');
        let currentHeadingLevel = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            // 1. Match headings: #, ##, ###, ####
            const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const text = headingMatch[2].trim();
                currentHeadingLevel = level;
                items.push({
                    type: 'heading',
                    text,
                    level,
                });
                continue;
            }

            // 2. Match subpages (gdd-page-link divs)
            if (trimmed.includes('data-type="gdd-page-link"')) {
                const pageIdMatch = trimmed.match(/data-page-id="([^"]+)"/);
                const titleMatch = trimmed.match(/data-page-title="([^"]+)"/);
                const emojiMatch = trimmed.match(/data-page-emoji="([^"]+)"/);

                const pageId = pageIdMatch ? pageIdMatch[1] : '';
                const pageTitle = titleMatch ? titleMatch[1] : 'Untitled';
                const pageEmoji = emojiMatch ? emojiMatch[1] : '📄';

                items.push({
                    type: 'page',
                    text: pageTitle,
                    level: currentHeadingLevel + 1,
                    pageId,
                    pageEmoji,
                });
            }
        }

        return items;
    }, [content]);

    if (outlineItems.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-650 select-none">
                <List className="w-8 h-8 mb-2 opacity-30 text-zinc-650" />
                <p className="text-xs font-semibold text-zinc-500">Empty Outline</p>
                <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed max-w-[180px]">
                    Add headings (# H1, ## H2) or subpages to see the outline structure.
                </p>
            </div>
        );
    }

    const handleHeadingClick = (text: string) => {
        const scrollEvent = new CustomEvent('gdd-scroll-to-heading', { detail: { headingText: text } });
        window.dispatchEvent(scrollEvent);
    };

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin-dark px-3 py-4 space-y-1">
            {outlineItems.map((item, idx) => {
                // Calculate indentation classes based on level
                const indentClass = item.level === 2
                    ? 'pl-3 ml-1 border-l border-zinc-800/40'
                    : item.level === 3
                    ? 'pl-5 ml-1 border-l border-zinc-800/40'
                    : item.level >= 4
                    ? 'pl-7 ml-1 border-l border-zinc-800/40'
                    : 'pl-1';

                if (item.type === 'page') {
                    return (
                        <button
                            key={`${item.pageId}-${idx}`}
                            onClick={() => onSelectPage(item.pageId!)}
                            className={cn(
                                "w-full flex items-center gap-1.5 py-1 pr-2 rounded text-left text-xs font-semibold transition-all hover:bg-zinc-800/50 hover:text-white text-blue-400/90",
                                indentClass
                            )}
                        >
                            <span className="text-sm select-none flex-shrink-0">{item.pageEmoji || '📄'}</span>
                            <span className="truncate flex-1">{item.text}</span>
                            <span className="text-[9px] text-zinc-600 flex-shrink-0 font-medium">↗</span>
                        </button>
                    );
                }

                const sizeClass = item.level === 1
                    ? 'text-xs font-bold text-zinc-200'
                    : item.level === 2
                    ? 'text-[11px] font-semibold text-zinc-400'
                    : 'text-[10px] text-zinc-500 font-medium';

                return (
                    <button
                        key={`${item.text}-${idx}`}
                        onClick={() => handleHeadingClick(item.text)}
                        className={cn(
                            "w-full flex items-center py-1 pr-2 rounded text-left transition-all hover:bg-zinc-800/50 hover:text-zinc-200",
                            indentClass,
                            sizeClass
                        )}
                    >
                        <span className="truncate flex-1">{item.text}</span>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Doc Tree (Left Sidebar) ──────────────────────────────────────────────────

function DocTreeItem({
    doc,
    docs,
    activeDocId,
    onSelect,
    onDelete,
    level = 0
}: {
    doc: GDDDoc;
    docs: GDDDoc[];
    activeDocId: string | null;
    onSelect: (doc: GDDDoc) => void;
    onDelete: (id: string) => void;
    level?: number;
}) {
    const [expanded, setExpanded] = useState(true);
    const children = useMemo(() => docs.filter(d => d.parentId === doc.id), [docs, doc.id]);
    const hasChildren = children.length > 0;

    const indentStyle = { paddingLeft: `${level * 14 + 6}px` };

    return (
        <div className="space-y-0.5">
            <div
                className={cn(
                    'group flex items-center gap-1.5 py-1.5 pr-2 rounded-lg cursor-pointer transition-all hover:bg-zinc-800/60',
                    activeDocId === doc.id
                        ? 'bg-blue-600/15 text-blue-400 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                )}
                style={indentStyle}
                onClick={() => onSelect(doc)}
            >
                {/* Toggle arrow */}
                <span
                    className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-zinc-800/80 text-zinc-500 cursor-pointer"
                    onClick={(e) => {
                        if (hasChildren) {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }
                    }}
                >
                    {hasChildren && (
                        <ChevronRight className={cn("w-2.5 h-2.5 transition-transform", expanded && "rotate-90")} />
                    )}
                </span>

                <span className="text-sm flex-shrink-0">{doc.emoji || '📄'}</span>
                <span className="text-xs truncate flex-1">{doc.title}</span>
                {doc.isPublic && (
                    <Globe className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0 opacity-60" />
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all flex-shrink-0"
                >
                    <Trash2 className="w-2.5 h-2.5" />
                </button>
            </div>

            {/* Recursively render child documents */}
            {hasChildren && expanded && (
                <div className="space-y-0.5">
                    {children.map(child => (
                        <DocTreeItem
                            key={child.id}
                            doc={child}
                            docs={docs}
                            activeDocId={activeDocId}
                            onSelect={onSelect}
                            onDelete={onDelete}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function DocTree({
    docs,
    activeDocId,
    onSelect,
    onNew,
    onDelete,
    searchQuery,
    onSearchChange,
}: {
    docs: GDDDoc[];
    activeDocId: string | null;
    onSelect: (doc: GDDDoc) => void;
    onNew: (section?: string) => void;
    onDelete: (id: string) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
}) {
    const { data: wsData } = useWorkspace();
    const categories = wsData.gddCategories ?? DEFAULT_GDD_CATEGORIES;
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const grouped = useMemo(() => {
        const q = searchQuery.toLowerCase();
        const filtered = q
            ? docs.filter(d => d.title.toLowerCase().includes(q) || d.section.toLowerCase().includes(q))
            : docs;

        return categories.map((cat) => ({
            section: cat.id,
            meta: cat,
            // Only show root docs in the main category layout
            docs: filtered.filter(d => d.section === cat.id && !d.parentId),
        })).filter(g => g.docs.length > 0);
    }, [docs, searchQuery, categories]);

    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="p-3 border-b border-zinc-800 flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                    <input
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search documents..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                    />
                </div>
            </div>

            {/* New page button */}
            <div className="px-3 py-2 flex-shrink-0">
                <button
                    onClick={() => onNew()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-xs font-semibold transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> New Document
                </button>
            </div>

            {/* Grouped doc list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin-dark px-2 pb-4 space-y-1">
                {grouped.length === 0 && (
                    <div className="text-center py-10 text-zinc-600">
                        <FileText className="w-7 h-7 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">{searchQuery ? 'No documents found' : 'No documents yet'}</p>
                    </div>
                )}

                {grouped.map(({ section, meta, docs: sectionDocs }) => (
                    <div key={section}>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(prev => ({ ...prev, [section]: !prev[section] })); }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-zinc-800/50 transition-all group cursor-pointer"
                        >
                            <ChevronRight className={cn('w-3 h-3 text-zinc-600 transition-transform flex-shrink-0', !collapsed[section] && 'rotate-90')} />
                            <span className="text-xs">{meta.emoji}</span>
                            <span className={cn('text-[10px] font-bold uppercase tracking-wider', meta.color)}>{meta.label}</span>
                            <span className="ml-auto text-[10px] text-zinc-700 font-semibold">{sectionDocs.length}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onNew(section); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700 transition-all"
                            >
                                <Plus className="w-3 h-3 text-zinc-500" />
                            </button>
                        </div>

                        {!collapsed[section] && (
                            <div className="ml-1 space-y-0.5 mt-0.5">
                                {sectionDocs.map(doc => (
                                    <DocTreeItem
                                        key={doc.id}
                                        doc={doc}
                                        docs={docs}
                                        activeDocId={activeDocId}
                                        onSelect={onSelect}
                                        onDelete={onDelete}
                                        level={0}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Convert Task Toast ───────────────────────────────────────────────────────

function useGDDToKanban(setTasks: (fn: (prev: Task[]) => Task[]) => void, columns: { id: string }[]) {
    useEffect(() => {
        const handler = (e: Event) => {
            const { text, docId, docTitle } = (e as CustomEvent).detail;
            const backlogCol = columns.find(c => c.id === 'backlog') ?? columns[0];
            if (!backlogCol) return;
            const newTask: Task = {
                id: `task-${Date.now()}`,
                title: text.slice(0, 80),
                description: `Created from GDD: "${docTitle}"\n\n${text}`,
                priority: 'medium',
                category: 'other',
                columnId: backlogCol.id,
                subtasks: [],
                comments: [],
                createdAt: new Date().toISOString(),
                linkedGDDRef: docId,
            };
            setTasks(prev => [...prev, newTask]);
        };
        window.addEventListener('gdd-convert-task', handler);
        return () => window.removeEventListener('gdd-convert-task', handler);
    }, [setTasks, columns]);
}

// ─── Main GDD Hub ─────────────────────────────────────────────────────────────

export default function GDDHub() {
    const { data, setGDDDocs, setBalancingTables, setTasks, logActivity } = useWorkspace();
    const { user } = useAuth();
    const { gddDocs, balancingTables, dialogueTrees, tasks, columns, gddCategories } = data;
    const categories = gddCategories ?? DEFAULT_GDD_CATEGORIES;

    const router = useRouter();
    const searchParams = useSearchParams();

    // Dynamically resolve parent-child relations based on page-link blocks in document contents
    const resolvedDocs = useMemo(() => {
        const parentMap = new Map<string, string>();
        for (const doc of gddDocs) {
            if (!doc.content) continue;
            // Match any occurrences of data-page-id="..."
            const matches = doc.content.matchAll(/data-page-id="([^"]+)"/g);
            for (const match of matches) {
                const childId = match[1];
                parentMap.set(childId, doc.id);
            }
        }
        return gddDocs.map(doc => ({
            ...doc,
            parentId: parentMap.get(doc.id) || doc.parentId
        }));
    }, [gddDocs]);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createSection, setCreateSection] = useState<GDDDocSection | undefined>();
    const [searchQuery, setSearchQuery] = useState('');
    const [sidePanel, setSidePanel] = useState<'outline' | 'comments' | null>('outline');
    const [scrollTarget, setScrollTarget] = useState<{ text: string; timestamp: number } | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const currentUser = user?.username ?? 'You';

    // Derived active document directly from URL parameter
    const urlDocId = searchParams.get('gddDocId');
    const editingDoc = useMemo(() => {
        if (!urlDocId) return null;
        return resolvedDocs.find(d => d.id === urlDocId) || null;
    }, [urlDocId, resolvedDocs]);

    // Callback to update URL search parameters (which automatically updates editingDoc via the derived state above)
    const setEditingDoc = useCallback((doc: GDDDoc | null) => {
        const params = new URLSearchParams(window.location.search);
        if (doc) {
            params.set('gddDocId', doc.id);
        } else {
            params.delete('gddDocId');
        }
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }, [router]);

    // GDD → Kanban bridge
    useGDDToKanban(setTasks, columns);

    // GDD page-link navigation listener
    useEffect(() => {
        const handler = (e: Event) => {
            const pageId = (e as CustomEvent).detail.pageId;
            const targetDoc = resolvedDocs.find(d => d.id === pageId);
            if (targetDoc) {
                setEditingDoc(targetDoc);
            }
        };
        window.addEventListener('gdd-navigate-page', handler);
        return () => window.removeEventListener('gdd-navigate-page', handler);
    }, [resolvedDocs, setEditingDoc]);

    // GDD subpage creation and navigation listener
    useEffect(() => {
        const handler = (e: Event) => {
            const { newPageId, title, section, parentId } = (e as CustomEvent).detail;
            const docTitle = title || 'Untitled';
            const newDoc: GDDDoc = {
                id: newPageId,
                title: docTitle,
                section: section,
                emoji: '📄',
                isPublic: false,
                content: `# ${docTitle}\n\n`,
                lastEdited: new Date().toISOString(),
                revisions: [],
                linkedTaskIds: [],
                comments: [],
                createdAt: new Date().toISOString(),
                parentId: parentId,
            };
            setGDDDocs(prev => [...prev, newDoc]);
            setEditingDoc(newDoc);
        };
        window.addEventListener('gdd-create-and-navigate', handler);
        return () => window.removeEventListener('gdd-create-and-navigate', handler);
    }, [setGDDDocs, setEditingDoc]);

    const handleCreateDoc = useCallback((title: string, section: GDDDocSection, emoji: string) => {
        const cats = data.gddCategories ?? DEFAULT_GDD_CATEGORIES;
        const meta = cats.find(c => c.id === section) || cats.find(c => c.id === 'other') || cats[0] || { label: 'Other', emoji: '📌' };
        const newDoc: GDDDoc = {
            id: `gdd-${Date.now()}`,
            title,
            section,
            emoji,
            isPublic: false,
            content: `# ${title}\n\n> ${meta.emoji} ${meta.label} document\n\n## Overview\n\nDescribe the ${title.toLowerCase()} here...\n\n## Details\n\n- Key point 1\n- Key point 2\n- Key point 3\n`,
            revisions: [],
            linkedTaskIds: [],
            comments: [],
            createdAt: new Date().toISOString(),
            lastEdited: new Date().toISOString(),
        };
        setGDDDocs(prev => [...prev, newDoc]);
        logActivity('gdd_edited', `GDD page "${title}" created.`, '📝');
        setEditingDoc(newDoc);
    }, [setGDDDocs, logActivity, data.gddCategories, setEditingDoc]);

    const handleUpdateDoc = useCallback((updated: GDDDoc) => {
        setGDDDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
        logActivity('gdd_edited', `GDD page "${updated.title}" updated.`, '📝');
        setEditingDoc(updated);
    }, [setGDDDocs, logActivity]);

    const handleDeleteDoc = useCallback((id: string) => {
        const doc = resolvedDocs.find(d => d.id === id);
        setGDDDocs(prev => prev.filter(d => d.id !== id));
        if (doc) logActivity('gdd_edited', `GDD page "${doc.title}" deleted.`, '🗑️');
        if (editingDoc?.id === id) setEditingDoc(null);
    }, [resolvedDocs, setGDDDocs, logActivity, editingDoc, setEditingDoc]);

    // ── Toggle panel (accordion: only one open) ──────────────────────────────
    const togglePanel = (panel: 'outline' | 'comments') => {
        setSidePanel(prev => prev === panel ? null : panel);
    };

    // ── If editing, show full Notion-style editor ─────────────────────────────
    if (editingDoc) {
        const latestDoc = resolvedDocs.find(d => d.id === editingDoc.id) ?? editingDoc;
        const historyRevisions = latestDoc.revisions ?? [];
        const docComments = latestDoc.comments ?? [];

        return (
            <div className="flex h-full min-h-0 -m-0">
                {/* ── Collapsible Panel Rail ── */}
                <div className="flex flex-shrink-0">
                    {/* Icon rail */}
                    <div className="w-10 border-r border-zinc-800 flex flex-col items-center py-3 gap-1 bg-zinc-950/60">
                        {/* Panel toggle buttons */}
                        {([
                            { id: 'outline' as const, icon: List, title: 'Outline' },
                            { id: 'comments' as const, icon: MessageSquare, title: 'Comments' },
                        ]).map(({ id, icon: Icon, title }) => (
                            <button
                                key={id}
                                onClick={() => togglePanel(id)}
                                title={title}
                                className={cn(
                                    'w-7 h-7 flex items-center justify-center rounded-lg transition-all',
                                    sidePanel === id
                                        ? 'bg-blue-600/20 text-blue-400'
                                        : 'text-zinc-700 hover:text-zinc-300 hover:bg-zinc-800'
                                )}
                            >
                                <Icon className="w-3.5 h-3.5" />
                            </button>
                        ))}
                    </div>

                    {/* Expanded panel */}
                    {sidePanel !== null && (
                        <div className="w-60 border-r border-zinc-800 flex flex-col flex-shrink-0 bg-zinc-950/40 overflow-hidden">
                            {/* Panel header */}
                            <div className="px-3 pt-3 pb-2 border-b border-zinc-800 flex-shrink-0 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    {sidePanel === 'outline' && 'Outline'}
                                    {sidePanel === 'comments' && 'Comments'}
                                </span>
                            </div>

                            {/* Document Outline panel */}
                            {sidePanel === 'outline' && (
                                <DocumentOutline
                                    content={latestDoc.content}
                                    onSelectPage={(id) => {
                                        const targetDoc = resolvedDocs.find(d => d.id === id);
                                        if (targetDoc) {
                                            setEditingDoc(targetDoc);
                                        }
                                    }}
                                />
                            )}



                            {/* Comments panel */}
                            {sidePanel === 'comments' && (
                                <div className="flex-1 overflow-y-auto scrollbar-thin-dark p-2 space-y-1.5">
                                    {docComments.length === 0 ? (
                                        <div className="text-center py-10">
                                            <MessageSquare className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
                                            <p className="text-xs text-zinc-700">No comments yet</p>
                                        </div>
                                    ) : docComments.map(comment => (
                                        <div
                                            key={comment.id}
                                            onClick={() => {
                                                const match = comment.text.match(/^Regarding "([^"]+)":/);
                                                const targetText = match && match[1] ? match[1] : comment.text;
                                                setScrollTarget({ text: targetText, timestamp: Date.now() });
                                            }}
                                            className={cn(
                                                'p-2.5 rounded-lg border text-xs cursor-pointer hover:border-zinc-700 transition-all',
                                                comment.resolved
                                                    ? 'border-zinc-800/40 opacity-40 bg-zinc-950/20'
                                                    : 'border-zinc-800 bg-zinc-900/30'
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-zinc-300">{comment.author}</span>
                                                    {comment.resolved && <span className="text-[9px] text-emerald-500 font-bold">Resolved</span>}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {!comment.resolved && comment.author === currentUser && editingCommentId !== comment.id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingCommentId(comment.id);
                                                                setEditText(comment.text);
                                                            }}
                                                            className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpdateDoc({
                                                                ...latestDoc,
                                                                comments: latestDoc.comments?.map(c =>
                                                                    c.id === comment.id ? { ...c, resolved: !c.resolved } : c
                                                                )
                                                            });
                                                        }}
                                                        className="text-[10px] text-zinc-500 hover:text-blue-400 px-1"
                                                    >
                                                        {comment.resolved ? 'Reopen' : 'Resolve'}
                                                    </button>
                                                    {(comment.author === currentUser || currentUser === 'admin' || currentUser === 'owner') && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleUpdateDoc({
                                                                    ...latestDoc,
                                                                    comments: latestDoc.comments?.filter(c => c.id !== comment.id)
                                                                });
                                                            }}
                                                            className="text-[10px] text-zinc-500 hover:text-red-400 px-1"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {editingCommentId === comment.id ? (
                                                <div className="mt-1" onClick={e => e.stopPropagation()}>
                                                    <textarea
                                                        value={editText}
                                                        onChange={e => setEditText(e.target.value)}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white outline-none focus:border-blue-500"
                                                        rows={2}
                                                    />
                                                    <div className="flex justify-end gap-1 mt-1">
                                                        <button
                                                            onClick={() => setEditingCommentId(null)}
                                                            className="px-2 py-1 rounded bg-zinc-800 text-[10px] text-zinc-400 hover:text-white"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                handleUpdateDoc({
                                                                    ...latestDoc,
                                                                    comments: latestDoc.comments?.map(c =>
                                                                        c.id === comment.id ? { ...c, text: editText } : c
                                                                    )
                                                                });
                                                                setEditingCommentId(null);
                                                            }}
                                                            className="px-2 py-1 rounded bg-blue-600 text-[10px] text-white font-bold"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-zinc-400 leading-relaxed break-words whitespace-pre-wrap">{comment.text}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Main Editor Area ── */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10">
                    <GDDEditor
                        key={latestDoc.id}
                        doc={latestDoc}
                        docs={resolvedDocs}
                        tasks={tasks}
                        onUpdate={handleUpdateDoc}
                        onBack={() => {
                            if (latestDoc.parentId) {
                                const parentDoc = resolvedDocs.find(d => d.id === latestDoc.parentId);
                                if (parentDoc) {
                                    setEditingDoc(parentDoc);
                                    return;
                                }
                            }
                            setEditingDoc(null);
                        }}
                        currentUser={currentUser}
                        selectedComment={scrollTarget}
                    />
                </div>

                {showCreateModal && (
                    <CreateDocModal
                        defaultSection={createSection}
                        onClose={() => setShowCreateModal(false)}
                        onSubmit={(title, section, emoji) => {
                            handleCreateDoc(title, section, emoji);
                            setShowCreateModal(false);
                        }}
                    />
                )}
            </div>
        );
    }

    // ── Document list view ────────────────────────────────────────────────────
    return (
        <div className="flex h-full min-h-0 -m-0" style={{ display: 'flex' }}>
            {/* Left: Doc Tree */}
            <div className="w-56 border-r border-zinc-800 flex flex-col flex-shrink-0 bg-zinc-950/30">
                <div className="px-3 pt-3 pb-2 border-b border-zinc-800 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">GDD Hub</span>
                    </div>
                </div>
                <DocTree
                    docs={resolvedDocs}
                    activeDocId={null}
                    onSelect={(doc) => setEditingDoc(doc)}
                    onNew={(section) => { setCreateSection(section); setShowCreateModal(true); }}
                    onDelete={handleDeleteDoc}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
            </div>

            {/* Right: Dashboard / Welcome */}
            <div className="flex-1 overflow-y-auto scrollbar-thin-dark p-8">
                {resolvedDocs.filter(d => !d.parentId).length === 0 ? (
                    /* Empty state */
                    <div className="max-w-2xl mx-auto text-center py-20">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
                            <BookOpen className="w-10 h-10 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3">Game Design Document Hub</h2>
                        <p className="text-zinc-500 text-sm leading-relaxed mb-8 max-w-md mx-auto">
                            Your Notion-style workspace for designing your game. Create design documents,
                            balancing tables, and link them directly to your Kanban tasks.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30"
                        >
                            <Plus className="w-4 h-4" /> Create Your First Document
                        </button>

                        <div className="mt-12 grid grid-cols-3 gap-4 text-left">
                            {[
                                { icon: '📝', title: 'Rich Markdown', desc: 'Full GFM support — headings, tables, task lists, code blocks' },
                                { icon: '🔗', title: 'Kanban Links', desc: 'Select text to convert directly to a Kanban task card' },
                                { icon: '🕐', title: 'Version History', desc: 'Auto-saves every 2 seconds' },
                            ].map(f => (
                                <div key={f.title} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                                    <span className="text-2xl mb-2 block">{f.icon}</span>
                                    <p className="text-xs font-bold text-white mb-1">{f.title}</p>
                                    <p className="text-[11px] text-zinc-500">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Dashboard with all docs */
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">GDD Hub</h2>
                                <p className="text-sm text-zinc-500 mt-0.5">
                                    {resolvedDocs.filter(d => !d.parentId).length} documents · {resolvedDocs.filter(d => d.isPublic && !d.parentId).length} public
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
                            >
                                <Plus className="w-4 h-4" /> New Document
                            </button>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Total Documents', value: resolvedDocs.filter(d => !d.parentId).length, color: 'text-blue-400' },
                                { label: 'Public', value: resolvedDocs.filter(d => d.isPublic && !d.parentId).length, color: 'text-emerald-400' },
                                { label: 'Linked Tasks', value: tasks.filter(t => t.linkedGDDRef).length, color: 'text-violet-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                                    <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
                                    <p className="text-xs text-zinc-500 mt-1 font-semibold">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Docs by category */}
                        {categories.map((cat) => {
                            const sectionDocs = resolvedDocs.filter(d => d.section === cat.id && !d.parentId);
                            if (sectionDocs.length === 0) return null;
                            return (
                                <div key={cat.id}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-base">{cat.emoji}</span>
                                        <h3 className={cn('text-sm font-bold', cat.color)}>{cat.label}</h3>
                                        <span className="text-xs text-zinc-700 font-semibold">{sectionDocs.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {sectionDocs.map(doc => {
                                            const preview = doc.content.replace(/[#*`>|]/g, '').trim().slice(0, 120);
                                            const linkedTaskCount = tasks.filter(t => t.linkedGDDRef === doc.id).length;
                                            const activeComments = (doc.comments ?? []).filter(c => !c.resolved).length;
                                            return (
                                                <div
                                                    key={doc.id}
                                                    className="group bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 space-y-3 transition-all hover:shadow-lg cursor-pointer"
                                                    onClick={() => setEditingDoc(doc)}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">{doc.emoji || cat.emoji}</span>
                                                            <p className="text-sm font-bold text-white leading-snug">{doc.title}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {doc.isPublic
                                                                ? <span title="Public"><Globe className="w-3.5 h-3.5 text-emerald-500" /></span>
                                                                : <span title="Private"><Lock className="w-3.5 h-3.5 text-zinc-700" /></span>}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 rounded hover:bg-red-500/10 transition-all"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">{preview}...</p>
                                                    <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> {formatRelativeTime(doc.lastEdited)}
                                                        </span>
                                                        {linkedTaskCount > 0 && (
                                                            <span className="flex items-center gap-1 text-violet-400">
                                                                <Link2 className="w-3 h-3" /> {linkedTaskCount}
                                                            </span>
                                                        )}
                                                        {activeComments > 0 && (
                                                            <span className="flex items-center gap-1 text-amber-400">
                                                                <MessageSquare className="w-3 h-3" /> {activeComments}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showCreateModal && (
                <CreateDocModal
                    defaultSection={createSection}
                    onClose={() => { setShowCreateModal(false); setCreateSection(undefined); }}
                    onSubmit={handleCreateDoc}
                />
            )}
        </div>
    );
}
