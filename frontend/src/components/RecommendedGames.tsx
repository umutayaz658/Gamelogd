import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Gamepad2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface RecommendedGame {
    id: number;
    title: string;
    cover_image: string | null;
}

interface RecommendedGamesProps {
    username?: string;
}

const GameCardContent = ({ game, isCenter }: { game: RecommendedGame, isCenter: boolean }) => (
    <>
        <div className={`w-full aspect-[3/4] rounded-lg bg-zinc-800 overflow-hidden mb-2 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-zinc-700/50 relative transition-all duration-500`}>
            {/* Gradient overlay for background items */}
            {!isCenter && (
                <div className="absolute inset-0 bg-black/40 z-10 transition-opacity duration-500 group-hover:bg-black/20" />
            )}
            {game.cover_image ? (
                <img
                    src={game.cover_image}
                    alt={game.title}
                    className="w-full h-full object-cover transition-transform duration-500"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Gamepad2 className="w-8 h-8 text-zinc-600" />
                </div>
            )}
        </div>
        <h3 className={`text-sm font-semibold text-zinc-200 text-center leading-snug w-full px-1 line-clamp-2 drop-shadow-md transition-opacity duration-500 ${isCenter ? 'opacity-100 group-hover:text-indigo-400' : 'opacity-0'}`}>
            {game.title}
        </h3>
    </>
);

export default function RecommendedGames({ username }: RecommendedGamesProps) {
    const router = useRouter();
    const [games, setGames] = useState<RecommendedGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchGames = async (forceRefresh = false) => {
        if (!username) {
            setLoading(false);
            return;
        }
        try {
            const cacheKey = `gamelogd_recommended_${username}`;
            if (!forceRefresh) {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    setGames(JSON.parse(cached));
                    setLoading(false);
                    return;
                }
            }
            if (forceRefresh) setIsRefreshing(true);
            const res = await api.get(`/users/${username}/recommended-games/`);
            setGames(res.data);
            localStorage.setItem(cacheKey, JSON.stringify(res.data));
            setActiveIndex(0);
        } catch (err) {
            console.error("Failed to fetch recommended games", err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchGames();
    }, [username]);

    if (loading) {
        return (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 h-64 flex items-center justify-center mt-6">
                <span className="text-zinc-500 text-sm">Loading recommendations...</span>
            </div>
        );
    }

    if (games.length === 0) {
        return null;
    }

    const nextGame = () => setActiveIndex((prev) => (prev + 1) % games.length);
    const prevGame = () => setActiveIndex((prev) => (prev - 1 + games.length) % games.length);

    // Calculate style for each game based on its relative distance from activeIndex
    const getStyleForIndex = (index: number) => {
        let diff = index - activeIndex;
        // Normalize diff to find the shortest distance in the circle
        const halfLength = games.length / 2;
        if (diff > halfLength) diff -= games.length;
        if (diff < -halfLength) diff += games.length;

        let translateX = 0;
        let scale = 1;
        let zIndex = 10;
        let opacity = 1;

        if (diff === 0) {
            translateX = 0;
            scale = 1;
            zIndex = 20;
            opacity = 1;
        } else if (diff === 1) {
            translateX = 100;
            scale = 0.85;
            zIndex = 15;
            opacity = 0.7;
        } else if (diff === -1) {
            translateX = -100;
            scale = 0.85;
            zIndex = 15;
            opacity = 0.7;
        } else if (diff === 2) {
            translateX = 170;
            scale = 0.7;
            zIndex = 10;
            opacity = 0.4;
        } else if (diff === -2) {
            translateX = -170;
            scale = 0.7;
            zIndex = 10;
            opacity = 0.4;
        } else {
            // Hidden items
            translateX = diff > 0 ? 220 : -220;
            scale = 0.5;
            zIndex = 0;
            opacity = 0;
        }

        return {
            transform: `translate(-50%, 0) translateX(${translateX}px) scale(${scale})`,
            zIndex,
            opacity,
            visibility: opacity === 0 ? 'hidden' as const : 'visible' as const,
        };
    };

    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 mt-6 overflow-hidden relative">
            <div className="flex items-center justify-between mb-2 relative z-30">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-indigo-500" />
                    You Might Like These
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => fetchGames(true)}
                        disabled={isRefreshing}
                        className={`p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-indigo-400 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Refresh Recommendations"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                    {games.length > 1 && (
                        <div className="flex gap-1 ml-1 pl-2 border-l border-zinc-700/50">
                            <button
                                onClick={prevGame}
                                className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={nextGame}
                                className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="relative h-[220px] w-full mt-4 perspective-1000">
                {games.map((game, index) => {
                    const style = getStyleForIndex(index);
                    const isCenter = style.zIndex === 20;

                    return (
                        <div
                            key={game.id}
                            className="absolute left-1/2 top-0 transition-all duration-500 ease-in-out origin-center"
                            style={style}
                        >
                            {isCenter ? (
                                <Link
                                    href={`/games/${game.id}`}
                                    className="group flex flex-col items-center w-[130px] rounded-xl transition-colors cursor-pointer"
                                    title={game.title}
                                >
                                    <GameCardContent game={game} isCenter={true} />
                                </Link>
                            ) : (
                                <div
                                    className="group flex flex-col items-center w-[130px] rounded-xl transition-colors cursor-pointer"
                                    title={game.title}
                                    onClick={() => setActiveIndex(index)}
                                >
                                    <GameCardContent game={game} isCenter={false} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {games.length > 0 && (
                <button
                    onClick={() => router.push(`/${username}/recommended`)}
                    className="w-full mt-4 py-2 text-sm text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all font-medium relative z-30"
                >
                    Show more
                </button>
            )}
        </div>
    );
}
