'use client';

import { useState, useEffect } from 'react';
import { X, Search, Loader2, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

interface Game {
    id: number;
    title: string;
    cover_image: string;
    release_date: string;
}

interface GameSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectGame: (game: Game) => void;
}

export default function GameSearchModal({ isOpen, onClose, onSelectGame }: GameSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.trim().length > 1) {
                setLoading(true);
                try {
                    const response = await api.get(`/games/?search=${searchTerm}`);
                    setResults(response.data);
                } catch (error) {
                    console.error("Search failed:", error);
                    setResults([]);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-white">Select a Favorite Game</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search for a game..."
                            autoFocus
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        />
                    </div>
                </div>

                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                            <Loader2 className="h-8 w-8 animate-spin mb-2 text-emerald-500" />
                            <p>Searching...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="space-y-1">
                            {results.map((game) => (
                                <button
                                    key={game.id}
                                    onClick={() => {
                                        onSelectGame(game);
                                        onClose();
                                    }}
                                    className="w-full flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-xl transition-colors group text-left"
                                >
                                    <div className="h-16 w-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 group-hover:border-zinc-700">
                                        {game.cover_image ? (
                                            <img src={getImageUrl(game.cover_image)} alt={game.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                                                <Search className="h-4 w-4" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-zinc-200 group-hover:text-white transition-colors">{game.title}</h3>
                                        {game.release_date && (
                                            <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                                                <Calendar className="h-3 w-3" />
                                                <span>{new Date(game.release_date).getFullYear()}</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : searchTerm.length > 1 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                            <Search className="h-8 w-8 mb-2 opacity-50" />
                            <p>No games found matching "{searchTerm}"</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                            <p>Type to search for games</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
