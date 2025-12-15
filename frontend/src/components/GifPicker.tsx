"use client";

import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface GifPickerProps {
    onSelected: (gifUrl: string) => void;
}

export default function GifPicker({ onSelected }: GifPickerProps) {
    const [gifs, setGifs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // My GIPHY API KEY
    const API_KEY = 'vLVdert2GbNDdzJVGOKqb8hRjXTCA2mo';

    useEffect(() => {
        const fetchGifs = async () => {
            setLoading(true);
            try {
                // Fetch Trending if search is empty, otherwise Search
                const endpoint = search
                    ? `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${search}&limit=20&rating=g`
                    : `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&limit=20&rating=g`;

                const res = await fetch(endpoint);
                const data = await res.json();
                setGifs(data.data);
            } catch (error) {
                console.error("Error fetching GIFs:", error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce: Wait 500ms after typing stops to save API calls
        const timeoutId = setTimeout(() => {
            fetchGifs();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [search]);

    return (
        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-full animate-in fade-in zoom-in-95 duration-200">
            {/* Search Bar */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Search GIFs..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {loading ? (
                    <div className="col-span-3 flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                    </div>
                ) : (
                    gifs.map((gif) => (
                        <button
                            key={gif.id}
                            onClick={() => onSelected(gif.images.original.url)}
                            className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all group"
                        >
                            <img
                                src={gif.images.fixed_height_small.url}
                                alt={gif.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </button>
                    ))
                )}
            </div>

            <div className="mt-2 text-[10px] text-zinc-600 text-center">
                Powered by GIPHY
            </div>
        </div>
    );
}
