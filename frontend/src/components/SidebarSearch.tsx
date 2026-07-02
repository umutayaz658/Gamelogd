'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, User as UserIcon, Building, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';

export default function SidebarSearch() {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [filterType, setFilterType] = useState<'users' | 'organisations' | 'projects'>('users');
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [recentSearches, setRecentSearches] = useState<any[]>([]);
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

    // Load recent searches from localStorage when dropdown opens
    useEffect(() => {
        if (showResults && typeof window !== 'undefined') {
            const stored = localStorage.getItem('gamelogd_recent_searches');
            if (stored) {
                try {
                    setRecentSearches(JSON.parse(stored));
                } catch (e) {
                    console.error("Failed to parse recent searches", e);
                }
            }
        }
    }, [showResults]);

    const saveRecentSearch = (item: any) => {
        try {
            const existing = localStorage.getItem('gamelogd_recent_searches');
            let list = existing ? JSON.parse(existing) : [];
            // Remove duplicates
            list = list.filter((x: any) => !(x.id === item.id && x.type === item.type));
            list.unshift(item);
            list = list.slice(0, 5);
            localStorage.setItem('gamelogd_recent_searches', JSON.stringify(list));
            setRecentSearches(list);
        } catch (e) {
            console.error("Error saving recent search", e);
        }
    };

    // Debounce / Trigger search when query or filterType changes
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
            if (cleanQuery.length > 2) {
                setIsLoading(true);
                setShowResults(true);
                try {
                    let endpoint = `/users/?search=${cleanQuery}`;
                    if (filterType === 'organisations') {
                        endpoint = `/organisations/?search=${cleanQuery}`;
                    } else if (filterType === 'projects') {
                        endpoint = `/projects/?search=${cleanQuery}`;
                    }
                    const res = await api.get(endpoint);
                    setResults(res.data.results || res.data);
                } catch (error) {
                    console.error("Search failed:", error);
                    setResults([]);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query, filterType]);

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setShowResults(false);
    };

    const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
    const isQueryShort = cleanQuery.length < 3;

    return (
        <div className="relative mb-6" ref={searchRef}>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setShowResults(true)}
                    placeholder={t('searchPlaceholder' as any) || "Ara..."}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-2.5 pl-10 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-500"
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

            {/* Absolute Dropdown Overlay */}
            {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col">
                    {/* Filter Pills inside dropdown */}
                    <div className="p-2.5 bg-zinc-900 border-b border-zinc-800/80 flex gap-1.5 justify-start">
                        <button
                            type="button"
                            onClick={() => {
                                setFilterType('users');
                                setResults([]);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                filterType === 'users'
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                    : 'bg-zinc-950/50 border border-zinc-850 text-zinc-400 hover:text-white'
                            }`}
                        >
                            <UserIcon className="h-3.5 w-3.5" />
                            <span>{t('users')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFilterType('organisations');
                                setResults([]);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                filterType === 'organisations'
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                    : 'bg-zinc-950/50 border border-zinc-850 text-zinc-400 hover:text-white'
                            }`}
                        >
                            <Building className="h-3.5 w-3.5" />
                            <span>{t('organisations')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFilterType('projects');
                                setResults([]);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                filterType === 'projects'
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                    : 'bg-zinc-950/50 border border-zinc-850 text-zinc-400 hover:text-white'
                            }`}
                        >
                            <FolderKanban className="h-3.5 w-3.5" />
                            <span>{t('projects')}</span>
                        </button>
                    </div>

                    {/* Content Section */}
                    {isLoading ? (
                        <div className="flex items-center justify-center p-6">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                        </div>
                    ) : isQueryShort ? (
                        <div className="max-h-64 overflow-y-auto py-2 scrollbar-thin-dark">
                            <div className="px-4 py-1.5 text-xs font-semibold text-zinc-500 flex items-center justify-between">
                                <span>{t('recentSearches')}</span>
                                {recentSearches.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            localStorage.removeItem('gamelogd_recent_searches');
                                            setRecentSearches([]);
                                        }}
                                        className="hover:text-red-400 transition-colors font-bold text-[10px] uppercase tracking-wider"
                                    >
                                        {t('clearAll')}
                                    </button>
                                )}
                            </div>
                            {recentSearches.length > 0 ? (
                                recentSearches.map((item) => {
                                    const fallbackChar = (item.name || '?').charAt(0).toUpperCase();
                                    return (
                                        <Link
                                            key={`${item.type}-${item.id}`}
                                            href={item.href || '#'}
                                            onClick={() => {
                                                saveRecentSearch(item);
                                                setShowResults(false);
                                            }}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/80 transition-colors"
                                        >
                                            <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 border border-zinc-800 flex items-center justify-center font-bold text-white text-sm">
                                                {item.avatar ? (
                                                    <img
                                                        src={getImageUrl(item.avatar)}
                                                        alt={item.name || ''}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    fallbackChar
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{item.name || ''}</p>
                                                <p className="text-xs text-zinc-550 truncate font-mono">{item.subtext || ''}</p>
                                            </div>
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className="px-4 py-6 text-center text-sm text-zinc-500">
                                    {t('noRecentSearches')}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="max-h-64 overflow-y-auto py-2 scrollbar-thin-dark">
                            {results.length > 0 ? (
                                results.map((item) => {
                                    let href = `/${item.username || ''}`;
                                    let avatar = item.avatar;
                                    let name = item.real_name || item.username || '';
                                    let subtext = item.username ? `@${item.username}` : '';
                                    let type: 'users' | 'organisations' | 'projects' = 'users';

                                    if (filterType === 'organisations') {
                                        href = `/organisations/${item.slug || ''}`;
                                        avatar = item.logo;
                                        name = item.name || '';
                                        subtext = item.slug ? `/organisations/${item.slug}` : '';
                                        type = 'organisations';
                                    } else if (filterType === 'projects') {
                                        href = `/projects/${item.id || ''}`;
                                        avatar = item.cover_image;
                                        name = item.title || '';
                                        subtext = item.status ? `Status: ${item.status}` : 'Game Project';
                                        type = 'projects';
                                    }

                                    // Absolute fallback if name is completely empty
                                    if (!name) name = item.username || item.slug || 'Result';

                                    const recentItem = {
                                        id: item.id || 0,
                                        type,
                                        name,
                                        subtext,
                                        avatar,
                                        href
                                    };

                                    const fallbackChar = name.charAt(0).toUpperCase();

                                    return (
                                        <Link
                                            key={item.id || `${type}-${name}`}
                                            href={href}
                                            onClick={() => {
                                                saveRecentSearch(recentItem);
                                                setShowResults(false);
                                            }}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/80 transition-colors"
                                        >
                                            <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 border border-zinc-800 flex items-center justify-center font-bold text-white text-sm">
                                                {avatar ? (
                                                    <img
                                                        src={getImageUrl(avatar)}
                                                        alt={name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    fallbackChar
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{name}</p>
                                                <p className="text-xs text-zinc-550 truncate font-mono">
                                                    {subtext}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className="p-4 text-center text-sm text-zinc-500">
                                    {t('noResultsFound' as any) || 'Sonuç bulunamadı.'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
