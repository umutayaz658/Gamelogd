'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import { Heart, UserPlus, Shield, MessageSquare, Star, AtSign, CheckCircle2, Loader2 } from 'lucide-react';
import api from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { useNotifications } from "@/context/NotificationContext";

interface Notification {
    id: number;
    actor: {
        username: string;
        avatar: string;
        is_verified?: boolean; // Assuming this might exist or we default to false
    };
    verb: string;
    target_type?: string;
    target_id?: number;
    is_read: boolean;
    created_at: string;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'mentions' | 'verified'>('all');

    const { markNotificationsRead } = useNotifications();

    useEffect(() => {
        const fetchNotifications = async () => {
            setIsLoading(true);
            try {
                const res = await api.get('/notifications/');
                setNotifications(res.data);
                markNotificationsRead();
            } catch (error) {
                console.error("Failed to fetch notifications:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNotifications();
    }, []);

    const getIcon = (verb: string) => {
        if (verb.includes('following')) return <UserPlus className="h-5 w-5 text-blue-500" />;
        if (verb.includes('liked')) return <Heart className="h-5 w-5 text-red-500 fill-red-500" />;
        if (verb.includes('mentioned')) return <AtSign className="h-5 w-5 text-emerald-500" />;
        if (verb.includes('replied')) return <MessageSquare className="h-5 w-5 text-purple-500" />;
        return <Star className="h-5 w-5 text-yellow-500" />;
    };

    const filteredNotifications = notifications.filter(notif => {
        if (filter === 'all') return true;
        // Simple filter logic based on verb for now, can be expanded
        if (filter === 'mentions') return notif.verb.includes('mentioned') || notif.verb.includes('replied');
        if (filter === 'verified') return notif.actor.is_verified;
        return true;
    });

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        return `${Math.floor(diffInSeconds / 86400)}d`;
    };

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

                                {/* Filters */}
                                <div className="flex gap-2">
                                    {['all', 'mentions', 'verified'].map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setFilter(f as any)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-all ${filter === f
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                                }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notification List */}
                            <div className="divide-y divide-zinc-800">
                                {isLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                    </div>
                                ) : filteredNotifications.length > 0 ? (
                                    filteredNotifications.map((notif) => (
                                        <Link
                                            href={`/${notif.actor.username}`}
                                            key={notif.id}
                                            className={`p-4 flex gap-4 hover:bg-zinc-800/30 transition-colors cursor-pointer ${!notif.is_read ? 'bg-zinc-800/20' : ''}`}
                                        >
                                            {/* Icon Column */}
                                            <div className="pt-1">
                                                {getIcon(notif.verb)}
                                            </div>

                                            {/* Content Column */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800">
                                                        <img
                                                            src={getImageUrl(notif.actor.avatar, notif.actor.username)}
                                                            alt={notif.actor.username}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>

                                                    <div className="flex flex-wrap items-baseline gap-1">
                                                        <span className="font-bold text-white flex items-center gap-1">
                                                            {notif.actor.username}
                                                            {notif.actor.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />}
                                                        </span>
                                                        <span className="text-zinc-400">{notif.verb}</span>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-zinc-500 font-medium pl-10">
                                                    {formatTime(notif.created_at)}
                                                </div>
                                            </div>

                                            {/* Unread Indicator */}
                                            {!notif.is_read && (
                                                <div className="pt-2">
                                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                </div>
                                            )}
                                        </Link>
                                    ))
                                ) : (
                                    <div className="p-12 text-center text-zinc-500">
                                        <div className="inline-block p-4 rounded-full bg-zinc-800/50 mb-4">
                                            <Bell className="h-8 w-8 text-zinc-600" />
                                        </div>
                                        <p className="font-medium">No notifications yet</p>
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

function Bell(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
    )
}
