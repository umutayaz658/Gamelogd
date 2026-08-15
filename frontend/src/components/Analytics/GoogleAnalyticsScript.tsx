'use client';

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
 */
export default function GoogleAnalyticsScript() {
    const { consent } = useAnalyticsConsent();

    if (consent !== 'granted' || !GA_MEASUREMENT_ID) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){window.dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
                `}
            </Script>
        </>
    );
}
