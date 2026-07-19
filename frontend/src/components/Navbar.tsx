'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Settings, LogOut, ChevronDown, LogIn, PlusCircle, Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLogModal } from '@/context/LogModalContext';
import { getImageUrl, getMediaUrl } from '@/lib/utils';
import api from '@/lib/api';
import { useTranslation } from '@/lib/useTranslation';
import MobileSidebarDrawer from './MobileSidebarDrawer';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [recentSearches, setRecentSearches] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const mobileSearchRef = useRef<HTMLDivElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();
    const { user, logout, isLoading } = useAuth();
    const { openLogModal } = useLogModal();
    const { t } = useTranslation();

    useEffect(() => {
        const stored = localStorage.getItem('gamelogd_recent_searches');
        if (stored) {
            try {
                setRecentSearches(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse recent searches', e);
            }
        }
    }, []);

    const addToRecent = (item: any) => {
        const itemType = item.result_type || 'game';
        const updated = [
            { ...item, result_type: itemType },
            ...recentSearches.filter((r) => r.id !== item.id || r.result_type !== itemType)
        ].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('gamelogd_recent_searches', JSON.stringify(updated));
    };

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
            const res = await api.get(`/games/global-search/?q=${encodeURIComponent(query.trim())}`);
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

    const handleSelectResult = (item: any) => {
        addToRecent(item);
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        setIsMobileSearchOpen(false);
        if (item.result_type === 'company') {
            router.push(`/developer/${encodeURIComponent(item.name || item.title)}`);
        } else {
            router.push(`/games/${item.id}`);
        }
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
            if (mobileSearchRef.current && !mobileSearchRef.current.contains(event.target as Node)) {
                setIsMobileSearchOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const renderSearchResultsDropdown = () => (
        <div className="absolute top-full mt-2 left-0 right-0 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
            {isSearching ? (
                <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : searchQuery.trim().length >= 2 ? (
                searchResults.length > 0 ? (
                    <div className="py-1 max-h-80 overflow-y-auto">
                        {searchResults.map((item) => {
                            const coverUrl = getMediaUrl(item.cover_image || item.logo);
                            const isCompany = item.result_type === 'company';
                            return (
                                <button
                                    key={`${item.result_type}-${item.id}`}
                                    onClick={() => handleSelectResult(item)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/80 transition-colors text-left group"
                                >
                                    <div className={`w-10 h-13 rounded-md overflow-hidden flex-shrink-0 border border-zinc-700/50 ${isCompany ? 'bg-zinc-100 flex items-center justify-center p-1' : 'bg-zinc-800'}`}>
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={item.title || item.name} className={isCompany ? "w-full h-auto object-contain max-h-full" : "w-full h-full object-cover"} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Search className="w-4 h-4 text-zinc-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                                            {item.title || item.name}
                                        </p>
                                        {item.release_date && !isCompany && (
                                            <p className="text-xs text-zinc-500">
                                                {new Date(item.release_date).getFullYear()}
                                            </p>
                                        )}
                                        {isCompany && (
                                            <p className="text-xs text-indigo-400 font-medium uppercase tracking-wider">
                                                Company
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-6 text-center">
                        <p className="text-sm text-zinc-500">{t('noGamesFound')}</p>
                    </div>
                )
            ) : recentSearches.length > 0 ? (
                <div className="py-2">
                    <div className="px-4 pb-2 pt-1">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Recent Searches</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {recentSearches.map((item) => {
                            const coverUrl = getMediaUrl(item.cover_image || item.logo);
                            const isCompany = item.result_type === 'company';
                            return (
                                <button
                                    key={`recent-${item.result_type}-${item.id}`}
                                    onClick={() => handleSelectResult(item)}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/80 transition-colors text-left group"
                                >
                                    <div className={`w-8 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-700/50 ${isCompany ? 'bg-zinc-100 flex items-center justify-center p-1' : 'bg-zinc-800'}`}>
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={item.title || item.name} className={isCompany ? "w-full h-auto object-contain max-h-full" : "w-full h-full object-cover"} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Search className="w-3 h-3 text-zinc-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-300 truncate group-hover:text-white transition-colors">
                                            {item.title || item.name}
                                        </p>
                                        {isCompany && (
                                            <p className="text-[10px] text-indigo-400 uppercase tracking-wider">
                                                Company
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="py-6 text-center">
                    <p className="text-sm text-zinc-500">Search for games or developers...</p>
                </div>
            )}
        </div>
    );

    return (
        <>
            <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60">
                {/* Desktop row */}
                <div className="container mx-auto hidden lg:flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="text-xl font-bold text-white hover:text-zinc-200 transition-colors">
                            Gamelogd
                        </Link>
                        <div className="hidden md:flex items-center gap-6">
                            <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                {t('home')}
                            </Link>
                            <Link href="/news" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                {t('news')}
                            </Link>
                            <Link href="/devs" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                {t('devs')}
                            </Link>
                            {process.env.NODE_ENV === 'development' && (
                                <>
                                    <Link href="/collabs" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                        {t('collabs')}
                                    </Link>
                                    <Link href="/invest" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                        {t('invest')}
                                    </Link>
                                </>
                            )}
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
                                    onFocus={() => { setShowResults(true); }}
                                    placeholder="Search games and devs..."
                                    className="bg-transparent text-sm text-white placeholder-zinc-500 outline-none border-none ml-2 w-full"
                                />
                                {searchQuery && (
                                    <button onClick={clearSearch} className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Search Results Dropdown */}
                            {showResults && renderSearchResultsDropdown()}
                        </div>

                        {isLoading ? (
                            // Loading Skeleton
                            <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse" />
                        ) : user ? (
                            // Logged In State
                            <>
                                {/* Log Game Button (Visible on all logged in screens) */}
                                <button
                                    onClick={() => openLogModal()}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors shadow-lg shadow-emerald-900/20"
                                    title={t('logGame')}
                                >
                                    <PlusCircle className="h-5 w-5" />
                                    <span className="hidden sm:inline font-bold text-sm">{t('logGame')}</span>
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
                                            <User className="h-4 w-4" />
                                            {t('profile')}
                                        </Link>

                                        <Link
                                            href="/settings"
                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <Settings className="h-4 w-4" />
                                            {t('settings')}
                                        </Link>

                                        <div className="my-2 border-t border-zinc-700" />

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            {t('logOut')}
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
                                {t('login')}
                            </Link>
                        )}
                    </div>
                </div>

                {/* Mobile row — avatar (opens drawer) / Gamelogd wordmark (home) / expanding search */}
                <div className="relative grid grid-cols-[2.5rem_1fr_2.5rem] lg:hidden items-center h-16 px-4 gap-2">
                    {isLoading ? (
                        <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse" />
                    ) : user ? (
                        <button
                            onClick={() => setIsMobileDrawerOpen(true)}
                            className={`h-9 w-9 rounded-full bg-zinc-700 ring-2 ring-zinc-800 overflow-hidden transition-opacity ${isMobileSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                            aria-label="Open menu"
                        >
                            <img
                                src={getImageUrl(user.avatar, user.username)}
                                alt={user.username}
                                className="h-full w-full object-cover"
                            />
                        </button>
                    ) : (
                        <Link
                            href="/login"
                            className={`flex items-center justify-center h-9 w-9 rounded-full bg-zinc-800 text-zinc-300 transition-opacity ${isMobileSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        >
                            <LogIn className="h-4 w-4" />
                        </Link>
                    )}

                    <Link
                        href="/"
                        className={`justify-self-center text-lg font-bold text-white hover:text-zinc-200 transition-opacity ${isMobileSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                    >
                        Gamelogd
                    </Link>

                    <button
                        onClick={() => setIsMobileSearchOpen(true)}
                        className={`justify-self-end p-2 text-zinc-300 hover:text-white transition-opacity ${isMobileSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        aria-label="Search"
                    >
                        <Search className="h-5 w-5" />
                    </button>

                    {/* Expanding search overlay */}
                    <div
                        ref={mobileSearchRef}
                        className={`absolute inset-y-0 right-0 flex items-center overflow-hidden transition-all duration-300 ease-out ${isMobileSearchOpen ? 'left-0 opacity-100' : 'left-[calc(100%-3.25rem)] opacity-0 pointer-events-none'}`}
                    >
                        <div className="flex items-center gap-2 w-full h-full px-4 bg-zinc-900">
                            <div className="flex items-center flex-1 min-w-0 bg-zinc-800/70 border border-zinc-700/50 rounded-full px-3 py-1.5">
                                <Search className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    onFocus={() => setShowResults(true)}
                                    autoFocus={isMobileSearchOpen}
                                    placeholder="Search games and devs..."
                                    className="bg-transparent text-sm text-white placeholder-zinc-500 outline-none border-none ml-2 w-full min-w-0"
                                />
                                {searchQuery && (
                                    <button onClick={clearSearch} className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => { setIsMobileSearchOpen(false); clearSearch(); }}
                                className="flex-shrink-0 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>

                    {/* Results render outside the overflow-hidden overlay so the dropdown isn't clipped */}
                    {isMobileSearchOpen && showResults && (
                        <div className="absolute top-full inset-x-4 z-10">
                            {renderSearchResultsDropdown()}
                        </div>
                    )}
                </div>
            </nav>

            <MobileSidebarDrawer open={isMobileDrawerOpen} onClose={() => setIsMobileDrawerOpen(false)} />
        </>
    );
}
