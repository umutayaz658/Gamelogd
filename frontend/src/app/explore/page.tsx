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

    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch posts on mount
    useEffect(() => {
        const fetchPosts = async () => {
            setIsLoading(true);
            try {
                const response = await api.get('/posts/');
                setPosts(response.data);
            } catch (error) {
                console.error("Failed to fetch posts:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPosts();
    }, []);

    // Filter posts based on active tab (Client-side filtering for now)
    const getFilteredPosts = () => {
        if (activeTab === 'For You') return posts;

        // Simple keyword matching for demo purposes
        // In a real app, you'd likely pass a query param to the API: /posts/?category=rpg
        const term = activeTab.toLowerCase();
        return posts.filter((post: any) =>
            post.content.toLowerCase().includes(term) ||
            (post.user.username && post.user.username.toLowerCase().includes(term))
        );
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

                            {/* Sticky Tab Bar */}
                            <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 -mx-4 px-4 mb-4">
                                <div className="flex overflow-x-auto scrollbar-thin-dark pb-2">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-4 py-4 text-sm font-bold whitespace-nowrap transition-all relative ${activeTab === tab
                                                ? 'text-white'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            {tab}
                                            {activeTab === tab && (
                                                <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                            )}
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
                                    <Feed initialPosts={getFilteredPosts()} />
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
