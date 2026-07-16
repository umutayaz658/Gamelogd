'use client';

import { Link2, Plus, X } from 'lucide-react';

export interface ExtraLink {
    label: string;
    url: string;
}

interface ExtraLinksEditorProps {
    value: ExtraLink[];
    onChange: (links: ExtraLink[]) => void;
}

/**
 * Editor for the arbitrary "beyond the 3 standard socials" links stored on Organisation/Project's
 * extra_links JSON field. Shared by both dashboards so the add/remove/edit behavior never diverges.
 */
export default function ExtraLinksEditor({ value, onChange }: ExtraLinksEditorProps) {
    const updateLink = (index: number, patch: Partial<ExtraLink>) => {
        onChange(value.map((link, i) => (i === index ? { ...link, ...patch } : link)));
    };

    const removeLink = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    const addLink = () => {
        onChange([...value, { label: '', url: '' }]);
    };

    return (
        <div className="space-y-2">
            {value.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 focus-within:border-blue-500/50 transition-all w-32 shrink-0">
                        <input
                            type="text"
                            className="w-full bg-transparent border-none text-white text-xs outline-none py-2"
                            value={link.label}
                            onChange={(e) => updateLink(i, { label: e.target.value })}
                            placeholder="Label"
                        />
                    </div>
                    <div className="flex items-center flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 focus-within:border-blue-500/50 transition-all">
                        <Link2 className="h-4 w-4 text-zinc-650 mr-2 shrink-0" />
                        <input
                            type="url"
                            className="flex-1 bg-transparent border-none text-white text-xs outline-none py-2 min-w-0"
                            value={link.url}
                            onChange={(e) => updateLink(i, { url: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => removeLink(i)}
                        className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={addLink}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-950 border border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2 transition-all"
            >
                <Plus className="h-3.5 w-3.5" /> Add Link
            </button>
        </div>
    );
}
