'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import { Heart, UserPlus, MessageSquare, Star, AtSign, CheckCircle2, Loader2, Bell, Mail, Check } from 'lucide-react';
import api from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { useNotifications } from "@/context/NotificationContext";

interface Notification {
    id: number;
    actor: {
        username: string;
        avatar: string;
        is_verified?: boolean;
    };
    verb: string;
    target_type?: number | null;
    target_type_label?: string | null;
    target_id?: number;
    preview_text?: string;
    target_url?: string;
    is_read: boolean;
    created_at: string;
}

type FilterType = 'all' | 'likes' | 'comments' | 'follows' | 'messages';

export default function NotificationsPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    const { markNotificationsRead } = useNotifications();

    useEffect(() => {
        const fetchNotifications = async () => {
            setIsLoading(true);
            try {
                const res = await api.get('/notifications/');
                // Handle paginated or array response
                const data = Array.isArray(res.data) ? res.data : res.data.results || [];
                setNotifications(data);
                markNotificationsRead();
            } catch (error) {
                console.error("Failed to fetch notifications:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNotifications();
    }, []);

    const getVerbCategory = (verb: string): FilterType => {
        if (verb.includes('liked')) return 'likes';
        if (verb.includes('replied') || verb.includes('commented') || verb.includes('mentioned')) return 'comments';
        if (verb.includes('following') || verb.includes('followed')) return 'follows';
        if (verb.includes('message')) return 'messages';
        return 'all';
    };

    const getIcon = (verb: string) => {
        if (verb.includes('liked')) return <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />;
        if (verb.includes('following') || verb.includes('followed')) return <UserPlus className="h-5 w-5 text-blue-500" />;
        if (verb.includes('mentioned')) return <AtSign className="h-5 w-5 text-emerald-500" />;
        if (verb.includes('replied') || verb.includes('commented')) return <MessageSquare className="h-5 w-5 text-purple-500" />;
        if (verb.includes('message')) return <Mail className="h-5 w-5 text-cyan-500" />;
        return <Star className="h-5 w-5 text-yellow-500" />;
    };

    const getIconBg = (verb: string) => {
        if (verb.includes('liked')) return 'bg-pink-500/10';
        if (verb.includes('following') || verb.includes('followed')) return 'bg-blue-500/10';
        if (verb.includes('mentioned')) return 'bg-emerald-500/10';
        if (verb.includes('replied') || verb.includes('commented')) return 'bg-purple-500/10';
        if (verb.includes('message')) return 'bg-cyan-500/10';
        return 'bg-yellow-500/10';
    };

    const filteredNotifications = notifications.filter(notif => {
        if (filter === 'all') return true;
        return getVerbCategory(notif.verb) === filter;
    });

    // Group notifications: if same verb + same target_id from multiple actors within last day
    const groupedNotifications = (() => {
        const groups: { [key: string]: Notification[] } = {};
        const standalone: Notification[] = [];

        filteredNotifications.forEach(notif => {
            // Group likes on the same target
            if (notif.verb.includes('liked') && notif.target_id) {
                const key = `${notif.verb}-${notif.target_id}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(notif);
            } else {
                standalone.push(notif);
            }
        });

        const result: { notification: Notification; groupCount: number; groupActors: string[] }[] = [];

        // Add grouped notifications (use the most recent one as representative)
        Object.values(groups).forEach(group => {
            const sorted = group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            result.push({
                notification: sorted[0],
                groupCount: group.length,
                groupActors: sorted.map(n => n.actor.username).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3),
            });
        });

        // Add standalone notifications
        standalone.forEach(notif => {
            result.push({ notification: notif, groupCount: 1, groupActors: [notif.actor.username] });
        });

        // Sort by date
        result.sort((a, b) => new Date(b.notification.created_at).getTime() - new Date(a.notification.created_at).getTime());

        return result;
    })();

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const handleNotificationClick = (notif: Notification) => {
        // Mark individual notification as read
        if (!notif.is_read) {
            api.post(`/notifications/${notif.id}/mark_read/`).catch(() => {});
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        }

        // Navigate to target
        if (notif.target_url) {
            router.push(notif.target_url);
        } else {
            router.push(`/${notif.actor.username}`);
        }
    };

    const filterTabs: { key: FilterType; label: string; icon: React.ReactNode }[] = [
        { key: 'all', label: 'All', icon: <Bell className="h-3.5 w-3.5" /> },
        { key: 'likes', label: 'Likes', icon: <Heart className="h-3.5 w-3.5" /> },
        { key: 'comments', label: 'Replies', icon: <MessageSquare className="h-3.5 w-3.5" /> },
        { key: 'follows', label: 'Follows', icon: <UserPlus className="h-3.5 w-3.5" /> },
        { key: 'messages', label: 'Messages', icon: <Mail className="h-3.5 w-3.5" /> },
    ];

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-6">
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 min-h-[calc(100vh-6rem)]">

                            {/* Header */}
                            <div className="p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10 rounded-t-2xl">
                                <h1 className="text-xl font-bold mb-4">Notifications</h1>

                                {/* Filter Tabs */}
                                <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                                    {filterTabs.map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setFilter(tab.key)}
                                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === tab.key
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                            }`}
                                        >
                                            {tab.icon}
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notification List */}
                            <div className="divide-y divide-zinc-800/50">
                                {isLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                    </div>
                                ) : groupedNotifications.length > 0 ? (
                                    groupedNotifications.map(({ notification: notif, groupCount, groupActors }) => (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`p-4 flex gap-4 hover:bg-zinc-800/30 transition-colors cursor-pointer ${!notif.is_read ? 'bg-emerald-500/[0.03]' : ''}`}
                                        >
                                            {/* Icon Column */}
                                            <div className="pt-0.5 flex-shrink-0">
                                                <div className={`p-2 rounded-full ${getIconBg(notif.verb)}`}>
                                                    {getIcon(notif.verb)}
                                                </div>
                                            </div>

                                            {/* Content Column */}
                                            <div className="flex-1 min-w-0">
                                                {/* Actor avatars (stacked for grouped) */}
                                                <div className="flex items-center gap-1 mb-1.5">
                                                    <div className="flex -space-x-2">
                                                        {groupCount > 1 ? (
                                                            groupActors.slice(0, 3).map((username, idx) => (
                                                                <div key={idx} className="h-7 w-7 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-900">
                                                                    <img
                                                                        src={getImageUrl(null, username)}
                                                                        alt={username}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800">
                                                                <img
                                                                    src={getImageUrl(notif.actor.avatar, notif.actor.username)}
                                                                    alt={notif.actor.username}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Text */}
                                                <div className="flex flex-wrap items-baseline gap-1 text-sm">
                                                    {groupCount > 1 ? (
                                                        <span className="text-zinc-300">
                                                            <span className="font-bold text-white">{groupActors[0]}</span>
                                                            {groupCount > 2 ? (
                                                                <> and <span className="font-bold text-white">{groupCount - 1} others</span></>
                                                            ) : groupActors[1] ? (
                                                                <> and <span className="font-bold text-white">{groupActors[1]}</span></>
                                                            ) : null}
                                                            {' '}{notif.verb}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-300">
                                                            <span className="font-bold text-white inline-flex items-center gap-1">
                                                                {notif.actor.username}
                                                                {notif.actor.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 inline" />}
                                                            </span>
                                                            {' '}{notif.verb}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Preview text */}
                                                {notif.preview_text && (
                                                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                                                        "{notif.preview_text}"
                                                    </p>
                                                )}

                                                {/* Time */}
                                                <div className="text-xs text-zinc-600 mt-1.5 font-medium">
                                                    {formatTime(notif.created_at)}
                                                </div>
                                            </div>

                                            {/* Unread Indicator */}
                                            <div className="flex items-start pt-2 flex-shrink-0">
                                                {!notif.is_read ? (
                                                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />
                                                ) : (
                                                    <div className="h-2.5 w-2.5" />
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-16 text-center text-zinc-500">
                                        <div className="inline-flex items-center justify-center p-5 rounded-full bg-zinc-800/50 mb-4">
                                            <Bell className="h-10 w-10 text-zinc-600" />
                                        </div>
                                        <p className="font-bold text-lg text-white mb-1">
                                            {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
                                        </p>
                                        <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                                            {filter === 'all'
                                                ? "When someone interacts with your posts or follows you, you'll see it here."
                                                : `You don't have any ${filter} notifications right now.`}
                                        </p>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <RightSidebar />
                    </div>
                </div>
            </main>
        </div>
    );
}
