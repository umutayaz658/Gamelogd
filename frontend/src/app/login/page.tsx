'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, ArrowRight } from 'lucide-react';

import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { User as UserIcon, Loader2 } from 'lucide-react'; // Import Loader2 for loading state

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
            // Backend expects 'username' but form has 'email'. 
            // If backend uses username for auth, we might need to change input or backend.
            // Assuming backend uses 'username' field for login (standard Django), 
            // but user enters email. We should probably check if backend supports email auth.
            // Standard Django auth token uses 'username'. 
            // Let's send email as username for now if your backend supports it, 
            // OR change the input to be "Username" instead of "Email".
            // Given the Register page asks for Username AND Email, let's assume user logs in with Username.
            // BUT the UI says "Email address". 
            // Let's change the UI to "Username" to match standard Django Auth Token behavior 
            // unless you have a custom backend auth backend.
            // I will change the input placeholder/name to "Username" to be safe and consistent with default Django.

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
                        {/* Username Input */}
                        <div className="relative group">
                            <UserIcon className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Username"
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
                    <button
                        type="button"
                        className="w-full bg-zinc-950/50 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Google
                    </button>
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
