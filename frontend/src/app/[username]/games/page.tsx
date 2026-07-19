'use client';

import { useState, use, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import FilterDropdown from "@/components/FilterDropdown";
import { Filter, ArrowUpDown, ArrowLeft, LayoutGrid, List, Gamepad2, Monitor, Play, Loader2 } from 'lucide-react';
import { getImageUrl } from "@/lib/utils";
import api from "@/lib/api";
import Link from 'next/link';
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/lib/useTranslation";
import { useToast } from "@/context/ToastContext";
import { useIsMobile } from "@/hooks/useIsMobile";

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
    const { user: currentUser } = useAuth();
    const { t } = useTranslation();
    const toast = useToast();
    const isOwnProfile = currentUser?.username?.toLowerCase() === username?.toLowerCase();
    const isMobile = useIsMobile();
    // State
    const [games, setGames] = useState<LibraryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPlatform, setFilterPlatform] = useState('all');
    const [sortBy, setSortBy] = useState('playtime');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    // Grid view isn't usable on narrow phones (only ~2 covers fit per row), so mobile
    // is always forced to list view regardless of the (desktop-only) toggle's state.
    const effectiveViewMode = isMobile ? 'list' : viewMode;

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

    // Grid card tap-to-reveal (touch equivalent of desktop's :hover reveal) — a tap
    // opens the title/status/"Edit Status" overlay, a second tap elsewhere steps
    // back one level (editing -> revealed -> closed) rather than closing outright.
    const [revealedId, setRevealedId] = useState<number | null>(null);

    const handleStatusUpdate = async (entryId: number, newStatus: string) => {
        setUpdatingId(entryId);
        try {
            await api.patch(`/library/${entryId}/`, { status: newStatus });

            // Optimistic Update
            setGames(prev => prev.map(g => g.id === entryId ? { ...g, status: newStatus } : g));
            setEditingId(null);
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("Failed to update status");
        } finally {
            setUpdatingId(null);
        }
    };

    const statusOptions = ['unplayed', 'plan_to_play', 'playing', 'replaying', 'completed', 'dropped'];

    const statusMap: Record<string, string> = {
        all: t('all'),
        unplayed: t('unplayed'),
        plan_to_play: t('planToPlay'),
        playing: t('playing'),
        replaying: t('replaying'),
        completed: t('completed'),
        dropped: t('dropped')
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-9">

                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <Link
                                    href={`/${username}`}
                                    className="p-2 -ml-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors flex-shrink-0"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                                <h1 className="text-2xl sm:text-3xl font-bold truncate">{t('gamesLibraryTitle').replace('{username}', username)}</h1>
                            </div>
                            <p className="text-zinc-400 pl-11">
                                <span className="text-white font-bold">{totalGames}</span> {t('gamesInCollection')} • <span className="text-emerald-400 font-bold">{Math.round(totalHours)}h</span> {t('playedTotal')}
                            </p>
                        </div>

                        {/* Sticky Filters Bar */}
                        <div className="sticky top-20 z-30 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-xl p-4 mb-6 shadow-xl shadow-black/20">

                            {/* Mobile: every filter in one horizontally-scrollable row (no view
                                toggle — mobile is always list view, see effectiveViewMode) */}
                            <div className="lg:hidden flex items-center gap-3 overflow-x-auto -mx-1 px-1 no-scrollbar">
                                <div className="flex-shrink-0">
                                    <FilterDropdown
                                        label={t('status')}
                                        allLabel={t('all')}
                                        icon={<Filter className="h-4 w-4" />}
                                        options={[
                                            { value: 'unplayed', label: t('unplayed') },
                                            { value: 'plan_to_play', label: t('planToPlay') },
                                            { value: 'playing', label: t('playing') },
                                            { value: 'replaying', label: t('replaying') },
                                            { value: 'completed', label: t('completed') },
                                            { value: 'dropped', label: t('dropped') }
                                        ]}
                                        value={filterStatus === 'all' ? '' : filterStatus}
                                        onChange={(val) => setFilterStatus(val || 'all')}
                                    />
                                </div>
                                <div className="flex-shrink-0">
                                    <FilterDropdown
                                        label={t('platforms')}
                                        allLabel={t('allPlatforms')}
                                        icon={<Gamepad2 className="h-4 w-4" />}
                                        options={[
                                            { value: 'Steam', label: 'Steam' },
                                            { value: 'PlayStation', label: 'PlayStation' },
                                            { value: 'Xbox', label: 'Xbox' },
                                            { value: 'EA', label: 'EA App' }
                                        ]}
                                        value={filterPlatform === 'all' ? '' : filterPlatform}
                                        onChange={(val) => setFilterPlatform(val || 'all')}
                                    />
                                </div>
                                <div className="flex-shrink-0">
                                    <FilterDropdown
                                        label={t('sortBy')}
                                        icon={<ArrowUpDown className="h-4 w-4" />}
                                        options={[
                                            { value: 'playtime', label: t('playtime') },
                                            { value: 'name', label: t('name') }
                                        ]}
                                        value={sortBy}
                                        onChange={(val) => setSortBy(val)}
                                        showAllOption={false}
                                        showSelectionAccent={false}
                                        align="right"
                                    />
                                </div>
                            </div>

                            {/* Desktop: two groups side by side, plus the grid/list view toggle */}
                            <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-4">
                                <div className="flex flex-row flex-wrap items-center gap-3">
                                    {/* Status Filter */}
                                    <FilterDropdown
                                        label={t('status')}
                                        allLabel={t('all')}
                                        icon={<Filter className="h-4 w-4" />}
                                        options={[
                                            { value: 'unplayed', label: t('unplayed') },
                                            { value: 'plan_to_play', label: t('planToPlay') },
                                            { value: 'playing', label: t('playing') },
                                            { value: 'replaying', label: t('replaying') },
                                            { value: 'completed', label: t('completed') },
                                            { value: 'dropped', label: t('dropped') }
                                        ]}
                                        value={filterStatus === 'all' ? '' : filterStatus}
                                        onChange={(val) => setFilterStatus(val || 'all')}
                                    />

                                    {/* Platform Filter */}
                                    <FilterDropdown
                                        label={t('platforms')}
                                        allLabel={t('allPlatforms')}
                                        icon={<Gamepad2 className="h-4 w-4" />}
                                        options={[
                                            { value: 'Steam', label: 'Steam' },
                                            { value: 'PlayStation', label: 'PlayStation' },
                                            { value: 'Xbox', label: 'Xbox' },
                                            { value: 'EA', label: 'EA App' }
                                        ]}
                                        value={filterPlatform === 'all' ? '' : filterPlatform}
                                        onChange={(val) => setFilterPlatform(val || 'all')}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-3 justify-end">
                                    {/* Sort */}
                                    <FilterDropdown
                                        label={t('sortBy')}
                                        icon={<ArrowUpDown className="h-4 w-4" />}
                                        options={[
                                            { value: 'playtime', label: t('playtime') },
                                            { value: 'name', label: t('name') }
                                        ]}
                                        value={sortBy}
                                        onChange={(val) => setSortBy(val)}
                                        showAllOption={false}
                                        showSelectionAccent={false}
                                        align="right"
                                    />

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
                                <p className="text-lg font-medium mb-2">{t('noGamesInLibrary')}</p>
                                <p className="text-sm mb-6">{t('adjustFiltersOrSync')}</p>
                                <Link href="/settings" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors">
                                    {t('connectAccounts')}
                                </Link>
                            </div>
                        ) : (
                            <div className={`grid gap-4 ${effectiveViewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5' : 'grid-cols-1'}`}>
                                {games.map((entry) => (
                                    effectiveViewMode === 'grid' ? (
                                        // Grid Card
                                        <div
                                            key={entry.id}
                                            onClick={() => { if (revealedId !== entry.id) setRevealedId(entry.id); }}
                                            className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-all hover:shadow-xl hover:shadow-emerald-900/10 relative cursor-pointer lg:cursor-default"
                                        >
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

                                                {/* Reveal overlay: desktop hover, or mobile tap (revealedId/editingId) */}
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (editingId === entry.id) {
                                                            setEditingId(null); // editing -> revealed
                                                        } else {
                                                            setRevealedId(null); // revealed -> closed
                                                        }
                                                    }}
                                                    className={`absolute inset-0 bg-black/90 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center ${(editingId === entry.id || revealedId === entry.id) ? 'flex opacity-100 z-20' : 'hidden lg:flex opacity-0 lg:group-hover:opacity-100'}`}
                                                >
                                                    <Link
                                                        href={`/games/${entry.game.id}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="font-bold text-white mb-2 line-clamp-2 hover:text-emerald-400 hover:underline transition-colors"
                                                    >{entry.game.title}</Link>
                                                    {isOwnProfile && editingId === entry.id ? (
                                                        <div className="flex flex-col gap-2 w-full animate-in zoom-in-95 duration-200">
                                                            <div className="text-xs text-zinc-400 mb-1">{t('selectStatus')}</div>
                                                            {statusOptions.map(status => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => handleStatusUpdate(entry.id, status)}
                                                                    disabled={updatingId === entry.id}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${entry.status === status
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                                                >
                                                                    {statusMap[status] || status}
                                                                </button>
                                                            ))}
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="mt-2 text-xs text-zinc-500 hover:text-white"
                                                            >
                                                                {t('cancel')}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4">{statusMap[entry.status] || entry.status}</span>
                                                            {isOwnProfile && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingId(entry.id); }}
                                                                    className="px-3 py-1.5 bg-white text-black rounded-full text-xs font-bold hover:bg-zinc-200 transition-colors"
                                                                >
                                                                    {t('editStatus')}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // List Card
                                        <div key={entry.id} className="relative flex items-center gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-colors group">
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
                                                <Link href={`/games/${entry.game.id}`} className="font-bold text-white truncate hover:text-emerald-400 hover:underline transition-colors block">{entry.game.title}</Link>
                                                <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <PlatformIcon platform={entry.platform} />
                                                        <span className="uppercase text-xs">{entry.platform}</span>
                                                    </div>
                                                    <span>•</span>
                                                    <span className="capitalize text-emerald-400 text-xs font-bold">{statusMap[entry.status] || entry.status}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <div className="font-bold text-zinc-400 text-sm">{entry.playtime_hours}h</div>
                                                </div>
                                                {isOwnProfile && (
                                                    <button
                                                        onClick={() => setEditingId(editingId === entry.id ? null : entry.id)}
                                                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                                                    >
                                                        <Filter className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* List View Popover (Simple implementation) */}
                                            {isOwnProfile && editingId === entry.id && (
                                                <div className="absolute right-12 mt-12 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[120px] animate-in zoom-in-95">
                                                    {statusOptions.map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleStatusUpdate(entry.id, status)}
                                                            className={`px-3 py-2 text-left text-xs font-bold capitalize rounded-lg transition-colors ${entry.status === status
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'text-zinc-300 hover:bg-zinc-800'}`}
                                                        >
                                                            {statusMap[status] || status}
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
