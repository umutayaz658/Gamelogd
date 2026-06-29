'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import Feed from "@/components/Feed";
import PostCard from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { Post } from "@/types";

import api from "@/lib/api";
import { Loader2, Gamepad2, MessageSquare, TrendingUp, Search } from "lucide-react";

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

export default function ExplorePage() {
    const { user } = useAuth();
    
    // Main tab: Games or Posts
    const [mainTab, setMainTab] = useState<'posts' | 'games'>('posts');
    
    // Posts state
    const [activeCategory, setActiveCategory] = useState('all');
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

    // Fetch posts for explore
    const fetchExplorePosts = useCallback(async (page: number, category: string, reset: boolean = false) => {
        setIsLoadingPosts(true);
        try {
            const params = new URLSearchParams();
            if (category !== 'all') params.set('category', category);
            params.set('page', page.toString());
            params.set('page_size', '20');
            
            const res = await api.get(`/explore/posts/?${params.toString()}`);
            const data = res.data;
            
            if (reset) {
                setPosts(data.results || []);
            } else {
                setPosts(prev => [...prev, ...(data.results || [])]);
            }
            setHasMorePosts(data.has_next || false);
        } catch (error: any) {
            console.error("Failed to fetch explore posts:", error);
            // Fallback: try for-you feed if explore endpoint doesn't exist yet
            if (error.response?.status === 404) {
                try {
                    const fallbackRes = await api.get('/feed/for-you/');
                    const fallbackPosts = fallbackRes.data || [];
                    if (category !== 'all') {
                        // Client-side filtering as fallback
                        const filtered = fallbackPosts.filter((p: any) => 
                            p.category === category || !p.category
                        );
                        setPosts(reset ? filtered : prev => [...prev, ...filtered]);
                    } else {
                        setPosts(reset ? fallbackPosts : prev => [...prev, ...fallbackPosts]);
                    }
                    setHasMorePosts(false);
                } catch {
                    setPosts([]);
                    setHasMorePosts(false);
                }
            }
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

    // Load posts when category or tab changes
    useEffect(() => {
        if (mainTab === 'posts') {
            setPostsPage(1);
            setPosts([]);
            setHasMorePosts(true);
            fetchExplorePosts(1, activeCategory, true);
        }
    }, [activeCategory, mainTab, fetchExplorePosts]);

    // Load games when filters change
    useEffect(() => {
        if (mainTab === 'games') {
            fetchGames();
        }
    }, [mainTab, activeGenre, gameSearch, gameSort, fetchGames]);

    // Infinite scroll for posts
    useEffect(() => {
        if (mainTab !== 'posts') return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMorePosts && !isLoadingPosts) {
                    const nextPage = postsPage + 1;
                    setPostsPage(nextPage);
                    fetchExplorePosts(nextPage, activeCategory);
                }
            },
            { threshold: 0.1 }
        );

        if (postsObserverRef.current) {
            observer.observe(postsObserverRef.current);
        }

        return () => observer.disconnect();
    }, [mainTab, hasMorePosts, isLoadingPosts, postsPage, activeCategory, fetchExplorePosts]);

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
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Category Filter Pills */}
                                    <div className="sticky top-[57px] z-10 bg-zinc-950/80 backdrop-blur-md -mx-4 px-4 py-3 border-b border-zinc-800/50">
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

                                    {/* Posts Feed */}
                                    <div className="mt-4 flex flex-col gap-4">
                                        {isLoadingPosts && posts.length === 0 ? (
                                            <div className="flex justify-center py-12">
                                                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                            </div>
                                        ) : posts.length === 0 ? (
                                            <div className="text-center py-16">
                                                <div className="text-4xl mb-4">
                                                    {POST_CATEGORIES.find(c => c.key === activeCategory)?.emoji || '🔍'}
                                                </div>
                                                <h3 className="text-lg font-bold text-zinc-300 mb-2">No posts found</h3>
                                                <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                                                    {activeCategory === 'all' 
                                                        ? 'No trending posts right now. Be the first to share something!'
                                                        : `No trending posts in ${POST_CATEGORIES.find(c => c.key === activeCategory)?.label || activeCategory}. Try a different category.`
                                                    }
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {posts.map((post) => (
                                                    <PostCard key={`explore-${post.id}`} post={post} />
                                                ))}
                                                
                                                {/* Infinite scroll trigger */}
                                                <div ref={postsObserverRef} className="py-4">
                                                    {isLoadingPosts && (
                                                        <div className="flex justify-center">
                                                            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {!hasMorePosts && posts.length > 0 && (
                                                    <div className="text-center py-6 text-zinc-600 text-xs font-medium">
                                                        You&apos;ve reached the end • Pull to refresh
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Games Tab Content */}
                            {mainTab === 'games' && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Game Search */}
                                    <div className="sticky top-[57px] z-10 bg-zinc-950/80 backdrop-blur-md -mx-4 px-4 py-3 border-b border-zinc-800/50">
                                        <div className="relative mb-3">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                            <input
                                                type="text"
                                                placeholder="Search games..."
                                                value={gameSearch}
                                                onChange={(e) => setGameSearch(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
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
                                            <p className="text-sm text-zinc-500">Try adjusting your search or filters.</p>
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
