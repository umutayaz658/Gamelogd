'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Settings, LogOut, ChevronDown, LogIn, PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLogModal } from '@/context/LogModalContext';
import { getImageUrl } from '@/lib/utils';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { user, logout, isLoading } = useAuth();
    const { openLogModal } = useLogModal(); // Hook

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
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

                <div className="flex items-center gap-4" ref={menuRef}>
                    {isLoading ? (
                        // Loading Skeleton
                        <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse" />
                    ) : user ? (
                        // Logged In State
                        <>
                            {/* Log Game Button (Visible on all logged in screens) */}
                            <button
                                onClick={openLogModal}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors mr-2 shadow-lg shadow-emerald-900/20"
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
                                        <p className="text-sm font-bold text-white">{user.username}</p>
                                        <p className="text-xs text-zinc-400 truncate">@{user.username.toLowerCase()}</p>
                                    </div>

                                    <Link
                                        href={`/${user.username}`}
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <User className="h-4 w-4" />
                                        Profile
                                    </Link>

                                    <Link
                                        href="/settings"
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <Settings className="h-4 w-4" />
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
        </nav>
    );
}
