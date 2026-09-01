'use client';

import LoginCard from '@/components/auth/LoginCard';

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
            <LoginCard />
        </div>
    );
}
