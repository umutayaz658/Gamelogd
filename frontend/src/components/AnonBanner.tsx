'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import { isChromeHiddenPath } from '@/lib/publicPaths';

const DISMISS_KEY = 'gamelogd_anon_banner_dismissed';

// Positioning (fixed/bottom/z-index) lives in the shared BottomBarStack wrapper that
// mounts this alongside ConsentBanner — this is just the bar's own content/styling now.
export default function AnonBanner() {
    const { user, isLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useTranslation();
    // Defaults to hidden until the sessionStorage check below runs, to avoid a flash for
    // visitors who already dismissed it this session (sessionStorage is unavailable
    // during SSR/first paint).
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        try {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === '1');
        } catch {
            setDismissed(false);
        }
    }, []);

    // This component only ever renders while anonymous (see the `user` check below), so the
    // '/' case in isChromeHiddenPath — hidden only while anonymous — always applies here.
    const hideChrome = isChromeHiddenPath(pathname ?? '', true);

    if (isLoading || user || dismissed || hideChrome) return null;

    const dismiss = () => {
        try {
            window.sessionStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // storage disabled — banner just won't stay dismissed across renders in this tab
        }
        setDismissed(true);
    };

    return (
        <div className="border-t border-zinc-800 bg-zinc-900/95 backdrop-blur px-4 py-3.5">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-3">
                <p className="text-sm text-zinc-300 text-center sm:text-left flex-1">
                    {t('anonBannerMessage')}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => router.push('/login')}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        {t('login')}
                    </button>
                    <button
                        onClick={() => router.push('/register')}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                    >
                        {t('signUp')}
                    </button>
                    <button
                        onClick={dismiss}
                        aria-label={t('cancel')}
                        className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
