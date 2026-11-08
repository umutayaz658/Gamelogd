import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

interface ToastContextValue extends ToastApi {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Mirrors frontend/src/context/ToastContext.tsx's {success,error,info} API and per-type
// auto-dismiss timing (errors linger longer so the user can read what went wrong).
// Mounted once at the root layout so useToast() works from any screen — but the actual
// visual stack is a separate component (ToastOverlay), mounted inside (tabs)/_layout.tsx
// where the tab bar's measured height is already known, so toasts float above the tab
// bar/AnonBanner (Faz 2 plan decision 4) instead of being obscured by them.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      const ttl = type === 'error' ? 6000 : 4000;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  const success = useCallback((m: string) => push('success', m), [push]);
  const error = useCallback((m: string) => push('error', m), [push]);
  const info = useCallback((m: string) => push('info', m), [push]);

  const value = useMemo<ToastContextValue>(
    () => ({ success, error, info, toasts, dismiss }),
    [success, error, info, toasts, dismiss]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

/** Internal — consumed only by ToastOverlay to render the current stack. */
export function useToastState(): { toasts: ToastItem[]; dismiss: (id: number) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastState must be used within a ToastProvider');
  }
  return ctx;
}
