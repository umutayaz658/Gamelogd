import { useEffect, useState } from 'react';
import { TrendingUp, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface NewsItem {
    id: number;
    title: string;
    source_name: string;
    pub_date: string;
}

export default function RightSidebar() {
    const router = useRouter();
    const [trendingNews, setTrendingNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await api.get('/news/');
                // Take first 4 items
                setTrendingNews(res.data.results ? res.data.results.slice(0, 4) : res.data.slice(0, 4));
            } catch (err) {
                console.error("Failed to fetch trending news", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

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
                    <span className="text-zinc-500 text-sm">Loading trends...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="hidden lg:block sticky top-20">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                        Trending News
                    </h2>
                </div>

                <div className="flex flex-col gap-4">
                    {trendingNews.map((news) => (
                        <div
                            key={news.id}
                            className="group cursor-pointer"
                            onClick={() => router.push(`/news/${news.id}`)}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors line-clamp-2">
                                    {news.title}
                                </h3>
                                <ArrowUpRight className="h-4 w-4 text-zinc-600 group-hover:text-emerald-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-zinc-500">{timeAgo(news.pub_date)}</span>
                                <span className="text-zinc-700">•</span>
                                <span className="text-xs text-zinc-500">{news.source_name}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => router.push('/news')}
                    className="w-full mt-4 py-2 text-sm text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all font-medium"
                >
                    Show more
                </button>
            </div>
        </div>
    );
}
