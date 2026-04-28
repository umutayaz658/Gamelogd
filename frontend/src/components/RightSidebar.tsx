'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, ArrowUpRight, UserPlus, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import RecommendedGames from '@/components/RecommendedGames';

interface NewsItem {
    id: number;
    title: string;
    source_name: string;
    pub_date: string;
}

interface SuggestedUser {
    id: number;
    username: string;
    avatar: string | null;
    bio?: string;
    is_following?: boolean;
}

export default function RightSidebar() {
    const router = useRouter();
    const { user } = useAuth();
    const [trendingNews, setTrendingNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
    const [suggestLoading, setSuggestLoading] = useState(true);
    const [followingMap, setFollowingMap] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await api.get('/news/');
                setTrendingNews(res.data.results ? res.data.results.slice(0, 4) : res.data.slice(0, 4));
            } catch (err) {
                console.error("Failed to fetch trending news", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    // Fetch friend suggestions
    useEffect(() => {
        if (!user) {
            setSuggestLoading(false);
            return;
        }
        const fetchSuggestions = async () => {
            try {
                const res = await api.get('/users/suggestions/');
                const data = Array.isArray(res.data) ? res.data : res.data.results || [];
                setSuggestedUsers(data.slice(0, 3));
            } catch (err) {
                console.error("Failed to fetch friend suggestions", err);
            } finally {
                setSuggestLoading(false);
            }
        };
        fetchSuggestions();
    }, [user]);

    const handleFollow = async (username: string, userId: number) => {
        setFollowingMap(prev => ({ ...prev, [userId]: true }));
        try {
            await api.post(`/users/${username}/follow/`);
        } catch (err) {
            console.error("Failed to follow", err);
            setFollowingMap(prev => ({ ...prev, [userId]: false }));
        }
    };

    const timeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    if (loading) {
        return (
            <div className="hidden lg:block sticky top-20">
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 h-64 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="hidden lg:flex flex-col gap-4 sticky top-20">
            {/* Trending News */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden card-hover">
                {/* Gradient top line */}
                <div className="h-[2px] bg-gradient-to-r from-emerald-500/60 via-teal-500/60 to-cyan-500/60" />
                
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
                            Trending News
                        </h2>
                    </div>

                    <div className="flex flex-col gap-3.5">
                        {trendingNews.map((news, index) => (
                            <div
                                key={news.id}
                                className="group cursor-pointer"
                                onClick={() => router.push(`/news/${news.id}`)}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex gap-3">
                                        <span className="text-xs font-bold text-zinc-600 mt-0.5">{index + 1}</span>
                                        <div>
                                            <h3 className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                                                {news.title}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-zinc-600">{timeAgo(news.pub_date)}</span>
                                                <span className="text-zinc-800">•</span>
                                                <span className="text-xs text-zinc-600">{news.source_name}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowUpRight className="h-3.5 w-3.5 text-zinc-700 group-hover:text-emerald-500 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100 mt-0.5" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => router.push('/news')}
                        className="w-full mt-4 py-2 text-sm text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all font-bold"
                    >
                        Show more
                    </button>
                </div>
            </div>

            {/* Who to Follow */}
            {user && (
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden card-hover">
                    {/* Gradient top line */}
                    <div className="h-[2px] bg-gradient-to-r from-blue-500/60 via-purple-500/60 to-pink-500/60" />
                    
                    <div className="p-4">
                        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                            <UserPlus className="h-4.5 w-4.5 text-blue-500" />
                            Who to Follow
                        </h2>

                        {suggestLoading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
                            </div>
                        ) : suggestedUsers.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {suggestedUsers.map((suggested) => (
                                    <div key={suggested.id} className="flex items-center gap-3 group">
                                        <Link href={`/${suggested.username}`} className="flex-shrink-0">
                                            <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-800 ring-1 ring-zinc-700 group-hover:ring-zinc-600 transition-all">
                                                <img
                                                    src={getImageUrl(suggested.avatar, suggested.username)}
                                                    alt={suggested.username}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </Link>
                                        <div className="flex-1 min-w-0">
                                            <Link href={`/${suggested.username}`} className="block">
                                                <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                                    {suggested.username}
                                                </p>
                                                {suggested.bio && (
                                                    <p className="text-xs text-zinc-500 truncate">{suggested.bio}</p>
                                                )}
                                            </Link>
                                        </div>
                                        <button
                                            onClick={() => handleFollow(suggested.username, suggested.id)}
                                            disabled={followingMap[suggested.id]}
                                            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                                followingMap[suggested.id]
                                                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                                                    : 'bg-white text-black hover:bg-zinc-200 hover:scale-[1.03] active:scale-[0.97]'
                                            }`}
                                        >
                                            {followingMap[suggested.id] ? 'Following' : 'Follow'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-600 text-center py-2">No suggestions right now</p>
                        )}

                        <button
                            onClick={() => router.push('/explore')}
                            className="w-full mt-4 py-2 text-sm text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all font-bold"
                        >
                            Discover more
                        </button>
                    </div>
                </div>
            )}

            {/* Recommended Games */}
            {user && user.username && (
                <RecommendedGames username={user.username} />
            )}

            {/* Footer */}
            <div className="px-4 py-3 text-[11px] text-zinc-700 flex flex-wrap gap-x-3 gap-y-1">
                <Link href="#" className="hover:text-zinc-500 transition-colors">Terms</Link>
                <Link href="#" className="hover:text-zinc-500 transition-colors">Privacy</Link>
                <Link href="#" className="hover:text-zinc-500 transition-colors">About</Link>
                <Link href="#" className="hover:text-zinc-500 transition-colors">Help</Link>
                <span className="text-zinc-800">© 2026 Gamelogd</span>
            </div>
        </div>
    );
}
