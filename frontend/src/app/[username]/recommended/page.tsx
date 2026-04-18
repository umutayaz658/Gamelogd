'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import api from '@/lib/api';
import { Gamepad2, ArrowLeft, ChevronLeft, ChevronRight, ListTodo, Users, TrendingUp, Sparkles, RefreshCw, LinkIcon, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface GameItem {
    id: number;
    title: string;
    cover_image: string | null;
    friend_username?: string;
    entry_count?: number;
}

interface GenreStat {
    genre: string;
    percentage: number;
}

const GameCard = ({ game, subtitle }: { game: GameItem, subtitle?: string }) => (
    <Link
        href={`/games/${game.id}`}
        className="group bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden hover:border-zinc-700 hover:-translate-y-1 transition-all cursor-pointer block duration-300"
    >
        <div className="relative aspect-[3/4] overflow-hidden bg-zinc-800">
            {game.cover_image ? (
                <img
                    src={game.cover_image}
                    alt={game.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Gamepad2 className="w-12 h-12 text-zinc-600" />
                </div>
            )}
        </div>
        <div className="p-3 bg-zinc-900">
            <h3 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">
                {game.title}
            </h3>
            {subtitle && (
                <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{subtitle}</p>
            )}
        </div>
    </Link>
);

export default function RecommendedGamesPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const username = params.username as string;

    const hasPlatformLinked = !!user?.steam_id;

    const [games, setGames] = useState<GameItem[]>([]);
    const [backlog, setBacklog] = useState<GameItem[]>([]);
    const [friendsPlaying, setFriendsPlaying] = useState<GameItem[]>([]);
    const [trending, setTrending] = useState<GameItem[]>([]);
    const [dnaGenres, setDnaGenres] = useState<GenreStat[]>([]);

    const [activeTab, setActiveTab] = useState('all');
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);

    const GAMES_PER_PAGE = 5;

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!username) return;
            try {
                // Always fetch trending (shown even without platform)
                const trendingRes = await api.get(`/games/trending/`);
                setTrending(trendingRes.data);

                // Only fetch DNA/backlog/friends if platform is linked
                if (hasPlatformLinked) {
                    const dnaRes = await api.get(`/users/${username}/game-dna/`);
                    setDnaGenres(dnaRes.data.slice(0, 5)); // Take top 5

                    const [backlogRes, friendsRes] = await Promise.all([
                        api.get(`/users/${username}/backlog/`),
                        api.get(`/users/${username}/friends-playing/`),
                    ]);

                    setBacklog(backlogRes.data);
                    setFriendsPlaying(friendsRes.data);
                }
            } catch (err) {
                console.error("Failed fetching extra sections", err);
            }
        };
        fetchInitialData();
    }, [username, hasPlatformLinked]);

    useEffect(() => {
        const fetchRecommended = async (forceRefresh = false) => {
            if (!username || !hasPlatformLinked) {
                setLoading(false);
                return;
            }

            const cacheKey = `recommended_games_${username}_${activeTab}`;

            if (!forceRefresh) {
                const cachedData = localStorage.getItem(cacheKey);
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        // Only use cache if it actually contains games
                        if (parsed.games && parsed.games.length > 0) {
                            setGames(parsed.games);
                            // Add artificial delay to show loading state smoothly
                            setLoading(true);
                            setTimeout(() => setLoading(false), 500);
                            return;
                        }
                    } catch (e) {
                        console.error('Failed to parse cached games', e);
                    }
                }
            }

            setLoading(true);
            try {
                const url = activeTab === 'all'
                    ? `/users/${username}/recommended-games/`
                    : `/users/${username}/recommended-games/?genre=${encodeURIComponent(activeTab)}`;

                const response = await api.get(url);
                setGames(response.data);
                setPageIndex(0);

                // Cache the new results
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    games: response.data
                }));
            } catch (err) {
                console.error("Error fetching recommended games:", err);
            } finally {
                setLoading(false);
                setIsRefreshing(false);
            }
        };
        fetchRecommended();

        // Expose refresh function to component
        (window as any).__refreshRecommendedPage = () => fetchRecommended(true);
    }, [username, activeTab, hasPlatformLinked]);

    const handleManualRefresh = () => {
        setIsRefreshing(true);
        if ((window as any).__refreshRecommendedPage) {
            (window as any).__refreshRecommendedPage();
        }
    };

    const totalPages = Math.ceil(games.length / GAMES_PER_PAGE);
    const visibleGames = games.slice(pageIndex * GAMES_PER_PAGE, (pageIndex + 1) * GAMES_PER_PAGE);

    const nextPage = () => setPageIndex(p => (p + 1) % totalPages);
    const prevPage = () => setPageIndex(p => (p - 1 + totalPages) % totalPages);

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-24">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-9 space-y-6">

                        {/* Header */}
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.back()} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <Sparkles className="text-indigo-500 h-8 w-8" />
                                Recommended for You
                            </h1>
                        </div>

                        {/* No Platform Linked Warning */}
                        {!hasPlatformLinked ? (
                            <>
                                <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-amber-500/20 rounded-3xl p-8 relative shadow-2xl overflow-hidden mt-6">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

                                    <div className="flex flex-col items-center justify-center py-8 text-center relative z-10">
                                        <div className="p-5 rounded-full bg-amber-500/10 mb-6">
                                            <LinkIcon className="h-12 w-12 text-amber-400" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-3">
                                            No platform connected yet
                                        </h2>
                                        <p className="text-zinc-400 max-w-md leading-relaxed mb-2">
                                            Please link a gaming platform to your account to receive personalized game recommendations.
                                        </p>
                                        <p className="text-zinc-500 text-sm mb-6">
                                            You can connect your Steam, PlayStation, Xbox or other gaming platforms.
                                        </p>
                                        <button
                                            onClick={() => router.push('/settings?tab=connected')}
                                            className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/30 rounded-xl text-sm font-semibold transition-all"
                                        >
                                            <Settings className="h-5 w-5" />
                                            Link Platform
                                        </button>
                                    </div>
                                </div>

                                {/* Still show Trending Games */}
                                {trending.length > 0 && (
                                    <div className="mt-8">
                                        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
                                            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                                <TrendingUp className="text-amber-400 h-6 w-6" />
                                                Trending on Gamelogd
                                            </h2>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                {trending.slice(0, 10).map((game, i) => (
                                                    <div key={game.id} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                                                        <GameCard game={game} subtitle={`${game.entry_count} players logged`} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Category Tabs */}
                                {dnaGenres.length > 0 && (
                                    <div className="flex items-center justify-between border-b border-zinc-800 pt-2 pb-2">
                                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1">
                                            <button
                                                onClick={() => setActiveTab('all')}
                                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'all' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                                            >
                                                All Recommendations
                                            </button>
                                            {dnaGenres.map(cat => (
                                                <button
                                                    key={cat.genre}
                                                    onClick={() => setActiveTab(cat.genre)}
                                                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeTab === cat.genre ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                                                >
                                                    {cat.genre}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={handleManualRefresh}
                                            disabled={loading || isRefreshing}
                                            className="ml-4 p-2 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors self-center shrink-0 border border-zinc-800 shadow-sm disabled:opacity-50"
                                            title="Refresh Recommendations"
                                        >
                                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                                        </button>
                                    </div>
                                )}

                                {/* Main Carousel (Vitrin) */}
                                <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-zinc-800 rounded-3xl p-6 relative shadow-2xl overflow-hidden mt-6">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                <Gamepad2 className="text-indigo-400 h-5 w-5" />
                                                {activeTab === 'all' ? 'Top Picks' : `${activeTab} Showcase`}
                                            </h2>
                                            <p className="text-sm text-zinc-500 mt-1">
                                                Games carefully selected for your unique profile.
                                            </p>
                                        </div>

                                        {totalPages > 1 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-zinc-500 mr-2">{pageIndex + 1} / {totalPages}</span>
                                                <button onClick={prevPage} className="p-2 bg-zinc-800 hover:bg-indigo-500 hover:text-white rounded-full transition-all text-zinc-300">
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button onClick={nextPage} className="p-2 bg-zinc-800 hover:bg-indigo-500 hover:text-white rounded-full transition-all text-zinc-300">
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {loading ? (
                                        <div className="flex justify-center items-center h-64">
                                            <span className="loading-spinner text-indigo-500">Loading showcase...</span>
                                        </div>
                                    ) : games.length === 0 ? (
                                        <div className="text-center py-16 text-zinc-500">
                                            No recommendations found for this category.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {visibleGames.map((game, i) => (
                                                <div key={game.id} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                                                    <GameCard game={game} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Filler Content Sections */}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-10 border-t border-zinc-800/50 mt-12">

                                    {/* Backlog Reminder */}
                                    {backlog.length > 0 && (
                                        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5">
                                            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                                <ListTodo className="text-rose-400 h-5 w-5" />
                                                Backlog Reminder
                                            </h2>
                                            <div className="space-y-3">
                                                {backlog.slice(0, 3).map(game => (
                                                    <Link key={game.id} href={`/games/${game.id}`} className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg transition-colors group">
                                                        <div className="w-10 h-14 rounded overflow-hidden bg-zinc-800 shrink-0 relative">
                                                            {game.cover_image && <img src={game.cover_image} className="w-full h-full object-cover" />}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-semibold group-hover:text-rose-400 line-clamp-1">{game.title}</h4>
                                                            <p className="text-xs text-zinc-500">Want to Play</p>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Friends Are Playing */}
                                    {friendsPlaying.length > 0 && (
                                        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5">
                                            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                                <Users className="text-emerald-400 h-5 w-5" />
                                                Friends Are Playing
                                            </h2>
                                            <div className="space-y-3">
                                                {friendsPlaying.slice(0, 3).map(game => (
                                                    <Link key={game.id} href={`/games/${game.id}`} className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg transition-colors group">
                                                        <div className="w-10 h-14 rounded overflow-hidden bg-zinc-800 shrink-0 relative">
                                                            {game.cover_image && <img src={game.cover_image} className="w-full h-full object-cover" />}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-semibold group-hover:text-emerald-400 line-clamp-1">{game.title}</h4>
                                                            <p className="text-xs text-zinc-500">Played by @{game.friend_username}</p>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Trending on Gamelogd */}
                                    {trending.length > 0 && (
                                        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5 md:col-span-2 xl:col-span-1">
                                            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                                <TrendingUp className="text-amber-400 h-5 w-5" />
                                                Trending on Gamelogd
                                            </h2>
                                            <div className="space-y-3">
                                                {trending.slice(0, 3).map(game => (
                                                    <Link key={game.id} href={`/games/${game.id}`} className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg transition-colors group">
                                                        <div className="w-10 h-14 rounded overflow-hidden bg-zinc-800 shrink-0 relative">
                                                            {game.cover_image && <img src={game.cover_image} className="w-full h-full object-cover" />}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-semibold group-hover:text-amber-400 line-clamp-1">{game.title}</h4>
                                                            <p className="text-xs text-zinc-500">{game.entry_count} players logged this</p>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
