'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

interface SearchUser {
    id: number;
    username: string;
    real_name?: string;
    avatar?: string;
}

export default function SidebarSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounce Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length > 2) {
                setIsLoading(true);
                setShowResults(true);
                try {
                    const res = await api.get(`/users/?search=${query}`);
                    setResults(res.data);
                } catch (error) {
                    console.error("Search failed:", error);
                    setResults([]);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setResults([]);
                if (query.length === 0) setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setShowResults(false);
    };

    return (
        <div className="relative mb-6" ref={searchRef}>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 2 && setShowResults(true)}
                    placeholder="Search..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2.5 pl-10 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-500"
                />
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />

                {query.length > 0 && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-2.5 text-zinc-500 hover:text-white transition-colors"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <X className="h-4 w-4" />
                        )}
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {showResults && query.length > 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {results.length > 0 ? (
                        <div className="max-h-64 overflow-y-auto py-2">
                            {results.map((user) => (
                                <Link
                                    key={user.id}
                                    href={`/${user.username}`}
                                    onClick={() => setShowResults(false)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors"
                                >
                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700">
                                        {user.avatar ? (
                                            <img
                                                src={getImageUrl(user.avatar, user.username)}
                                                alt={user.username}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                                <UserIcon className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {user.real_name && (
                                            <p className="text-sm font-bold text-white truncate">{user.real_name}</p>
                                        )}
                                        <p className={`text-xs text-zinc-400 truncate ${!user.real_name ? 'text-sm font-medium text-zinc-200' : ''}`}>
                                            @{user.username}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        !isLoading && (
                            <div className="p-4 text-center text-sm text-zinc-500">
                                No users found.
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
