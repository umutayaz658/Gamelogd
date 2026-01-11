'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import ReviewCard from "@/components/ReviewCard";
import PostCard from "@/components/PostCard";
import PostComposer from "@/components/PostComposer";
import api from '@/lib/api';
import { Review } from '@/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import { useFeed } from '@/context/FeedContext';

export default function SingleReviewPage() {
    const params = useParams();
    const { addFeedItem } = useFeed();
    const router = useRouter();
    const { user } = useAuth();
    const [review, setReview] = useState<Review | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [replies, setReplies] = useState<any[]>([]);

    useEffect(() => {
        if (params?.id) {
            const fetchData = async () => {
                try {
                    const [reviewRes, repliesRes] = await Promise.all([
                        api.get(`/reviews/${params.id}/`),
                        api.get(`/posts/?review_parent=${params.id}`)
                    ]);
                    setReview(reviewRes.data);
                    setReplies(repliesRes.data);
                } catch (err) {
                    console.error('Failed to fetch data:', err);
                    setError('Failed to load review.');
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [params?.id]);

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
                            <h1 className="text-xl font-bold">Review</h1>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                            </div>
                        ) : error ? (
                            <div className="text-center py-10 text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
                                {error}
                            </div>
                        ) : review ? (
                            <div className="flex flex-col gap-4">
                                <div className="pointer-events-none">
                                    <ReviewCard review={review} />
                                </div>

                                {/* Reply Composer */}
                                <div className="border-t border-zinc-800 pt-6">
                                    <PostComposer
                                        onPostCreated={(post) => {
                                            console.log('Replied:', post);
                                            addFeedItem(post);
                                            setReplies(prev => [post, ...prev]);
                                        }}
                                        replyingTo={review.user}
                                        parentId={review.id}
                                        parentType="review"
                                    />

                                    {/* Replies List */}
                                    <div className="mt-8 space-y-4">
                                        {replies.length > 0 ? (
                                            replies.map((reply) => (
                                                <PostCard key={reply.id} post={reply} />
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-zinc-500 border border-dashed border-zinc-900 rounded-xl">
                                                No replies yet. Be the first to share your thoughts!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-zinc-500">
                                Review not found.
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
