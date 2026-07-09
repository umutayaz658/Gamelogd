'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Node, mergeAttributes } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Markdown } from 'tiptap-markdown';
import { cn } from '@/lib/utils';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link2,
    Heading1, Heading2, Heading3, Heading4, List, ListOrdered, CheckSquare, Quote,
    Code2, Minus, Table as TableIcon, Type, Plus, GripVertical, FileText,
    Globe, Lock, ArrowLeft, ChevronRight, Check, Loader2, MessageSquare, Palette
} from 'lucide-react';
import type { GDDDoc, Task, GDDComment } from './WorkspaceTypes';

// ─── Editor CSS ───────────────────────────────────────────────────────────────

// ─── Editor CSS ───────────────────────────────────────────────────────────────

const EDITOR_CSS = `
.gdd-prosemirror .ProseMirror { outline: none; caret-color: #60a5fa; min-height: 300px; }
.gdd-prosemirror .ProseMirror > * + * { margin-top: 2px; }
.gdd-prosemirror .ProseMirror h1 { font-size: 2rem; font-weight: 800; color: #fff; margin: 1.75rem 0 0.2rem; line-height: 1.15; }
.gdd-prosemirror .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; color: #fff; margin: 1.4rem 0 0.15rem; line-height: 1.25; }
.gdd-prosemirror .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; color: #e4e4e7; margin: 1.1rem 0 0.1rem; }
.gdd-prosemirror .ProseMirror h4 { font-size: 0.95rem; font-weight: 600; color: #d4d4d8; margin: 0.9rem 0 0.1rem; }
.gdd-prosemirror .ProseMirror p { color: #d4d4d8; line-height: 1.75; margin: 0.05rem 0; font-size: 0.9375rem; }
.gdd-prosemirror .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #3f3f46; pointer-events: none; float: left; height: 0; }
.gdd-prosemirror .ProseMirror strong { color: #fff; font-weight: 700; }
.gdd-prosemirror .ProseMirror em { font-style: italic; }
.gdd-prosemirror .ProseMirror u { text-decoration: underline; text-underline-offset: 3px; }
.gdd-prosemirror .ProseMirror s { color: #71717a; }
.gdd-prosemirror .ProseMirror code { background: #27272a; color: #34d399; padding: 0.1em 0.4em; border-radius: 4px; font-size: 0.84em; font-family: 'JetBrains Mono','Fira Code',monospace; border: 1px solid #3f3f46; }
.gdd-prosemirror .ProseMirror pre { background: #18181b; border: 1px solid #3f3f46; border-radius: 12px; padding: 1.1rem 1.4rem; margin: 0.75rem 0; overflow-x: auto; }
.gdd-prosemirror .ProseMirror pre code { background: none; border: none; padding: 0; color: #34d399; font-size: 0.83rem; line-height: 1.7; }
.gdd-prosemirror .ProseMirror blockquote { border-left: 3px solid #3b82f6; padding: 0.4rem 1rem; margin: 0.6rem 0; background: rgba(59,130,246,0.05); border-radius: 0 8px 8px 0; }
.gdd-prosemirror .ProseMirror blockquote p { color: #a1a1aa; font-style: italic; margin: 0; }
.gdd-prosemirror .ProseMirror hr { border: none; border-top: 1px solid #3f3f46; margin: 1.25rem 0; }

/* Notion Bullet Nesting Rules */
.gdd-prosemirror .ProseMirror ul { list-style-type: disc !important; padding-left: 1.5rem; margin: 0.4rem 0; }
.gdd-prosemirror .ProseMirror ul ul { list-style-type: circle !important; }
.gdd-prosemirror .ProseMirror ul ul ul { list-style-type: square !important; }
.gdd-prosemirror .ProseMirror ul ul ul ul { list-style-type: disc !important; }
.gdd-prosemirror .ProseMirror ul ul ul ul ul { list-style-type: circle !important; }
.gdd-prosemirror .ProseMirror ul ul ul ul ul ul { list-style-type: square !important; }

.gdd-prosemirror .ProseMirror ol { list-style-type: decimal !important; padding-left: 1.5rem; margin: 0.4rem 0; }
.gdd-prosemirror .ProseMirror li { color: #d4d4d8; line-height: 1.75; font-size: 0.9375rem; margin: 0.2rem 0; }

/* Markers inherit current text color (no forced blue) */
.gdd-prosemirror .ProseMirror ul li::marker { color: inherit; font-size: 1em; }
.gdd-prosemirror .ProseMirror ol li::marker { color: inherit; font-weight: inherit; }

.gdd-prosemirror .ProseMirror ul[data-type="taskList"] { list-style: none !important; padding-left: 0; }
.gdd-prosemirror .ProseMirror ul[data-type="taskList"] > li { display: flex; align-items: flex-start; gap: 0.5rem; }
.gdd-prosemirror .ProseMirror ul[data-type="taskList"] > li > label { flex-shrink: 0; margin-top: 0.3rem; }
.gdd-prosemirror .ProseMirror ul[data-type="taskList"] > li > label input[type="checkbox"] { width: 15px; height: 15px; border-radius: 3px; cursor: pointer; accent-color: #3b82f6; }
.gdd-prosemirror .ProseMirror ul[data-type="taskList"] > li[data-checked="true"] > div p { color: #52525b; text-decoration: line-through; }
.gdd-prosemirror .ProseMirror a { color: #60a5fa; text-decoration: underline; text-underline-offset: 2px; }
.gdd-prosemirror .ProseMirror a:hover { color: #93c5fd; }
.gdd-prosemirror .ProseMirror table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; border: 1px solid #3f3f46; border-radius: 8px; overflow: hidden; }
.gdd-prosemirror .ProseMirror th { background: #1c1c1e; color: #a1a1aa; font-size: 0.73rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.55rem 0.9rem; border-bottom: 1px solid #3f3f46; text-align: left; }
.gdd-prosemirror .ProseMirror td { color: #d4d4d8; font-size: 0.875rem; padding: 0.55rem 0.9rem; border-bottom: 1px solid #27272a; vertical-align: top; }
.gdd-prosemirror .ProseMirror tr:last-child td { border-bottom: none; }
.gdd-prosemirror .ProseMirror tr:hover td { background: rgba(255,255,255,0.02); }
.gdd-prosemirror .ProseMirror .selectedCell { background: rgba(59,130,246,0.1) !important; }
.gdd-prosemirror .ProseMirror mark { background: rgba(250,204,21,0.2); color: #fde047; border-radius: 2px; padding: 0.05em 0.15em; }

/* Active block highlighters & Comment indicators */
.gdd-prosemirror .ProseMirror .gdd-active-block-highlight { background-color: rgba(59, 130, 246, 0.18) !important; border-radius: 4px; transition: background-color 0.15s ease; }
.gdd-prosemirror .ProseMirror .gdd-commented-block { border-bottom: 1.5px dashed rgba(16, 185, 129, 0.45); background-color: rgba(16, 185, 129, 0.08); position: relative; }
.gdd-prosemirror .ProseMirror .gdd-commented-block::after { content: '💬'; position: absolute; right: -24px; top: 50%; transform: translateY(-50%); font-size: 11px; opacity: 0.65; cursor: pointer; }
.gdd-prosemirror .ProseMirror .gdd-commented-block:hover::after { opacity: 1; }

/* Sleek Dark Theme Scrollbars */
.flex-1.overflow-y-auto::-webkit-scrollbar,
.overflow-y-auto::-webkit-scrollbar,
.gdd-prosemirror::-webkit-scrollbar,
.scrollbar-thin-dark::-webkit-scrollbar,
textarea::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
.flex-1.overflow-y-auto::-webkit-scrollbar-track,
.overflow-y-auto::-webkit-scrollbar-track,
.gdd-prosemirror::-webkit-scrollbar-track,
.scrollbar-thin-dark::-webkit-scrollbar-track,
textarea::-webkit-scrollbar-track {
    background: transparent;
}
.flex-1.overflow-y-auto::-webkit-scrollbar-thumb,
.overflow-y-auto::-webkit-scrollbar-thumb,
.gdd-prosemirror::-webkit-scrollbar-thumb,
.scrollbar-thin-dark::-webkit-scrollbar-thumb,
textarea::-webkit-scrollbar-thumb {
    background: #27272a;
    border-radius: 10px;
    border: 1px solid #18181b;
}
.flex-1.overflow-y-auto::-webkit-scrollbar-thumb:hover,
.overflow-y-auto::-webkit-scrollbar-thumb:hover,
.gdd-prosemirror::-webkit-scrollbar-thumb:hover,
.scrollbar-thin-dark::-webkit-scrollbar-thumb:hover,
textarea::-webkit-scrollbar-thumb:hover {
    background: #3f3f46;
}

/* Details / Collapsible blocks styling */
.gdd-toggle-block { margin: 0.4rem 0; }
.gdd-toggle-summary { cursor: pointer; color: #a1a1aa; outline: none; list-style: none; font-size: 0.9375rem; padding: 0.15rem 0; display: flex; align-items: center; gap: 0.4rem; font-weight: 500; }
.gdd-toggle-summary::-webkit-details-marker { display: none; }
.gdd-toggle-summary::before { content: '▶'; display: inline-block; font-size: 11px; color: #a1a1aa; transition: transform 0.15s ease; margin-top: 1px; margin-right: 2px; }
.gdd-toggle-block[open] > .gdd-toggle-summary::before { transform: rotate(90deg); }
.gdd-toggle-summary-h1 { font-size: 2rem; font-weight: 800; color: #fff; margin: 1.2rem 0 0.2rem; line-height: 1.15; }
.gdd-toggle-summary-h2 { font-size: 1.4rem; font-weight: 700; color: #fff; margin: 1.0rem 0 0.15rem; line-height: 1.25; }
.gdd-toggle-summary-h3 { font-size: 1.1rem; font-weight: 600; color: #e4e4e7; margin: 0.8rem 0 0.1rem; }
.gdd-toggle-summary-h4 { font-size: 0.95rem; font-weight: 600; color: #d4d4d8; margin: 0.6rem 0 0.1rem; }
.gdd-toggle-content { padding-left: 1.25rem; border-left: 1px solid #27272a; margin-top: 0.25rem; }

/* Page link block styling */
.gdd-page-link-block { box-shadow: 0 2px 8px -2px rgba(0,0,0,0.5); }
`;

