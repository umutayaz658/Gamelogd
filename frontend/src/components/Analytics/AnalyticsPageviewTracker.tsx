'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAnalyticsConsent } from '@/context/AnalyticsConsentContext';

function PageviewTrackerInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { isAuthenticated } = useAuth();
    const { consent } = useAnalyticsConsent();
    const loggedUserPropRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (consent !== 'granted' || typeof window.gtag !== 'function') return;
        if (loggedUserPropRef.current !== isAuthenticated) {
            loggedUserPropRef.current = isAuthenticated;
            window.gtag('set', 'user_properties', { logged_in: isAuthenticated });
        }
    }, [isAuthenticated, consent]);

    useEffect(() => {
        if (consent !== 'granted' || typeof window.gtag !== 'function') return;
        const query = searchParams.toString();
        window.gtag('event', 'page_view', {
            page_path: query ? `${pathname}?${query}` : pathname,
        });
    }, [pathname, searchParams, consent]);

    return null;
}

/**
 * Mounted once in the root layout alongside the other singleton overlays (MessagesDrawer,
 * ReplyModal, etc.) — because it lives there, every route in the app is covered without
 * touching individual pages. `useSearchParams` requires a Suspense boundary in the App
 * Router, hence the wrapper.
 */
export default function AnalyticsPageviewTracker() {
    return (
        <Suspense fallback={null}>
            <PageviewTrackerInner />
        </Suspense>
    );
}
