'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { CompanyInfo, CompanyGame } from '@/types';
import Navbar from '@/components/Navbar';
import LeftSidebar from '@/components/LeftSidebar';
import FilterDropdown from '@/components/FilterDropdown';
import Image from 'next/image';
import { useTranslation } from '@/lib/useTranslation';

const GAMES_PER_PAGE = 20;

const COMPANY_EMOJI = '🏢';
const REDIRECT_EMOJI = '🔀';
const CALENDAR_EMOJI = '🗓️';
const GLOBE_EMOJI = '🌍';
const WEBSITE_EMOJI = '🌐';
const EXTERNAL_LINK_ARROW = '↗';
const CONTROLLER_EMOJI = '🎮';
const STAR_SYMBOL = '★';

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

export default function DeveloperDetailClient() {
    const { t } = useTranslation();
    const params = useParams();
    const companyName = decodeURIComponent(params.name as string);
    const companyNotFoundMessage = `${t('couldNotFindInfoFor')} "${companyName}".`;

    const [company, setCompany] = useState<CompanyInfo | null>(null);
    const [games, setGames] = useState<CompanyGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [error, setError] = useState(false);
    const [filter, setFilter] = useState<'all' | 'developer' | 'publisher'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'rating'>('date');
    const [currentPage, setCurrentPage] = useState(1);

    const gamesHeaderRef = useRef<HTMLDivElement>(null);
    const isFirstMount = useRef(true);

    // Custom smooth scroll with ease-in-out physics — mirrors news/page.tsx's pattern.
    const smoothScrollTo = (targetY: number, duration: number = 700) => {
        const startY = window.scrollY;
        const difference = targetY - startY;
        let startTime: number | null = null;

        const easeInOutQuad = (t: number, b: number, c: number, d: number) => {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
        };

        const animateScroll = (timestamp: number) => {
            if (startTime === null) startTime = timestamp;
            const timeElapsed = timestamp - startTime;
            const nextY = easeInOutQuad(timeElapsed, startY, difference, duration);

            window.scrollTo(0, nextY);

            if (timeElapsed < duration) {
                requestAnimationFrame(animateScroll);
            } else {
                window.scrollTo(0, targetY);
            }
        };

        requestAnimationFrame(animateScroll);
    };

    // Reset to page 1 whenever the filter/search/sort changes.
    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchQuery, sortBy]);

    // Smooth scroll to the games header when the page changes (ignoring first mount).
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        if (gamesHeaderRef.current) {
            const rect = gamesHeaderRef.current.getBoundingClientRect();
            const targetY = window.scrollY + rect.top - 20;
            smoothScrollTo(targetY, 700);
        }
    }, [currentPage]);

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

    const filteredGames = useMemo(() => games.filter(g => {
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
    }), [games, filter, searchQuery, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredGames.length / GAMES_PER_PAGE));

    const pagedGames = useMemo(() => {
        const start = (currentPage - 1) * GAMES_PER_PAGE;
        return filteredGames.slice(start, start + GAMES_PER_PAGE);
    }, [filteredGames, currentPage]);

    const pageNumbers = useMemo(() => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);

            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);

            if (currentPage <= 3) {
                end = 4;
            } else if (currentPage >= totalPages - 2) {
                start = totalPages - 3;
            }

            if (start > 2) pages.push('...');
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages - 1) pages.push('...');

            pages.push(totalPages);
        }
        return pages;
    }, [currentPage, totalPages]);

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
                            <span className="text-5xl block mb-4" aria-hidden="true">{COMPANY_EMOJI}</span>
                            <h2 className="text-xl font-bold text-zinc-300 mb-2">{t('companyNotFound')}</h2>
                            <p className="text-zinc-500">{companyNotFoundMessage}</p>
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
                                    <div className="w-full bg-zinc-900/40 border border-zinc-800/60 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md relative p-5 sm:p-8 md:p-12">
                                        {/* Decorative Background Glows */}
                                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
                                        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

                                        <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start">
                                            <div className="flex-1 w-full">
                                                {/* Resolved From Badge */}
                                                {company.resolved_from && (
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="text-xs text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-zinc-700/50 font-medium tracking-wide shadow-sm">
                                                            {REDIRECT_EMOJI} {t('redirectedFrom')} {company.resolved_from}
                                                        </span>
                                                    </div>
                                                )}

                                                <h1 className="text-3xl sm:text-4xl md:text-6xl font-black mb-6 tracking-tight drop-shadow-lg text-white">
                                                    {company.name}
                                                </h1>

                                                <div className="flex flex-wrap items-center gap-3 mb-8 text-sm font-medium">
                                                    {foundedYear && (
                                                        <span className="bg-zinc-800/80 text-zinc-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-zinc-700/50 flex items-center gap-2 shadow-sm hover:bg-zinc-800 transition-colors">
                                                            <span className="text-zinc-500" aria-hidden="true">{CALENDAR_EMOJI}</span> {t('founded')} {foundedYear}
                                                        </span>
                                                    )}
                                                    {company.country && (
                                                        <span className="bg-zinc-800/80 text-zinc-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-zinc-700/50 flex items-center gap-2 shadow-sm hover:bg-zinc-800 transition-colors">
                                                            <span className="text-zinc-500" aria-hidden="true">{GLOBE_EMOJI}</span> {t('headquarteredIn')} {COUNTRY_MAP[company.country] || `${t('countryCode')} ${company.country}`}
                                                        </span>
                                                    )}
                                                    {officialWebsite && (
                                                        <a
                                                            href={officialWebsite}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-indigo-500/20 transition-all flex items-center gap-2 shadow-sm"
                                                        >
                                                            {WEBSITE_EMOJI} {t('officialWebsite')} <span className="opacity-70 text-xs" aria-hidden="true">{EXTERNAL_LINK_ARROW}</span>
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
                                                            {t('noDescriptionAvailableIgdb')}
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
                                                                {WEBSITE_LABELS[w.category] || t('link')} <span className="opacity-50" aria-hidden="true">{EXTERNAL_LINK_ARROW}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Games Stat Floating Right */}
                                            <div className="shrink-0 w-full md:w-auto">
                                                <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/90 rounded-3xl p-6 md:p-8 border border-zinc-700/50 shadow-2xl flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 md:gap-6 min-w-[200px] hover:border-indigo-500/40 transition-colors">
                                                    <div className="p-4 bg-zinc-900 rounded-full shadow-inner border border-zinc-800/80 flex items-center justify-center">
                                                        <span className="text-4xl block" aria-hidden="true">{CONTROLLER_EMOJI}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end md:items-center">
                                                        <span className="text-4xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 leading-none mb-2">
                                                            {games.length}
                                                        </span>
                                                        <span className="text-[11px] text-zinc-400 uppercase font-bold tracking-[0.2em]">
                                                            {t('gamesListed')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Games Section */}
                                <div className="px-4">
                                    <div ref={gamesHeaderRef} className="mb-8 border-b border-zinc-800 pb-4">
                                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {t('games')}
                                        </h2>

                                        <div className="flex flex-wrap items-center gap-3 mt-4">
                                            {/* Search Input — first */}
                                            <div className="relative flex items-center w-full sm:w-auto">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Search games..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="bg-zinc-800/80 border border-zinc-700 text-white text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:w-40 md:w-64 pl-9 pr-4 py-2 placeholder-zinc-500 transition-colors outline-none"
                                                />
                                            </div>

                                            <FilterDropdown
                                                label="Filter"
                                                options={[
                                                    { value: 'all', label: 'All' },
                                                    { value: 'developer', label: 'Developed' },
                                                    { value: 'publisher', label: 'Published' },
                                                ]}
                                                value={filter}
                                                onChange={(v) => setFilter(v as 'all' | 'developer' | 'publisher')}
                                                showAllOption={false}
                                                showSelectionAccent={false}
                                                matchTriggerWidth
                                            />

                                            <FilterDropdown
                                                label={t('sortBy')}
                                                options={[
                                                    { value: 'date', label: t('newestFirst') },
                                                    { value: 'rating', label: t('highestRated') },
                                                ]}
                                                value={sortBy}
                                                onChange={(v) => setSortBy(v as 'date' | 'rating')}
                                                showAllOption={false}
                                                showSelectionAccent={false}
                                                matchTriggerWidth
                                            />
                                        </div>
                                    </div>

                                    {gamesLoading ? (
                                        <div className="flex justify-center py-12">
                                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : pagedGames.length > 0 ? (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                {pagedGames.map(game => (
                                                    <GameCard key={game.igdb_id} game={game} />
                                                ))}
                                            </div>

                                            {totalPages > 1 && (
                                                // Mobile: justify-between anchors Prev/Next flush against this row's own
                                                // edges — since this row shares the same padded parent as the games grid
                                                // above, that lines up Prev's left edge and Next's right edge with the
                                                // grid's left/right edges automatically, without any manual sizing.
                                                // sm:+ (desktop): reverts to the original centered, tightly-packed layout.
                                                <div className="flex items-center justify-between sm:justify-center gap-2 mt-12 sm:flex-wrap">
                                                    <button
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                        className="flex-shrink-0 px-3 py-2 sm:px-4 rounded-lg bg-zinc-900 border border-zinc-800 text-xs sm:text-sm font-medium hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:hover:bg-zinc-900 transition-colors"
                                                    >
                                                        <span className="sm:hidden">{t('prev')}</span>
                                                        <span className="hidden sm:inline">{t('previous')}</span>
                                                    </button>

                                                    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar flex-nowrap min-w-0">
                                                        {pageNumbers.map((page, idx) => (
                                                            typeof page === 'number' ? (
                                                                <button
                                                                    key={`page-${page}`}
                                                                    onClick={() => setCurrentPage(page)}
                                                                    className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                                                                        currentPage === page
                                                                            ? 'bg-emerald-500 text-black font-bold'
                                                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                                                    }`}
                                                                >
                                                                    {page}
                                                                </button>
                                                            ) : (
                                                                <span
                                                                    key={`ellipsis-${idx}`}
                                                                    className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-zinc-500 select-none text-xs sm:text-sm"
                                                                >
                                                                    {page}
                                                                </span>
                                                            )
                                                        ))}
                                                    </div>

                                                    <button
                                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={currentPage === totalPages}
                                                        className="flex-shrink-0 px-3 py-2 sm:px-4 rounded-lg bg-zinc-900 border border-zinc-800 text-xs sm:text-sm font-medium hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:hover:bg-zinc-900 transition-colors"
                                                    >
                                                        {t('next')}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 border-dashed">
                                            <span className="text-4xl block mb-3" aria-hidden="true">{CONTROLLER_EMOJI}</span>
                                            <h3 className="text-lg font-bold text-zinc-300 mb-1">{t('noGamesFound')}</h3>
                                            <p className="text-zinc-500">{t('noGamesMatchFilter')}</p>
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
    const { t } = useTranslation();
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
                    sizes="(max-width: 639px) 45vw, (max-width: 767px) 30vw, (max-width: 1023px) 22vw, 15vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110 group-hover:saturate-150"
                    unoptimized
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <span className="text-zinc-600 font-medium">{t('noCover')}</span>
                </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Rating Badge */}
            {game.rating && (
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold text-yellow-400 border border-yellow-500/20 z-10">
                    {STAR_SYMBOL} {game.rating}
                </div>
            )}

            {/* Role Badge */}
            <div className="absolute top-2 left-2 flex gap-1 z-10">
                {game.is_developer && (
                    <span className="bg-emerald-500/20 backdrop-blur-sm text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                        {t('devBadge')}
                    </span>
                )}
                {game.is_publisher && (
                    <span className="bg-blue-500/20 backdrop-blur-sm text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/30">
                        {t('pubBadge')}
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
