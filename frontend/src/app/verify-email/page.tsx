'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function VerifyEmailForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { login } = useAuth();
    const email = searchParams.get('email') || '';

    const [code, setCode] = useState<string[]>(Array(6).fill(''));
    const [resendCooldown, setResendCooldown] = useState(60); // 60 seconds cooldown
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // If no email query param, go back to register
    useEffect(() => {
        if (!email) {
            router.push('/register');
        }
    }, [email, router]);

    // Cooldown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    // Focus first input on mount
    useEffect(() => {
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, []);

    const handleChange = (index: number, value: string) => {
        // Only allow numbers
        if (!/^[0-9]?$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);
        setError(null);

        // Move to next input if value is filled
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (!code[index] && index > 0) {
                // Focus previous input on backspace if current is empty
                const newCode = [...code];
                newCode[index - 1] = '';
                setCode(newCode);
                inputRefs.current[index - 1]?.focus();
            } else if (code[index]) {
                // Clear current input
                const newCode = [...code];
                newCode[index] = '';
                setCode(newCode);
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();
        if (!/^\d{6}$/.test(pastedData)) return; // Only allow exactly 6 digits

        const newCode = pastedData.split('');
        setCode(newCode);
        setError(null);
        // Focus the last input
        inputRefs.current[5]?.focus();
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || isResending) return;
        setIsResending(true);
        setError(null);
        setSuccessMsg(null);

        try {
            await api.post('/resend-verification/', { email });
            setSuccessMsg('A new verification code has been sent to your email address.');
            setResendCooldown(60); // Reset cooldown to 60s
            setCode(Array(6).fill(''));
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 50);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send code. Please try again.');
        } finally {
            setIsResending(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const verificationCode = code.join('');
        if (verificationCode.length < 6) {
            setError('Please enter the 6-digit verification code.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await api.post('/verify-email/', {
                email,
                code: verificationCode
            });

            setSuccessMsg('Verification successful! Logging in...');

            // login() navigates away on success but only toasts (never throws or navigates) if
            // the follow-up /users/me/ fetch fails — without the finally below, that left this
            // page stuck showing "Logging in..." forever with the button disabled.
            const token = res.data.token;
            await login(token);
            setSuccessMsg('Verification successful! If you are not redirected automatically, please log in.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Verification failed. Please check the code you entered.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/50 overflow-hidden relative">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="mx-auto w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                    <Mail className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Email Verification</h1>
                <p className="text-zinc-400 text-sm">
                    To activate your account, enter the 6-digit code we sent to <span className="text-zinc-200 font-medium">{email}</span>.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* 6-Digit OTP Inputs */}
                <div className="flex justify-between gap-2" onPaste={handlePaste}>
                    {code.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => { inputRefs.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleChange(index, e.target.value)}
                            onKeyDown={e => handleKeyDown(index, e)}
                            className="w-12 h-14 bg-zinc-950/50 border border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 rounded-xl text-center text-2xl font-bold text-white focus:outline-none transition-all"
                        />
                    ))}
                </div>

                {/* Resend Cooldown Button */}
                <div className="text-center text-sm">
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || isResending}
                        className="text-emerald-500 hover:text-emerald-400 font-bold transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50 disabled:text-zinc-500 disabled:hover:text-zinc-500"
                    >
                        {isResending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        {resendCooldown > 0 
                            ? `Resend Code in ${resendCooldown}s` 
                            : 'Resend Code'}
                    </button>
                </div>

                {/* Feedback Messages */}
                {error && (
                    <div className="text-red-500 text-sm text-center font-medium bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="text-emerald-500 text-sm text-center font-medium bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                        {successMsg}
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isSubmitting || code.some(d => d === '')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        'Verify Account'
                    )}
                </button>
            </form>

            {/* Back to Login */}
            <div className="mt-8 text-center text-sm">
                <Link href="/login" className="text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-2 font-medium">
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                </Link>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
            <Suspense fallback={
                <div className="flex flex-col items-center gap-4 text-zinc-400">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    Loading...
                </div>
            }>
                <VerifyEmailForm />
            </Suspense>
        </div>
    );
}
