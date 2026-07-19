'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Hash, Newspaper, Bell, MessageSquare, ChevronUp, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useTranslation } from '@/lib/useTranslation';
import { useIsMobile } from '@/hooks/useIsMobile';

// Pixels of scroll movement (in one direction) required before the bar reacts,
// so it doesn't flicker on tiny scroll jitter.
const SCROLL_THRESHOLD = 8;

export default function MobileTabBar() {
    const { user } = useAuth();
    const { unreadNotifications, unreadMessages, markMessagesRead, markNotificationsRead, isChatFullscreen } = useNotifications();
    const { t } = useTranslation();
    const pathname = usePathname();
    const isMobile = useIsMobile();

    const [hidden, setHidden] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const lastScrollY = useRef(0);
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

    useEffect(() => {
        lastScrollY.current = window.scrollY;

        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY.current;

            if (currentScrollY <= 0) {
                setHidden(false);
            } else if (delta > SCROLL_THRESHOLD) {
                setHidden(true); // scrolling down
                lastScrollY.current = currentScrollY;
            } else if (delta < -SCROLL_THRESHOLD) {
                setHidden(false); // scrolling up
                lastScrollY.current = currentScrollY;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!user || !isMobile || isChatFullscreen) return null;

    const recommendedHref = `/${user.username}/recommended`;

    const leftTabs = [
        { key: 'home', href: '/', icon: Home, label: t('home') },
        { key: 'explore', href: '/explore', icon: Hash, label: t('explore') },
    ];
    const rightTabs = [
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
    const expandedTabs = [
        { key: 'news', href: '/news', icon: Newspaper, label: t('news') },
        { key: 'recommended', href: recommendedHref, icon: Sparkles, label: t('recommended') },
    ];

    const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));
    const isExpandedGroupActive = isActive('/news') || isActive(recommendedHref);

    // These two pages should never hide the tab bar on scroll-down — the messages check
    // only ever matters for the conversation list, since isChatFullscreen already hides
    // this bar entirely once a chat thread is open.
    const alwaysVisible = pathname === '/notifications' || pathname === '/messages';

    const renderTab = (tab: { key: string; href: string; icon: typeof Home; label: string; badge?: number; onClick?: () => void }) => {
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

    return (
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
    );
}
