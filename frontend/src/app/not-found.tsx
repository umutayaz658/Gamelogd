'use client';

import { Gamepad2, Home, Search } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';

const ERROR_CODE_404 = '404';

export default function NotFound() {
    const { t } = useTranslation();
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8">
                {/* Large 404 */}
                <div className="relative">
                    <div className="text-[8rem] font-black text-zinc-800 leading-none select-none">
                        {ERROR_CODE_404}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Gamepad2 className="w-10 h-10 text-emerald-400" />
                        </div>
                    </div>
                </div>

                {/* Text */}
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-zinc-100">{t('pageNotFound')}</h1>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        {t('pageNotFoundDesc')}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        {t('goHome')}
                    </Link>
                    <Link
                        href="/explore"
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm transition-colors"
                    >
                        <Search className="w-4 h-4" />
                        {t('explore')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
