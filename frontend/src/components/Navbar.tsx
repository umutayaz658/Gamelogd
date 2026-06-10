'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
    User, Settings, LogOut, ChevronDown, LogIn, PlusCircle, Search, X, 
    Bell, MessageSquare, Bookmark, Home, Newspaper, Code2, Briefcase, DollarSign 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLogModal } from '@/context/LogModalContext';
import { useNotifications } from '@/context/NotificationContext';
import { getImageUrl } from '@/lib/utils';
import api from '@/lib/api';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout, isLoading } = useAuth();
    const { openLogModal } = useLogModal();
    const { unreadMessages, unreadNotifications } = useNotifications();

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
    };

    const searchGames = useCallback(async (query: string) => {
        if (query.trim().length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const res = await api.get(`/games/?search=${encodeURIComponent(query.trim())}`);
            const results = res.data.results || res.data;
            setSearchResults(results.slice(0, 6));
        } catch (err) {
            console.error('Search failed', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        setShowResults(true);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            searchGames(value);
        }, 300);
    };

    const handleSelectGame = (gameId: number) => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        router.push(`/games/${gameId}`);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
    };

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-xl font-bold text-white hover:text-zinc-200 transition-colors">
                        Gamelogd
                    </Link>
                    <div className="hidden md:flex items-center gap-6">
                        <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                            Home
                        </Link>
                        <Link href="/news" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                            News
                        </Link>
                        <Link href="/devs" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                            Devs
                        </Link>
                        <Link href="/collabs" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                            Collabs
                        </Link>
                        <Link href="/invest" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                            Invest
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-3" ref={menuRef}>
                    {/* Game Search Bar */}
                    <div className="relative" ref={searchRef}>
                        <div className="flex items-center bg-zinc-800/70 border border-zinc-700/50 rounded-full px-3 py-1.5 focus-within:border-indigo-500/60 focus-within:bg-zinc-800 transition-all duration-300 w-48 sm:w-64 focus-within:w-64 sm:focus-within:w-80">
                            <Search className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onFocus={() => { if (searchQuery.trim().length >= 2) setShowResults(true); }}
                                placeholder="Search games"
                                className="bg-transparent text-sm text-white placeholder-zinc-500 outline-none border-none ml-2 w-full"
                            />
                            {searchQuery && (
                                <button onClick={clearSearch} className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {showResults && searchQuery.trim().length >= 2 && (
                            <div className="absolute top-full mt-2 left-0 right-0 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                                {isSearching ? (
                                    <div className="flex items-center justify-center py-6">
                                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="py-1 max-h-80 overflow-y-auto">
                                        {searchResults.map((game) => {
                                            const coverUrl = game.cover_image
                                                ? (game.cover_image.startsWith('http') ? game.cover_image : `http://localhost:8000${game.cover_image}`)
                                                : null;
                                            return (
                                                <button
                                                    key={game.id}
                                                    onClick={() => handleSelectGame(game.id)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/80 transition-colors text-left group"
                                                >
                                                    <div className="w-10 h-13 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700/50">
                                                        {coverUrl ? (
                                                            <img src={coverUrl} alt={game.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Search className="w-4 h-4 text-zinc-600" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                                                            {game.title}
                                                        </p>
                                                        {game.release_date && (
                                                            <p className="text-xs text-zinc-500">
                                                                {new Date(game.release_date).getFullYear()}
                                                            </p>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-6 text-center">
                                        <p className="text-sm text-zinc-500">No games found</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {isLoading ? (
                        // Loading Skeleton
                        <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse" />
                    ) : user ? (
                        // Logged In State
                        <>
                            {/* Log Game Button (Visible on all logged in screens) */}
                            <button
                                onClick={openLogModal}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors shadow-lg shadow-emerald-900/20"
                                title="Log a Game"
                            >
                                <PlusCircle className="h-5 w-5" />
                                <span className="hidden sm:inline font-bold text-sm">Log Game</span>
                            </button>

                            <div
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                            >
                                <div className="h-9 w-9 rounded-full bg-zinc-700 ring-2 ring-zinc-800 group-hover:ring-zinc-600 transition-all overflow-hidden">
                                    <img
                                        src={getImageUrl(user.avatar, user.username)}
                                        alt={user.username}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <ChevronDown className={`h-4 w-4 text-zinc-400 group-hover:text-white transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                                <div className="absolute top-16 right-4 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="px-4 py-3 border-b border-zinc-700 mb-2">
                                        <p className="text-sm font-bold text-white">{user.real_name || user.username}</p>
                                        <p className="text-xs text-zinc-400 truncate">@{user.username.toLowerCase()}</p>
                                    </div>

                                    <Link
                                        href={`/${user.username}`}
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <User className="h-4 w-4 text-zinc-400" />
                                        Profile
                                    </Link>

                                    <Link
                                        href="/notifications"
                                        className="flex items-center justify-between px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Bell className="h-4 w-4 text-zinc-400" />
                                            Notifications
                                        </div>
                                        {unreadNotifications > 0 && (
                                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        )}
                                    </Link>

                                    <Link
                                        href="/messages"
                                        className="flex items-center justify-between px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <MessageSquare className="h-4 w-4 text-zinc-400" />
                                            Messages
                                        </div>
                                        {unreadMessages > 0 && (
                                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        )}
                                    </Link>

                                    <Link
                                        href="/bookmarks"
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <Bookmark className="h-4 w-4 text-zinc-400" />
                                        Bookmarks
                                    </Link>

                                    <Link
                                        href="/settings"
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <Settings className="h-4 w-4 text-zinc-400" />
                                        Settings
                                    </Link>

                                    <div className="my-2 border-t border-zinc-700" />

                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Log Out
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        // Logged Out State
                        <Link
                            href="/login"
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            <LogIn className="h-4 w-4" />
                            Login
                        </Link>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Navigation Dock */}
            {user && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800 flex justify-around items-center h-16 md:hidden px-2 shadow-2xl">
                    {[
                        { label: 'Home', href: '/', icon: Home, color: 'text-emerald-500' },
                        { label: 'News', href: '/news', icon: Newspaper, color: 'text-emerald-500' },
                        { label: 'Devs', href: '/devs', icon: Code2, color: 'text-blue-500' },
                        { label: 'Collabs', href: '/collabs', icon: Briefcase, color: 'text-blue-500' },
                        { label: 'Invest', href: '/invest', icon: DollarSign, color: 'text-amber-500' }
                    ].map((item) => {
                        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${
                                    active ? item.color : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <Icon className={`h-5 w-5 transition-transform ${active ? 'scale-110' : ''}`} />
                                <span className="text-[10px] font-bold mt-1 tracking-wide uppercase">{item.label}</span>
                                {active && (
                                    <div className="absolute top-0 w-8 h-1 bg-current rounded-b-full" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </nav>
    );
}
