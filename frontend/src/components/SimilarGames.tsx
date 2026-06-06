import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';

export default function SimilarGames({ currentId, genres }: { currentId: string, genres?: string[] }) {
    const [games, setGames] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSimilar = async () => {
            try {
                // Fetch games
                const res = await api.get('/games/');
                let results = res.data.results || res.data;
                
                // Filter out the current game
                results = results.filter((g: any) => g.id.toString() !== currentId);
                
                if (genres && genres.length > 0) {
                    // Score games based on how many genres match
                    results.forEach((g: any) => {
                        const gameGenres = g.genres || [];
                        const matchCount = gameGenres.filter((genre: string) => genres.includes(genre)).length;
                        g._matchScore = matchCount;
                    });
                    // Sort descending by score
                    results.sort((a: any, b: any) => {
                        if (b._matchScore !== a._matchScore) {
                            return b._matchScore - a._matchScore;
                        }
                        // If same score, fallback to rating or random. Here we just fallback to highest rating.
                        return (b.average_rating || 0) - (a.average_rating || 0);
                    });
                }
                
                // Show up to 6 similar games
                setGames(results.slice(0, 6));
            } catch (err) {
                console.error("Failed to fetch similar games", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSimilar();
    }, [currentId, genres]);

    if (loading || games.length === 0) return null;

    return (
        <div className="mt-16 border-t border-zinc-800/50 pt-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                Similar Games
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {games.map(game => {
                    const coverUrl = game.cover_image ? (game.cover_image.startsWith('http') ? game.cover_image : `http://localhost:8000${game.cover_image}`) : null;
                    
                    return (
                        <Link 
                            href={`/games/${game.id}`} 
                            key={game.id}
                            className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:ring-1 hover:ring-indigo-500/50 transition-all duration-500 transform hover:-translate-y-2 bg-zinc-900"
                        >
                            {coverUrl ? (
                                <Image src={coverUrl} alt={game.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110 group-hover:saturate-150" unoptimized />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                    <span className="text-zinc-600 font-medium">No Cover</span>
                                </div>
                            )}
                            
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                            
                            {/* Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                <h3 className="text-white font-bold text-sm leading-tight mb-1 drop-shadow-md">
                                    {game.title}
                                </h3>
                                {game.release_date && (
                                    <p className="text-zinc-400 text-xs font-semibold">
                                        {new Date(game.release_date).getFullYear()}
                                    </p>
                                )}
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
}
