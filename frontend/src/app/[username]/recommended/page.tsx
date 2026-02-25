'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import api from '@/lib/api';
import { Gamepad2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface RecommendedGame {
    id: number;
    title: string;
    cover_image: string | null;
}

export default function RecommendedGamesPage() {
    const params = useParams();
    const router = useRouter();
    const username = params.username as string;

    const [games, setGames] = useState<RecommendedGame[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGames = async () => {
            if (!username) return;
            try {
                // Read from localStorage to keep consistency with the carousel
                const cacheKey = `gamelogd_recommended_${username}`;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    setGames(JSON.parse(cached));
                    setLoading(false);
                    return;
                }

                // Fallback to API if not cached
                const response = await api.get(`/users/${username}/recommended-games/`);
                setGames(response.data);
                localStorage.setItem(cacheKey, JSON.stringify(response.data));
            } catch (error) {
                console.error("Error fetching recommended games:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGames();
    }, [username]);

    const handleBack = () => {
        router.back();
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-20">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar - Hidden on mobile/tablet */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-9 space-y-8">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBack}
                                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <Gamepad2 className="text-indigo-500 h-8 w-8" />
                                Recommended Games for You
                            </h1>
                        </div>

                        <p className="text-zinc-400 text-lg">
                            Games you might like based on your Game DNA, excluding games you've already played or reviewed.
                        </p>

                        {/* Games Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <span className="loading-spinner text-indigo-500">Loading recommendations...</span>
                            </div>
                        ) : games.length === 0 ? (
                            <div className="text-center py-20 bg-zinc-900 rounded-2xl border border-zinc-800">
                                <Gamepad2 className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">No recommendations found</h3>
                                <p className="text-zinc-400">Play or review more games to generate your Game DNA.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {games.map((game) => (
                                    <Link
                                        key={game.id}
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
                                        <div className="p-3">
                                            <h3 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">
                                                {game.title}
                                            </h3>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
