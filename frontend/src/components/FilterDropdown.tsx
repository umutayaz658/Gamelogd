import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface FilterDropdownProps {
    label: string;
    icon?: React.ReactNode;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    showAllOption?: boolean;
    allLabel?: string;
    // Which edge the popover hangs from — 'right' avoids overflowing off the
    // right side of narrow viewports for triggers positioned near the right
    // edge of their row (e.g. a Sort dropdown in a `justify-end` toolbar).
    align?: 'left' | 'right';
    // Whether a non-empty value gets the emerald "filter applied" treatment.
    // Set to false for dropdowns that always have a value (e.g. Sort, which
    // has no "All" state) so they stay neutral like an unselected filter
    // instead of permanently looking "active".
    showSelectionAccent?: boolean;
}

export default function FilterDropdown({ label, icon, options, value, onChange, showAllOption = true, allLabel, align = 'left', showSelectionAccent = true }: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // The menu is portaled to <body> (see render below) so it can't be clipped
    // by an ancestor's `overflow-x-auto` — a horizontally-scrollable row like
    // the mobile filter bar forces overflow-y to clip too (per the CSS spec),
    // which silently hid this dropdown when it lived inside that row.
    const updatePosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition(
            align === 'right'
                ? { top: rect.bottom + 8, right: window.innerWidth - rect.right }
                : { top: rect.bottom + 8, left: rect.left }
        );
    };

    const handleToggle = () => {
        if (!isOpen) updatePosition();
        setIsOpen((prev) => !prev);
    };

    // Close on click outside (checks both the trigger button and the portaled menu)
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (
                buttonRef.current && !buttonRef.current.contains(target) &&
                menuRef.current && !menuRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Keep the menu aligned with the trigger if the window resizes while open
    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const selectedOption = options.find(opt => opt.value === value);
    const isAccented = showSelectionAccent && !!value;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${isOpen || isAccented
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
            >
                {icon && <span className={isAccented ? "text-emerald-500" : ""}>{icon}</span>}
                <span className={isAccented ? "text-emerald-500" : ""}>
                    {selectedOption ? selectedOption.label : label}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {mounted && isOpen && position && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: position.top, left: position.left, right: position.right }}
                    className="w-56 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                    <div className="p-1">
                        {showAllOption && (
                            <button
                                onClick={() => { onChange(''); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${value === '' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                            >
                                {allLabel || `All ${label.replace('All ', '')}`}
                            </button>
                        )}
                        {/* Caps the visible list to ~5 rows — the rest scrolls instead of
                            growing the popover unbounded when there are many options. */}
                        <div className="max-h-[220px] overflow-y-auto">
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
                </div>,
                document.body
            )}
        </div>
    );
}
