'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { GameDetail, Review } from '@/types';
import Navbar from '@/components/Navbar';
import LeftSidebar from '@/components/LeftSidebar';
import ReviewCard from '@/components/ReviewCard';
import SimilarGames from '@/components/SimilarGames';
import { getMediaUrl, getRatingTextClass } from '@/lib/utils';
import Image from 'next/image';
import { useLogModal } from '@/context/LogModalContext';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';

const ERROR_CODE_404 = '404';
const STAR_SYMBOL = '★';
const NO_LOGS_EMOJI = '🎮';

// In-memory cache so navigating back to a previously-viewed game (e.g. from a review's
// detail page) can render instantly instead of flashing a loading spinner that collapses
// the page height and defeats the browser's scroll-position restoration.
const gameDetailCache = new Map<string, GameDetail>();
const gameReviewsCache = new Map<string, Review[]>();

export default function GameDetailPage() {
    const { t } = useTranslation();
    const params = useParams();
    const gameId = params.id as string;
    const { openLogModal } = useLogModal();

    const [game, setGame] = useState<GameDetail | null>(() => gameDetailCache.get(gameId) ?? null);
    const [reviews, setReviews] = useState<Review[]>(() => gameReviewsCache.get(gameId) ?? []);
    const [myReview, setMyReview] = useState<Review | null>(null);
    const [loading, setLoading] = useState(() => !gameDetailCache.has(gameId));
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const { user } = useAuth();

    // Filtering state
    const [order, setOrder] = useState('-likes_count'); // '-likes_count', '-timestamp', '-rating', 'rating'

    const carouselRef = useRef<HTMLDivElement>(null);
    const scrollRafRef = useRef<number | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const [notFound, setNotFound] = useState(false);

    // Mobile-only: description show-more/less (mirrors [username]/page.tsx's bio pattern)
    const [isDescExpanded, setIsDescExpanded] = useState(false);
    const [shouldShowDescShowMore, setShouldShowDescShowMore] = useState(false);
    const descRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchGame = async () => {
            try {
                const response = await api.get(`/games/${gameId}/details/`);
                setGame(response.data);
                gameDetailCache.set(gameId, response.data);
            } catch (err: any) {
                console.error("Failed to fetch game details:", err);
                if (err.response?.status === 404) {
                    setNotFound(true);
                }
            } finally {
                setLoading(false);
            }
        };

        if (gameId) {
            fetchGame();
        }
    }, [gameId]);

    useEffect(() => {
        const fetchReviews = async () => {
            // Only show the loading spinner when there's nothing cached to render yet —
            // a cached back-navigation should refresh silently in the background.
            if (!gameReviewsCache.has(gameId)) {
                setReviewsLoading(true);
            }
            try {
                const response = await api.get(`/reviews/?game_id=${gameId}&ordering=${order}`);
                const data = response.data.results || response.data;
                setReviews(data);
                gameReviewsCache.set(gameId, data);
            } catch (err) {
                console.error("Failed to fetch reviews:", err);
            } finally {
                setReviewsLoading(false);
            }
        };

        if (gameId) {
            fetchReviews();
        }
    }, [gameId, order]);

    useEffect(() => {
        const fetchMyReview = async () => {
            if (!user || !gameId) return;

            // Avoid a redundant request when the user's review is already in the loaded list.
            const alreadyLoaded = reviews.find(r => r.user?.username === user.username);
            if (alreadyLoaded) {
                setMyReview(alreadyLoaded);
                return;
            }

            try {
                const response = await api.get(`/reviews/?game_id=${gameId}&username=${user.username}`);
                const data = response.data.results || response.data;
                if (data && data.length > 0) {
                    setMyReview(data[0]);
                } else {
                    setMyReview(null);
                }
            } catch (err) {
                console.error("Failed to fetch my review:", err);
            }
        };

        fetchMyReview();
    }, [gameId, user, reviews]);

    useEffect(() => {
        return () => {
            if (scrollRafRef.current !== null) {
                cancelAnimationFrame(scrollRafRef.current);
            }
        };
    }, []);

    // Mobile-only description clamp: check whether it overflows 5 lines, mirrors
    // [username]/page.tsx's bio show-more/less overflow-detection pattern.
    useEffect(() => {
        const checkDescOverflow = () => {
            if (descRef.current && !isDescExpanded) {
                setShouldShowDescShowMore(descRef.current.scrollHeight > descRef.current.clientHeight);
            }
        };
        const timer = setTimeout(checkDescOverflow, 50);
        window.addEventListener('resize', checkDescOverflow);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkDescOverflow);
        };
    }, [game?.summary, game?.description, isDescExpanded]);

    const handleScroll = () => {
        if (scrollRafRef.current !== null) return;
        scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null;
            if (!carouselRef.current || !game?.screenshots) return;
            const container = carouselRef.current;
            const scrollCenter = container.scrollLeft + container.offsetWidth / 2;

            let closestIndex = 0;
            let minDistance = Infinity;

            Array.from(container.children).forEach((child: any, index) => {
                const childCenter = child.offsetLeft + child.offsetWidth / 2;
                const distance = Math.abs(scrollCenter - childCenter);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = index;
                }
            });

            if (closestIndex !== activeIndex) {
                setActiveIndex(closestIndex);
            }
        });
    };

    const scrollToScreenshot = (index: number) => {
        if (!carouselRef.current || !game?.screenshots) return;
        const container = carouselRef.current;
        const children = Array.from(container.children);
        if (index >= 0 && index < children.length) {
            const target = children[index] as HTMLElement;
            const scrollPos = target.offsetLeft - container.offsetWidth / 2 + target.offsetWidth / 2;
            container.scrollTo({ left: scrollPos, behavior: 'smooth' });
        }
    };

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

    if (notFound || !game) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
                <Navbar />
                <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="hidden lg:block col-span-3"><LeftSidebar /></div>
                        <div className="col-span-12 lg:col-span-9 flex flex-col justify-center items-center h-64 text-center">
                            <h2 className="text-4xl font-bold text-zinc-500 mb-4">{ERROR_CODE_404}</h2>
                            <p className="text-zinc-400 text-lg">{t('gameRemovedOrNotExist')}</p>
                            <Link href="/" className="mt-6 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full font-medium transition-colors">
                                {t('goBackHome')}
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const coverUrl = getMediaUrl(game.cover_image);
    const bannerUrl = (game.screenshots && game.screenshots.length > 0) ? game.screenshots[0] : coverUrl;

    // Same 0-10 rating scale used for review scores — see lib/utils.ts's getRatingTextClass.
    const avgRatingTextClass = game.average_rating ? getRatingTextClass(game.average_rating) : 'text-zinc-500';
    const avgRatingGlowClass = !game.average_rating
        ? ''
        : game.average_rating < 5.0
            ? 'drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]'
            : game.average_rating < 8.0
                ? 'drop-shadow-[0_0_12px_rgba(234,179,8,0.6)]'
                : 'drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]';

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 relative overflow-x-hidden">
            {/* Global Page Background based on cover */}
            {coverUrl && (
                <div 
                    className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
                    style={{ 
                        backgroundImage: `url(${coverUrl})`, 
                        backgroundSize: 'cover', 
                        backgroundPosition: 'center',
                        filter: 'blur(80px) saturate(200%)'
                    }}
                />
            )}
            <div className="relative z-10">
                <Navbar />
                <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6 pb-20">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="hidden lg:block col-span-3">
                            <LeftSidebar />
                        </div>

                    <div className="col-span-12 lg:col-span-9">
                        <div className="max-w-full mx-auto">
                {/* Hero Section Banner Style */}
                <div className="mb-12 relative">
                    {/* Banner Image */}
                    <div className="w-full h-64 md:h-80 relative rounded-2xl overflow-hidden shadow-2xl group">
                        {bannerUrl ? (
                            <Image src={bannerUrl} alt={`${game.title} banner`} fill className="object-cover transition-transform duration-1000 group-hover:scale-105" unoptimized />
                        ) : (
                            <div className="w-full h-full bg-zinc-800" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                    </div>
                    
                    {/* Overlapping Content: Cover & Info */}
                    <div className="px-6 md:px-12 flex flex-col md:flex-row gap-8 relative -mt-24 md:-mt-32">
                        <div className="w-36 h-48 sm:w-48 sm:h-64 md:w-56 md:h-72 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border-4 border-zinc-950 relative z-20">
                            {coverUrl ? (
                                <Image src={coverUrl} alt={game.title} fill className="object-cover" unoptimized />
                            ) : (
                                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                    <span className="text-zinc-500 font-medium">{t('noCover')}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 mt-auto pt-4 md:pb-4 text-white z-20">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 tracking-tight drop-shadow-lg">
                                {game.title}
                            </h1>
                            
                            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm font-medium drop-shadow">
                                {game.release_date && (
                                    <span className="bg-zinc-900/80 px-3 py-1 rounded-full border border-zinc-700/50 backdrop-blur-sm">
                                        {new Date(game.release_date).getFullYear()}
                                    </span>
                                )}
                                {game.developer && game.developer.split(',').map((dev, i) => {
                                    const devName = dev.trim();
                                    return (
                                        <Link 
                                            key={i} 
                                            href={`/developer/${encodeURIComponent(devName)}`}
                                            className="text-zinc-300 bg-zinc-900/60 px-3 py-1 rounded-full border border-zinc-700/50 backdrop-blur-sm hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-300 cursor-pointer"
                                        >
                                            {devName}
                                        </Link>
                                    );
                                })}
                            </div>

                            {game.genres && game.genres.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{t('genres')}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {game.genres.map(genre => (
                                            <span key={genre} className="bg-zinc-800/80 text-zinc-300 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border border-zinc-700/50 backdrop-blur-sm">
                                                {genre.toUpperCase()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {game.platforms && game.platforms.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{t('platforms')}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {game.platforms.map(plat => (
                                            <span key={plat} className="bg-zinc-800/80 text-zinc-300 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border border-zinc-700/50 backdrop-blur-sm">
                                                {plat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-3xl font-black ${avgRatingTextClass} ${avgRatingGlowClass}`}>
                                            {STAR_SYMBOL} {game.average_rating ? game.average_rating.toFixed(1) : '-'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-xs text-zinc-300 font-medium border-l border-zinc-700/80 pl-6 drop-shadow">
                                        <span><strong className="text-white">{game.review_count || 0}</strong> {t('reviews')}</span>
                                        <span><strong className="text-white">{game.log_count || 0}</strong> {t('logs')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <button
                                        onClick={() => openLogModal(game, myReview)}
                                        className={`flex-1 sm:flex-none justify-center px-6 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg flex items-center gap-2 text-sm ${myReview ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
                                    >
                                        {myReview ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                                        )}
                                        {myReview ? t('editLog') : t('logGame')}
                                    </button>
                                    {myReview && (
                                        <button
                                            onClick={() => openLogModal(game, myReview, true)}
                                            className="flex-1 sm:flex-none justify-center px-5 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-500 shadow-purple-900/20"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                                            {t('logReplay')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div className="mb-12 px-4">
                    <div
                        ref={descRef}
                        className={`text-zinc-300 leading-relaxed text-lg font-medium ${isDescExpanded ? '' : 'line-clamp-5'} lg:line-clamp-none`}
                    >
                        {game.summary || game.description || "No description available for this game."}
                    </div>
                    {shouldShowDescShowMore && (
                        <button
                            onClick={() => setIsDescExpanded(v => !v)}
                            className="lg:hidden mt-2 text-emerald-500 hover:text-emerald-400 hover:underline text-xs font-semibold block w-fit"
                        >
                            {isDescExpanded ? t('showLess') : `${t('showMore')}...`}
                        </button>
                    )}
                </div>

                {/* Screenshots Carousel */}
                {game.screenshots && game.screenshots.length > 0 && (
                    <div className="mb-16 relative">
                        <div className="flex items-center justify-between mb-6 px-4">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {t('screenshots')}
                            </h2>
                        </div>
                        
                        <div className="relative group">
                            {/* Left Arrow */}
                            <button
                                onClick={() => scrollToScreenshot(activeIndex - 1)}
                                disabled={activeIndex === 0}
                                aria-label={t('previousScreenshot')}
                                className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center p-3 bg-black/60 hover:bg-black/80 backdrop-blur text-white rounded-full transition-all shadow-xl border border-white/10 ${activeIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-60 lg:opacity-0 lg:group-hover:opacity-100'}`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>

                            {/* Right Arrow */}
                            <button
                                onClick={() => scrollToScreenshot(activeIndex + 1)}
                                disabled={!game.screenshots || activeIndex === game.screenshots.length - 1}
                                aria-label={t('nextScreenshot')}
                                className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center p-3 bg-black/60 hover:bg-black/80 backdrop-blur text-white rounded-full transition-all shadow-xl border border-white/10 ${(!game.screenshots || activeIndex === game.screenshots.length - 1) ? 'opacity-0 cursor-default' : 'opacity-60 lg:opacity-0 lg:group-hover:opacity-100'}`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>

                            <div 
                                ref={carouselRef}
                                onScroll={handleScroll}
                                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 pb-8 px-[7.5%] md:px-[15%]"
                                style={{ scrollBehavior: 'smooth' }}
                            >
                                {game.screenshots.map((url, index) => {
                                    const isActive = index === activeIndex;
                                    return (
                                        <div 
                                            key={index} 
                                            className={`
                                                snap-center shrink-0 w-[85%] md:w-[70%] rounded-2xl overflow-hidden transition-all duration-500 ease-out cursor-pointer
                                                ${isActive ? 'scale-100 opacity-100 shadow-[0_0_30px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/50' : 'scale-95 opacity-40 hover:opacity-60 saturate-50'}
                                            `}
                                            onClick={() => scrollToScreenshot(index)}
                                        >
                                            <div className="relative aspect-video">
                                                <Image src={url} alt={`Screenshot ${index + 1}`} fill className="object-cover" unoptimized />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Game Stats Section (Metacritic & HLTB) */}
                {(game.metacritic_score || game.hltb_main) && (
                    <div className="px-4 mb-16">
                        <div className="flex items-center gap-2 mb-6">
                            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <h2 className="text-2xl font-bold text-white">{t('gameStats')}</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Metacritic Card */}
                            {game.metacritic_score && (
                                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-zinc-700 transition-all">
                                    <h3 className="text-zinc-400 font-semibold mb-3 text-sm tracking-wider uppercase">{t('criticScore')}</h3>
                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-4 shadow-lg ${
                                        game.metacritic_score >= 75 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-emerald-500/20' :
                                        game.metacritic_score >= 50 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50 shadow-yellow-500/20' :
                                        'bg-red-500/10 text-red-400 border-red-500/50 shadow-red-500/20'
                                    }`}>
                                        {game.metacritic_score}
                                    </div>
                                    <div className="mt-3 text-xs text-zinc-500">{t('basedOnIgdbCritics')}</div>
                                </div>
                            )}

                            {/* HowLongToBeat Cards */}
                            {(game.hltb_main || game.hltb_main_extra || game.hltb_completionist) && (
                                <div className={`grid gap-4 ${game.metacritic_score ? 'md:col-span-3 grid-cols-1 sm:grid-cols-3' : 'md:col-span-4 grid-cols-1 sm:grid-cols-3'}`}>
                                    {game.hltb_main && (
                                        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-center shadow-lg hover:border-indigo-500/30 transition-all relative overflow-hidden group">
                                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <svg className="w-24 h-24 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>
                                            </div>
                                            <h3 className="text-zinc-400 font-semibold mb-1 text-sm tracking-wider uppercase">{t('mainStory')}</h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-bold text-indigo-400">{game.hltb_main}</span>
                                                <span className="text-zinc-500 font-medium">{t('hours')}</span>
                                            </div>
                                        </div>
                                    )}
                                    {game.hltb_main_extra && (
                                        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-center shadow-lg hover:border-purple-500/30 transition-all relative overflow-hidden group">
                                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <svg className="w-24 h-24 text-purple-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>
                                            </div>
                                            <h3 className="text-zinc-400 font-semibold mb-1 text-sm tracking-wider uppercase">{t('mainPlusExtras')}</h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-bold text-purple-400">{game.hltb_main_extra}</span>
                                                <span className="text-zinc-500 font-medium">{t('hours')}</span>
                                            </div>
                                        </div>
                                    )}
                                    {game.hltb_completionist && (
                                        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-center shadow-lg hover:border-pink-500/30 transition-all relative overflow-hidden group">
                                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <svg className="w-24 h-24 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>
                                            </div>
                                            <h3 className="text-zinc-400 font-semibold mb-1 text-sm tracking-wider uppercase">{t('completionist')}</h3>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-bold text-pink-400">{game.hltb_completionist}</span>
                                                <span className="text-zinc-500 font-medium">{t('hours')}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Similar Games Section */}
                <div className="px-4 mb-16">
                    <SimilarGames currentId={gameId} genres={game.genres} />
                </div>

                {/* Reviews Section */}
                <div className="px-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-zinc-800 pb-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                            {t('playerLogs')}
                        </h2>

                        <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar">
                            {[
                                { id: '-likes_count', label: 'Popular' },
                                { id: '-timestamp', label: 'Recent' },
                                { id: '-rating', label: 'Highest' },
                                { id: 'rating', label: 'Lowest' }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setOrder(filter.id)}
                                    aria-pressed={order === filter.id}
                                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                                        order === filter.id 
                                            ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] scale-105' 
                                            : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {reviewsLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            {reviews.map(review => (
                                <ReviewCard key={review.id} review={review} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 border-dashed">
                            <span className="text-4xl block mb-3" aria-hidden="true">{NO_LOGS_EMOJI}</span>
                            <h3 className="text-lg font-bold text-zinc-300 mb-1">{t('noLogsYet')}</h3>
                            <p className="text-zinc-500">{t('beFirstToLogGame')}</p>
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
