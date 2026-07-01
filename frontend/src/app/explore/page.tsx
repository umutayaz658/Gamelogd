'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import PostCard from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { Post } from "@/types";
import api from "@/lib/api";
import { Loader2, Gamepad2, TrendingUp, Search } from "lucide-react";
import { useTranslation } from '@/lib/useTranslation';
import { useSearchParams, useRouter } from 'next/navigation';

// Post category filters for the explore page
const POST_CATEGORIES = [
    { key: 'all', label: 'All', emoji: '🔥' },
    { key: 'reviews', label: 'Reviews', emoji: '⭐' },
    { key: 'gameplay', label: 'Gameplay', emoji: '🎮' },
    { key: 'news', label: 'News', emoji: '📰' },
    { key: 'discussion', label: 'Discussion', emoji: '💬' },
    { key: 'memes', label: 'Memes', emoji: '😂' },
    { key: 'esports', label: 'Esports', emoji: '🏆' },
    { key: 'indie', label: 'Indie', emoji: '🎨' },
    { key: 'devlogs', label: 'Dev Logs', emoji: '🛠️' },
    { key: 'tips', label: 'Tips & Guides', emoji: '📖' },
];

// Game genre filters (preserved from original)
const GAME_GENRES = [
    'All', 'Action', 'Adventure', 'RPG', 'Strategy', 'Puzzle',
    'Simulation', 'Sports', 'Horror', 'Shooter', 'Platformer',
    'Racing', 'Fighting', 'Indie', 'MMO'
];

