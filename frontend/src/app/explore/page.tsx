'use client';

import { useState } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import Feed from "@/components/Feed";
import { useAuth } from "@/context/AuthContext";

import api from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function ExplorePage() {
    const [activeTab, setActiveTab] = useState('For You');
    const { user } = useAuth();

    // Default tabs
    const defaultTabs = ["For You", "Trending", "News"];
    let tabs = [...defaultTabs];

    // Inject User Interests if available
    if (user && user.interests && user.interests.length > 0) {
        // Use Set to ensure uniqueness when merging
        tabs = Array.from(new Set([...defaultTabs, ...user.interests]));
    } else {
        // Fallback static tabs if no user or interests
        tabs = [...tabs, "Esports", "Indie", "RPG"];
    }

    const [posts, setPosts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch feed on mount
    useEffect(() => {
        const fetchFeed = async () => {
            setIsLoading(true);
            try {
                const [postsRes, reviewsRes] = await Promise.all([
                    api.get('/posts/'),
                    api.get('/reviews/')
                ]);

                const posts = postsRes.data.map((p: any) => ({ ...p, type: 'post' }));
                const reviews = reviewsRes.data.map((r: any) => ({ ...r, type: 'review' }));

                const combined = [...posts, ...reviews].sort((a: any, b: any) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );

                setPosts(combined);
            } catch (error) {
                console.error("Failed to fetch feed:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFeed();
    }, []);

    // Filter items based on active tab (Client-side filtering for now)
    const getFilteredItems = () => {
        if (activeTab === 'For You') return posts;

        // Simple keyword matching for demo purposes
        const term = activeTab.toLowerCase();
        return posts.filter((item: any) => {
            const content = item.content || '';
            const username = item.user?.username || '';
            const gameTitle = item.game?.title || ''; // Handle Review game title

            return (
                content.toLowerCase().includes(term) ||
                username.toLowerCase().includes(term) ||
                gameTitle.toLowerCase().includes(term)
            );
        });
    };

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

                            {/* Animated Gradient Header */}
                            <div className="relative overflow-hidden rounded-2xl mb-4 p-6 bg-gradient-to-br from-emerald-600/20 via-teal-600/10 to-cyan-600/20 border border-emerald-500/10 animate-gradient-shift" style={{ backgroundSize: '200% 200%' }}>
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5" />
                                <div className="relative z-10">
                                    <h1 className="text-2xl font-bold gradient-text mb-1">Discover Gaming</h1>
                                    <p className="text-sm text-zinc-400">Explore trending posts, reviews, and gaming communities</p>
                                </div>
                                {/* Decorative orb */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
                            </div>

                            {/* Sticky Tab Bar */}
                            <div className="sticky top-16 z-10 bg-zinc-950/90 backdrop-blur-xl -mx-4 px-4 mb-4 py-3">
                                <div className="flex overflow-x-auto scrollbar-none gap-1.5 pb-0.5">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-all rounded-full ${activeTab === tab
                                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                                                : 'text-zinc-500 hover:text-white hover:bg-zinc-800/60 bg-zinc-900/50'
                                                }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Feed Content */}
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {isLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                    </div>
                                ) : (
                                    <Feed initialItems={getFilteredItems()} />
                                )}
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
