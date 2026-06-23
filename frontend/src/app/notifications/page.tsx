'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus, Heart, AtSign, MessageSquare, Users, Star, CheckCircle2, Repeat, Lock, Check, X } from 'lucide-react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";

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
    target_type?: string;
    target_id?: number;
    is_read: boolean;
    created_at: string;
    target_url?: string | null;
}

interface FollowRequestUser {
    id: number;
    username: string;
    real_name?: string;
    avatar?: string;
}

export default function NotificationsPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [followRequests, setFollowRequests] = useState<FollowRequestUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRequestsLoading, setIsRequestsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'mentions' | 'verified' | 'follow_requests'>('all');
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);

    const { markNotificationsRead } = useNotifications();

    // Read ?filter= URL param on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paramFilter = params.get('filter');
        if (paramFilter === 'follow_requests') {
            setFilter('follow_requests');
        }
    }, []);

    const handleNotificationClick = (e: React.MouseEvent, targetUrl: string | null | undefined) => {
        const target = e.target as HTMLElement;
        if (target.closest('a') || target.closest('button')) {
            return;
        }
        if (targetUrl) {
            router.push(targetUrl);
        }
    };

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

    useEffect(() => {
        const fetchFollowRequests = async () => {
            setIsRequestsLoading(true);
            try {
                const res = await api.get('/users/follow-requests/');
                setFollowRequests(res.data);
            } catch (error) {
                console.error("Failed to fetch follow requests:", error);
            } finally {
                setIsRequestsLoading(false);
            }
        };

        fetchFollowRequests();
    }, []);

    const handleAcceptInvite = async (e: React.MouseEvent, targetId: number | undefined) => {
        e.preventDefault();
        if (!targetId) return;
        try {
            await api.post(`/project-members/${targetId}/accept/`);
            setNotifications(prev => prev.filter(n => n.target_id !== targetId));
        } catch (error) {
            console.error('Failed to accept invite:', error);
        }
    };

    const handleDeclineInvite = async (e: React.MouseEvent, targetId: number | undefined) => {
        e.preventDefault();
        if (!targetId) return;
        try {
            await api.delete(`/project-members/${targetId}/`);
            setNotifications(prev => prev.filter(n => n.target_id !== targetId));
        } catch (error) {
            console.error('Failed to decline invite:', error);
        }
    };

    const handleApproveFollowRequest = async (e: React.MouseEvent, username: string) => {
        e.preventDefault();
        setProcessingRequest(username);
        try {
            await api.post(`/users/${username}/approve-request/`);
            setFollowRequests(prev => prev.filter(u => u.username !== username));
            // Also remove the corresponding notification from the list
            setNotifications(prev => prev.filter(n => !(n.verb.includes('requested to follow') && n.actor.username === username)));
        } catch (error) {
            console.error('Failed to approve follow request:', error);
        } finally {
            setProcessingRequest(null);
        }
    };

    const handleRejectFollowRequest = async (e: React.MouseEvent, username: string) => {
        e.preventDefault();
        setProcessingRequest(username);
        try {
            await api.post(`/users/${username}/reject-request/`);
            setFollowRequests(prev => prev.filter(u => u.username !== username));
            setNotifications(prev => prev.filter(n => !(n.verb.includes('requested to follow') && n.actor.username === username)));
        } catch (error) {
            console.error('Failed to reject follow request:', error);
        } finally {
            setProcessingRequest(null);
        }
    };

    const getIcon = (verb: string) => {
        if (verb.includes('liked')) return <Heart className="h-5 w-5 text-rose-500" />;
        if (verb.includes('mentioned')) return <AtSign className="h-5 w-5 text-sky-500" />;
        if (verb.includes('replied')) return <MessageSquare className="h-5 w-5 text-emerald-500" />;
        if (verb.includes('reposted') || verb.includes('quoted')) return <Repeat className="h-5 w-5 text-emerald-500" />;
        if (verb.includes('invited') || verb.includes('accepted')) return <Users className="h-5 w-5 text-amber-500" />;
        if (verb.includes('requested to follow')) return <Lock className="h-5 w-5 text-indigo-400" />;
        if (verb.includes('followed') || verb.includes('following')) return <UserPlus className="h-5 w-5 text-indigo-500" />;
        return <Star className="h-5 w-5 text-yellow-500" />;
    };

    const filteredNotifications = notifications.filter(notif => {
        if (filter === 'all') return true;
        if (filter === 'mentions') return notif.verb.includes('mentioned') || notif.verb.includes('replied');
        if (filter === 'verified') return notif.actor.is_verified;
        if (filter === 'follow_requests') return notif.verb.includes('requested to follow');
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

    const pendingRequestCount = followRequests.length;

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
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'follow_requests', label: 'Follow Requests' },
                                        { key: 'mentions', label: 'Mentions' },
                                        { key: 'verified', label: 'Verified' },
                                    ].map((f) => (
                                        <button
                                            key={f.key}
                                            onClick={() => setFilter(f.key as any)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-all flex items-center gap-1.5 ${filter === f.key
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                                }`}
                                        >
                                            {f.label}
                                            {f.key === 'follow_requests' && pendingRequestCount > 0 && (
                                                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full px-1.5 py-0.5 border border-emerald-500/30">
                                                    {pendingRequestCount}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Follow Requests Tab Content */}
                            {filter === 'follow_requests' ? (
                                <div className="divide-y divide-zinc-800">
                                    {isRequestsLoading ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : followRequests.length > 0 ? (
                                        followRequests.map((reqUser) => {
                                            const isProcessing = processingRequest === reqUser.username;
                                            return (
                                                <div
                                                    key={reqUser.id}
                                                    className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-800/20 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Link href={`/${reqUser.username}`} className="h-11 w-11 rounded-full overflow-hidden bg-zinc-800 hover:ring-2 hover:ring-emerald-500 transition-all flex-shrink-0">
                                                            <img
                                                                src={getImageUrl(reqUser.avatar, reqUser.username)}
                                                                alt={reqUser.username}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </Link>
                                                        <div>
                                                            <Link href={`/${reqUser.username}`} className="font-bold text-white hover:underline block">
                                                                {reqUser.real_name || reqUser.username}
                                                            </Link>
                                                            <span className="text-sm text-zinc-500">@{reqUser.username}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <button
                                                            onClick={(e) => handleApproveFollowRequest(e, reqUser.username)}
                                                            disabled={isProcessing}
                                                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all cursor-pointer"
                                                        >
                                                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRejectFollowRequest(e, reqUser.username)}
                                                            disabled={isProcessing}
                                                            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-bold px-4 py-2 rounded-xl text-sm border border-zinc-700 transition-all cursor-pointer"
                                                        >
                                                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                                            Decline
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-12 text-center text-zinc-500">
                                            <div className="inline-block p-4 rounded-full bg-zinc-800/50 mb-4">
                                                <UserPlus className="h-8 w-8 text-zinc-600" />
                                            </div>
                                            <p className="font-medium">No pending follow requests</p>
                                            <p className="text-sm text-zinc-600 mt-1">When someone requests to follow your private account, they'll appear here.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Standard Notification List */
                                <div className="divide-y divide-zinc-800">
                                    {isLoading ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : filteredNotifications.length > 0 ? (
                                        filteredNotifications.map((notif) => {
                                            const isFollowRequest = notif.verb.includes('requested to follow');
                                            const isProcessing = processingRequest === notif.actor.username;
                                            // Follow requests → navigate to sender's profile; others → navigate to target_url
                                            const clickTarget = isFollowRequest ? `/${notif.actor.username}` : (notif.target_url || `/${notif.actor.username}`);

                                            return (
                                                <div
                                                    key={notif.id}
                                                    role="link"
                                                    tabIndex={0}
                                                    className={`p-4 flex gap-4 transition-colors cursor-pointer hover:bg-zinc-800/30 ${!notif.is_read ? 'bg-zinc-800/20' : ''}`}
                                                    onClick={(e) => {
                                                        const target = e.target as HTMLElement;
                                                        if (target.closest('button') || target.closest('a')) return;
                                                        router.push(clickTarget);
                                                    }}
                                                >
                                                    {/* Icon Column */}
                                                    <div className="pt-1">
                                                        {getIcon(notif.verb)}
                                                    </div>

                                                    {/* Content Column */}
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Link href={`/${notif.actor.username}`} className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800 group hover:ring-2 hover:ring-emerald-500 transition-all">
                                                                <img
                                                                    src={getImageUrl(notif.actor.avatar, notif.actor.username)}
                                                                    alt={notif.actor.username}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </Link>

                                                            <div className="flex flex-wrap items-baseline gap-1">
                                                                <Link href={`/${notif.actor.username}`} className="font-bold text-white hover:underline flex items-center gap-1">
                                                                    {notif.actor.username}
                                                                    {notif.actor.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />}
                                                                </Link>
                                                                <span className="text-zinc-400">{notif.verb}</span>
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons for Project Invites */}
                                                        {notif.verb.toLowerCase().includes('invited') && (
                                                            <div className="mt-3 flex gap-2 pl-10 mb-2">
                                                                <button
                                                                    onClick={(e) => handleAcceptInvite(e, notif.target_id)}
                                                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
                                                                >
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeclineInvite(e, notif.target_id)}
                                                                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors border border-zinc-700"
                                                                >
                                                                    Decline
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Action Buttons for Follow Requests */}
                                                        {isFollowRequest && (
                                                            <div className="mt-3 flex gap-2 pl-10 mb-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleApproveFollowRequest(e, notif.actor.username); }}
                                                                    disabled={isProcessing}
                                                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded-lg text-sm transition-all cursor-pointer"
                                                                >
                                                                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleRejectFollowRequest(e, notif.actor.username); }}
                                                                    disabled={isProcessing}
                                                                    className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors border border-zinc-700 cursor-pointer"
                                                                >
                                                                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                                    Decline
                                                                </button>
                                                            </div>
                                                        )}

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
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-12 text-center text-zinc-500">
                                            <div className="inline-block p-4 rounded-full bg-zinc-800/50 mb-4">
                                                <Bell className="h-8 w-8 text-zinc-600" />
                                            </div>
                                            <p className="font-medium">No notifications yet</p>
                                        </div>
                                    )}
                                </div>
                            )}

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
