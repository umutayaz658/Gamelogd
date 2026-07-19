'use client';

import { useState, useEffect, useRef } from 'react';
import { getCountryCallingCode } from 'react-phone-number-input';
import { ChevronDown, Search, Check } from 'lucide-react';

interface CustomCountrySelectProps {
    value?: string;
    onChange: (value?: string) => void;
    options: { value?: string; label: string }[];
}

/**
 * Country-code dropdown for react-phone-number-input's `countrySelectComponent` slot.
 * Shared between the register page and Settings so both phone number fields look and
 * behave identically.
 */
export default function CustomCountrySelect({ value, onChange, options }: CustomCountrySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const filteredOptions = options.filter(opt => {
        if (!opt.value) return false;
        const name = opt.label.toLowerCase();
        const code = opt.value.toLowerCase();
        const query = search.toLowerCase();
        return name.includes(query) || code.includes(query);
    });

    return (
        <div className="relative shrink-0" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm font-semibold transition-all duration-200 focus:outline-none ${
                    isOpen
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
            >
                <span className="text-zinc-200 font-semibold text-xs uppercase">
                    {value ? `${value} (+${getCountryCallingCode(value as any)})` : 'Select'}
                </span>
                <ChevronDown className={`h-3 w-3 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 max-h-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/80 overflow-hidden z-50 flex flex-col">
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar {
                            width: 5px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: transparent;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: #27272a;
                            border-radius: 99px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: #3f3f46;
                        }
                    `}</style>
                    {/* Search Box */}
                    <div className="p-2 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950/30">
                        <Search className="h-4 w-4 text-zinc-500 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search country..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none border-none ring-0"
                            autoFocus
                        />
                    </div>
                    {/* Country List */}
                    <div className="overflow-y-auto p-1 flex-1 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="text-zinc-600 text-xs text-center py-4">No countries found</div>
                        ) : (
                            filteredOptions.map((option) => {
                                const callingCode = option.value ? getCountryCallingCode(option.value as any) : '';
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                            value === option.value
                                                ? 'bg-emerald-500/10 text-emerald-500 font-semibold'
                                                : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="truncate text-xs">{option.label}</span>
                                            <span className="text-zinc-500 text-[10px] font-bold shrink-0">
                                                (+{callingCode})
                                            </span>
                                        </div>
                                        {value === option.value && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
