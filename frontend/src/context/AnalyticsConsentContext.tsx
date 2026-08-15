'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ConsentState = 'unknown' | 'granted' | 'denied';

interface AnalyticsConsentApi {
    consent: ConsentState;
    grant: () => void;
    deny: () => void;
}

const STORAGE_KEY = 'gamelogd_analytics_consent';

const AnalyticsConsentContext = createContext<AnalyticsConsentApi | null>(null);

/**
 * Gates whether the GA4 script is ever loaded. Starts as 'unknown' on every render
 * (server and first client paint) and is hydrated from localStorage in an effect —
 * this avoids a hydration mismatch while still resolving to the user's real choice
 * before the banner has a chance to flash for returning visitors.
 */
export function AnalyticsConsentProvider({ children }: { children: React.ReactNode }) {
    const [consent, setConsent] = useState<ConsentState>('unknown');

    useEffect(() => {
        // Reading localStorage (an external system, unavailable during SSR) can only happen
        // client-side after mount — there's no lint-clean way to avoid this one extra render.
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'granted' || stored === 'denied') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setConsent(stored);
        }
    }, []);

    const grant = useCallback(() => {
        window.localStorage.setItem(STORAGE_KEY, 'granted');
        setConsent('granted');
    }, []);

    const deny = useCallback(() => {
        window.localStorage.setItem(STORAGE_KEY, 'denied');
        setConsent('denied');
    }, []);

    const api = useMemo(() => ({ consent, grant, deny }), [consent, grant, deny]);

    return (
        <AnalyticsConsentContext.Provider value={api}>
            {children}
        </AnalyticsConsentContext.Provider>
    );
}

export function useAnalyticsConsent(): AnalyticsConsentApi {
    const ctx = useContext(AnalyticsConsentContext);
    if (!ctx) {
        // Defensive fallback — should never happen given the root-layout mount. Treat as
        // permanently denied rather than throwing, so a missing provider never blocks render.
        return { consent: 'denied', grant: () => {}, deny: () => {} };
    }
    return ctx;
}
