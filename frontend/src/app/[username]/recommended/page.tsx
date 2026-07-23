'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import FilterDropdown from "@/components/FilterDropdown";
import GameCarousel from "@/components/GameCarousel";
import api from '@/lib/api';
import { Gamepad2, ArrowLeft, ChevronLeft, ChevronRight, Users, TrendingUp, LinkIcon, Settings, Gem } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import { useIsMobile } from '@/hooks/useIsMobile';

interface GameItem {
    id: number;
    title: string;
    cover_image: string | null;
    friend_username?: string;
    entry_count?: number;
    platforms?: string[];
    release_date?: string;
    avg_rating?: number;
}

interface GenreStat {
    genre: string;
    percentage: number;
}

// Full genre taxonomy the backend's recommended-games endpoint understands (mirrors
// backend/api/views.py's translation_map) — not limited to the user's own top-5 Game
// DNA genres, so there's always a complete set of choices to filter by.
const GENRE_OPTIONS = [
    'Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Sports',
    'Racing', 'Massively Multiplayer', 'Casual', 'Indie', 'Early Access', 'Free To Play',
];

const GameCard = ({ game, subtitle }: { game: GameItem, subtitle?: string }) => (
    <Link
        href={`/games/${game.id}`}
        className="group bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden hover:border-zinc-700 hover:-translate-y-1 transition-all cursor-pointer block duration-300 relative aspect-[3/4]"
    >
        {game.cover_image ? (
            <img
                src={game.cover_image}
                alt={game.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                <Gamepad2 className="w-12 h-12 text-zinc-600" />
            </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none" />

        {/* Text over image at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors drop-shadow-md">
                {game.title}
            </h3>
            {subtitle && (
                <p className="text-xs text-zinc-400 mt-1 font-semibold drop-shadow-md">{subtitle}</p>
            )}
        </div>
    </Link>
);

// Trending / Friends Playing / Hidden Gems cards — on mobile these page through 5 at a
// time (matching the old "You Might Like These" widget's top-right prev/next buttons)
// since there's no side space for a grid; desktop keeps a simple static top-3 list.
const DiscoverySection = ({
    title,
    icon,
    items,
    emptyMessage,
    renderSubtitle,
    accentClass,
    isMobile,
}: {
    title: string;
    icon: ReactNode;
    items: GameItem[];
    emptyMessage: string;
    renderSubtitle: (game: GameItem) => string;
    accentClass: string;
    isMobile: boolean;
}) => {
    const [page, setPage] = useState(0);
    const PER_PAGE = 5;
    const totalPages = Math.ceil(items.length / PER_PAGE);

    useEffect(() => {
        setPage(0);
    }, [items]);

    const visible = isMobile ? items.slice(page * PER_PAGE, (page + 1) * PER_PAGE) : items.slice(0, 3);

    return (
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    {icon}
                    {title}
                </h2>
                {isMobile && totalPages > 1 && (
                    <div className="flex items-center gap-1 pl-2 ml-1 border-l border-zinc-700/50">
                        <button
                            onClick={() => setPage(p => (p - 1 + totalPages) % totalPages)}
                            className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setPage(p => (p + 1) % totalPages)}
                            className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                            aria-label="Next"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
            {items.length > 0 ? (
                <div className="space-y-3">
                    {visible.map(game => (
                        <Link key={game.id} href={`/games/${game.id}`} className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg transition-colors group">
                            <div className="w-10 h-14 rounded overflow-hidden bg-zinc-800 shrink-0 relative">
                                {game.cover_image && <img src={game.cover_image} className="w-full h-full object-cover" />}
                            </div>
                            <div>
                                <h4 className={`text-sm font-semibold ${accentClass} line-clamp-1`}>{game.title}</h4>
                                <p className="text-xs text-zinc-500">{renderSubtitle(game)}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-sm text-zinc-500 italic py-4 flex flex-col justify-center h-24">
                    {emptyMessage}
                </div>
            )}
        </div>
    );
};

export default function RecommendedGamesPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const username = params.username as string;

    const hasPlatformLinked = !!user?.steam_id;

    const [games, setGames] = useState<GameItem[]>([]);
    const [friendsPlaying, setFriendsPlaying] = useState<GameItem[]>([]);
    const [trending, setTrending] = useState<GameItem[]>([]);
    const [hiddenGems, setHiddenGems] = useState<GameItem[]>([]);
    const [dnaGenres, setDnaGenres] = useState<GenreStat[]>([]);

    const [activeTab, setActiveTab] = useState('all');
    const [selectedYear, setSelectedYear] = useState('All');
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!username) return;
            try {
                // Always fetch trending and hidden gems
                const [trendingRes, hiddenGemsRes] = await Promise.all([
                    api.get(`/games/trending/`),
                    api.get(`/games/hidden-gems/`),
                ]);
                setTrending(trendingRes.data);
                setHiddenGems(hiddenGemsRes.data);

                // Only fetch DNA/friends if platform is linked
                if (hasPlatformLinked) {
                    const dnaRes = await api.get(`/users/${username}/game-dna/`);
                    setDnaGenres(dnaRes.data.slice(0, 5)); // Take top 5

                    const friendsRes = await api.get(`/users/${username}/friends-playing/`);
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
                        const timestamp = parsed.timestamp || 0;
                        const isExpired = Date.now() - timestamp > 1000 * 60 * 60; // 1 hour expiration
                        
                        // Only use cache if it actually contains games and is not expired
                        if (!isExpired && parsed.games && parsed.games.length > 0) {
                            // Check if all covers are null (legacy cache), force refresh if so
                            const hasCovers = parsed.games.some((g: GameItem) => g.cover_image !== null);
                            if (hasCovers || parsed.games.length === 0) {
                                setGames(parsed.games);
                                // Add artificial delay to show loading state smoothly
                                setLoading(true);
                                setTimeout(() => setLoading(false), 500);
                                return;
                            }
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
        const win = typeof window !== 'undefined' ? (window as unknown as { __refreshRecommendedPage?: (force?: boolean) => void }) : null;
        if (win) {
            win.__refreshRecommendedPage = () => fetchRecommended(true);
        }
    }, [username, activeTab, hasPlatformLinked]);

    const handleManualRefresh = () => {
        setIsRefreshing(true);
        const win = typeof window !== 'undefined' ? (window as unknown as { __refreshRecommendedPage?: (force?: boolean) => void }) : null;
        if (win?.__refreshRecommendedPage) {
            win.__refreshRecommendedPage();
        }
    };

    const YEAR_RANGES = [
        { label: t('allYears'), value: 'All' },
        { label: '?-2000', value: '?-2000' },
        { label: '2000-2010', value: '2000-2010' },
        { label: '2010-2020', value: '2010-2020' },
        { label: '2020-?', value: '2020-?' },
    ];

    const filteredGames = games.filter((game: GameItem) => {
        if (selectedYear !== 'All') {
            const yearStr = game.release_date ? game.release_date.split('-')[0] : null;
            if (!yearStr) return false;
            const year = parseInt(yearStr, 10);
            
            if (selectedYear === '?-2000' && year >= 2000) return false;
            if (selectedYear === '2000-2010' && (year < 2000 || year >= 2010)) return false;
            if (selectedYear === '2010-2020' && (year < 2010 || year >= 2020)) return false;
            if (selectedYear === '2020-?' && year < 2020) return false;
        }
        return true;
    });

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
            <Navbar />

            <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6 pb-24">
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
                            <h1 className="text-2xl sm:text-3xl font-bold">
                                {t('recommendedForYou')}
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
                                            {t('noPlatformConnectedHeader')}
                                        </h2>
                                        <p className="text-zinc-400 max-w-md leading-relaxed mb-2">
                                            {t('noPlatformConnectedDesc')}
                                        </p>
                                        <p className="text-zinc-500 text-sm mb-6">
                                            {t('noPlatformConnectedDescSub')}
                                        </p>
                                        <button
                                            onClick={() => router.push('/settings?tab=connected')}
                                            className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/30 rounded-xl text-sm font-semibold transition-all"
                                        >
                                            <Settings className="h-5 w-5" />
                                            {t('linkPlatform')}
                                        </button>
                                    </div>
                                </div>

                                {/* Still show Trending Games */}
                                {trending.length > 0 && (
                                    <div className="mt-8">
                                        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
                                            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                                <TrendingUp className="text-amber-400 h-6 w-6" />
                                                {t('trendingOnGamelogd')}
                                            </h2>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                {trending.slice(0, 10).map((game, i) => (
                                                    <div key={game.id} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                                                        <GameCard game={game} subtitle={t('playersLoggedThis').replace('{count}', String(game.entry_count))} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Genre + Year filters */}
                                {dnaGenres.length > 0 && (
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-zinc-800 pt-2 pb-3">
                                        <div className="flex-shrink-0">
                                            <FilterDropdown
                                                label={t('all')}
                                                allLabel={t('all')}
                                                options={GENRE_OPTIONS.map(g => ({ value: g, label: g }))}
                                                value={activeTab === 'all' ? '' : activeTab}
                                                onChange={(v) => setActiveTab(v || 'all')}
                                            />
                                        </div>
                                        <div className="flex-shrink-0">
                                            <FilterDropdown
                                                label={t('allYears')}
                                                allLabel={t('allYears')}
                                                options={YEAR_RANGES.filter(r => r.value !== 'All').map(r => ({ value: r.value, label: r.label }))}
                                                value={selectedYear === 'All' ? '' : selectedYear}
                                                onChange={(v) => setSelectedYear(v || 'All')}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Top Picks — shared carousel, same design as the RightSidebar's "You Might Like These" */}
                                <div className="mt-6">
                                    <GameCarousel
                                        title={activeTab === 'all' ? t('topPicks') : t('genreShowcase').replace('{genre}', activeTab)}
                                        games={filteredGames}
                                        loading={loading}
                                        loadingLabel={t('loadingShowcase')}
                                        emptyLabel={t('noRecommendationsFound')}
                                        onRefresh={handleManualRefresh}
                                        isRefreshing={isRefreshing}
                                    />
                                </div>

                                {/* Deep Discovery Sections */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-zinc-800/50 mt-12">
                                    <DiscoverySection
                                        title={t('trendingOnGamelogd')}
                                        icon={<TrendingUp className="text-amber-400 h-5 w-5" />}
                                        items={trending}
                                        emptyMessage={t('noTrendingData')}
                                        accentClass="group-hover:text-amber-400"
                                        isMobile={isMobile}
                                        renderSubtitle={(game) => t('playersLoggedThis').replace('{count}', String(game.entry_count))}
                                    />
                                    <DiscoverySection
                                        title={t('loggedByFriends')}
                                        icon={<Users className="text-emerald-400 h-5 w-5" />}
                                        items={friendsPlaying}
                                        emptyMessage={t('noFriendsLogged')}
                                        accentClass="group-hover:text-emerald-400"
                                        isMobile={isMobile}
                                        renderSubtitle={(game) => t('loggedByFriend').replace('{username}', game.friend_username || '')}
                                    />
                                    <DiscoverySection
                                        title={t('hiddenGems')}
                                        icon={<Gem className="text-purple-400 h-5 w-5" />}
                                        items={hiddenGems}
                                        emptyMessage={t('noHiddenGems')}
                                        accentClass="group-hover:text-purple-400"
                                        isMobile={isMobile}
                                        renderSubtitle={(game) => `${t('avgRating')}: ${game.avg_rating?.toFixed(1) || 'N/A'}`}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
