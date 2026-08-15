'use client';

import { useAnalyticsConsent } from '@/context/AnalyticsConsentContext';
import { useTranslation } from '@/lib/useTranslation';

export default function ConsentBanner() {
    const { consent, grant, deny } = useAnalyticsConsent();
    const { t } = useTranslation();

    if (consent !== 'unknown') return null;

    return (
        <div className="fixed bottom-14 lg:bottom-0 inset-x-0 z-[9999] border-t border-zinc-800 bg-zinc-900/95 backdrop-blur px-4 py-3.5">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-3">
                <p className="text-sm text-zinc-300 text-center sm:text-left flex-1">
                    {t('analyticsConsentMessage')}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={deny}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        {t('analyticsConsentDecline')}
                    </button>
                    <button
                        onClick={grant}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                    >
                        {t('analyticsConsentAccept')}
                    </button>
                </div>
            </div>
        </div>
    );
}