// ─── Slash Items ──────────────────────────────────────────────────────────────

interface SlashItem { title: string; subtitle: string; icon: React.ElementType; keywords?: string[]; command: (editor: ReturnType<typeof useEditor>) => void; }
interface TurnIntoItem { label: string; icon: React.ElementType; command: (editor: ReturnType<typeof useEditor>) => void; }

const SLASH_ITEMS: SlashItem[] = [
    { title: 'Text', subtitle: 'Start writing with plain text', icon: Type, keywords: ['text', 'p'], command: e => e?.chain().focus().clearNodes().setParagraph().run() },
    { title: 'Heading 1', subtitle: 'Big section heading', icon: Heading1, keywords: ['h1', '#'], command: e => e?.chain().focus().clearNodes().setHeading({ level: 1 }).run() },
    { title: 'Heading 2', subtitle: 'Medium section heading', icon: Heading2, keywords: ['h2', '##'], command: e => e?.chain().focus().clearNodes().setHeading({ level: 2 }).run() },
    { title: 'Heading 3', subtitle: 'Small section heading', icon: Heading3, keywords: ['h3', '###'], command: e => e?.chain().focus().clearNodes().setHeading({ level: 3 }).run() },
    { title: 'Heading 4', subtitle: 'Small sub-section heading', icon: Heading4, keywords: ['h4', '####'], command: e => e?.chain().focus().clearNodes().setHeading({ level: 4 }).run() },
    { title: 'Page', subtitle: 'Link an existing GDD page', icon: FileText, keywords: ['page', 'link'], command: () => {} },
    { title: 'Bulleted List', subtitle: 'Create a simple bulleted list', icon: List, keywords: ['ul', 'bullet', '-'], command: e => e?.chain().focus().clearNodes().toggleBulletList().run() },
    { title: 'Numbered List', subtitle: 'Create a numbered list', icon: ListOrdered, keywords: ['ol', 'numbered', '1.'], command: e => e?.chain().focus().clearNodes().toggleOrderedList().run() },
    { title: 'To-do List', subtitle: 'Track tasks with checkboxes', icon: CheckSquare, keywords: ['todo', 'task', '[]'], command: e => e?.chain().focus().clearNodes().toggleTaskList().run() },
    { title: 'Toggle List', subtitle: 'Create a collapsible section', icon: ChevronRight, keywords: ['toggle', 'details'], command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 0 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
    { title: 'Code Block', subtitle: 'Capture a code snippet', icon: Code2, keywords: ['code', '```'], command: e => e?.chain().focus().clearNodes().setCodeBlock().run() },
    { title: 'Quote', subtitle: 'Capture a quote', icon: Quote, keywords: ['quote', '>'], command: e => e?.chain().focus().clearNodes().setBlockquote().run() },
    { title: 'Divider', subtitle: 'Visually divide content', icon: Minus, keywords: ['divider', '---'], command: e => e?.chain().focus().clearNodes().setHorizontalRule().run() },
    { title: 'Table', subtitle: 'Insert a table', icon: TableIcon, keywords: ['table', 'grid'], command: e => e?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { title: 'Toggle Heading 1', subtitle: 'Collapsible Heading 1', icon: Heading1, keywords: ['toggle1', 'th1'], command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 1 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
    { title: 'Toggle Heading 2', subtitle: 'Collapsible Heading 2', icon: Heading2, keywords: ['toggle2', 'th2'], command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 2 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
    { title: 'Toggle Heading 3', subtitle: 'Collapsible Heading 3', icon: Heading3, keywords: ['toggle3', 'th3'], command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 3 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
    { title: 'Toggle Heading 4', subtitle: 'Collapsible Heading 4', icon: Heading4, keywords: ['toggle4', 'th4'], command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 4 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
];

const TURN_INTO_ITEMS: TurnIntoItem[] = [
    { label: 'Text', icon: Type, command: e => e?.chain().focus().clearNodes().setParagraph().run() },
    { label: 'Heading 1', icon: Heading1, command: e => e?.chain().focus().clearNodes().setHeading({ level: 1 }).run() },
    { label: 'Heading 2', icon: Heading2, command: e => e?.chain().focus().clearNodes().setHeading({ level: 2 }).run() },
    { label: 'Heading 3', icon: Heading3, command: e => e?.chain().focus().clearNodes().setHeading({ level: 3 }).run() },
    { label: 'Heading 4', icon: Heading4, command: e => e?.chain().focus().clearNodes().setHeading({ level: 4 }).run() },
    { label: 'Page', icon: FileText, command: () => {} },
    { label: 'Bulleted List', icon: List, command: e => e?.chain().focus().clearNodes().toggleBulletList().run() },
    { label: 'Numbered List', icon: ListOrdered, command: e => e?.chain().focus().clearNodes().toggleOrderedList().run() },
    { label: 'To-do List', icon: CheckSquare, command: e => e?.chain().focus().clearNodes().toggleTaskList().run() },
    { label: 'Toggle List', icon: ChevronRight, command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 0 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
    { label: 'Code Block', icon: Code2, command: e => e?.chain().focus().clearNodes().setCodeBlock().run() },
    { label: 'Quote', icon: Quote, command: e => e?.chain().focus().clearNodes().setBlockquote().run() },
    { label: 'Toggle Heading 1', icon: Heading1, command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 1 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
    { label: 'Toggle Heading 2', icon: Heading2, command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 2 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
    { label: 'Toggle Heading 3', icon: Heading3, command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 3 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
    { label: 'Toggle Heading 4', icon: Heading4, command: e => {
        const text = e?.state.selection.$from.parent.textContent || '';
        e?.chain().focus().clearNodes().insertContent({
            type: 'toggle',
            content: [
                { type: 'toggleSummary', attrs: { level: 4 }, content: text ? [{ type: 'text', text }] : [] },
                { type: 'toggleContent', content: [{ type: 'paragraph' }] }
            ]
        }).run();
    }},
];

interface ColorItem { label: string; color: string; isBg?: boolean; }

const COLOR_ITEMS: ColorItem[] = [
    { label: 'Default', color: 'inherit' },
    { label: 'Gray', color: '#9ca3af' },
    { label: 'Brown', color: '#b45309' },
    { label: 'Orange', color: '#ea580c' },
    { label: 'Yellow', color: '#eab308' },
    { label: 'Green', color: '#22c55e' },
    { label: 'Blue', color: '#3b82f6' },
    { label: 'Purple', color: '#a855f7' },
    { label: 'Pink', color: '#ec4899' },
    { label: 'Red', color: '#ef4444' },
    
    // Background colors
    { label: 'Gray background', color: 'rgba(156,163,175,0.15)', isBg: true },
    { label: 'Brown background', color: 'rgba(180,83,9,0.15)', isBg: true },
    { label: 'Orange background', color: 'rgba(234,88,12,0.15)', isBg: true },
    { label: 'Yellow background', color: 'rgba(234,179,8,0.15)', isBg: true },
    { label: 'Green background', color: 'rgba(34,197,94,0.15)', isBg: true },
    { label: 'Blue background', color: 'rgba(59,130,246,0.15)', isBg: true },
    { label: 'Purple background', color: 'rgba(168,85,247,0.15)', isBg: true },
    { label: 'Pink background', color: 'rgba(236,72,153,0.15)', isBg: true },
    { label: 'Red background', color: 'rgba(239,68,68,0.15)', isBg: true },
];

function getBlockInfo(pos: number, editor: any) {
    const $pos = editor.state.doc.resolve(pos);
    let depth = $pos.depth;
    while (depth > 1) {
        if ($pos.node(depth).type.name === 'listItem' || $pos.node(depth).type.name === 'toggle') {
            break;
        }
        depth--;
    }
    const nodePos = $pos.before(depth);
    const node = $pos.node(depth);
    return { nodePos, node, startPos: $pos.start(depth) };
}

function getCurrentBlockType(editor: any) {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    if (editor.isActive('heading', { level: 4 })) return 'Heading 4';
    if (editor.isActive('toggle')) return 'Toggle List';
    if (editor.isActive('bulletList')) return 'Bulleted List';
    if (editor.isActive('orderedList')) return 'Numbered List';
    if (editor.isActive('taskList')) return 'To-do List';
    if (editor.isActive('codeBlock')) return 'Code Block';
    if (editor.isActive('blockquote')) return 'Quote';
    return 'Text';
}

// ─── Slash Dropdown ───────────────────────────────────────────────────────────

function SlashDropdown({ items, onSelect, onClose, position }: { items: SlashItem[]; onSelect: (i: SlashItem) => void; onClose: () => void; position: { top: number; left: number }; }) {
    const [idx, setIdx] = useState(0);
    useEffect(() => { setIdx(0); }, [items]);
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); if (items[idx]) onSelect(items[idx]); }
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [items, idx, onSelect, onClose]);

    if (!items.length) return null;
    return (
        <div style={{ top: position.top, left: position.left }} className="absolute z-50 w-72 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Blocks</p>
            </div>
            <div className="p-1.5 max-h-72 overflow-y-auto">
                {items.map((item, i) => {
                    const Icon = item.icon;
                    return (
                        <button key={item.title} onClick={() => onSelect(item)}
                            className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors', i === idx ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800/70')}
                        >
                            <span className="w-7 h-7 flex-shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700">
                                <Icon className="w-3.5 h-3.5 text-zinc-400" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-medium">{item.title}</span>
                                <span className="block text-[11px] text-zinc-500 truncate">{item.subtitle}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Turn Into Menu ───────────────────────────────────────────────────────────

function TurnIntoMenu({ position, onSelect }: { position: { top: number; left: number }; onSelect: (i: TurnIntoItem) => void; }) {
    const ref = useRef<HTMLDivElement>(null);
    const [top, setTop] = useState(position.top);

    useEffect(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) {
                setTop(Math.max(16, window.innerHeight - rect.height - 16));
            }
        }
    }, [position.top]);

    return createPortal(
        <div ref={ref} data-turninto style={{ top, left: position.left }} className="fixed z-[9999] w-52 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Turn Into</p>
            </div>
            <div className="p-1 max-h-60 overflow-y-auto scrollbar-thin-dark">
                {TURN_INTO_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.label}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelect(item);
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left"
                        >
                            <Icon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />{item.label}
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
    );
}

// ─── Color Menu ──────────────────────────────────────────────────────────────

function ColorMenu({ position, onSelect }: { position: { top: number; left: number }; onSelect: (i: ColorItem) => void; }) {
    const ref = useRef<HTMLDivElement>(null);
    const [top, setTop] = useState(position.top);

    useEffect(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) {
                setTop(Math.max(16, window.innerHeight - rect.height - 16));
            }
        }
    }, [position.top]);

    return createPortal(
        <div ref={ref} data-colormenu style={{ top, left: position.left }} className="fixed z-[9999] w-52 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Color</p>
            </div>
            <div className="p-1 max-h-64 overflow-y-auto scrollbar-thin-dark">
                {COLOR_ITEMS.map((item) => {
                    return (
                        <button
                            key={item.label}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelect(item);
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left"
                        >
                            <span className="flex items-center gap-2">
                                <span 
                                    className="w-4 h-4 rounded border border-zinc-700/50" 
                                    style={item.isBg ? { backgroundColor: item.color } : { color: item.color, backgroundColor: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}
                                >
                                    {!item.isBg && item.color !== 'inherit' && 'A'}
                                </span>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
    );
}

// ─── Block Context Menu ───────────────────────────────────────────────────────

function BlockContextMenu({ position, onTurnInto, onColor, onComment, onDelete, onDuplicate }: { position: { top: number; left: number }; onTurnInto: () => void; onColor: () => void; onComment: () => void; onDelete: () => void; onDuplicate: () => void; }) {
    const ref = useRef<HTMLDivElement>(null);
    const [top, setTop] = useState(position.top);

    useEffect(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) {
                setTop(Math.max(16, window.innerHeight - rect.height - 16));
            }
        }
    }, [position.top]);

    return createPortal(
        <div ref={ref} data-ctxmenu style={{ top, left: position.left }} className="fixed z-[9999] w-56 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
            <div className="p-1">
                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onTurnInto();
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                    <span className="flex items-center gap-2"><Type className="w-3.5 h-3.5 text-zinc-500" />Turn into</span>
                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                </button>
                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onColor();
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                    <span className="flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-zinc-500" />Color</span>
                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                </button>
                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onComment();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                    <span className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5 text-zinc-500" />Comment</span>
                </button>
                <div className="border-t border-zinc-800 my-1" />
                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDuplicate();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                    <Plus className="w-3.5 h-3.5 text-zinc-500" />Duplicate
                </button>
                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                    <Minus className="w-3.5 h-3.5" />Delete block
                </button>
            </div>
        </div>,
        document.body
    );
}

// ─── Bubble Toolbar ───────────────────────────────────────────────────────────

function BubbleToolbar({ editor, onRequestComment }: { editor: ReturnType<typeof useEditor>; onRequestComment: (pos: number, selText: string) => void }) {
    const [openDropdown, setOpenDropdown] = useState<'type' | 'color' | null>(null);
    if (!editor) return null;

    const blockType = getCurrentBlockType(editor);

    const handleCommentClick = () => {
        const { from, to } = editor.state.selection;
        const selText = editor.state.doc.textBetween(from, to);
        onRequestComment(from, selText);
    };

    const handleColorSelect = (item: ColorItem) => {
        if (item.color === 'inherit') {
            editor.chain().focus().unsetColor().unsetHighlight().run();
        } else if (item.isBg) {
            editor.chain().focus().unsetHighlight().setHighlight({ color: item.color }).run();
        } else {
            editor.chain().focus().unsetColor().setColor(item.color).run();
        }
        setOpenDropdown(null);
    };

    const handleTurnIntoSelect = (item: TurnIntoItem) => {
        item.command(editor);
        setOpenDropdown(null);
    };

    return (
        <div className="relative flex items-center gap-0.5 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/60 p-1 text-zinc-300">
            {/* Block Type Dropdown */}
            <div className="relative">
                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenDropdown(prev => prev === 'type' ? null : 'type');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-zinc-800 text-xs font-semibold text-zinc-200 transition-colors"
                >
                    {blockType}
                    <ChevronRight className="w-3 h-3 rotate-90 text-zinc-500" />
                </button>

                {openDropdown === 'type' && (
                    <div className="absolute top-full left-0 mt-1.5 w-48 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/60 p-1 z-50 max-h-60 overflow-y-auto">
                        {TURN_INTO_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleTurnIntoSelect(item);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left"
                                >
                                    <Icon className="w-3.5 h-3.5 text-zinc-500" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            {/* Format buttons */}
            <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); editor.chain().focus().toggleBold().run(); }}
                className={cn('p-1.5 rounded-lg transition-colors', editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800')}
                title="Bold"
            >
                <Bold className="w-3.5 h-3.5" />
            </button>
            <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); editor.chain().focus().toggleItalic().run(); }}
                className={cn('p-1.5 rounded-lg transition-colors', editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800')}
                title="Italic"
            >
                <Italic className="w-3.5 h-3.5" />
            </button>
            <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); editor.chain().focus().toggleUnderline().run(); }}
                className={cn('p-1.5 rounded-lg transition-colors', editor.isActive('underline') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800')}
                title="Underline"
            >
                <UnderlineIcon className="w-3.5 h-3.5" />
            </button>
            <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); editor.chain().focus().toggleStrike().run(); }}
                className={cn('p-1.5 rounded-lg transition-colors', editor.isActive('strike') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800')}
                title="Strikethrough"
            >
                <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); editor.chain().focus().toggleCode().run(); }}
                className={cn('p-1.5 rounded-lg transition-colors', editor.isActive('code') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800')}
                title="Code"
            >
                <Code className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            {/* Comment button */}
            <button
                onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCommentClick();
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Comment"
            >
                <MessageSquare className="w-3.5 h-3.5" />
            </button>

            {/* Color button */}
            <div className="relative">
                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenDropdown(prev => prev === 'color' ? null : 'color');
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Text color / Highlight"
                >
                    <span className="w-4 h-4 flex items-center justify-center font-bold text-xs border border-zinc-700 rounded bg-zinc-850">A</span>
                </button>

                {openDropdown === 'color' && (
                    <div className="absolute top-full right-0 mt-1.5 w-48 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/60 p-1 z-50 max-h-60 overflow-y-auto">
                        {COLOR_ITEMS.map((item) => (
                            <button
                                key={item.label}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleColorSelect(item);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors text-left"
                            >
                                <span
                                    className="w-3.5 h-3.5 rounded border border-zinc-800 flex-shrink-0"
                                    style={item.isBg ? { backgroundColor: item.color } : { color: item.color, backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}
                                >
                                    {!item.isBg && item.color !== 'inherit' && 'A'}
                                </span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to determine if the commented block/text is still present in the document
const isTargetTextStillPresent = (targetText: string, fullText: string): boolean => {
    if (!targetText) return false;
    let cleanTarget = targetText.trim();
    if (cleanTarget.endsWith('...')) {
        cleanTarget = cleanTarget.slice(0, -3).trim();
    }
    if (!cleanTarget) return false;

    // If it's very short, it must match exactly or be fully contained
    if (cleanTarget.length <= 3) {
        return fullText.includes(cleanTarget);
    }

    // Check sliding window of size Math.max(3, Math.floor(cleanTarget.length * 0.4))
    const windowSize = Math.max(3, Math.floor(cleanTarget.length * 0.4));
    for (let i = 0; i <= cleanTarget.length - windowSize; i++) {
        const sub = cleanTarget.substring(i, i + windowSize);
        if (fullText.includes(sub)) {
            return true;
        }
    }
    return false;
};

// Helper to find the element in the editor DOM for a given targetText
const findElementForTarget = (pmDom: HTMLElement, targetText: string): HTMLElement | null => {
    if (!targetText) return null;
    let cleanTarget = targetText.trim();
    if (cleanTarget.endsWith('...')) {
        cleanTarget = cleanTarget.slice(0, -3).trim();
    }
    if (!cleanTarget) return null;

    const elements = Array.from(pmDom.querySelectorAll('p, h1, h2, h3, li, blockquote, pre'));
    
    // First, try exact or includes match
    const match = elements.find(el => el.textContent === cleanTarget || el.textContent?.includes(cleanTarget));
    if (match) return match as HTMLElement;

    // If no exact match and target is long enough, try sliding window match
    if (cleanTarget.length <= 3) return null;

    const windowSize = Math.max(3, Math.floor(cleanTarget.length * 0.4));
    let bestEl: HTMLElement | null = null;
    let maxMatches = 0;

    for (const el of elements) {
        const text = el.textContent || '';
        let matches = 0;
        for (let i = 0; i <= cleanTarget.length - windowSize; i++) {
            const sub = cleanTarget.substring(i, i + windowSize);
            if (text.includes(sub)) {
                matches++;
            }
        }
        if (matches > 0 && matches > maxMatches) {
            maxMatches = matches;
            bestEl = el as HTMLElement;
        }
    }
    return bestEl;
};

// Custom TipTap node extensions for Collapsible sections and GDD page links
export const ToggleSummary = Node.create({
    name: 'toggleSummary',
    content: 'inline*',
    selectable: false,
    defining: true,
    addAttributes() {
        return {
            level: {
                default: 0, // 0 = standard toggle list text, 1-4 = heading levels
                parseHTML: el => parseInt(el.getAttribute('data-level') || '0', 10),
                renderHTML: attrs => attrs.level > 0 ? { 'data-level': attrs.level } : {},
            }
        };
    },
    parseHTML() { return [{ tag: 'summary' }]; },
    renderHTML({ node, HTMLAttributes }) {
        const lvl = node.attrs.level;
        let className = 'gdd-toggle-summary';
        if (lvl === 1) className += ' gdd-toggle-summary-h1';
        else if (lvl === 2) className += ' gdd-toggle-summary-h2';
        else if (lvl === 3) className += ' gdd-toggle-summary-h3';
        else if (lvl === 4) className += ' gdd-toggle-summary-h4';
        
        return ['summary', mergeAttributes(HTMLAttributes, { class: className }), 0];
    },
});

export const ToggleContent = Node.create({
    name: 'toggleContent',
    content: 'block*',
    selectable: false,
    defining: true,
    parseHTML() { return [{ tag: 'div[data-type="toggle-content"]' }]; },
    renderHTML({ HTMLAttributes }) { 
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle-content', class: 'gdd-toggle-content pl-4 border-l border-zinc-800/50 mt-1.5' }), 0]; 
    },
});

export const ToggleBlock = Node.create({
    name: 'toggle',
    group: 'block',
    content: 'toggleSummary toggleContent',
    defining: true,
    addAttributes() {
        return {
            open: {
                default: true,
                parseHTML: el => el.hasAttribute('open'),
                renderHTML: attrs => attrs.open ? { open: '' } : {},
            },
        };
    },
    parseHTML() { return [{ tag: 'details' }]; },
    renderHTML({ node, HTMLAttributes }) { 
        return ['details', mergeAttributes(HTMLAttributes, { class: 'gdd-toggle-block my-2' }), 0]; 
    },
});

export const GDDPageLinkNode = Node.create({
    name: 'gddPageLink',
    group: 'block',
    atom: true, // Leaf node, non-editable
    addAttributes() {
        return {
            pageId: {
                default: '',
                parseHTML: element => element.getAttribute('data-page-id') || element.getAttribute('pageId') || '',
                renderHTML: attributes => {
                    if (!attributes.pageId) return {};
                    return { 'data-page-id': attributes.pageId };
                }
            },
            pageTitle: {
                default: 'Untitled Page',
                parseHTML: element => element.getAttribute('data-page-title') || element.getAttribute('pageTitle') || 'Untitled',
                renderHTML: attributes => {
                    if (!attributes.pageTitle) return {};
                    return { 'data-page-title': attributes.pageTitle };
                }
            },
            pageEmoji: {
                default: '📄',
                parseHTML: element => element.getAttribute('data-page-emoji') || element.getAttribute('pageEmoji') || '📄',
                renderHTML: attributes => {
                    if (!attributes.pageEmoji) return {};
                    return { 'data-page-emoji': attributes.pageEmoji };
                }
            },
        };
    },
    parseHTML() {
        return [{ tag: 'div[data-type="gdd-page-link"]' }];
    },
    renderHTML({ node, HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'gdd-page-link',
                class: 'gdd-page-link-block flex items-center gap-2.5 p-2 px-3 rounded-lg border border-zinc-800/85 bg-zinc-900/30 hover:bg-zinc-800/50 cursor-pointer transition-all my-2 select-none w-full max-w-xl group',
                'data-page-id': node.attrs.pageId,
                'data-page-title': node.attrs.pageTitle,
                'data-page-emoji': node.attrs.pageEmoji,
            }),
            ['span', { class: 'gdd-page-link-emoji text-base group-hover:scale-110 transition-transform' }, node.attrs.pageEmoji],
            ['span', { class: 'gdd-page-link-title text-xs font-bold text-zinc-300 group-hover:text-white transition-colors' }, node.attrs.pageTitle],
            ['span', { class: 'ml-auto text-[10px] text-zinc-600 group-hover:text-zinc-400 font-medium' }, 'GDD Page ↗']
        ];
    },
});

// ─── GDDEditor Main ───────────────────────────────────────────────────────────

interface GDDEditorProps {
    doc: GDDDoc;
    docs: GDDDoc[];
    tasks: Task[];
    currentUser: string;
    onUpdate: (doc: GDDDoc) => void;
    onBack: () => void;
    selectedComment: { text: string; timestamp: number } | null;
}

export default function GDDEditor({ doc, docs, tasks: _tasks, currentUser, onUpdate, onBack, selectedComment }: GDDEditorProps) {
    const [title, setTitle] = useState(doc.title);
    const [isPublic, setIsPublic] = useState(doc.isPublic);
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Slash menu state
    const [slashOpen, setSlashOpen] = useState(false);
    const [slashQuery, setSlashQuery] = useState('');
    const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
    const slashRangeRef = useRef<{ from: number; to: number } | null>(null);

    // Block handle state
    const [blockHandle, setBlockHandle] = useState<{ top: number; left: number; height: number; pos: number } | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ top: number; left: number; pos: number; showTurnInto: boolean; showColor: boolean } | null>(null);
    // The actual DOM element currently hovered — used for reliable block highlight
    const hoveredBlockRef = useRef<HTMLElement | null>(null);

    // Comment modal state
    const [commentText, setCommentText] = useState('');
    const [commentInputOpen, setCommentInputOpen] = useState<{ pos: number; selectionText?: string; nodeText?: string; top: number } | null>(null);

    const contentAreaRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Inject CSS once
    useEffect(() => {
        if (document.getElementById('gdd-editor-css')) return;
        const s = document.createElement('style');
        s.id = 'gdd-editor-css';
        s.textContent = EDITOR_CSS;
        document.head.appendChild(s);
    }, []);

    // Auto-resize title textarea
    useEffect(() => {
        if (titleRef.current) {
            titleRef.current.style.height = 'auto';
            titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
        }
    }, [title]);

    // Save handler
    const performSave = useCallback((ed: ReturnType<typeof useEditor>) => {
        if (!ed) return;
        const storage = ed.storage as any;
        if (!storage || !storage.markdown) return;
        const markdown = storage.markdown.getMarkdown();
        const fullText = ed.state.doc.textContent;

        // Automatically delete comments whose target block text is no longer in the document!
        const cleanedComments = (doc.comments || []).filter(comment => {
            const match = comment.text.match(/^Regarding "([^"]+)":/);
            const targetText = match ? match[1] : null;
            if (targetText && !isTargetTextStillPresent(targetText, fullText)) {
                return false;
            }
            return true;
        });

        onUpdate({
            ...doc,
            title,
            isPublic,
            content: markdown,
            comments: cleanedComments,
            lastEdited: new Date().toISOString(),
            revisions: [
                { id: `rev-${Date.now()}`, content: markdown, editedAt: new Date().toISOString(), editedBy: currentUser },
                ...(doc.revisions || []).slice(0, 29),
            ],
        });
        setLastSaved(new Date());
        setIsDirty(false);
    }, [doc, title, isPublic, currentUser, onUpdate]);

    // TipTap editor
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            Link.configure({ openOnClick: false }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            Placeholder.configure({ placeholder: "Type '/' for commands, or start writing…" }),
            Markdown.configure({ html: true, transformPastedText: true }),
            ToggleSummary,
            ToggleContent,
            ToggleBlock,
            GDDPageLinkNode,
        ],
        content: doc.content,
        immediatelyRender: false,
        editorProps: {
            handleClick(view, pos, event) {
                const target = event.target as HTMLElement;

                // 1. GDD Page Link click
                const pageLink = target.closest('.gdd-page-link-block');
                if (pageLink) {
                    const pageId = pageLink.getAttribute('data-page-id');
                    if (pageId) {
                        event.preventDefault();
                        event.stopPropagation();
                        const navigateEvent = new CustomEvent('gdd-navigate-page', { detail: { pageId } });
                        window.dispatchEvent(navigateEvent);
                        return true;
                    }
                }

                // 2. Toggle summary click
                const summary = target.closest('.gdd-toggle-summary');
                if (summary) {
                    const details = summary.closest('details');
                    if (details) {
                        event.preventDefault();
                        event.stopPropagation();
                        try {
                            const detailsPos = view.posAtDOM(details, 0);
                            const resolvedPos = view.state.doc.resolve(detailsPos);
                            let depth = resolvedPos.depth;
                            while (depth > 0) {
                                const node = resolvedPos.node(depth);
                                if (node && node.type.name === 'toggle') {
                                    const togglePos = resolvedPos.before(depth);
                                    view.dispatch(
                                        view.state.tr.setNodeMarkup(togglePos, undefined, {
                                            ...node.attrs,
                                            open: !node.attrs.open
                                        })
                                    );
                                    return true;
                                }
                                depth--;
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
                return false;
            }
        },
        onUpdate: ({ editor: ed }) => {
            setIsDirty(true);
            detectSlash(ed);
            if (saveTimer.current) clearTimeout(saveTimer.current);
            // Auto-save after 1.5s of inactivity (Notion-like)
            saveTimer.current = setTimeout(() => performSave(ed), 1500);
        },
    });

    // Detect slash command
    const detectSlash = useCallback((ed: typeof editor) => {
        if (!ed) return;
        const { from, to } = ed.state.selection;
        if (from !== to) { setSlashOpen(false); return; }
        const $from = ed.state.selection.$from;
        const lineText = ed.state.doc.textBetween($from.start(), from, undefined, '\ufffc');
        if (lineText === '/' || (lineText.startsWith('/') && !lineText.includes(' '))) {
            setSlashQuery(lineText.slice(1));
            setSlashOpen(true);
            try {
                const coords = ed.view.coordsAtPos(from);
                const wRect = contentAreaRef.current?.getBoundingClientRect();
                if (wRect) setSlashPos({ top: coords.bottom - wRect.top + 6, left: coords.left - wRect.left });
                slashRangeRef.current = { from: $from.start(), to: from };
            } catch { /* noop */ }
        } else {
            setSlashOpen(false);
            slashRangeRef.current = null;
        }
    }, []);

    // Slash select
    const handleSlashSelect = useCallback((item: SlashItem) => {
        if (!editor || !slashRangeRef.current) return;
        if (item.title === 'Page') {
            const newPageId = 'gdd-' + Date.now();
            editor.chain().focus().deleteRange(slashRangeRef.current).insertContent({
                type: 'gddPageLink',
                attrs: {
                    pageId: newPageId,
                    pageTitle: 'Untitled',
                    pageEmoji: '📄'
                }
            }).run();
            setSlashOpen(false);
            slashRangeRef.current = null;
            
            // Save parent
            performSave(editor);
            
            // Navigate to new subpage
            const event = new CustomEvent('gdd-create-and-navigate', {
                detail: {
                    newPageId,
                    section: doc.section,
                    parentId: doc.id
                }
            });
            window.dispatchEvent(event);
            return;
        }
        editor.chain().focus().deleteRange(slashRangeRef.current).run();
        item.command(editor);
        setSlashOpen(false);
        slashRangeRef.current = null;
    }, [editor, performSave, doc.section, doc.id]);

    // Mouse move → block handle (vertical line detection, Notion-style)
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('[data-block-handle]') ||
            (e.target as HTMLElement).closest('[data-ctxmenu]') ||
            (e.target as HTMLElement).closest('[data-turninto]') ||
            (e.target as HTMLElement).closest('[data-colormenu]')) return;
        if (!editor || !contentAreaRef.current) return;

        const containerRect = contentAreaRef.current.getBoundingClientRect();
        // Only active if horizontal mouse coordinate is within the page column width
        if (e.clientX < containerRect.left || e.clientX > containerRect.right) {
            setBlockHandle(null);
            return;
        }

        const pmDom = editor.view.dom as HTMLElement;
        const clientY = e.clientY;

        // Query all block elements currently in the editor
        const blocks = Array.from(pmDom.querySelectorAll('p, h1, h2, h3, h4, li, blockquote, pre, summary, div[data-type="gdd-page-link"]'));
        
        let el: HTMLElement | null = null;
        for (const block of blocks) {
            const rect = block.getBoundingClientRect();
            // Match block containing clientY vertically (with 4px margin of error)
            if (clientY >= rect.top - 4 && clientY <= rect.bottom + 4) {
                el = block as HTMLElement;
            }
        }

        if (!el) {
            setBlockHandle(null);
            return;
        }

        try {
            const rect = el.getBoundingClientRect();
            const pos = editor.view.posAtDOM(el, 0);

            // Store direct DOM reference for reliable highlighting later
            hoveredBlockRef.current = el;

            // Align handle with the center of the first line of the block (Notion-style)
            let lineCenter = rect.height / 2; // Default for single-line blocks
            if (rect.height > 32) {
                if (el.classList.contains('gdd-page-link-block') || el.getAttribute('data-type') === 'gdd-page-link') {
                    lineCenter = rect.height / 2;
                } else if (el.tagName === 'H1' || el.classList.contains('gdd-toggle-summary-h1')) {
                    lineCenter = 22;
                } else if (el.tagName === 'H2' || el.classList.contains('gdd-toggle-summary-h2')) {
                    lineCenter = 18;
                } else if (el.tagName === 'H3' || el.classList.contains('gdd-toggle-summary-h3')) {
                    lineCenter = 16;
                } else if (el.tagName === 'H4' || el.classList.contains('gdd-toggle-summary-h4')) {
                    lineCenter = 14;
                } else {
                    lineCenter = 12; // Paragraphs, list items, quotes, code blocks
                }
            }
            setBlockHandle({ top: rect.top - containerRect.top + lineCenter, left: rect.left - containerRect.left - 64, height: 0, pos });
        } catch { setBlockHandle(null); }
    }, [editor]);

    // Open context menu
    const openContextMenu = useCallback((handle: typeof blockHandle) => {
        if (!handle || !editor || !contentAreaRef.current) return;
        const wRect = contentAreaRef.current.getBoundingClientRect();
        // Viewport-relative left (aligned next to the indented handle)
        const left = wRect.left + handle.left + 68;
        // Viewport-relative top
        const top = wRect.top + handle.top - 40;
        setCtxMenu({ top, left, pos: handle.pos, showTurnInto: false, showColor: false });
    }, [editor]);

    // Add comment to GDD document comments array
    const handleAddComment = useCallback((text: string) => {
        const newComment: GDDComment = {
            id: `comment-${Date.now()}`,
            author: currentUser,
            text: text,
            resolved: false,
            createdAt: new Date().toISOString()
        };
        onUpdate({
            ...doc,
            comments: [...(doc.comments || []), newComment]
        });
    }, [doc, currentUser, onUpdate]);

    // Submit custom comment from the dialog
    const submitComment = () => {
        if (!commentText.trim() || !commentInputOpen) return;
        if (commentInputOpen.selectionText) {
            handleAddComment(`Regarding "${commentInputOpen.selectionText}": ${commentText}`);
        } else if (commentInputOpen.nodeText) {
            handleAddComment(`Regarding "${commentInputOpen.nodeText.slice(0, 80)}${commentInputOpen.nodeText.length > 80 ? '...' : ''}": ${commentText}`);
        }
        setCommentText('');
        setCommentInputOpen(null);
    };

    // Comment from 6-dot block menu
    const handleBlockComment = useCallback(() => {
        if (!editor || !ctxMenu) return;
        try {
            const { node } = getBlockInfo(ctxMenu.pos, editor);
            setCommentInputOpen({
                pos: ctxMenu.pos,
                nodeText: node.textContent,
                top: ctxMenu.top + 40 // Align with block vertically
            });
        } catch (e) {
            console.error("Block comment failed", e);
        }
        setCtxMenu(null);
    }, [editor, ctxMenu]);

    // Color select from 6-dot block menu (safe range calculation - no extra line creation)
    const handleBlockColorSelect = useCallback((item: ColorItem) => {
        if (!editor || !ctxMenu) return;
        try {
            const { startPos, node } = getBlockInfo(ctxMenu.pos, editor);
            const textLen = node.textContent.length;
            if (textLen > 0) {
                editor.chain().focus().setTextSelection({ from: startPos, to: startPos + textLen }).run();
                if (item.color === 'inherit') {
                    editor.chain().focus().unsetColor().unsetHighlight().run();
                } else if (item.isBg) {
                    editor.chain().focus().unsetHighlight().setHighlight({ color: item.color }).run();
                } else {
                    editor.chain().focus().unsetColor().setColor(item.color).run();
                }
                editor.chain().setTextSelection(startPos + textLen).run();
            } else {
                editor.chain().focus().setTextSelection(startPos).run();
                if (item.color === 'inherit') {
                    editor.chain().focus().unsetColor().unsetHighlight().run();
                } else if (item.isBg) {
                    editor.chain().focus().unsetHighlight().setHighlight({ color: item.color }).run();
                } else {
                    editor.chain().focus().unsetColor().setColor(item.color).run();
                }
            }
        } catch (e) {
            console.error("Block color selection failed", e);
        }
        setCtxMenu(null);
    }, [editor, ctxMenu]);

    // Turn into
    const handleTurnInto = useCallback((item: TurnIntoItem) => {
        if (!editor || !ctxMenu) return;
        if (item.label === 'Page') {
            const newPageId = 'gdd-' + Date.now();
            try {
                const { nodePos, node } = getBlockInfo(ctxMenu.pos, editor);
                const pageTitle = node.textContent.trim() || 'Untitled';
                // Replace current block with GDDPageLink block node
                editor.chain().focus().deleteRange({ from: nodePos, to: nodePos + node.nodeSize }).insertContentAt(nodePos, {
                    type: 'gddPageLink',
                    attrs: {
                        pageId: newPageId,
                        pageTitle: pageTitle,
                        pageEmoji: '📄'
                    }
                }).run();
                setCtxMenu(null);

                // Save parent
                performSave(editor);

                // Navigate to new page
                const event = new CustomEvent('gdd-create-and-navigate', {
                    detail: {
                        newPageId,
                        title: pageTitle,
                        section: doc.section,
                        parentId: doc.id
                    }
                });
                window.dispatchEvent(event);
            } catch (e) {
                console.error("Turn into page failed", e);
                setCtxMenu(null);
            }
            return;
        }
        try {
            const { startPos } = getBlockInfo(ctxMenu.pos, editor);
            editor.chain().focus().setTextSelection(startPos).run();
            item.command(editor);
        } catch (e) {
            console.error("Turn into failed", e);
        }
        setCtxMenu(null);
    }, [editor, ctxMenu, performSave, doc.section, doc.id]);

    // Delete block
    const handleDeleteBlock = useCallback(() => {
        if (!editor || !ctxMenu) return;
        try {
            const { nodePos, node } = getBlockInfo(ctxMenu.pos, editor);
            editor.chain().focus().deleteRange({ from: nodePos, to: nodePos + node.nodeSize }).run();
        } catch (e) {
            console.error("Delete block failed", e);
        }
        setCtxMenu(null);
    }, [editor, ctxMenu]);

    // Duplicate block
    const handleDuplicateBlock = useCallback(() => {
        if (!editor || !ctxMenu) return;
        try {
            const { nodePos, node } = getBlockInfo(ctxMenu.pos, editor);
            const insertAt = nodePos + node.nodeSize;
            editor.chain().focus().insertContentAt(insertAt, node.toJSON()).run();
        } catch (e) {
            console.error("Duplicate block failed", e);
        }
        setCtxMenu(null);
    }, [editor, ctxMenu]);

    // Add block below
    const handleAddBlock = useCallback((pos: number) => {
        if (!editor) return;
        try {
            const { nodePos, node } = getBlockInfo(pos, editor);
            const insertAt = nodePos + node.nodeSize;
            editor.chain().focus().insertContentAt(insertAt, { type: 'paragraph' }).setTextSelection(insertAt + 1).run();
        } catch (e) {
            editor.chain().focus().enter().run();
        }
    }, [editor]);

    // Scroll to block when clicked in comments panel
    useEffect(() => {
        if (!selectedComment || !editor) return;
        try {
            const pmDom = editor.view.dom as HTMLElement;
            const match = selectedComment.text.match(/^Regarding "([^"]+)":/);
            const targetText = match ? match[1] : selectedComment.text;
            const targetEl = findElementForTarget(pmDom, targetText);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash highlighted block
                targetEl.classList.add('bg-blue-500/10');
                setTimeout(() => targetEl.classList.remove('bg-blue-500/10'), 2000);
            }
        } catch (err) {
            console.error("Scroll to comment target failed", err);
        }
    }, [selectedComment, editor]);

    // Listen to custom event to scroll to a heading in the document outline
    useEffect(() => {
        if (!editor) return;
        const handleScrollToHeading = (e: Event) => {
            const { headingText } = (e as CustomEvent).detail;
            try {
                const pmDom = editor.view.dom as HTMLElement;
                // Find all elements that could be headings (h1, h2, h3, h4, summary)
                const headings = Array.from(pmDom.querySelectorAll('h1, h2, h3, h4, summary'));
                const targetEl = headings.find(el => el.textContent?.trim() === headingText.trim());
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Briefly flash background color to draw attention
                    targetEl.classList.add('bg-blue-500/10');
                    setTimeout(() => targetEl.classList.remove('bg-blue-500/10'), 2000);
                }
            } catch (err) {
                console.error("Scroll to outline target heading failed", err);
            }
        };
        window.addEventListener('gdd-scroll-to-heading', handleScrollToHeading);
        return () => window.removeEventListener('gdd-scroll-to-heading', handleScrollToHeading);
    }, [editor]);

    // Highlight commented blocks in the editor
    useEffect(() => {
        if (!editor || !doc.comments) return;
        try {
            const pmDom = editor.view.dom as HTMLElement;
            pmDom.querySelectorAll('.gdd-commented-block').forEach(el => el.classList.remove('gdd-commented-block'));

            doc.comments.forEach(comment => {
                if (comment.resolved) return;
                const match = comment.text.match(/^Regarding "([^"]+)":/);
                const targetText = match ? match[1] : null;
                if (!targetText) return;

                const targetEl = findElementForTarget(pmDom, targetText);
                if (targetEl) {
                    targetEl.classList.add('gdd-commented-block');
                }
            });
        } catch (err) {
            console.error("Highlighting commented blocks failed", err);
        }
    }, [editor, doc.comments, editor?.state.doc]);

    // Highlight the active block while context menu is open (direct DOM ref — always reliable)
    useEffect(() => {
        if (!ctxMenu) return;
        // Use the stored hovered element ref (set during mousemove), which is always the exact element
        const activeDom = hoveredBlockRef.current;
        if (activeDom) {
            activeDom.classList.add('gdd-active-block-highlight');
            return () => {
                activeDom.classList.remove('gdd-active-block-highlight');
            };
        }
    }, [ctxMenu]);

    // Close context menu on scroll (ignore scrolls inside menu lists)
    useEffect(() => {
        if (!ctxMenu) return;
        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target && (target.closest('[data-ctxmenu]') || target.closest('[data-turninto]') || target.closest('[data-colormenu]'))) {
                return;
            }
            setCtxMenu(null);
        };
        window.addEventListener('scroll', handleScroll, true); // capture phase
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [ctxMenu]);

    // Word count (manual — no CharacterCount extension needed)
    const wordCount = useMemo(() => {
        if (!editor) return 0;
        try {
            const text = editor.state.doc.textContent;
            return text.trim() ? text.trim().split(/\s+/).length : 0;
        } catch { return 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor?.state]);

    // Ctrl+S
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (editor) performSave(editor); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [editor, performSave]);

    // Handle click on Page Link blocks to navigate
    useEffect(() => {
        if (!editor) return;
        const pmDom = editor.view.dom as HTMLElement;
        const handleDomClick = (e: MouseEvent) => {
            const pageLink = (e.target as HTMLElement).closest('.gdd-page-link-block');
            if (pageLink) {
                const pageId = pageLink.getAttribute('data-page-id');
                if (pageId) {
                    const event = new CustomEvent('gdd-navigate-page', { detail: { pageId } });
                    window.dispatchEvent(event);
                }
            }
        };
        pmDom.addEventListener('click', handleDomClick);
        return () => pmDom.removeEventListener('click', handleDomClick);
    }, [editor]);

    // Sync GDD Page Link block titles and emojis dynamically from the docs prop
    useEffect(() => {
        if (!editor || !docs) return;
        const pmDom = editor.view.dom as HTMLElement;
        pmDom.querySelectorAll('.gdd-page-link-block').forEach(el => {
            const pageId = el.getAttribute('data-page-id');
            const docData = docs.find(d => d.id === pageId);
            if (docData) {
                // Update title span text
                const titleEl = el.querySelector('.gdd-page-link-title');
                if (titleEl && titleEl.textContent !== docData.title) {
                    titleEl.textContent = docData.title;
                }
                // Update emoji span text
                const emojiEl = el.querySelector('.gdd-page-link-emoji');
                if (emojiEl && emojiEl.textContent !== docData.emoji) {
                    emojiEl.textContent = docData.emoji || '📄';
                }
            }
        });
    }, [editor, docs, editor?.state.doc]);

    // Filtered slash items
    const filteredSlash = useMemo(() => {
        if (!slashQuery) return SLASH_ITEMS;
        const q = slashQuery.toLowerCase();
        return SLASH_ITEMS.filter(i => i.title.toLowerCase().includes(q) || i.keywords?.some(k => k.includes(q)));
    }, [slashQuery]);

    return (
        <div className="flex flex-col h-full bg-zinc-950 min-h-0">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/70 bg-zinc-950/90 backdrop-blur-sm flex-shrink-0">
                <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span>
                        {doc.parentId 
                            ? docs.find(d => d.id === doc.parentId)?.title || 'Back'
                            : 'GDD Hub'}
                    </span>
                </button>
                <div className="flex items-center gap-2">
                    {isDirty ? (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <Loader2 className="w-3 h-3 animate-spin" />Saving…
                        </span>
                    ) : lastSaved ? (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                            <Check className="w-3 h-3" />Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : null}
                    <button
                        onClick={() => { const next = !isPublic; setIsPublic(next); setIsDirty(true); }}
                        className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all', isPublic ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200')}
                    >
                        {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {isPublic ? 'Public' : 'Private'}
                    </button>
                </div>
            </div>

            {/* Editor scroll area */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div
                    ref={contentAreaRef}
                    className="relative max-w-3xl mx-auto px-20 pt-16 pb-40"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => { if (!ctxMenu) setBlockHandle(null); }}
                >
                    {/* Block handle */}
                    {blockHandle && !ctxMenu && (
                        <div
                            data-block-handle
                            style={{
                                top: blockHandle.top - 22,
                                position: 'absolute',
                                left: blockHandle.left,
                                paddingLeft: 4,
                                paddingRight: 12,
                                paddingTop: 10,
                                paddingBottom: 10,
                            }}
                            className="flex items-center gap-0.5 z-20"
                        >
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddBlock(blockHandle.pos);
                                }}
                                title="Add block below"
                                className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openContextMenu(blockHandle);
                                }}
                                title="Open block menu"
                                className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                            >
                                <GripVertical className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Context menu */}
                    {ctxMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-40 bg-transparent cursor-default"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setCtxMenu(null);
                                }}
                            />
                            <BlockContextMenu
                                position={{ top: ctxMenu.top, left: ctxMenu.left }}
                                onTurnInto={() => setCtxMenu(m => m ? { ...m, showTurnInto: !m.showTurnInto, showColor: false } : null)}
                                onColor={() => setCtxMenu(m => m ? { ...m, showTurnInto: false, showColor: !m.showColor } : null)}
                                onComment={handleBlockComment}
                                onDelete={handleDeleteBlock}
                                onDuplicate={handleDuplicateBlock}
                            />
                            {ctxMenu.showTurnInto && (
                                <TurnIntoMenu
                                    position={{ top: ctxMenu.top + 8, left: ctxMenu.left + 220 }}
                                    onSelect={handleTurnInto}
                                />
                            )}
                            {ctxMenu.showColor && (
                                <ColorMenu
                                    position={{ top: ctxMenu.top + 44, left: ctxMenu.left + 220 }}
                                    onSelect={handleBlockColorSelect}
                                />
                            )}
                        </>
                    )}

                    {/* Slash menu */}
                    {slashOpen && filteredSlash.length > 0 && (
                        <SlashDropdown items={filteredSlash} position={slashPos} onSelect={handleSlashSelect} onClose={() => setSlashOpen(false)} />
                    )}


                    {/* Notion-style comment input popup dialog in the right gutter */}
                    {commentInputOpen && (
                        <div
                            style={{ top: commentInputOpen.top - 10, right: '16px' }}
                            className="absolute z-30 w-72 bg-zinc-900 border border-zinc-700/80 rounded-xl p-3 shadow-xl shadow-black/80 flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                                    Add comment
                                </span>
                                <button
                                    onClick={() => { setCommentInputOpen(null); setCommentText(''); }}
                                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                >
                                    Cancel
                                </button>
                            </div>
                            {commentInputOpen.selectionText && (
                                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 mb-2 text-[10px] text-zinc-400 italic max-h-16 overflow-y-auto break-words leading-normal scrollbar-thin-dark">
                                    "{commentInputOpen.selectionText}"
                                </div>
                            )}
                            <textarea
                                autoFocus
                                placeholder="Add a comment..."
                                className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500 transition-colors resize-none mb-2 scrollbar-thin-dark"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        submitComment();
                                    }
                                }}
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={submitComment}
                                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all"
                                >
                                    Comment
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Page title */}
                    <div className="mb-10">
                        <div className="text-5xl mb-3 select-none w-fit cursor-default">{doc.emoji || '📄'}</div>
                        <textarea
                            ref={titleRef}
                            value={title}
                            onChange={e => { setTitle(e.target.value); setIsDirty(true); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start'); } }}
                            placeholder="Untitled"
                            rows={1}
                            className="w-full bg-transparent resize-none overflow-hidden text-[2.5rem] font-extrabold text-white placeholder-zinc-700 outline-none"
                            style={{ lineHeight: 1.12 }}
                        />
                    </div>

                    {/* TipTap editor */}
                    <div className="gdd-prosemirror">
                        {editor && (
                            <BubbleMenu editor={editor} shouldShow={() => !editor.state.selection.empty && !editor.isActive('codeBlock')}>
                                <BubbleToolbar
                                    editor={editor}
                                    onRequestComment={(pos, selText) => {
                                        try {
                                            const coords = editor.view.coordsAtPos(pos);
                                            const containerRect = contentAreaRef.current?.getBoundingClientRect();
                                            const top = containerRect ? coords.top - containerRect.top : 200;
                                            setCommentInputOpen({ pos, selectionText: selText, top });
                                        } catch {
                                            setCommentInputOpen({ pos, selectionText: selText, top: 200 });
                                        }
                                    }}
                                />
                            </BubbleMenu>
                        )}
                        <EditorContent editor={editor} />
                    </div>
                </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-6 py-1.5 border-t border-zinc-800/50 flex-shrink-0 bg-zinc-950">
                <div className="flex items-center gap-3 text-[11px] text-zinc-700">
                    <span>{wordCount} words</span>
                    <span>·</span>
                    <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
                </div>
                <div className="text-[11px] text-zinc-700">/ for commands · auto-saved</div>
            </div>
        </div>
    );
}