function ExploreContent() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const hashtagParam = searchParams?.get('hashtag') || null;
    
    // Main tab: Games or Posts
    const [mainTab, setMainTab] = useState<'posts' | 'games'>('posts');
    
    // Posts state
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeHashtag, setActiveHashtag] = useState<string | null>(hashtagParam);
    const [postSort, setPostSort] = useState<'popular' | 'newest' | 'oldest'>('popular');
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    const [postsPage, setPostsPage] = useState(1);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const postsObserverRef = useRef<HTMLDivElement>(null);
    
    // Games state
    const [activeGenre, setActiveGenre] = useState('All');
    const [games, setGames] = useState<any[]>([]);
    const [isLoadingGames, setIsLoadingGames] = useState(false);
    const [gameSearch, setGameSearch] = useState('');
    const [gameSort, setGameSort] = useState('popular');

    // Update active hashtag state when query parameter changes
    useEffect(() => {
        setActiveHashtag(hashtagParam);
    }, [hashtagParam]);

    // Fetch posts for explore
    const fetchExplorePosts = useCallback(async (page: number, category: string, hashtag: string | null, ordering: string, reset: boolean = false) => {
        setIsLoadingPosts(true);
        try {
            const params = new URLSearchParams();
            if (category !== 'all') params.set('category', category);
            if (hashtag) params.set('hashtag', hashtag);
            params.set('ordering', ordering);
            params.set('page', page.toString());
            params.set('page_size', '20');
            
            const res = await api.get(`/explore/posts/?${params.toString()}`);
            const data = res.data;
            
            if (reset) {
                setPosts(data.results || []);
            } else {
                setPosts(prev => [...prev, ...(data.results || [])]);
            }
            setHasMorePosts(data.has_next);
        } catch (error) {
            console.error("Failed to fetch explore posts:", error);
            if (reset) {
                setPosts([]);
            }
            setHasMorePosts(false);
        } finally {
            setIsLoadingPosts(false);
        }
    }, []);

    // Fetch games
    const fetchGames = useCallback(async () => {
        setIsLoadingGames(true);
        try {
            const params = new URLSearchParams();
            if (gameSearch) params.set('search', gameSearch);
            if (activeGenre !== 'All') params.set('genre', activeGenre);
            params.set('ordering', gameSort === 'popular' ? '-library_count' : gameSort === 'newest' ? '-release_date' : '-rating');
            
            const res = await api.get(`/games/?${params.toString()}`);
            setGames(res.data.results || res.data || []);
        } catch (error) {
            console.error("Failed to fetch games:", error);
        } finally {
            setIsLoadingGames(false);
        }
    }, [gameSearch, activeGenre, gameSort]);

    // Load posts when category, hashtag, sort or tab changes
    useEffect(() => {
        if (mainTab === 'posts') {
            setPostsPage(1);
            setPosts([]);
            setHasMorePosts(true);
            fetchExplorePosts(1, activeCategory, activeHashtag, postSort, true);
        }
    }, [activeCategory, activeHashtag, postSort, mainTab, fetchExplorePosts]);

    // Load games when filters change
    useEffect(() => {
        if (mainTab === 'games') {
            fetchGames();
        }
    }, [mainTab, activeGenre, gameSearch, gameSort, fetchGames]);

    // Intersection observer for infinite scrolling on posts
    useEffect(() => {
        if (!hasMorePosts || isLoadingPosts || mainTab !== 'posts') return;
        
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const nextPage = postsPage + 1;
                setPostsPage(nextPage);
                fetchExplorePosts(nextPage, activeCategory, activeHashtag, postSort);
            }
        }, { threshold: 1.0 });
        
        const currentTarget = postsObserverRef.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }
        
        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMorePosts, isLoadingPosts, postsPage, activeCategory, activeHashtag, postSort, mainTab, fetchExplorePosts]);

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
                    <div className="col-span-12 lg:col-span-6">
                        <div className="min-h-[calc(100vh-6rem)]">

                            {/* Main Tab Bar: Posts / Games */}
                            <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800 -mx-4 px-4">
                                <div className="flex">
                                    <button
                                        onClick={() => setMainTab('posts')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all relative ${
                                            mainTab === 'posts'
                                                ? 'text-white'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        <TrendingUp className="h-4 w-4" />
                                        Trending Posts
                                        {mainTab === 'posts' && (
                                            <div className="absolute bottom-0 left-1/4 w-1/2 h-1 bg-emerald-500 rounded-t-full" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setMainTab('games')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all relative ${
                                            mainTab === 'games'
                                                ? 'text-white'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        <Gamepad2 className="h-4 w-4" />
                                        Discover Games
                                        {mainTab === 'games' && (
                                            <div className="absolute bottom-0 left-1/4 w-1/2 h-1 bg-emerald-500 rounded-t-full" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Posts Tab Content */}
                            {mainTab === 'posts' && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-4">
                                    
                                    {/* Active Hashtag Banner */}
                                    {activeHashtag && (
                                        <div className="bg-emerald-950/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div>
                                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Filtered Hashtag</span>
                                                <h2 className="text-lg font-black text-white mt-0.5">#{activeHashtag}</h2>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const params = new URLSearchParams(window.location.search);
                                                    params.delete('hashtag');
                                                    router.push(`/explore?${params.toString()}`);
                                                }}
                                                className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-zinc-800"
                                            >
                                                Clear Filter
                                            </button>
                                        </div>
                                    )}

                                    {/* Category Filter Pills */}
                                    <div className="mb-4">
                                        <div className="flex overflow-x-auto gap-2 scrollbar-thin-dark pb-1">
                                            {POST_CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.key}
                                                    onClick={() => setActiveCategory(cat.key)}
                                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                                        activeCategory === cat.key
                                                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/30'
                                                            : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                                                    }`}
                                                >
                                                    <span>{cat.emoji}</span>
                                                    {cat.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sort Options for Posts */}
                                    <div className="flex items-center gap-2 mb-4 px-1">
                                        <span className="text-xs text-zinc-500 font-medium">Sort by:</span>
                                        {[
                                            { key: 'popular', label: 'Popular' },
                                            { key: 'newest', label: 'Newest' },
                                            { key: 'oldest', label: 'Oldest' },
                                        ].map((sort) => (
                                            <button
                                                key={sort.key}
                                                onClick={() => setPostSort(sort.key as any)}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                                    postSort === sort.key
                                                        ? 'bg-zinc-900 text-emerald-400 border border-zinc-800'
                                                        : 'text-zinc-500 hover:text-zinc-350'
                                                }`}
                                            >
                                                {sort.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Posts Feed */}
                                    <div className="space-y-4">
                                        {posts.map((post) => (
                                            <PostCard key={post.id} post={post} />
                                        ))}
                                        
                                        {isLoadingPosts && (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                            </div>
                                        )}
                                        
                                        {!isLoadingPosts && posts.length === 0 && (
                                            <div className="text-center py-16 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
                                                <div className="text-4xl mb-3">📭</div>
                                                <h3 className="text-sm font-bold text-zinc-300">No posts found</h3>
                                                <p className="text-xs text-zinc-550 mt-1">Be the first to share something about this category!</p>
                                            </div>
                                        )}
                                        
                                        {/* Sentinel element for infinite scroll */}
                                        <div ref={postsObserverRef} className="h-4" />
                                    </div>
                                </div>
                            )}

                            {/* Games Tab Content */}
                            {mainTab === 'games' && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-4">
                                    <div className="space-y-4 mb-6">
                                        {/* Search Input */}
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                            <input
                                                type="text"
                                                placeholder="Search games by title..."
                                                value={gameSearch}
                                                onChange={(e) => setGameSearch(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-all placeholder:text-zinc-500"
                                            />
                                        </div>
                                        
                                        {/* Genre Filter Pills */}
                                        <div className="flex overflow-x-auto gap-2 scrollbar-thin-dark pb-1">
                                            {GAME_GENRES.map((genre) => (
                                                <button
                                                    key={genre}
                                                    onClick={() => setActiveGenre(genre)}
                                                    className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                                        activeGenre === genre
                                                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/30'
                                                            : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                                                    }`}
                                                >
                                                    {genre}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sort Options */}
                                    <div className="flex items-center gap-2 mt-4 mb-4">
                                        <span className="text-xs text-zinc-500 font-medium">Sort by:</span>
                                        {[
                                            { key: 'popular', label: 'Popular' },
                                            { key: 'newest', label: 'Newest' },
                                            { key: 'rated', label: 'Highest Rated' },
                                        ].map((sort) => (
                                            <button
                                                key={sort.key}
                                                onClick={() => setGameSort(sort.key)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                    gameSort === sort.key
                                                        ? 'bg-zinc-800 text-emerald-400'
                                                        : 'text-zinc-500 hover:text-zinc-300'
                                                }`}
                                            >
                                                {sort.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Games Grid */}
                                    {isLoadingGames ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : games.length === 0 ? (
                                        <div className="text-center py-16">
                                            <div className="text-4xl mb-4">🎮</div>
                                            <h3 className="text-lg font-bold text-zinc-300 mb-2">No games found</h3>
                                            <p className="text-sm text-zinc-550">Try adjusting your search or filters.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {games.map((game) => (
                                                <a
                                                    key={game.id}
                                                    href={`/games/${game.id}`}
                                                    className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-lg hover:shadow-zinc-950/50"
                                                >
                                                    <div className="aspect-[3/4] overflow-hidden">
                                                        <img
                                                            src={game.cover_image || '/placeholder-game.png'}
                                                            alt={game.title}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        />
                                                    </div>
                                                    <div className="p-3">
                                                        <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                                            {game.title}
                                                        </h3>
                                                        {game.genres && game.genres.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {(Array.isArray(game.genres) ? game.genres : []).slice(0, 2).map((genre: string, i: number) => (
                                                                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded font-medium">
                                                                        {genre}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <RightSidebar />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function ExplorePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
        }>
            <ExploreContent />
        </Suspense>
    );
}
