'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import PostCard from "@/components/PostCard";
import PostComposer from "@/components/PostComposer";
import api from '@/lib/api';
import { Post, Review } from '@/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useFeed } from '@/context/FeedContext';
import ReviewCard from '@/components/ReviewCard';

export default function SinglePostPage() {
    const params = useParams();
    const router = useRouter();
    const [post, setPost] = useState<Post | null>(null);
    const [parentPost, setParentPost] = useState<Post | null>(null);
    const [parentReview, setParentReview] = useState<Review | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [replies, setReplies] = useState<Post[]>([]);

    useEffect(() => {
        if (params?.id) {
            const fetchData = async () => {
                try {
                    setLoading(true);
                    setParentPost(null); // Reset parent on id change

                    // 1. Fetch Focus Post & Replies
                    const [postRes, repliesRes] = await Promise.all([
                        api.get(`/posts/${params.id}/`),
                        api.get(`/posts/`, { params: { parent: params.id } })
                    ]);

                    const fetchedPost = postRes.data;
                    console.log("Full Reply Data:", fetchedPost); // Debug log as requested

                    setPost(fetchedPost);
                    setReplies(repliesRes.data);

                    // 2. Set Parent from embedded parent_details
                    if (fetchedPost.parent_details) {
                        const parent = fetchedPost.parent_details;
                        // Use explicit type check from backend
                        if (parent.type === 'review') {
                            setParentReview(parent as Review);
                        } else {
                            setParentPost(parent as Post);
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch data:', err);
                    setError('Failed to load post.');
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [params?.id]);

    const { addFeedItem } = useFeed();

    const handleReply = (newReply: Post) => {
        console.log("New reply:", newReply);
        addFeedItem(newReply);
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
                                {/* Parent Context */}
                                {parentReview && (
                                    <div className="relative">
                                        <ReviewCard review={parentReview} isDetailView={true} />
                                        {/* Visual Connector Line */}
                                        <div className="absolute left-8 top-full h-4 w-0.5 bg-zinc-800 -z-10" />
                                    </div>
                                )}
                                {parentPost && (
                                    <div className="relative">
                                        <PostCard post={parentPost} isDetailView={true} />
                                        {/* Visual Connector Line */}
                                        <div className="absolute left-8 top-full h-4 w-0.5 bg-zinc-800 -z-10" />
                                    </div>
                                )}

                                {/* Focused Post */}
                                <div className="z-10 bg-zinc-950">
                                    <PostCard post={post} isDetailView={true} />
                                </div>

                                {/* Reply Composer */}
                                <div className="border-t border-zinc-800 pt-6">
                                    <PostComposer
                                        onPostCreated={(newReply) => {
                                            console.log("Adding new reply to list:", newReply);
                                            handleReply(newReply);
                                            // IMMEDIATE STATE UPDATE: Append new reply to the TOP of the list
                                            setReplies(prev => [newReply, ...prev]);
                                        }}
                                        replyingTo={post.user}
                                        parentId={post.id}
                                        parentType="post"
                                    />

                                    <div className="py-4">
                                        {replies.length > 0 ? (
                                            replies.map((reply) => (
                                                <div key={reply.id} className="mb-4">
                                                    <PostCard post={reply} />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-8 text-center text-zinc-500">
                                                No replies yet.
                                            </div>
                                        )}
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
