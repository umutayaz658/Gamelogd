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
import { getMediaUrl } from '@/lib/utils';
import Image from 'next/image';
import { useLogModal } from '@/context/LogModalContext';

export default function GameDetailPage() {
    const params = useParams();
    const gameId = params.id as string;
    const { openLogModal } = useLogModal();

    const [game, setGame] = useState<GameDetail | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    
    // Filtering state
    const [order, setOrder] = useState('-likes_count'); // '-likes_count', '-timestamp', '-rating', 'rating'

    const carouselRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const fetchGame = async () => {
            try {
                const response = await api.get(`/games/${gameId}/details/`);
                setGame(response.data);
            } catch (err) {
                console.error("Failed to fetch game details:", err);
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
            setReviewsLoading(true);
            try {
                const response = await api.get(`/reviews/?game_id=${gameId}&ordering=${order}`);
                setReviews(response.data.results || response.data);
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

    const handleScroll = () => {
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
                <main className="container mx-auto px-4 pt-6">
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

    if (!game) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
                <Navbar />
                <main className="container mx-auto px-4 pt-6">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="hidden lg:block col-span-3"><LeftSidebar /></div>
                        <div className="col-span-12 lg:col-span-9 text-center text-zinc-400 mt-20">
                            Game not found.
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const coverUrl = getMediaUrl(game.cover_image);
    const bannerUrl = (game.screenshots && game.screenshots.length > 0) ? game.screenshots[0] : coverUrl;

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 relative">
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
                <main className="container mx-auto px-4 pt-6 pb-20">
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
                            <Image src={bannerUrl} alt="Banner" fill className="object-cover transition-transform duration-1000 group-hover:scale-105" unoptimized />
                        ) : (
                            <div className="w-full h-full bg-zinc-800" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                    </div>
                    
                    {/* Overlapping Content: Cover & Info */}
                    <div className="px-6 md:px-12 flex flex-col md:flex-row gap-8 relative -mt-24 md:-mt-32">
                        <div className="w-48 h-64 md:w-56 md:h-72 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border-4 border-zinc-950 relative z-20">
                            {coverUrl ? (
                                <Image src={coverUrl} alt={game.title} fill className="object-cover" unoptimized />
                            ) : (
                                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                    <span className="text-zinc-500 font-medium">No Cover</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 mt-auto pt-4 md:pb-4 text-white z-20">
                            <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tight drop-shadow-lg">
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
                                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Genres</h3>
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
                                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Platforms</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {game.platforms.map(plat => (
                                            <span key={plat} className="bg-zinc-800/80 text-zinc-300 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border border-zinc-700/50 backdrop-blur-sm">
                                                {plat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <span className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]">
                                            ★ {game.average_rating ? game.average_rating.toFixed(1) : '-'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-xs text-zinc-300 font-medium border-l border-zinc-700/80 pl-6 drop-shadow">
                                        <span><strong className="text-white">{game.review_count || 0}</strong> Reviews</span>
                                        <span><strong className="text-white">{game.log_count || 0}</strong> Logs</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => openLogModal(game)}
                                    className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 text-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                                    Log Game
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div className="mb-12 text-zinc-300 leading-relaxed text-lg font-medium px-4">
                    {game.summary || game.description || "No description available for this game."}
                </div>

                {/* Screenshots Carousel */}
                {game.screenshots && game.screenshots.length > 0 && (
                    <div className="mb-16 relative">
                        <div className="flex items-center justify-between mb-6 px-4">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Screenshots
                            </h2>
                        </div>
                        
                        <div className="relative group">
                            {/* Left Arrow */}
                            <button 
                                onClick={() => scrollToScreenshot(activeIndex - 1)}
                                disabled={activeIndex === 0}
                                className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/60 hover:bg-black/80 backdrop-blur text-white rounded-full transition-all shadow-xl border border-white/10 ${activeIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-0 group-hover:opacity-100'}`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>

                            {/* Right Arrow */}
                            <button 
                                onClick={() => scrollToScreenshot(activeIndex + 1)}
                                disabled={!game.screenshots || activeIndex === game.screenshots.length - 1}
                                className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/60 hover:bg-black/80 backdrop-blur text-white rounded-full transition-all shadow-xl border border-white/10 ${(!game.screenshots || activeIndex === game.screenshots.length - 1) ? 'opacity-0 cursor-default' : 'opacity-0 group-hover:opacity-100'}`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>

                            <div 
                                ref={carouselRef}
                                onScroll={handleScroll}
                                className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-8 px-[7.5%] md:px-[15%]"
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

                {/* Similar Games Section */}
                <div className="px-4 mb-16">
                    <SimilarGames currentId={gameId} genres={game.genres} />
                </div>

                {/* Reviews Section */}
                <div className="px-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-zinc-800 pb-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                            Player Logs
                        </h2>

                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: '-likes_count', label: 'Popular' },
                                { id: '-timestamp', label: 'Recent' },
                                { id: '-rating', label: 'Highest' },
                                { id: 'rating', label: 'Lowest' }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setOrder(filter.id)}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
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
                        <div className="grid gap-4">
                            {reviews.map(review => (
                                <ReviewCard key={review.id} review={review} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 border-dashed">
                            <span className="text-4xl block mb-3">🎮</span>
                            <h3 className="text-lg font-bold text-zinc-300 mb-1">No logs yet</h3>
                            <p className="text-zinc-500">Be the first to log this game!</p>
                        </div>
                    )}
                </div>
                        </div>
                    </div>
                </div>
            </main>
            </div>
            
            <style jsx global>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .mask-image-gradient-b {
                    -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
                    mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
                }
            `}</style>
        </div>
    );
}
