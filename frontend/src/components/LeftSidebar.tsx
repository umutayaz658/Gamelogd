'use client';

import { useState, useEffect } from 'react';
import { Search, Bell, MessageSquare, Bookmark, User, Settings, X, Maximize2, Hash, PlusCircle, Heart, UserPlus, AtSign, Mail } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
    preview_text?: string;
    target_url?: string;
    created_at: string;
    is_read: boolean;
}

export default function LeftSidebar() {
    const { user } = useAuth();
    const pathname = usePathname();
    const { unreadMessages, unreadNotifications, markMessagesRead, markNotificationsRead } = useNotifications();
    const { openLogModal } = useLogModal();

    const [isNotifMode, setIsNotifMode] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isNotifMode) {
            markNotificationsRead();
            const fetchNotifications = async () => {
                setIsLoading(true);
                try {
                    const res = await api.get('/notifications/');
                    const data = Array.isArray(res.data) ? res.data : res.data.results || [];
                    setNotifications(data);
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

    const getNotifIcon = (verb: string) => {
        if (verb.includes('liked')) return <Heart className="h-3.5 w-3.5 text-pink-500 fill-pink-500" />;
        if (verb.includes('following') || verb.includes('followed')) return <UserPlus className="h-3.5 w-3.5 text-blue-500" />;
        if (verb.includes('mentioned')) return <AtSign className="h-3.5 w-3.5 text-emerald-500" />;
        if (verb.includes('replied') || verb.includes('commented')) return <MessageSquare className="h-3.5 w-3.5 text-purple-500" />;
        if (verb.includes('message')) return <Mail className="h-3.5 w-3.5 text-cyan-500" />;
        return <Bell className="h-3.5 w-3.5 text-yellow-500" />;
    };

    const isActive = (href: string) => {
        if (href === '#') return false;
        if (href === '/') return pathname === '/';
        return pathname?.startsWith(href);
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
            <SidebarSearch />

            {isNotifMode ? (
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 h-full flex flex-col overflow-hidden animate-fade-up">
                    {/* Gradient accent */}
                    <div className="h-[2px] bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-blue-500/50" />
                    
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
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin-dark">
                        {isLoading ? (
                            <div className="text-center py-8 text-zinc-500 text-sm">Loading...</div>
                        ) : notifications.length > 0 ? (
                            notifications.slice(0, 20).map((notif) => (
                                <Link
                                    href={notif.target_url || `/${notif.actor.username}`}
                                    key={notif.id}
                                    className={`flex items-start gap-3 p-3 hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer ${!notif.is_read ? 'bg-zinc-800/30' : ''}`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800">
                                            <img
                                                src={getImageUrl(notif.actor.avatar, notif.actor.username)}
                                                alt={notif.actor.username}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-zinc-900 rounded-full">
                                            {getNotifIcon(notif.verb)}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-200 leading-snug">
                                            <span className="font-bold">{notif.actor.username}</span> {notif.verb}
                                        </p>
                                        {notif.preview_text && (
                                            <p className="text-xs text-zinc-600 truncate mt-0.5">"{notif.preview_text}"</p>
                                        )}
                                        <span className="text-[10px] text-zinc-600 font-medium">{formatTime(notif.created_at)}</span>
                                    </div>
                                    {!notif.is_read && (
                                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                                    )}
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-8 text-zinc-600 text-sm">No notifications</div>
                        )}
                    </div>
                </div>
            ) : (
                <nav className="flex flex-col gap-1 h-full">
                    <div className="flex-1 flex flex-col gap-0.5">
                        {menuItems.map((item) => {
                            const active = isActive(item.href);
                            const isButton = item.href === '#';

                            const className = `flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left relative ${
                                active
                                    ? 'text-white bg-zinc-800/60'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                            }`;

                            const content = (
                                <>
                                    <div className="relative">
                                        <item.icon className={`h-6 w-6 group-hover:scale-110 transition-transform ${active ? 'text-emerald-500' : ''}`} />
                                        {item.badge && item.badge > 0 ? (
                                            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-emerald-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-zinc-950 animate-badge-pulse">
                                                {item.badge > 9 ? '9+' : item.badge}
                                            </span>
                                        ) : null}
                                    </div>
                                    <span className={`font-medium text-lg ${active ? 'font-bold' : ''}`}>{item.label}</span>
                                    {active && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-emerald-500 rounded-r-full" />
                                    )}
                                </>
                            );

                            if (isButton) {
                                return (
                                    <button key={item.label} onClick={item.onClick} className={className}>
                                        {content}
                                    </button>
                                );
                            }

                            return (
                                <Link key={item.label} href={item.href} onClick={item.onClick} className={className}>
                                    {content}
                                </Link>
                            );
                        })}

                        {/* Log Game CTA */}
                        <button
                            onClick={openLogModal}
                            className="mt-6 flex items-center gap-4 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl transition-all group w-full text-left shadow-lg shadow-emerald-900/25 hover:shadow-emerald-900/40 hover:scale-[1.01] active:scale-[0.99]"
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
