import { Dna, ArrowRight, Clock, Gamepad2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Stat {
    name: string;
    percentage: number;
    color: string;
    total_hours?: number;
    game_count?: number;
}

interface GameDNAProps {
    stats: {
        genres: Stat[];
        platforms: Stat[];
    } | any[]; // any[] to handle old format gracefully
    username?: string;
    // When false, renders only the genre bar list (no card wrapper/own header) —
    // used by the mobile accordion, which supplies its own single header instead
    // of stacking a second "Game DNA" title underneath.
    showHeader?: boolean;
}

const getHexColor = (colorStr: string) => {
    if (!colorStr) return '#10b981';
    if (colorStr.startsWith('#')) return colorStr;
    const colorMap: Record<string, string> = {
        'bg-emerald-500': '#10b981',
        'bg-blue-500': '#3b82f6',
        'bg-purple-500': '#a855f7',
        'bg-amber-500': '#f59e0b',
        'bg-rose-500': '#f43f5e',
        'bg-cyan-500': '#06b6d4',
        'bg-pink-500': '#ec4899',
        'bg-indigo-500': '#6366f1'
    };
    return colorMap[colorStr] || '#10b981';
};

const formatHours = (hours: number): string => {
    if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k`;
    if (hours >= 100) return `${Math.round(hours)}`;
    return `${hours}`;
};

export default function GameDNA({ stats, username, showHeader = true }: GameDNAProps) {
    const [activeTab, setActiveTab] = useState<'genres' | 'platforms'>('genres');

    const isOldFormat = Array.isArray(stats);

    // If old format, it has "genre" instead of "name" sometimes, map it safely
    const genresList = isOldFormat
        ? stats.map(s => ({ ...s, name: s.genre || s.name }))
        : (stats?.genres || []);

    const platformsList = isOldFormat ? [] : (stats?.platforms || []);

    const currentList = activeTab === 'genres' ? genresList : platformsList;
    const totalHours = genresList.reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0);

    if (genresList.length === 0 && platformsList.length === 0) {
        return null; // Do not render if completely empty
    }

    const content = (
        <>
            {/* Tabs */}
            {!isOldFormat && platformsList.length > 0 && (
                <div className="flex items-center gap-2 mb-6 bg-zinc-950 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('genres')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === 'genres' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Genres
                    </button>
                    <button
                        onClick={() => setActiveTab('platforms')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === 'platforms' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Platforms
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-4">
                {currentList.map((stat: any) => (
                    <div key={stat.name}>
                        <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-zinc-400 font-medium">{stat.name}</span>
                            <div className="flex items-center gap-2">
                                {stat.total_hours !== undefined && stat.total_hours > 0 && (
                                    <span className="text-zinc-600 text-xs flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatHours(stat.total_hours)}h
                                    </span>
                                )}
                                {stat.game_count !== undefined && stat.game_count > 0 && (
                                    <span className="text-zinc-600 text-xs flex items-center gap-1">
                                        <Gamepad2 className="h-3 w-3" />
                                        {stat.game_count}
                                    </span>
                                )}
                                <span className="text-white font-bold">{stat.percentage}%</span>
                            </div>
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${stat.percentage}%`, backgroundColor: getHexColor(stat.color) }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </>
    );

    if (!showHeader) {
        return content;
    }

    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-zinc-100 font-bold">
                    <Dna className="h-5 w-5 text-emerald-500" />
                    <span>Game DNA</span>
                </div>
                <div className="flex items-center gap-3">
                    {totalHours > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Clock className="h-3 w-3" />
                            <span>{formatHours(totalHours)}h total</span>
                        </div>
                    )}
                    {username && (
                        <Link
                            href={`/${username}/games`}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors group"
                            title="View Full Library"
                        >
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    )}
                </div>
            </div>

            {content}
        </div>
    );
}
