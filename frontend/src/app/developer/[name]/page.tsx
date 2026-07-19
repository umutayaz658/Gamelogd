'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { CompanyInfo, CompanyGame } from '@/types';
import Navbar from '@/components/Navbar';
import LeftSidebar from '@/components/LeftSidebar';
import Image from 'next/image';

// Country code mapping (ISO 3166-1 numeric)
const COUNTRY_MAP: Record<number, string> = {
    840: 'USA', 616: 'Poland', 392: 'Japan', 124: 'Canada', 
    826: 'UK', 250: 'France', 276: 'Germany', 752: 'Sweden', 
    156: 'China', 410: 'South Korea', 100: 'Bulgaria', 
    380: 'Italy', 724: 'Spain', 36: 'Australia', 554: 'New Zealand',
    158: 'Taiwan', 643: 'Russia', 804: 'Ukraine', 246: 'Finland'
};

// IGDB website category labels
const WEBSITE_LABELS: Record<number, string> = {
    1: 'Official',
    2: 'Wikia',
    3: 'Wikipedia',
    4: 'Facebook',
    5: 'Twitter',
    6: 'Twitch',
    8: 'Instagram',
    9: 'YouTube',
};

export default function DeveloperPage() {
    const params = useParams();
    const companyName = decodeURIComponent(params.name as string);

    const [company, setCompany] = useState<CompanyInfo | null>(null);
    const [games, setGames] = useState<CompanyGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [error, setError] = useState(false);
    const [filter, setFilter] = useState<'all' | 'developer' | 'publisher'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'rating'>('date');


    useEffect(() => {
        const fetchCompanyInfo = async () => {
            try {
                const res = await api.get(`/games/company-info/?name=${encodeURIComponent(companyName)}`);
                setCompany(res.data);
            } catch (err) {
                console.error("Failed to fetch company info:", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        const fetchCompanyGames = async () => {
            try {
                const res = await api.get(`/games/company-games/?name=${encodeURIComponent(companyName)}`);
                setGames(res.data);
            } catch (err) {
                console.error("Failed to fetch company games:", err);
            } finally {
                setGamesLoading(false);
            }
        };

        if (companyName) {
            fetchCompanyInfo();
            fetchCompanyGames();
        }
    }, [companyName]);

    const filteredGames = games.filter(g => {
        if (filter === 'developer' && !g.is_developer) return false;
        if (filter === 'publisher' && !g.is_publisher) return false;
        if (searchQuery && !g.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    }).sort((a, b) => {
        if (sortBy === 'rating') {
            return (b.rating || 0) - (a.rating || 0);
        } else {
            const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
            const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
            return dateB - dateA;
        }
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
                <Navbar />
                <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="hidden lg:block col-span-3"><LeftSidebar /></div>
                        <div className="col-span-12 lg:col-span-9 flex justify-center items-center h-64">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !company) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
                <Navbar />
                <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="hidden lg:block col-span-3"><LeftSidebar /></div>
                        <div className="col-span-12 lg:col-span-9 text-center mt-20">
                            <span className="text-5xl block mb-4">🏢</span>
                            <h2 className="text-xl font-bold text-zinc-300 mb-2">Company not found</h2>
                            <p className="text-zinc-500">Could not find information for &quot;{companyName}&quot;.</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const foundedYear = company.start_date ? new Date(company.start_date).getFullYear() : null;
    const officialWebsite = company.websites?.find(w => w.category === 1)?.url;

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 relative">
            {/* Background Glow */}
            <div
                className="fixed inset-0 z-0 opacity-[0.04] pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.4) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(16, 185, 129, 0.3) 0%, transparent 60%)',
                }}
            />

            <div className="relative z-10">
                <Navbar />
                <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6 pb-20">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="hidden lg:block col-span-3">
                            <LeftSidebar />
                        </div>

                        <div className="col-span-12 lg:col-span-9">
                            <div className="max-w-full mx-auto">

                                {/* Hero Section */}
                                <div className="mb-12 relative z-10">
                                    <div className="w-full bg-zinc-900/40 border border-zinc-800/60 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md relative p-8 md:p-12">
                                        {/* Decorative Background Glows */}
                                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
                                        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

                                        <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start">
                                            <div className="flex-1 w-full">
                                                {/* Resolved From Badge */}
                                                {company.resolved_from && (
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="text-xs text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-zinc-700/50 font-medium tracking-wide shadow-sm">
                                                            🔀 Redirected from {company.resolved_from}
                                                        </span>
                                                    </div>
                                                )}

                                                <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight drop-shadow-lg text-white">
                                                    {company.name}
                                                </h1>

                                                <div className="flex flex-wrap items-center gap-3 mb-8 text-sm font-medium">
                                                    {foundedYear && (
                                                        <span className="bg-zinc-800/80 text-zinc-300 px-4 py-2 rounded-xl border border-zinc-700/50 flex items-center gap-2 shadow-sm hover:bg-zinc-800 transition-colors">
                                                            <span className="text-zinc-500">🗓️</span> Founded {foundedYear}
                                                        </span>
                                                    )}
                                                    {company.country && (
                                                        <span className="bg-zinc-800/80 text-zinc-300 px-4 py-2 rounded-xl border border-zinc-700/50 flex items-center gap-2 shadow-sm hover:bg-zinc-800 transition-colors">
                                                            <span className="text-zinc-500">🌍</span> Headquartered In: {COUNTRY_MAP[company.country] || `Code ${company.country}`}
                                                        </span>
                                                    )}
                                                    {officialWebsite && (
                                                        <a
                                                            href={officialWebsite}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 px-4 py-2 rounded-xl border border-indigo-500/20 transition-all flex items-center gap-2 shadow-sm"
                                                        >
                                                            🌐 Official Website <span className="opacity-70 text-xs">↗</span>
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Description embedded in the hero */}
                                                <div className="prose prose-invert max-w-none">
                                                    {company.description ? (
                                                        <p className="text-zinc-300 leading-relaxed text-lg font-medium border-l-4 border-indigo-500/50 pl-5 py-2">
                                                            {company.description}
                                                        </p>
                                                    ) : (
                                                        <p className="text-zinc-500 italic border-l-4 border-zinc-700/50 pl-5 py-2">
                                                            Açıklama bulunmuyor. (No description available on IGDB for this developer.)
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Social Links */}
                                                {company.websites && company.websites.length > 1 && (
                                                    <div className="flex flex-wrap gap-2 mt-8">
                                                        {company.websites.filter(w => w.category !== 1).map((w, i) => (
                                                            <a
                                                                key={i}
                                                                href={w.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800/40 hover:bg-zinc-700/80 px-3 py-1.5 rounded-lg border border-zinc-700/40 transition-all shadow-sm flex items-center gap-1.5"
                                                            >
                                                                {WEBSITE_LABELS[w.category] || 'Link'} <span className="opacity-50">↗</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Games Stat Floating Right */}
                                            <div className="shrink-0 w-full md:w-auto">
                                                <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/90 rounded-3xl p-6 md:p-8 border border-zinc-700/50 shadow-2xl flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 md:gap-6 min-w-[200px] hover:border-indigo-500/40 transition-colors">
                                                    <div className="p-4 bg-zinc-900 rounded-full shadow-inner border border-zinc-800/80 flex items-center justify-center">
                                                        <span className="text-4xl block">🎮</span>
                                                    </div>
                                                    <div className="flex flex-col items-end md:items-center">
                                                        <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 leading-none mb-2">
                                                            {games.length}
                                                        </span>
                                                        <span className="text-[11px] text-zinc-400 uppercase font-bold tracking-[0.2em]">
                                                            Games Listed
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Games Section */}
                                <div className="px-4">
                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 gap-4 border-b border-zinc-800 pb-4">
                                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Games
                                        </h2>
                                        
                                        <div className="flex flex-wrap items-center xl:justify-end gap-3">
                                            <div className="flex flex-wrap gap-2 xl:mr-2">
                                                {[
                                                    { id: 'all' as const, label: 'All' },
                                                    { id: 'developer' as const, label: 'Developed' },
                                                    { id: 'publisher' as const, label: 'Published' },
                                                ].map(f => (
                                                    <button
                                                        key={f.id}
                                                        onClick={() => setFilter(f.id)}
                                                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${filter === f.id
                                                            ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                                                            : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700/50'
                                                            }`}
                                                    >
                                                        {f.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Search Input */}
                                            <div className="relative flex items-center">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                                </div>
                                                <input 
                                                    type="text" 
                                                    placeholder="Search games..." 
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="bg-zinc-800/80 border border-zinc-700 text-white text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-40 md:w-64 pl-9 pr-4 py-2 placeholder-zinc-500 transition-colors outline-none"
                                                />
                                            </div>

                                            {/* Sort Dropdown */}
                                            <div className="relative">
                                                <select 
                                                    value={sortBy}
                                                    onChange={(e) => setSortBy(e.target.value as any)}
                                                    className="appearance-none bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block py-2 pl-3 pr-8 transition-colors outline-none cursor-pointer"
                                                >
                                                    <option className="bg-zinc-900 text-zinc-300" value="date">Newest First</option>
                                                    <option className="bg-zinc-900 text-zinc-300" value="rating">Highest Rated</option>
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {gamesLoading ? (
                                        <div className="flex justify-center py-12">
                                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : filteredGames.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {filteredGames.map(game => (
                                                <GameCard key={game.igdb_id} game={game} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 border-dashed">
                                            <span className="text-4xl block mb-3">🎮</span>
                                            <h3 className="text-lg font-bold text-zinc-300 mb-1">No games found</h3>
                                            <p className="text-zinc-500">No games match the selected filter.</p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

function GameCard({ game }: { game: CompanyGame }) {
    const year = game.release_date ? new Date(game.release_date).getFullYear() : null;
    const href = game.local_id ? `/games/${game.local_id}` : null;

    const card = (
        <div className={`group relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 transition-all duration-500 ${href ? 'hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:ring-1 hover:ring-indigo-500/50 transform hover:-translate-y-2 cursor-pointer' : ''}`}>
            {/* Cover Image */}
            {game.cover_url ? (
                <Image
                    src={game.cover_url}
                    alt={game.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110 group-hover:saturate-150"
                    unoptimized
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <span className="text-zinc-600 font-medium">No Cover</span>
                </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Rating Badge */}
            {game.rating && (
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold text-yellow-400 border border-yellow-500/20 z-10">
                    ★ {game.rating}
                </div>
            )}

            {/* Role Badge */}
            <div className="absolute top-2 left-2 flex gap-1 z-10">
                {game.is_developer && (
                    <span className="bg-emerald-500/20 backdrop-blur-sm text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                        DEV
                    </span>
                )}
                {game.is_publisher && (
                    <span className="bg-blue-500/20 backdrop-blur-sm text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/30">
                        PUB
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 z-10">
                <h3 className="text-white font-bold text-sm leading-tight mb-1 drop-shadow-md truncate">
                    {game.name}
                </h3>
                {year && (
                    <p className="text-zinc-400 text-xs font-semibold">{year}</p>
                )}
            </div>
        </div>
    );

    if (href) {
        return <Link href={href}>{card}</Link>;
    }
    return card;
}
