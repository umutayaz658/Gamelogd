'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SideDrawerProps {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    widthClassName?: string;
}

export default function SideDrawer({ isOpen, title, subtitle, onClose, children, footer, widthClassName = 'max-w-md' }: SideDrawerProps) {
    if (typeof document === 'undefined') return null;
    // Rendered via a portal straight into <body>: any ancestor modal using backdrop-blur (a CSS
    // filter) establishes a new containing block for `position: fixed` descendants, which traps
    // a nested fixed-position drawer inside that ancestor's stacking context — no z-index value
    // can then lift it above unrelated root-level overlays (e.g. the Messages drawer). Portaling
    // out to <body> sidesteps that entirely.
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100050] flex justify-end">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                        className={`relative h-full w-full ${widthClassName} bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col`}
                    >
                        <div className="flex items-start justify-between gap-4 p-5 border-b border-zinc-800 flex-shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-white truncate">{title}</h3>
                                {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
                            </div>
                            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-900 transition-all flex-shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-thin-dark p-5">
                            {children}
                        </div>

                        {footer && (
                            <div className="p-5 border-t border-zinc-800 flex-shrink-0">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
