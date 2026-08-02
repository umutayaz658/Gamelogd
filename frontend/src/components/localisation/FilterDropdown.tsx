'use client';

import { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared dropdown filter control — used by the public Localisation panel (language/namespace/
 * status) and the Contributors panel (language), so both look and behave identically. */
export default function FilterDropdown<T extends string>({
    label, icon: Icon = Filter, value, options, onChange,
}: {
    label: string;
    icon?: React.ElementType;
    value: T;
    options: { key: T; label: string }[];
    onChange: (v: T) => void;
}) {
    const [open, setOpen] = useState(false);
    const current = options.find((o) => o.key === value);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-300 transition-all"
            >
                <Icon className="w-3.5 h-3.5" />
                {current?.label ?? label}
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full mt-2 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-48 max-h-44 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        {options.map((opt) => (
                            <button
                                key={opt.key}
                                onClick={() => { onChange(opt.key); setOpen(false); }}
                                className={cn('w-full text-left px-2.5 py-2 text-xs rounded-lg font-semibold transition-colors',
                                    value === opt.key ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-900')}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
