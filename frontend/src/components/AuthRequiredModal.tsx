'use client';

import { X } from 'lucide-react';
import { useAuthGate, AuthGateAction } from '@/context/AuthGateContext';
import { useTranslation } from '@/lib/useTranslation';
import LoginCard from '@/components/auth/LoginCard';

const ACTION_COPY_KEYS: Record<AuthGateAction, string> = {
    like: 'signInToLike',
    bookmark: 'signInToBookmark',
    repost: 'signInToRepost',
    vote: 'signInToVote',
    follow: 'signInToFollow',
    message: 'signInToMessage',
    reply: 'signInToReply',
    post: 'signInToPost',
    logGame: 'signInToLogGame',
    generic: 'signInRequired',
};

export default function AuthRequiredModal() {
    const { isOpen, action, close } = useAuthGate();
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={close}
        >
            <div
                className="relative w-full max-w-md animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={close}
                    className="absolute -top-3 -right-3 z-10 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-full shadow-lg transition-colors cursor-pointer"
                >
                    <X className="h-4 w-4" />
                </button>
                <LoginCard contextMessage={t(ACTION_COPY_KEYS[action] as any)} onLoggedIn={close} />
            </div>
        </div>
    );
}
