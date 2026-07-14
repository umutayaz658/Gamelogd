'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * App-wide async confirmation dialog — the design-consistent replacement for the
 * browser's native `confirm()`. Mounted once in the root layout. Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: 'Delete this?', isDanger: true }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>((opts) => {
        setOptions(opts);
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    const settle = useCallback((value: boolean) => {
        resolverRef.current?.(value);
        resolverRef.current = null;
        setOptions(null);
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <ConfirmModal
                isOpen={options !== null}
                onClose={() => settle(false)}
                onConfirm={() => settle(true)}
                title={options?.title ?? 'Are you sure?'}
                message={options?.message ?? ''}
                confirmText={options?.confirmText}
                cancelText={options?.cancelText}
                isDanger={options?.isDanger}
            />
        </ConfirmContext.Provider>
    );
}

export function useConfirm(): ConfirmFn {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        // Defensive fallback to native confirm if provider is missing.
        return async (opts) =>
            typeof window !== 'undefined' ? window.confirm(opts.message) : false;
    }
    return ctx;
}
