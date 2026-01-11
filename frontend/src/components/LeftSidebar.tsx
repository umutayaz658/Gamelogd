'use client';

import { useState, useEffect } from 'react';
import { Search, Bell, MessageSquare, Bookmark, User, Settings, X, Maximize2, Hash, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useLogModal } from '@/context/LogModalContext';
import SidebarSearch from './SidebarSearch';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

interface Notification {
    id: number;
    actor: {
        username: string;
        avatar: string;
    };
    verb: string;
    created_at: string;
    is_read: boolean;
}

export default function LeftSidebar() {
    const { user } = useAuth();
    const { unreadMessages, unreadNotifications, markMessagesRead, markNotificationsRead } = useNotifications();
    const { openLogModal } = useLogModal();

    const [isNotifMode, setIsNotifMode] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch notifications when drawer opens
    useEffect(() => {
        if (isNotifMode) {
            markNotificationsRead(); // Clear badge immediately when opening drawer
            const fetchNotifications = async () => {
                setIsLoading(true);
                try {
                    const res = await api.get('/notifications/');
                    setNotifications(res.data);
                } catch (error) {
                    console.error("Failed to fetch notifications:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchNotifications();
        }
    }, [isNotifMode]);

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        return `${Math.floor(diffInSeconds / 86400)}d`;
    };

    const menuItems = [
        { icon: Hash, label: 'Explore', href: '/explore' },
        {
            icon: Bell,
            label: 'Notifications',
            href: '#',
            onClick: () => {
                setIsNotifMode(true);
                markNotificationsRead();
            },
            badge: unreadNotifications
        },
        {
            icon: MessageSquare,
            label: 'Messages',
            href: '/messages',
            onClick: () => markMessagesRead(),
            badge: unreadMessages
        },
        { icon: Bookmark, label: 'Bookmarks', href: '#' },
        { icon: User, label: 'Profile', href: user ? `/${user.username}` : '/login' },
        { icon: Settings, label: 'Settings', href: '/settings' },
    ];

    return (
        <div className="hidden lg:flex flex-col gap-2 sticky top-20 h-[calc(100vh-5rem)]">
            {/* Search Bar Always Visible */}
            <SidebarSearch />

            {/* Conditional Content */}
            {isNotifMode ? (
                // --- VIEW A: NOTIFICATION DRAWER ---
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 h-full flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                        <h2 className="font-bold text-white">Notifications</h2>
                        <div className="flex items-center gap-1">
                            <Link href="/notifications" className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
                                <Maximize2 className="h-4 w-4" />
                            </Link>
                            <button
                                onClick={() => setIsNotifMode(false)}
                                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {isLoading ? (
                            <div className="text-center py-8 text-zinc-500">Loading...</div>
                        ) : notifications.length > 0 ? (
                            notifications.map((notif) => (
                                <Link
                                    href={`/${notif.actor.username}`}
                                    key={notif.id}
                                    className={`flex items-start gap-3 p-3 hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer ${!notif.is_read ? 'bg-zinc-800/30' : ''}`}
                                >
                                    <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                                        <img
                                            src={getImageUrl(notif.actor.avatar, notif.actor.username)}
                                            alt={notif.actor.username}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-200 leading-snug">
                                            <span className="font-bold">{notif.actor.username}</span> {notif.verb}
                                        </p>
                                        <span className="text-xs text-zinc-500">{formatTime(notif.created_at)}</span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-8 text-zinc-500">No notifications</div>
                        )}
                    </div>
                </div>
            ) : (
                // --- VIEW B: STANDARD MENU ---
                <nav className="flex flex-col gap-1 h-full">
                    <div className="flex-1 flex flex-col gap-1">
                        {menuItems.map((item) => {
                            const isButton = item.href === '#';
                            const extraClass = (item as any).className || '';

                            if (isButton) {
                                return (
                                    <button
                                        key={item.label}
                                        onClick={item.onClick}
                                        className={`flex items-center gap-4 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-900/50 rounded-xl transition-all group w-full text-left relative ${extraClass}`}
                                    >
                                        <div className="relative">
                                            <item.icon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                                            {item.badge && item.badge > 0 ? (
                                                <span className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-zinc-950">
                                                    {item.badge > 9 ? '9+' : item.badge}
                                                </span>
                                            ) : null}
                                        </div>
                                        <span className="font-medium text-lg">{item.label}</span>
                                    </button>
                                );
                            }

                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    onClick={item.onClick}
                                    className={`flex items-center gap-4 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-900/50 rounded-xl transition-all group relative ${extraClass}`}
                                >
                                    <div className="relative">
                                        <item.icon className="h-6 w-6 group-hover:scale-110 transition-transform" />
                                        {item.badge && item.badge > 0 ? (
                                            <span className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-zinc-950">
                                                {item.badge > 9 ? '9+' : item.badge}
                                            </span>
                                        ) : null}
                                    </div>
                                    <span className="font-medium text-lg">{item.label}</span>
                                </Link>
                            );
                        })}

                        {/* Log Game CTA Button - Solid Green, Below Settings with Spacing */}
                        <button
                            onClick={openLogModal}
                            className="mt-6 flex items-center gap-4 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all group w-full text-left shadow-lg shadow-emerald-900/20"
                        >
                            <PlusCircle className="h-6 w-6 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-lg">Log Game</span>
                        </button>
                    </div>
                </nav>
            )}
        </div>
    );
}
