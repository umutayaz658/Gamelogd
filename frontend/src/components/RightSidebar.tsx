import { useEffect, useState, useRef } from 'react';
import { TrendingUp, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, unwrapList } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import RecommendedGames from '@/components/RecommendedGames';
import NewsSkeleton from '@/components/skeletons/NewsSkeleton';
import { useTranslation } from '@/lib/useTranslation';
import { getRelativeTime } from '@/lib/utils';

interface NewsItem {
    id: number;
    title: string;
    source_name: string;
    pub_date: string;
}

export default function RightSidebar() {
    const router = useRouter();
    const { user } = useAuth();
    const { t, language } = useTranslation();
    const { data: newsData, isLoading: loading } = useSWR<NewsItem[] | { results: NewsItem[] }>('/news/', fetcher);
    const trendingNews = unwrapList<NewsItem>(newsData).slice(0, 4);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [stickyTop, setStickyTop] = useState<number>(80);
    const stickyTopRef = useRef<number>(80);

    useEffect(() => {
        if (loading) return;

        let lastScrollY = window.scrollY;

        const handleScroll = () => {
            if (!sidebarRef.current) return;
            const currentScrollY = window.scrollY;
            const dY = currentScrollY - lastScrollY;

            const viewportHeight = window.innerHeight;
            const sidebarHeight = sidebarRef.current.offsetHeight;
            const availableSpace = viewportHeight - 80; // 80px top offset (navbar + gap)

            if (sidebarHeight <= availableSpace) {
                // If it fits, stick to the top
                stickyTopRef.current = 80;
                setStickyTop(80);
            } else {
                // Dynamic two-way sticky calculation
                // lowerLimit keeps the bottom of the sidebar at least 80px above the viewport bottom (to avoid overlapping messages drawer)
                const lowerLimit = viewportHeight - sidebarHeight - 80;
                const upperLimit = 80;

                let nextTop = stickyTopRef.current - dY;
                nextTop = Math.max(lowerLimit, Math.min(upperLimit, nextTop));

                stickyTopRef.current = nextTop;
                setStickyTop(nextTop);
            }
            lastScrollY = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll);
        // Run once initially
        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [loading]);

    const timeAgo = (dateString: string) => {
        return getRelativeTime(dateString, language);
    };

    if (loading) {
        return (
            <div className="hidden lg:block sticky top-20">
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                    <NewsSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div
            ref={sidebarRef}
            className="hidden lg:block w-full"
            style={{ position: 'sticky', top: `${stickyTop}px` }}
        >
            <div className="flex flex-col gap-4">
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            {t('whatHappeningRight')}
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
                        {t('showMore')}
                    </button>
                </div>

                {/* You Might Like These - Recommended Games Carousel */}
                {user && user.username && (
                    <RecommendedGames username={user.username} />
                )}
            </div>
        </div>
    );
}
