import { createContext, ReactNode, useContext, useState } from 'react';

interface AnonBannerContextValue {
  dismissed: boolean;
  dismiss: () => void;
}

const AnonBannerContext = createContext<AnonBannerContextValue | undefined>(undefined);

// Mirrors web's sessionStorage-backed dismissal (frontend/src/components/AnonBanner.tsx)
// closely enough for Phase 1: an in-memory flag that survives for as long as the app
// process is alive — not persisted to disk (resets on a real app restart, unlike web's
// per-browser-tab session). Provided at the root layout, above both the (auth) and
// (tabs) route groups, specifically so it survives navigating between them (e.g. a
// login/logout round trip) — local state inside the (tabs) layout does NOT survive
// that, since navigating into (auth) unmounts (tabs) and remounts it on return.
export function AnonBannerProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <AnonBannerContext.Provider value={{ dismissed, dismiss: () => setDismissed(true) }}>
      {children}
    </AnonBannerContext.Provider>
  );
}

export function useAnonBanner(): AnonBannerContextValue {
  const ctx = useContext(AnonBannerContext);
  if (!ctx) {
    throw new Error('useAnonBanner must be used within an AnonBannerProvider');
  }
  return ctx;
}
