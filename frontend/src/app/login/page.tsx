'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, ArrowRight } from 'lucide-react';

import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { User as UserIcon, Loader2 } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = "47915710744-n0ou1hdfknaur2ijac5gntqopbruoar1.apps.googleusercontent.com";

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });

    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            await login(token);

        } catch (err: any) {
            console.error('Login failed:', err);
            setError('Invalid credentials. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block text-3xl font-bold text-white mb-2 hover:text-zinc-200 transition-colors">
                        Gamelogd
                    </Link>
                    <p className="text-zinc-400">Welcome back, gamer!</p>
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
                            Forgot password?
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
                                Signing In...
                            </>
                        ) : (
                            <>
                                Sign In
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
                            <span className="bg-zinc-900 px-2 text-zinc-500">Or continue with</span>
                        </div>
                    </div>

                    {/* Social Login */}
                    <div className="w-full">
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
                                        await login(res.data.token);
                                    } catch (err: any) {
                                        console.error('Google Login failed:', err);
                                        setError(err.response?.data?.error || 'Google login failed. Please try again.');
                                        setIsLoading(false);
                                    }
                                }}
                                onError={() => {
                                    console.log('Login Failed');
                                    setError('Google login was cancelled or failed.');
                                }}
                                theme="filled_black"
                                size="large"
                                shape="pill"
                                text="continue_with"
                                width="360"
                            />
                        </GoogleOAuthProvider>
                    </div>
                </form>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-zinc-400">
                    Don't have an account?{' '}
                    <Link href="/register" className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
                        Sign up
                    </Link>
                </div>
            </div>
        </div>
    );
}
