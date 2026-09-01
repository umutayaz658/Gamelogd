'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { useAnalyticsConsent } from '@/context/AnalyticsConsentContext';

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Loads gtag.js only once the user has explicitly granted analytics consent, and only
 * if a measurement ID is configured. Nothing is requested from Google before that —
 * no Consent Mode "denied" ping, no script tag at all — the simplest correct way to
 * respect a "Decline" choice.
 *
 * The dataLayer/gtag stub and the initial 'js'/'config' calls run in a plain effect
 * rather than a next/script tag: next/script's "afterInteractive" body executes after
 * React's own commit phase, so a sibling's ordinary mount effect (the pageview tracker)
 * could run first and find `gtag` undefined, silently dropping that pageview. A plain
 * effect commits in React's normal, deterministic order, which — given this component
 * is mounted ahead of the pageview tracker in the tree — always runs first.
 */
export default function GoogleAnalyticsScript() {
    const { consent } = useAnalyticsConsent();
    const ready = consent === 'granted' && !!GA_MEASUREMENT_ID;

    useEffect(() => {
        if (!ready) return;
        window.gtag = window.gtag || function gtag() {
            (window.dataLayer = window.dataLayer || []).push(arguments);
        };
        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
    }, [ready]);

    if (!ready) return null;

    return (
        <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
        />
    );
}
