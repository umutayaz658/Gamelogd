'use client';

import { useState, use, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import { Search, Filter, ArrowUpDown, LayoutGrid, List, Gamepad2, Monitor, Zap, Play, Loader2 } from 'lucide-react';
import { getImageUrl } from "@/lib/utils";
import api from "@/lib/api";
import Link from 'next/link';

interface Game {
    id: number;
    title: string;
    cover_image: string | null;
    igdb_id: number;
}

interface LibraryEntry {
    id: number;
    game: Game;
    playtime_forever: number;
    playtime_hours: number;
    platform: string;
    status: string;
    added_at: string;
}

export default function GameLibraryPage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = use(params);

    // State
    const [games, setGames] = useState<LibraryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPlatform, setFilterPlatform] = useState('all');
    const [sortBy, setSortBy] = useState('playtime');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Fetch Data
    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            try {
                let url = `/library/?user__username=${username}`;

                // Add Filters
                if (filterStatus !== 'all') url += `&status=${filterStatus}`;
                if (filterPlatform !== 'all') url += `&platform=${filterPlatform}`;

                // Add Sorting
                if (sortBy === 'playtime') url += `&ordering=-playtime_forever`;
                if (sortBy === 'name') url += `&ordering=game__title`;

                const response = await api.get(url);
                setGames(response.data);
            } catch (err) {
                console.error("Failed to fetch library:", err);
                setError("Failed to load game library.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchLibrary();
    }, [username, filterStatus, filterPlatform, sortBy]);


    const PlatformIcon = ({ platform }: { platform: string }) => {
        const p = platform.toLowerCase();
        if (p === 'steam') return <Gamepad2 className="h-3 w-3 text-blue-400" />;
        if (p === 'psn' || p === 'playstation') return <Gamepad2 className="h-3 w-3 text-blue-600" />;
        if (p === 'xbox') return <Gamepad2 className="h-3 w-3 text-green-500" />;
        if (p === 'ea') return <Play className="h-3 w-3 text-red-500" />;
        return <Monitor className="h-3 w-3 text-zinc-400" />;
    };

    // Calculate totals
    const totalGames = games.length;
    const totalHours = games.reduce((acc, curr) => acc + curr.playtime_hours, 0);

    // Status Editing
    const [editingId, setEditingId] = useState<number | null>(null);
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const handleStatusUpdate = async (entryId: number, newStatus: string) => {
        setUpdatingId(entryId);
        try {
            await api.patch(`/library/${entryId}/`, { status: newStatus });

            // Optimistic Update
            setGames(prev => prev.map(g => g.id === entryId ? { ...g, status: newStatus } : g));
            setEditingId(null);
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Failed to update status");
        } finally {
            setUpdatingId(null);
        }
    };

    const statusOptions = ['unplayed', 'playing', 'replaying', 'completed', 'dropped'];

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-9">

                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold mb-2">{username}'s Game Library</h1>
                            <p className="text-zinc-400">
                                <span className="text-white font-bold">{totalGames}</span> games in collection • <span className="text-emerald-400 font-bold">{Math.round(totalHours)}h</span> played total
                            </p>
                        </div>

                        {/* Sticky Filters Bar */}
                        <div className="sticky top-20 z-30 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xl shadow-black/20">

                            <div className="flex items-center gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                                {/* Status Filter */}
                                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                                    {['all', 'unplayed', 'playing', 'replaying', 'completed', 'dropped'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setFilterStatus(status)}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${filterStatus === status
                                                ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                                                : 'text-zinc-400 hover:text-zinc-200'
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>

                                {/* Platform Filter */}
                                <select
                                    value={filterPlatform}
                                    onChange={(e) => setFilterPlatform(e.target.value)}
                                    className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 cursor-pointer hover:bg-zinc-800 transition-colors"
                                >
                                    <option value="all">All Platforms</option>
                                    <option value="Steam">Steam</option>
                                    <option value="PlayStation">PlayStation</option>
                                    <option value="Xbox">Xbox</option>
                                    <option value="EA">EA App</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                {/* Sort */}
                                <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                                    <ArrowUpDown className="h-4 w-4" />
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="bg-transparent border-none text-white focus:ring-0 cursor-pointer p-0 text-sm"
                                    >
                                        <option value="playtime">Playtime</option>
                                        <option value="name">Name</option>
                                    </select>
                                </div>

                                <div className="h-6 w-px bg-zinc-800" />

                                {/* View Mode */}
                                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        <List className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                            </div>
                        ) : error ? (
                            <div className="text-center py-20 text-red-400">
                                <p>{error}</p>
                            </div>
                        ) : games.length === 0 ? (
                            <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/50">
                                <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-medium mb-2">No games found</p>
                                <p className="text-sm mb-6">Try adjusting your filters or sync your accounts.</p>
                                <Link href="/settings" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors">
                                    Connect Accounts
                                </Link>
                            </div>
                        ) : (
                            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5' : 'grid-cols-1'}`}>
                                {games.map((entry) => (
                                    viewMode === 'grid' ? (
                                        // Grid Card
                                        <div key={entry.id} className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-all hover:shadow-xl hover:shadow-emerald-900/10 relative">
                                            <div className="aspect-[3/4] relative overflow-hidden bg-zinc-950">
                                                {entry.game.cover_image ? (
                                                    <img
                                                        src={getImageUrl(entry.game.cover_image)}
                                                        alt={entry.game.title}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                                        <Gamepad2 className="h-12 w-12" />
                                                    </div>
                                                )}

                                                {/* Platform Badge */}
                                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/10 shadow-lg">
                                                    <PlatformIcon platform={entry.platform} />
                                                </div>

                                                {/* Playtime Badge */}
                                                <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 text-xs font-bold text-white shadow-lg">
                                                    {entry.playtime_hours}h
                                                </div>

                                                {/* Hover Overlay */}
                                                <div className={`absolute inset-0 bg-black/90 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center ${editingId === entry.id ? 'opacity-100 z-20' : 'opacity-0 group-hover:opacity-100'}`}>
                                                    <h3 className="font-bold text-white mb-2 line-clamp-2">{entry.game.title}</h3>

                                                    {editingId === entry.id ? (
                                                        <div className="flex flex-col gap-2 w-full animate-in zoom-in-95 duration-200">
                                                            <div className="text-xs text-zinc-400 mb-1">Select Status</div>
                                                            {statusOptions.map(status => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => handleStatusUpdate(entry.id, status)}
                                                                    disabled={updatingId === entry.id}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${entry.status === status
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                                                >
                                                                    {status}
                                                                </button>
                                                            ))}
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="mt-2 text-xs text-zinc-500 hover:text-white"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4">{entry.status}</span>
                                                            <button
                                                                onClick={() => setEditingId(entry.id)}
                                                                className="px-3 py-1.5 bg-white text-black rounded-full text-xs font-bold hover:bg-zinc-200 transition-colors"
                                                            >
                                                                Edit Status
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // List Card
                                        <div key={entry.id} className="flex items-center gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-colors group">
                                            <div className="h-16 w-12 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-950">
                                                {entry.game.cover_image ? (
                                                    <img src={getImageUrl(entry.game.cover_image)} alt={entry.game.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                                        <Gamepad2 className="h-6 w-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{entry.game.title}</h3>
                                                <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <PlatformIcon platform={entry.platform} />
                                                        <span className="uppercase text-xs">{entry.platform}</span>
                                                    </div>
                                                    <span>•</span>
                                                    <span className="capitalize text-emerald-400 text-xs font-bold">{entry.status}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right px-4">
                                                    <div className="font-bold text-white">{entry.playtime_hours}h</div>
                                                    <div className="text-xs text-zinc-500">played</div>
                                                </div>
                                                <button
                                                    onClick={() => setEditingId(editingId === entry.id ? null : entry.id)}
                                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Filter className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* List View Popover (Simple implementation) */}
                                            {editingId === entry.id && (
                                                <div className="absolute right-12 mt-12 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[120px] animate-in zoom-in-95">
                                                    {statusOptions.map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleStatusUpdate(entry.id, status)}
                                                            className={`px-3 py-2 text-left text-xs font-bold capitalize rounded-lg transition-colors ${entry.status === status
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'text-zinc-300 hover:bg-zinc-800'}`}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                ))}
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
