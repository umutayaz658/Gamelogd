'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";

import api from "@/lib/api";
import { getImageUrl, getRelativeTime } from "@/lib/utils";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/lib/useTranslation";
import type { Notification } from "@/types";
import {
    resolveNotificationType,
    getNotificationText,
    isSystemNotification,
    getSystemTargetUrl,
    getInviteEndpoints,
    isInviteType,
    getFilterGroup,
} from "@/lib/notifications";

export default function NotificationsPage() {
    const router = useRouter();
    const { t, language } = useTranslation();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'mentions' | 'follow_requests'>('all');
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAcceptInvite = async (e: React.MouseEvent, targetId: number | undefined, type: ReturnType<typeof resolveNotificationType>) => {
        e.preventDefault();
        if (!targetId) return;
        try {
            const endpoints = getInviteEndpoints(type, targetId);
            await api.post(endpoints.accept);
            setNotifications(prev => prev.filter(n => n.target_id !== targetId));
        } catch (error) {
            console.error('Failed to accept invite:', error);
        }
    };

    const handleDeclineInvite = async (e: React.MouseEvent, targetId: number | undefined, type: ReturnType<typeof resolveNotificationType>) => {
        e.preventDefault();
        if (!targetId) return;
        try {
            const endpoints = getInviteEndpoints(type, targetId);
            if (endpoints.declineMethod === 'delete') {
                await api.delete(endpoints.decline);
            } else {
                await api.post(endpoints.decline);
            }
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
            setNotifications(prev => prev.filter(n => !(n.verb.includes('requested to follow') && n.actor.username === username)));
        } catch (error) {
            console.error('Failed to reject follow request:', error);
        } finally {
            setProcessingRequest(null);
        }
    };

    const isSelfActor = (notif: Notification) => !!user && notif.actor.id === user.id;

    const filteredNotifications = notifications.filter(notif => {
        if (filter === 'all') return true;
        const type = resolveNotificationType(notif.verb, isSelfActor(notif));
        const group = getFilterGroup(type);
        if (filter === 'mentions') return group === 'mentions';
        if (filter === 'follow_requests') return group === 'follow_requests';
        return true;
    });

    const formatTime = (dateString: string) => {
        return getRelativeTime(dateString, language);
    };

    const pendingRequestCount = notifications.filter(
        n => getFilterGroup(resolveNotificationType(n.verb, isSelfActor(n))) === 'follow_requests'
    ).length;

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-6">
                        <div className="min-h-[calc(100vh-6rem)] lg:bg-zinc-900 lg:rounded-2xl lg:border lg:border-zinc-800">

                            {/* Header */}
                            <div className="p-4 border-b border-zinc-800 sticky top-16 bg-zinc-950/95 lg:bg-zinc-900/95 backdrop-blur-sm z-10 lg:rounded-t-2xl">
                                <h1 className="text-xl font-bold mb-4">{t('notifications')}</h1>

                                {/* Filters — single scrollable row on mobile, wraps on desktop.
                                    These only ever filter which notifications show; the row markup
                                    below is identical regardless of which filter is active. */}
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5 lg:flex-wrap lg:overflow-visible lg:pb-0">
                                    {[
                                        { key: 'all', label: t('all') },
                                        { key: 'follow_requests', label: t('followRequests') },
                                        { key: 'mentions', label: t('mentions') },
                                    ].map((f) => (
                                        <button
                                            key={f.key}
                                            onClick={() => setFilter(f.key as any)}
                                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-all flex items-center gap-1.5 ${filter === f.key
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                                }`}
                                        >
                                            {f.label}
                                            {f.key === 'follow_requests' && pendingRequestCount > 0 && (
                                                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 border ${filter === f.key
                                                    ? 'bg-white/20 text-white border-white/30'
                                                    : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50'
                                                    }`}>
                                                    {pendingRequestCount}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notification List — one row template shared by every filter/type */}
                            <div className="divide-y divide-zinc-800">
                                {isLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                    </div>
                                ) : filteredNotifications.length > 0 ? (
                                    filteredNotifications.map((notif) => {
                                        const type = resolveNotificationType(notif.verb, isSelfActor(notif));
                                        const text = getNotificationText(type, notif.verb, t);
                                        const isSystem = isSystemNotification(type);
                                        const isFollowRequest = type === 'follow_request';
                                        const isProcessing = processingRequest === notif.actor.username;

                                        const clickTarget = isSystem
                                            ? getSystemTargetUrl(type, notif.actor.username, notif.target_url)
                                            : isFollowRequest
                                                ? `/${notif.actor.username}`
                                                : (notif.target_url || `/${notif.actor.username}`);

                                        if (isSystem) {
                                            return (
                                                <div
                                                    key={notif.id}
                                                    role="link"
                                                    tabIndex={0}
                                                    className="p-4 flex gap-4 transition-colors cursor-pointer hover:bg-zinc-800/30"
                                                    onClick={() => { if (clickTarget) router.push(clickTarget); }}
                                                >
                                                    <p className="text-zinc-300 flex-1">
                                                        {text}. <span className="text-zinc-500 text-sm">{formatTime(notif.created_at)}</span>
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={notif.id}
                                                role="link"
                                                tabIndex={0}
                                                className="p-4 flex items-start gap-4 transition-colors cursor-pointer hover:bg-zinc-800/30"
                                                onClick={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (target.closest('button') || target.closest('a')) return;
                                                    if (clickTarget) router.push(clickTarget);
                                                }}
                                            >
                                                <Link href={`/${notif.actor.username}`} className="h-11 w-11 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0 hover:ring-2 hover:ring-emerald-500 transition-all">
                                                    <img
                                                        src={getImageUrl(notif.actor.avatar, notif.actor.username)}
                                                        alt={notif.actor.username}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </Link>

                                                {/* Content Column */}
                                                <div className="flex-1">
                                                    <p>
                                                        <Link href={`/${notif.actor.username}`} className="font-bold text-white hover:underline">
                                                            {notif.actor.username}
                                                        </Link>{' '}
                                                        <span className="text-zinc-400">{text}.</span>{' '}
                                                        <span className="text-zinc-500 text-sm">{formatTime(notif.created_at)}</span>
                                                    </p>

                                                    {/* Action Buttons for Project/Organisation/Group Invites */}
                                                    {isInviteType(type) && (
                                                        <div className="mt-3 flex gap-2">
                                                            <button
                                                                onClick={(e) => handleAcceptInvite(e, notif.target_id, type)}
                                                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
                                                            >
                                                                {t('accept')}
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeclineInvite(e, notif.target_id, type)}
                                                                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors border border-zinc-700"
                                                            >
                                                                {t('decline')}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Action Buttons for Follow Requests */}
                                                    {isFollowRequest && (
                                                        <div className="mt-3 flex gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleApproveFollowRequest(e, notif.actor.username); }}
                                                                disabled={isProcessing}
                                                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded-lg text-sm transition-all cursor-pointer"
                                                            >
                                                                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                                {t('accept')}
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRejectFollowRequest(e, notif.actor.username); }}
                                                                disabled={isProcessing}
                                                                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm transition-colors border border-zinc-700 cursor-pointer"
                                                            >
                                                                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                                {t('decline')}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-12 text-center text-zinc-500">
                                        <div className="inline-block p-4 rounded-full bg-zinc-800/50 mb-4">
                                            <Bell className="h-8 w-8 text-zinc-600" />
                                        </div>
                                        <p className="font-medium">{t('noNotifications')}</p>
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
