'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';
import { useIsMobile } from '@/hooks/useIsMobile';
import LeftSidebarContent from './LeftSidebarContent';

interface MobileSidebarDrawerProps {
    open: boolean;
    onClose: () => void;
}

// Mobile equivalent of LeftSidebar — a slide-in drawer (Twitter mobile web
// style) triggered by tapping the avatar in Navbar's mobile row. Reuses
// LeftSidebarContent so the menu never drifts out of sync with desktop.
export default function MobileSidebarDrawer({ open, onClose }: MobileSidebarDrawerProps) {
    const { user, logout } = useAuth();
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    if (!user || !isMobile) return null;

    const handleLogout = () => {
        logout();
        onClose();
    };

    return (
        <div
            className={`fixed inset-0 z-[60] lg:hidden ${open ? '' : 'pointer-events-none'}`}
            aria-hidden={!open}
        >
            {/* Backdrop */}
            <div
                onClick={onClose}
                className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Sliding panel */}
            <div
                className={`absolute left-0 top-0 h-full w-[80%] max-w-xs bg-zinc-950 border-r border-zinc-800 flex flex-col overflow-y-auto transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Account header */}
                <Link
                    href={`/${user.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 p-4 border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                >
                    <div className="h-11 w-11 rounded-full bg-zinc-700 ring-2 ring-zinc-800 overflow-hidden flex-shrink-0">
                        <img
                            src={getImageUrl(user.avatar, user.username)}
                            alt={user.username}
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{user.real_name || user.username}</p>
                        <p className="text-xs text-zinc-400 truncate">@{user.username.toLowerCase()}</p>
                    </div>
                </Link>

                {/* Shared menu content (search, explore, notifications, messages, bookmarks, profile, settings, log game) */}
                <div className="flex-1 p-2">
                    <LeftSidebarContent onNavigate={onClose} />
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 m-2 text-sm text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors text-left"
                >
                    <LogOut className="h-4 w-4" />
                    {t('logOut')}
                </button>
            </div>
        </div>
    );
}
