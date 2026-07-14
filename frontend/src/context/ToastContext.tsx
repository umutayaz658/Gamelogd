'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
    id: number;
    type: ToastType;
    message: string;
}

interface ToastApi {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * App-wide toast notifications — the design-consistent replacement for the browser's
 * native `alert()`. Mounted once in the root layout; call `useToast()` from any client
 * component. Toasts auto-dismiss after a few seconds and stack in the bottom-right.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idRef = useRef(0);

    const remove = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const push = useCallback((type: ToastType, message: string) => {
        const id = ++idRef.current;
        setToasts((prev) => [...prev, { id, type, message }]);
        // Errors linger a little longer so the user can read what went wrong.
        const ttl = type === 'error' ? 6000 : 4000;
        setTimeout(() => remove(id), ttl);
    }, [remove]);

    const api: ToastApi = {
        success: useCallback((m: string) => push('success', m), [push]),
        error: useCallback((m: string) => push('error', m), [push]),
        info: useCallback((m: string) => push('info', m), [push]),
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2.5 pointer-events-none max-w-[calc(100vw-2rem)]">
                <AnimatePresence initial={false}>
                    {toasts.map((toast) => (
                        <Toast key={toast.id} toast={toast} onClose={() => remove(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />,
};

const ACCENTS: Record<ToastType, string> = {
    success: 'border-emerald-600/40',
    error: 'border-red-600/40',
    info: 'border-blue-600/40',
};

function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className={`pointer-events-auto flex items-start gap-3 w-80 max-w-full bg-zinc-900 border ${ACCENTS[toast.type]} rounded-xl shadow-2xl px-4 py-3.5`}
        >
            {ICONS[toast.type]}
            <p className="text-sm text-zinc-200 leading-snug font-medium flex-1 whitespace-pre-line break-words">
                {toast.message}
            </p>
            <button
                onClick={onClose}
                className="p-0.5 text-zinc-500 hover:text-white rounded-md transition-colors cursor-pointer flex-shrink-0"
                aria-label="Dismiss"
            >
                <X className="h-4 w-4" />
            </button>
        </motion.div>
    );
}

/**
 * Access the toast API. Returns `{ success, error, info }`.
 * Falls back to a no-throw stub (native alert) if used outside the provider so a
 * missing provider never crashes a page — but the provider is mounted app-wide.
 */
export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // Extremely defensive: should never happen given the root-layout mount.
        return {
            success: (m) => typeof window !== 'undefined' && window.alert(m),
            error: (m) => typeof window !== 'undefined' && window.alert(m),
            info: (m) => typeof window !== 'undefined' && window.alert(m),
        };
    }
    return ctx;
}
