/**
 * Fires a GA4 custom event. Silently no-ops if the user hasn't granted analytics
 * consent (in which case `window.gtag` was never installed) or GA isn't configured —
 * callers never need to check consent state themselves.
 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    window.gtag('event', name, params);
}
