'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, User as UserIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useTranslation } from '@/lib/useTranslation';
import { trackEvent } from '@/lib/analytics';

const GOOGLE_CLIENT_ID = "47915710744-n0ou1hdfknaur2ijac5gntqopbruoar1.apps.googleusercontent.com";
const BRAND_NAME = 'Gamelogd';

interface LoginCardProps {
    // Overrides the "Welcome back, gamer!" subtitle — used by AuthRequiredModal to show
    // why the visitor landed here (e.g. "Please sign in to like.") instead of the generic
    // greeting, without needing a second header stacked on top of this card.
    contextMessage?: string;
    // Fired the instant a password or Google login succeeds, before login()'s own
    // redirect/refresh settles — lets a caller (e.g. a modal) close itself immediately
    // instead of staying visible through the navigation.
    onLoggedIn?: () => void;
}

export default function LoginCard({ contextMessage, onLoggedIn }: LoginCardProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });

    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The underlying Google Identity Services button needs an explicit pixel width — it
    // doesn't stretch to fill its container on its own, and a hardcoded value overflows a
    // narrow mobile card. Measure the actual available width instead.
    const googleButtonWrapperRef = useRef<HTMLDivElement>(null);
    const [googleButtonWidth, setGoogleButtonWidth] = useState(360);

    useEffect(() => {
        const el = googleButtonWrapperRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width;
            if (width) setGoogleButtonWidth(Math.round(width));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // 1. Call API to get token
            const response = await api.post('/login/', {
                username: formData.username,
                password: formData.password
            });

            const { token } = response.data;

            // 2. Use AuthContext to login
            onLoggedIn?.();
            await login(token);
            trackEvent('login', { method: 'password' });

        } catch (err: any) {
            console.error('Login failed:', err);
            const data = err.response?.data;

            // If user hasn't verified email yet, redirect to verification page
            if (data?.status === 'verification_required' && data?.email) {
                const emailEncoded = encodeURIComponent(data.email);
                router.push(`/verify-email?email=${emailEncoded}`);
                return;
            }

            const errorMsg = data?.detail || data?.error || (typeof data === 'string' ? data : 'Invalid credentials. Please try again.');
            setError(errorMsg);
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="text-center mb-8">
                <Link href="/" className="inline-block text-3xl font-bold text-white mb-2 hover:text-zinc-200 transition-colors">
                    {BRAND_NAME}
                </Link>
                <p className="text-zinc-400">{contextMessage || t('welcomeBackGamer')}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    {/* Username or Email Input */}
                    <div className="relative group">
                        <UserIcon className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Username or Email"
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                    </div>

                    {/* Password Input */}
                    <div className="relative group">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end">
                    <Link href="#" className="text-sm text-zinc-400 hover:text-emerald-500 transition-colors">
                        {t('forgotPassword')}
                    </Link>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 group"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('signingIn')}
                        </>
                    ) : (
                        <>
                            {t('signIn')}
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                {error && (
                    <div className="text-red-500 text-sm text-center font-medium bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                        {error}
                    </div>
                )}

                {/* Divider */}
                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-zinc-900 px-2 text-zinc-500">{t('orContinueWith')}</span>
                    </div>
                </div>

                {/* Social Login */}
                <div className="w-full" ref={googleButtonWrapperRef}>
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                        <GoogleLogin
                            onSuccess={async (credentialResponse) => {
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
                                        onLoggedIn?.();
                                        router.push('/register');
                                    } else {
                                        onLoggedIn?.();
                                        await login(res.data.token);
                                        trackEvent('login', { method: 'google' });
                                    }
                                } catch (err: any) {
                                    console.error('Google Login failed:', err);
                                    setError(err.response?.data?.error || 'Google login failed. Please try again.');
                                    setIsLoading(false);
                                }
                            }}
                            onError={() => {
                                setError('Google login was cancelled or failed.');
                            }}
                            theme="filled_black"
                            size="large"
                            shape="pill"
                            text="continue_with"
                            width={googleButtonWidth}
                        />
                    </GoogleOAuthProvider>
                </div>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-zinc-400">
                {t('dontHaveAccount')}{' '}
                <Link href="/register" className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
                    {t('signUp')}
                </Link>
            </div>
        </div>
    );
}
