'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

function PageviewTrackerInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { isAuthenticated } = useAuth();
    const loggedUserPropRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (typeof window.gtag !== 'function') return;
        if (loggedUserPropRef.current !== isAuthenticated) {
            loggedUserPropRef.current = isAuthenticated;
            window.gtag('set', 'user_properties', { logged_in: isAuthenticated });
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (typeof window.gtag !== 'function') return;
        const query = searchParams.toString();
        window.gtag('event', 'page_view', {
            page_path: query ? `${pathname}?${query}` : pathname,
        });
    }, [pathname, searchParams]);

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
