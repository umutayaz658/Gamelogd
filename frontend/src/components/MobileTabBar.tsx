'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Hash, Newspaper, Bell, MessageSquare, ChevronUp, Sparkles, PenSquare, LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuthGate } from '@/context/AuthGateContext';
import { useNotifications } from '@/context/NotificationContext';
import { useTranslation } from '@/lib/useTranslation';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { usePostModal } from '@/context/PostModalContext';
import { isChromeHiddenPath } from '@/lib/publicPaths';

type Tab = { key: string; href: string; icon: typeof Home; label: string; badge?: number; onClick?: () => void };

export default function MobileTabBar() {
    const { user } = useAuth();
    const { requireAuth } = useAuthGate();
    const { unreadNotifications, unreadMessages, markMessagesRead, markNotificationsRead, isChatFullscreen } = useNotifications();
    const { t } = useTranslation();
    const pathname = usePathname();
    const router = useRouter();
    const isMobile = useIsMobile();
    const { openPostModal } = usePostModal();

    const scrollHidden = useHideOnScroll();
    const [isExpanded, setIsExpanded] = useState(false);
    const navRef = useRef<HTMLElement>(null);

    // Close the drawer on any tap outside the nav bar itself.
    useEffect(() => {
        if (!isExpanded) return;
        const handleOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isExpanded]);

    // Auth-flow pages (login/register/verify-email) have no use for a "Login" tab or any nav
    // at all — the whole page IS the login flow. '/' is also excluded, but only while
    // anonymous — it's the marketing/cover page then (see app/page.tsx), not a content page;
    // a signed-in visitor still gets the normal tab bar there since '/' is their real feed.
    const hideChrome = isChromeHiddenPath(pathname ?? '', !user);

    // Only the auth-required condition changed here (dropped `!user`) — an anonymous
    // visitor still gets a (reduced) tab bar instead of losing mobile nav entirely.
    if (!isMobile || isChatFullscreen || hideChrome) return null;

    // Anonymous visitors get a fully static bar — no scroll-hide/show — so it (and the
    // login/register banner pinned above it) never slides away while browsing signed out.
    // Signed-in behavior is unchanged.
    const hidden = user ? scrollHidden : false;

    const recommendedHref = user ? `/${user.username}/recommended` : null;

    const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

    // These pages should never hide the tab bar on scroll-down — the messages check
    // only ever matters for the conversation list, since isChatFullscreen already hides
    // this bar entirely once a chat thread is open. Settings has its own long scrollable
    // sub-pages, so it's included for the same reason as Notifications/Messages.
    const alwaysVisible = pathname === '/notifications' || pathname === '/messages' || pathname === '/settings';

    const renderTab = (tab: Tab) => {
        const active = isActive(tab.href);
        return (
            <Link
                key={tab.key}
                href={tab.href}
                onClick={() => { tab.onClick?.(); setIsExpanded(false); }}
                className="flex flex-col items-center justify-center gap-0.5 relative"
                aria-label={tab.label}
            >
                <div className="relative">
                    <tab.icon className={`h-5 w-5 ${active ? 'text-white' : 'text-zinc-500'}`} />
                    {tab.badge && tab.badge > 0 ? (
                        <span className="absolute -top-1 -right-2 h-4 w-4 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-zinc-950">
                            {tab.badge > 9 ? '9+' : tab.badge}
                        </span>
                    ) : null}
                </div>
                <span className={`text-[10px] leading-none ${active ? 'text-white font-medium' : 'text-zinc-500'}`}>
                    {tab.label}
                </span>
            </Link>
        );
    };

    if (!user) {
        // Anonymous set: no Notifications/Messages/Recommended (all inherently personal —
        // Recommended isn't even public per middleware), no expandable drawer since there's
        // nothing left to put in it. News is promoted straight into the main row instead.
        const anonTabs: Tab[] = [
            { key: 'home', href: '/home', icon: Home, label: t('home') },
            { key: 'explore', href: '/explore', icon: Hash, label: t('explore') },
            { key: 'news', href: '/news', icon: Newspaper, label: t('news') },
        ];
        const showPostFab = pathname === '/home' || pathname === '/explore';

        return (
            <>
                {showPostFab && (
                    <button
                        onClick={() => { if (requireAuth('post')) return; openPostModal(); }}
                        aria-label={t('post')}
                        className={`fixed right-4 z-40 lg:hidden h-14 w-14 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/30 transition-all duration-300 ease-out ${
                            hidden && !alwaysVisible ? 'bottom-[max(env(safe-area-inset-bottom),1rem)]' : 'bottom-20'
                        }`}
                    >
                        <PenSquare className="h-6 w-6" />
                    </button>
                )}
                <nav
                    ref={navRef}
                    className={`fixed bottom-0 inset-x-0 z-50 lg:hidden bg-zinc-900 border-t border-zinc-800 pb-[max(env(safe-area-inset-bottom),0.5rem)] transition-transform duration-300 ease-out ${
                        hidden && !alwaysVisible ? 'translate-y-full' : 'translate-y-0'
                    }`}
                >
                    <div className="grid grid-cols-4 h-14">
                        {anonTabs.map(renderTab)}
                        <button
                            onClick={() => router.push('/login')}
                            className="flex flex-col items-center justify-center gap-0.5 relative"
                            aria-label={t('login')}
                        >
                            <LogIn className="h-5 w-5 text-zinc-500" />
                            <span className="text-[10px] leading-none text-zinc-500">{t('login')}</span>
                        </button>
                    </div>
                </nav>
            </>
        );
    }

    const leftTabs: Tab[] = [
        { key: 'home', href: '/', icon: Home, label: t('home') },
        { key: 'explore', href: '/explore', icon: Hash, label: t('explore') },
    ];
    const rightTabs: Tab[] = [
        {
            key: 'notifications',
            href: '/notifications',
            icon: Bell,
            label: t('notifications'),
            badge: unreadNotifications,
            onClick: markNotificationsRead,
        },
        {
            key: 'messages',
            href: '/messages',
            icon: MessageSquare,
            label: t('messages'),
            badge: unreadMessages,
            onClick: markMessagesRead,
        },
    ];
    // News moved out of the main row into the expandable row below, alongside Recommended.
    const expandedTabs: Tab[] = [
        { key: 'news', href: '/news', icon: Newspaper, label: t('news') },
        { key: 'recommended', href: recommendedHref!, icon: Sparkles, label: t('recommended') },
    ];

    const isExpandedGroupActive = isActive('/news') || isActive(recommendedHref!);

    // Quick-post FAB only makes sense where there's a feed (or the user's own posts) to
    // post into — not on e.g. Messages/Settings/someone else's profile.
    const showPostFab = pathname === '/' || pathname === '/explore' || pathname === '/bookmarks' || pathname === `/${user.username}`;

    return (
        <>
            {/* Quick-post FAB — follows the tab bar's own scroll-hide animation (same
                duration/easing) instead of just vanishing with it: when the bar slides
                down, the FAB slides down too and settles at the very bottom edge, then
                slides back up together with the bar on scroll-up. */}
            {showPostFab && (
                <button
                    onClick={openPostModal}
                    aria-label={t('post')}
                    className={`fixed right-4 z-40 lg:hidden h-14 w-14 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/30 transition-all duration-300 ease-out ${
                        hidden && !alwaysVisible ? 'bottom-[max(env(safe-area-inset-bottom),1rem)]' : 'bottom-20'
                    }`}
                >
                    <PenSquare className="h-6 w-6" />
                </button>
            )}
            <nav
                ref={navRef}
                className={`fixed bottom-0 inset-x-0 z-50 lg:hidden bg-zinc-900 border-t border-zinc-800 pb-[max(env(safe-area-inset-bottom),0.5rem)] transition-transform duration-300 ease-out ${
                    hidden && !alwaysVisible ? 'translate-y-full' : 'translate-y-0'
                }`}
            >
                {/* Main row comes first in DOM so it's the one that gets pushed upward when
                    the drawer below it grows — the News/Recommended row becomes the new
                    bottom-most strip instead of appearing above the main row. */}
                <div className="grid grid-cols-5 h-14">
                    {leftTabs.map(renderTab)}
                    <button
                        onClick={() => setIsExpanded((v) => !v)}
                        className="flex flex-col items-center justify-center gap-0.5 relative"
                        aria-label={t('recommended')}
                        aria-expanded={isExpanded}
                    >
                        <ChevronUp className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} ${isExpanded || isExpandedGroupActive ? 'text-white' : 'text-zinc-500'}`} />
                    </button>
                    {rightTabs.map(renderTab)}
                </div>

                {/* Expandable drawer — News + Recommended. Animates via an explicit inline
                    height (rather than swapping Tailwind's max-h utility) so the grow/shrink
                    is a single smooth property change. Being last in DOM, this row is what
                    ends up flush against the screen edge once it grows. */}
                <div
                    className="grid grid-cols-2 overflow-hidden transition-[height] duration-300 ease-out"
                    style={{ height: isExpanded ? '3.5rem' : '0px' }}
                >
                    {expandedTabs.map(renderTab)}
                </div>
            </nav>
        </>
    );
}
