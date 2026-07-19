'use client';

import { useState, useEffect } from 'react';
import { Bell, MessageSquare, Bookmark, User, Settings, X, Maximize2, Hash, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useLogModal } from '@/context/LogModalContext';
import SidebarSearch from './SidebarSearch';
import api from '@/lib/api';
import { getImageUrl, getRelativeTime } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Notification } from '@/types';
import { resolveNotificationType, getNotificationText } from '@/lib/notifications';

interface LeftSidebarContentProps {
    onNavigate?: () => void;
}

// Shared menu/search/notification-drawer content used by both the desktop
// LeftSidebar (hidden lg:flex wrapper) and the mobile MobileSidebarDrawer,
// so the two never drift out of sync.
export default function LeftSidebarContent({ onNavigate }: LeftSidebarContentProps) {
    const { user } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();
    const { unreadMessages, unreadNotifications, markMessagesRead, markNotificationsRead } = useNotifications();
    const { openLogModal } = useLogModal();
    const { t, language } = useTranslation();

    const getTranslatedVerb = (verb: string, actorId?: number) => {
        const isSelfActor = !!user && !!actorId && actorId === user.id;
        const type = resolveNotificationType(verb, isSelfActor);
        return getNotificationText(type, verb, t);
    };

    const [isNotifMode, setIsNotifMode] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);

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
        return getRelativeTime(dateString, language);
    };

    const handleApproveRequest = async (e: React.MouseEvent, actorUsername: string) => {
        e.preventDefault();
        e.stopPropagation();
        setProcessingRequest(actorUsername);
        try {
            await api.post(`/users/${actorUsername}/approve-request/`);
            setNotifications(prev =>
                prev.filter(n => !(n.verb.includes('requested to follow') && n.actor.username === actorUsername))
            );
        } catch (error) {
            console.error('Failed to approve follow request:', error);
        } finally {
            setProcessingRequest(null);
        }
    };

    const handleRejectRequest = async (e: React.MouseEvent, actorUsername: string) => {
        e.preventDefault();
        e.stopPropagation();
        setProcessingRequest(actorUsername);
        try {
            await api.post(`/users/${actorUsername}/reject-request/`);
            setNotifications(prev =>
                prev.filter(n => !(n.verb.includes('requested to follow') && n.actor.username === actorUsername))
            );
        } catch (error) {
            console.error('Failed to reject follow request:', error);
        } finally {
            setProcessingRequest(null);
        }
    };

    const menuItems = [
        { icon: Hash, label: t('explore'), href: '/explore', key: 'explore' },
        // On mobile there's no room for a mini-drawer, so this navigates straight
        // to the full /notifications page instead of opening the in-place panel.
        {
            icon: Bell,
            label: t('notifications'),
            href: isMobile ? '/notifications' : '#',
            onClick: () => {
                if (!isMobile) setIsNotifMode(true);
                markNotificationsRead();
            },
            badge: unreadNotifications,
            key: 'notifications'
        },
        {
            icon: MessageSquare,
            label: t('messages'),
            href: '/messages',
            onClick: () => markMessagesRead(),
            badge: unreadMessages,
            key: 'messages'
        },
        { icon: Bookmark, label: t('bookmarks'), href: '/bookmarks', key: 'bookmarks' },
        { icon: User, label: t('profile'), href: user ? `/${user.username}` : '/login', key: 'profile' },
        { icon: Settings, label: t('settings'), href: '/settings', key: 'settings' },
    ];

    return (
        <div className="flex flex-col gap-2 h-full">
            {/* Search Bar Always Visible */}
            <SidebarSearch />

            {/* Conditional Content */}
            {isNotifMode ? (
                // --- VIEW A: NOTIFICATION DRAWER ---
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 h-full flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                        <h2 className="font-bold text-white">{t('notifications')}</h2>
                        <div className="flex items-center gap-1">
                            <Link href="/notifications" onClick={onNavigate} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
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
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {isLoading ? (
                            <div className="text-center py-8 text-zinc-500">{t('loading')}</div>
                        ) : notifications.length > 0 ? (
                            notifications.map((notif) => {
                                const isFollowRequest = notif.verb.includes('requested to follow');
                                const isProcessing = processingRequest === notif.actor.username;

                                if (isFollowRequest) {
                                    // Follow request: card fully clickable → profile, except Accept/Decline buttons
                                    return (
                                        <div
                                            key={notif.id}
                                            role="link"
                                            tabIndex={0}
                                            onClick={() => {
                                                setIsNotifMode(false);
                                                onNavigate?.();
                                                router.push(`/${notif.actor.username}`);
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && (setIsNotifMode(false), onNavigate?.(), router.push(`/${notif.actor.username}`))}
                                            className={`flex flex-col gap-2.5 p-3 rounded-xl cursor-pointer hover:bg-zinc-800/50 transition-colors ${!notif.is_read ? 'bg-zinc-800/30' : 'bg-zinc-800/10'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                                                    <img
                                                        src={getImageUrl(notif.actor.avatar, notif.actor.username)}
                                                        alt={notif.actor.username}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-zinc-200 leading-snug">
                                                        <span className="font-bold">{notif.actor.username}</span>
                                                        {' '}
                                                        <span className="text-zinc-400">{t('requestedToFollowYou')}</span>
                                                    </p>
                                                    <span className="text-xs text-zinc-500">{formatTime(notif.created_at)}</span>
                                                </div>
                                            </div>
                                            {/* Stop propagation on button row so clicks don't navigate */}
                                            <div className="flex items-center gap-2 pl-11" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => handleApproveRequest(e, notif.actor.username)}
                                                    disabled={isProcessing}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs py-1.5 transition-all cursor-pointer"
                                                >
                                                    {isProcessing ? '...' : t('accept')}
                                                </button>
                                                <button
                                                    onClick={(e) => handleRejectRequest(e, notif.actor.username)}
                                                    disabled={isProcessing}
                                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-bold rounded-lg text-xs py-1.5 border border-zinc-700 transition-all cursor-pointer"
                                                >
                                                    {isProcessing ? '...' : t('decline')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                // Standard notification: clickable link
                                return (
                                    <Link
                                        href={notif.target_url || `/${notif.actor.username}`}
                                        key={notif.id}
                                        onClick={() => { setIsNotifMode(false); onNavigate?.(); }}
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
                                                <span className="font-bold">{notif.actor.username}</span> {getTranslatedVerb(notif.verb, notif.actor.id)}
                                            </p>
                                            <span className="text-xs text-zinc-500">{formatTime(notif.created_at)}</span>
                                        </div>
                                    </Link>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-zinc-500">{t('noNotifications')}</div>
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
                                        key={item.key}
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
                                    key={item.key}
                                    href={item.href}
                                    onClick={() => { item.onClick?.(); onNavigate?.(); }}
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
                            onClick={() => { openLogModal(); onNavigate?.(); }}
                            className="mt-6 flex items-center gap-4 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all group w-full text-left shadow-lg shadow-emerald-900/20"
                        >
                            <PlusCircle className="h-6 w-6 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-lg">{t('logGame')}</span>
                        </button>
                    </div>
                </nav>
            )}
        </div>
    );
}
