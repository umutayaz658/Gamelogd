'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { User, Settings, LogOut, ChevronDown, LogIn, PlusCircle, Bell, MessageSquare, Search, Menu, X, Hash, Bookmark, Gamepad2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLogModal } from '@/context/LogModalContext';
import { useNotifications } from '@/context/NotificationContext';
import { getImageUrl } from '@/lib/utils';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout, isLoading } = useAuth();
    const { openLogModal } = useLogModal();
    const { unreadMessages, unreadNotifications, markMessagesRead, markNotificationsRead } = useNotifications();

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/news', label: 'News' },
        { href: '/devs', label: 'Devs' },
        { href: '/collabs', label: 'Collabs' },
        { href: '/invest', label: 'Invest' },
    ];

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname?.startsWith(href);
    };

    return (
        <>
            <nav className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
                {/* Gradient accent line */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    {/* Left: Logo + Nav Links */}
                    <div className="flex items-center gap-8">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>

                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
                                <Gamepad2 className="h-4.5 w-4.5 text-white" />
                            </div>
                            <span className="text-xl font-bold gradient-text hidden sm:inline">
                                Gamelogd
                            </span>
                        </Link>

                        {/* Desktop Nav Links */}
                        <div className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                                        isActive(link.href)
                                            ? 'text-white bg-zinc-800/60'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                                    }`}
                                >
                                    {link.label}
                                    {isActive(link.href) && (
                                        <div className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-8 h-[2px] bg-emerald-500 rounded-full" />
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2" ref={menuRef}>
                        {isLoading ? (
                            <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse" />
                        ) : user ? (
                            <>
                                {/* Notification Icon */}
                                <Link
                                    href="/notifications"
                                    onClick={() => markNotificationsRead()}
                                    className="relative p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-all hidden sm:flex"
                                >
                                    <Bell className="h-5 w-5" />
                                    {unreadNotifications > 0 && (
                                        <span className="absolute top-1 right-1 h-4 w-4 bg-emerald-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-zinc-950 animate-badge-pulse">
                                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                        </span>
                                    )}
                                </Link>

                                {/* Messages Icon */}
                                <Link
                                    href="/messages"
                                    onClick={() => markMessagesRead()}
                                    className="relative p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-all hidden sm:flex"
                                >
                                    <MessageSquare className="h-5 w-5" />
                                    {unreadMessages > 0 && (
                                        <span className="absolute top-1 right-1 h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-zinc-950 animate-badge-pulse">
                                            {unreadMessages > 9 ? '9+' : unreadMessages}
                                        </span>
                                    )}
                                </Link>

                                {/* Log Game Button */}
                                <button
                                    onClick={openLogModal}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full transition-all mr-1 shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 hover:scale-[1.02] active:scale-[0.98]"
                                    title="Log a Game"
                                >
                                    <PlusCircle className="h-4.5 w-4.5" />
                                    <span className="hidden sm:inline font-bold text-sm">Log Game</span>
                                </button>

                                {/* User Avatar Dropdown */}
                                <div
                                    className="flex items-center gap-1.5 cursor-pointer group"
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                >
                                    <div className="h-9 w-9 rounded-full bg-zinc-700 ring-2 ring-zinc-800 group-hover:ring-emerald-500/30 transition-all overflow-hidden">
                                        <img
                                            src={getImageUrl(user.avatar, user.username)}
                                            alt={user.username}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 group-hover:text-white transition-all duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Dropdown Menu */}
                                {isMenuOpen && (
                                    <div className="absolute top-[60px] right-4 w-60 glass-strong rounded-xl shadow-2xl shadow-black/60 py-2 animate-fade-up overflow-hidden">
                                        {/* Gradient accent */}
                                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                                        
                                        <div className="px-4 py-3 border-b border-zinc-800 mb-1">
                                            <p className="text-sm font-bold text-white">{user.username}</p>
                                            <p className="text-xs text-zinc-500 truncate">@{user.username.toLowerCase()}</p>
                                        </div>

                                        <Link
                                            href={`/${user.username}`}
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white transition-colors"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <User className="h-4 w-4" />
                                            Profile
                                        </Link>

                                        <Link
                                            href="/settings"
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white transition-colors"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <Settings className="h-4 w-4" />
                                            Settings
                                        </Link>

                                        <div className="my-1 border-t border-zinc-800" />

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Log Out
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <Link
                                href="/login"
                                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50"
                            >
                                <LogIn className="h-4 w-4" />
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            {/* Mobile Navigation Drawer */}
            {isMobileMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    
                    {/* Drawer */}
                    <div className="fixed top-16 left-0 right-0 bg-zinc-950 border-b border-zinc-800 z-40 md:hidden animate-fade-up">
                        <div className="container mx-auto px-4 py-4 flex flex-col gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                                        isActive(link.href)
                                            ? 'text-white bg-emerald-500/10 text-emerald-400'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}

                            {user && (
                                <>
                                    <div className="my-2 border-t border-zinc-800" />
                                    <Link
                                        href="/explore"
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                                            isActive('/explore') ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                        }`}
                                    >
                                        <Hash className="h-5 w-5" />
                                        Explore
                                    </Link>
                                    <Link
                                        href="/notifications"
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
                                    >
                                        <Bell className="h-5 w-5" />
                                        Notifications
                                        {unreadNotifications > 0 && (
                                            <span className="ml-auto bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                {unreadNotifications}
                                            </span>
                                        )}
                                    </Link>
                                    <Link
                                        href="/messages"
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
                                    >
                                        <MessageSquare className="h-5 w-5" />
                                        Messages
                                        {unreadMessages > 0 && (
                                            <span className="ml-auto bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                {unreadMessages}
                                            </span>
                                        )}
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
