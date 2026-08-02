'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useTranslation } from '@/lib/useTranslation';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();
    const { t } = useTranslation();

    useEffect(() => {
        // Log to an error reporting service in production
        console.error('[App Error Boundary]', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-10 h-10 text-red-400" />
                    </div>
                </div>

                {/* Text */}
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-zinc-100">{t('somethingWentWrong')}</h1>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        {t('unexpectedErrorNotified')}
                        {error?.digest && (
                            <span className="block mt-1 text-xs text-zinc-600 font-mono">
                                {t('errorId')} {error.digest}
                            </span>
                        )}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t('tryAgain')}
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        {t('goHome')}
                    </button>
                </div>
            </div>
        </div>
    );
}
