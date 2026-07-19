'use client';

import { useEffect, useState, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Gamepad2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export interface CarouselGame {
    id: number;
    title: string;
    cover_image: string | null;
}

interface GameCarouselProps {
    title: string;
    games: CarouselGame[];
    loading?: boolean;
    loadingLabel?: string;
    emptyLabel?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    showMoreHref?: string;
    showMoreLabel?: string;
}

const GameCardContent = ({ game, isCenter, overlay }: { game: CarouselGame; isCenter: boolean; overlay?: ReactNode }) => (
    <>
        {/* This box is exactly the cover art's own bounds — the prev/next overlay button
            (when present) is nested inside it so its vertical centering lines up with
            the cover image itself, not the taller image+title block below. */}
        <div className="w-full aspect-[3/4] rounded-lg bg-zinc-800 overflow-hidden mb-2 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-zinc-700/50 relative transition-all duration-500">
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
            {overlay}
        </div>
        <h3 className={`text-sm font-semibold text-zinc-200 text-center leading-snug w-full px-1 line-clamp-2 drop-shadow-md transition-opacity duration-500 ${isCenter ? 'opacity-100 group-hover:text-indigo-400' : 'opacity-0'}`}>
            {game.title}
        </h3>
    </>
);

/**
 * The center-focused "You Might Like These" carousel — shared by the RightSidebar
 * widget and the /recommended page's Top Picks section so both stay visually in sync.
 */
export default function GameCarousel({
    title,
    games,
    loading = false,
    loadingLabel = 'Loading...',
    emptyLabel,
    onRefresh,
    isRefreshing = false,
    showMoreHref,
    showMoreLabel = 'Show More',
}: GameCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        setActiveIndex(0);
    }, [games]);

    useEffect(() => {
        if (games.length <= 1 || isHovered) return;
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % games.length);
        }, 10000);
        return () => clearInterval(interval);
    }, [activeIndex, games.length, isHovered]);

    if (loading) {
        return (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 h-64 flex items-center justify-center">
                <span className="text-zinc-500 text-sm">{loadingLabel}</span>
            </div>
        );
    }

    if (games.length === 0) {
        if (!emptyLabel) return null;
        return (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 h-64 flex items-center justify-center">
                <span className="text-zinc-500 text-sm">{emptyLabel}</span>
            </div>
        );
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
            diff,
        };
    };

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 overflow-hidden relative"
        >
            <div className="flex items-center justify-between mb-2 relative z-30">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-indigo-500" />
                    {title}
                </h2>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className={`p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-indigo-400 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Refresh Recommendations"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>

            <div className="relative h-[220px] w-full mt-4">
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
                                    className="group flex flex-col items-center w-[130px] rounded-xl transition-colors cursor-pointer relative"
                                    title={game.title}
                                    onClick={() => setActiveIndex(index)}
                                >
                                    <GameCardContent
                                        game={game}
                                        isCenter={false}
                                        overlay={
                                            // Prev/next controls live centered on the side covers themselves,
                                            // not the header.
                                            style.diff === -1 ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); prevGame(); }}
                                                    className="absolute inset-0 z-20 flex items-center justify-center"
                                                    aria-label="Previous"
                                                >
                                                    <span className="bg-black/60 hover:bg-black/80 rounded-full p-2.5 transition-colors">
                                                        <ChevronLeft className="h-6 w-6 text-white" />
                                                    </span>
                                                </button>
                                            ) : style.diff === 1 ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); nextGame(); }}
                                                    className="absolute inset-0 z-20 flex items-center justify-center"
                                                    aria-label="Next"
                                                >
                                                    <span className="bg-black/60 hover:bg-black/80 rounded-full p-2.5 transition-colors">
                                                        <ChevronRight className="h-6 w-6 text-white" />
                                                    </span>
                                                </button>
                                            ) : undefined
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {showMoreHref && (
                <Link
                    href={showMoreHref}
                    className="block w-full mt-4 py-2 text-sm text-center text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all font-medium relative z-30"
                >
                    {showMoreLabel}
                </Link>
            )}
        </div>
    );
}
