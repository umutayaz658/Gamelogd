'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import PostCard from "@/components/PostCard";
import PostComposer from "@/components/PostComposer";
import api from '@/lib/api';
import { Post } from '@/types';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function SinglePostPage() {
    const params = useParams();
    const router = useRouter();
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (params?.id) {
            const fetchPost = async () => {
                try {
                    const response = await api.get(`/posts/${params.id}/`);
                    setPost(response.data);
                } catch (err) {
                    console.error('Failed to fetch post:', err);
                    setError('Failed to load post.');
                } finally {
                    setLoading(false);
                }
            };
            fetchPost();
        }
    }, [params?.id]);

    const handleReply = (newReply: any) => {
        // Handle reply creation - for now just log or refresh
        console.log("New reply:", newReply);
        // Ideally append to comments list
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
                        <div className="flex items-center gap-4 mb-6">
                            <button
                                onClick={() => router.back()}
                                className="p-2 hover:bg-zinc-900 rounded-full transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5 text-zinc-400" />
                            </button>
                            <h1 className="text-xl font-bold">Post</h1>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                            </div>
                        ) : error ? (
                            <div className="text-center py-10 text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
                                {error}
                            </div>
                        ) : post ? (
                            <div className="flex flex-col gap-4">
                                <PostCard post={post} isDetailView={true} />

                                {/* Placeholder for Comments/Replies */}
                                <div className="border-t border-zinc-800 pt-4">
                                    <PostComposer onPostCreated={handleReply} />
                                    {/* Future: Render Comments List Here */}
                                    <div className="py-8 text-center text-zinc-500">
                                        Replies coming soon...
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-zinc-500">
                                Post not found.
                            </div>
                        )}
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
