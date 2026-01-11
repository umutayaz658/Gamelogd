'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { ExternalLink, Calendar, MessageCircle, Heart, Share2 } from 'lucide-react';
import PostComposer from '@/components/PostComposer';
import PostCard from '@/components/PostCard';

import { Post } from '@/types';

interface NewsDetail {
    id: number;
    title: string;
    link: string;
    image_url: string | null;
    description: string;
    pub_date: string;
    category: string;
    source_name: string;
    source_icon: string | null;
    is_liked: boolean;
    like_count: number;
    comment_count: number;
}

export default function NewsDetailPage() {
    const params = useParams();
    const id = params.id;

    const [news, setNews] = useState<NewsDetail | null>(null);
    const [comments, setComments] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            try {
                // Fetch News Detail
                const newsRes = await api.get(`/news/${id}/`);
                setNews(newsRes.data);
                setIsLiked(newsRes.data.is_liked);
                setLikeCount(newsRes.data.like_count);

                // Fetch Comments (Posts with news_parent=id)
                const commentsRes = await api.get(`/posts/?news_parent=${id}`);
                setComments(commentsRes.data.results || commentsRes.data);
            } catch (err) {
                console.error("Failed to fetch news detail:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleLike = async () => {
        if (!news) return;
        // Optimistic update
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1);

        try {
            await api.post('/likes/', { news: news.id });
        } catch (err) {
            console.error("Like failed", err);
            // Revert on failure
            setIsLiked(!isLiked);
            setLikeCount(prev => isLiked ? prev + 1 : prev - 1);
        }
    };


    if (loading) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Loading...</div>;
    if (!news) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">News not found</div>;

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-20">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-9 max-w-3xl mx-auto w-full space-y-6">

                        {/* Hero Image */}
                        <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
                            <img
                                src={news.image_url || "/placeholder-news.jpg"}
                                alt={news.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-4 left-4">
                                <span className="bg-emerald-600/90 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wide border border-white/10">
                                    {news.category}
                                </span>
                            </div>
                        </div>

                        {/* Header Info */}
                        <div className="space-y-4">
                            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{news.title}</h1>

                            <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
                                <div className="flex items-center gap-3">
                                    {news.source_icon && (
                                        <img src={news.source_icon} alt={news.source_name} className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 p-1" />
                                    )}
                                    <div>
                                        <p className="font-bold text-zinc-200">{news.source_name}</p>
                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(news.pub_date).toLocaleDateString(undefined, {
                                                year: 'numeric', month: 'long', day: 'numeric'
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <a
                                        href={news.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-zinc-100 text-zinc-900 hover:bg-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-colors"
                                    >
                                        Read Full Article <ExternalLink className="h-4 w-4" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="prose prose-invert prose-lg max-w-none text-zinc-300 leading-relaxed">
                            <div dangerouslySetInnerHTML={{ __html: news.description }} />
                        </div>

                        {/* Social Actions Bar */}
                        <div className="flex items-center justify-between py-4 border-y border-zinc-800">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleLike}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isLiked ? 'text-pink-500 bg-pink-500/10' : 'text-zinc-400 hover:bg-zinc-800 hover:text-pink-500'
                                        }`}
                                >
                                    <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                                    <span className="font-medium">{likeCount}</span>
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-blue-400 transition-colors">
                                    <MessageCircle className="h-5 w-5" />
                                    <span className="font-medium">{comments.length}</span>
                                </button>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
                                <Share2 className="h-5 w-5" />
                                <span className="font-medium">Share</span>
                            </button>
                        </div>

                        {/* Comments Section */}
                        <div className="pt-4">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <MessageCircle className="h-5 w-5 text-emerald-500" />
                                Discussion
                            </h3>

                            {/* Input */}
                            <div className="mb-8">
                                <PostComposer
                                    onPostCreated={(newPost) => setComments([newPost, ...comments])}
                                    parentId={news.id}
                                    parentType="news"
                                />
                            </div>

                            {/* List */}
                            <div className="space-y-6">
                                {comments.map((comment) => (
                                    <div key={comment.id}>
                                        <PostCard post={comment} hideNewsQuote={true} />
                                    </div>
                                ))}
                                {comments.length === 0 && (
                                    <div className="text-center py-10 text-zinc-600">
                                        No comments yet. Be the first to start the conversation!
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
