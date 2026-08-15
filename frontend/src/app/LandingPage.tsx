'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gamepad2, Code2, Loader2 } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import GameCoverWall from '@/components/GameCoverWall';
import { trackEvent } from '@/lib/analytics';

const GOOGLE_CLIENT_ID = "47915710744-n0ou1hdfknaur2ijac5gntqopbruoar1.apps.googleusercontent.com";
const BRAND_NAME = 'Gamelogd';

export default function LandingPage() {
    const router = useRouter();
    const { t } = useTranslation();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // GoogleLogin's `width` prop is a fixed pixel value, not "100%" — without measuring
    // the actual container it renders wider than the Login/Sign up buttons above it
    // (Google's default is 360px, which overflows this card's ~300px content width).
    const googleBtnWrapperRef = useRef<HTMLDivElement>(null);
    const [googleBtnWidth, setGoogleBtnWidth] = useState(300);

    useEffect(() => {
        const el = googleBtnWrapperRef.current;
        if (!el) return;
        const update = () => setGoogleBtnWidth(Math.round(el.getBoundingClientRect().width));
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        if (!credentialResponse.credential) return;
        try {
            setIsLoading(true);
            setError(null);
            const res = await api.post('/google-login/', {
                credential: credentialResponse.credential
            });

            if (res.data.is_new_user) {
                localStorage.setItem('googleSignupData', JSON.stringify({
                    email: res.data.email,
                    firstName: res.data.first_name,
                    lastName: res.data.last_name
                }));
                router.push('/register');
            } else {
                await login(res.data.token);
                trackEvent('login', { method: 'google' });
            }
        } catch (err: any) {
            console.error('Google Login failed:', err);
            setError(err.response?.data?.error || 'Google login failed. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="relative z-0 min-h-screen lg:h-screen lg:overflow-hidden bg-zinc-950 selection:bg-emerald-500/30">
            <GameCoverWall />

            {/* landing-grid (globals.css) reorders these three blocks per breakpoint:
                mobile stacks hero -> auth -> pitch top to bottom (CTAs reachable right
                after the pitch, without scrolling past both cards first) and scrolls
                normally if needed; desktop groups hero+pitch into one left column
                beside a separate auth column, fixed to exactly one viewport (no
                scrolling) with align-content:center distributing any leftover space
                as breathing room above/below. */}
            <div className="landing-grid relative z-10 min-h-screen lg:h-full">
                {/* Auth card */}
                <section className="landing-grid-auth flex items-center justify-center p-4 pb-10 lg:pb-4 lg:pr-16 xl:pr-24">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">{t('landingGetStarted')}</h2>
                            <p className="text-zinc-400 text-sm">{t('landingAuthCardSubtext')}</p>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl transition-all"
                            >
                                {t('login')}
                            </button>
                            <button
                                onClick={() => router.push('/register')}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2.5 rounded-xl transition-all"
                            >
                                {t('signUp')}
                            </button>

                            {error && (
                                <div className="text-red-500 text-sm text-center font-medium bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                                    {error}
                                </div>
                            )}

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-zinc-800"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-zinc-900 px-2 text-zinc-500">{t('orContinueWith')}</span>
                                </div>
                            </div>

                            <div ref={googleBtnWrapperRef} className="w-full flex justify-center">
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2 py-2.5 text-zinc-400 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    </div>
                                ) : (
                                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                                        <GoogleLogin
                                            onSuccess={handleGoogleSuccess}
                                            onError={() => setError('Google login was cancelled or failed.')}
                                            theme="filled_black"
                                            size="large"
                                            shape="pill"
                                            text="continue_with"
                                            width={String(googleBtnWidth)}
                                        />
                                    </GoogleOAuthProvider>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Brand + hero copy */}
                <div className="landing-grid-hero flex flex-col justify-center p-8 pb-4 lg:p-16 lg:pb-10">
                    <div className="max-w-xl">
                        <Link href="/" className="inline-block text-3xl lg:text-4xl font-bold text-white mb-6 hover:text-zinc-200 transition-colors">
                            {BRAND_NAME}
                        </Link>

                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
                            {t('landingHeroHeadline')}
                        </h1>
                        <p className="text-lg text-zinc-400">
                            {t('landingHeroSubheadline')}
                        </p>
                    </div>
                </div>

                {/* Gamer / developer pitch cards */}
                <div className="landing-grid-pitch flex flex-col justify-center p-8 pt-4 pb-12 lg:p-16 lg:pt-0">
                    <div className="max-w-xl space-y-6">
                        <div className="flex gap-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Gamepad2 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">{t('landingGamerHeadline')}</h2>
                                <p className="text-zinc-400 text-sm">{t('landingGamerPitch')}</p>
                            </div>
                        </div>

                        <div className="flex gap-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Code2 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">{t('landingDevHeadline')}</h2>
                                <p className="text-zinc-400 text-sm">{t('landingDevPitch')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
