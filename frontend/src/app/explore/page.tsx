'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import PostCard from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { Post } from "@/types";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useTranslation } from '@/lib/useTranslation';
import { useSearchParams, useRouter } from 'next/navigation';

function ExploreContent() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const hashtagParam = searchParams?.get('hashtag') || null;

    // Filter pills: "For You" + "Trending" (shown to everyone), then "News" pinned as
    // the 3rd pill when the user follows it, followed by their remaining registered
    // interests (User.interests) — restores the original pre-testing pill set instead
    // of the fixed post-category enum.
    const filterPills = useMemo(() => {
        const interests = user?.interests ?? [];
        const hasNews = interests.includes('News');
        const restInterests = interests.filter((name) => name !== 'News');
        return [
            { key: 'for_you', label: t('forYou') || 'For You' },
            { key: 'trending', label: t('trending') || 'Trending' },
            ...(hasNews ? [{ key: 'News', label: 'News' }] : []),
            ...restInterests.map((name) => ({ key: name, label: name })),
        ];
    }, [user?.interests, t]);

    // Posts state
    const [activeFilter, setActiveFilter] = useState('for_you');
    const [activeHashtag, setActiveHashtag] = useState<string | null>(hashtagParam);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    const [postsPage, setPostsPage] = useState(1);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const postsObserverRef = useRef<HTMLDivElement>(null);

    // Update active hashtag state when query parameter changes
    useEffect(() => {
        setActiveHashtag(hashtagParam);
    }, [hashtagParam]);

    // Fetch posts for explore
    const fetchExplorePosts = useCallback(async (page: number, filter: string, hashtag: string | null, reset: boolean = false) => {
        setIsLoadingPosts(true);
        try {
            const params = new URLSearchParams();
            if (filter === 'for_you') {
                params.set('mode', 'for_you');
            } else if (filter === 'trending') {
                params.set('mode', 'trending');
            } else {
                params.set('mode', 'trending');
                params.set('interest', filter);
            }
            if (hashtag) params.set('hashtag', hashtag);
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

    // Load posts when filter or hashtag changes
    useEffect(() => {
        setPostsPage(1);
        setPosts([]);
        setHasMorePosts(true);
        fetchExplorePosts(1, activeFilter, activeHashtag, true);
    }, [activeFilter, activeHashtag, fetchExplorePosts]);

    // Intersection observer for infinite scrolling on posts
    useEffect(() => {
        if (!hasMorePosts || isLoadingPosts) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const nextPage = postsPage + 1;
                setPostsPage(nextPage);
                fetchExplorePosts(nextPage, activeFilter, activeHashtag);
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
    }, [hasMorePosts, isLoadingPosts, postsPage, activeFilter, activeHashtag, fetchExplorePosts]);

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
                    <div className="col-span-12 lg:col-span-6">
                        <div className="min-h-[calc(100vh-6rem)]">

                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">

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

                                {/* Filter Pills: For You / Trending / your registered interests */}
                                <div className="mb-4 sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-xl -mx-4 px-4">
                                    <div className="flex overflow-x-auto gap-2 scrollbar-thin-dark pb-3">
                                        {filterPills.map((pill) => (
                                            <button
                                                key={pill.key}
                                                onClick={() => setActiveFilter(pill.key)}
                                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                                    activeFilter === pill.key
                                                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/30'
                                                        : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                                                }`}
                                            >
                                                {pill.label}
                                            </button>
                                        ))}
                                    </div>
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
                                            <p className="text-xs text-zinc-550 mt-1">Be the first to share something!</p>
                                        </div>
                                    )}

                                    {/* Sentinel element for infinite scroll */}
                                    <div ref={postsObserverRef} className="h-4" />
                                </div>
                            </div>

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
