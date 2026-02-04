import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface FilterDropdownProps {
    label: string;
    icon?: React.ReactNode;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
}

export default function FilterDropdown({ label, icon, options, value, onChange }: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
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

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${isOpen || value
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
            >
                {icon && <span className={value ? "text-emerald-500" : ""}>{icon}</span>}
                <span className={value ? "text-emerald-500" : ""}>
                    {selectedOption ? selectedOption.label : label}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu (Pop-over) */}
            <div
                className={`absolute top-full left-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-50 transform transition-all duration-200 origin-top-left ${isOpen
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                    }`}
            >
                <div className="p-1">
                    <button
                        onClick={() => { onChange(''); setIsOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${value === '' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                    >
                        All {label.replace('All ', '')}
                    </button>
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => { onChange(option.value); setIsOpen(false); }}
                            className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-colors ${value === option.value
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                }`}
                        >
                            {option.label}
                            {value === option.value && <Check className="h-4 w-4" />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
