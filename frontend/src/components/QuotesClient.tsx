'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import LeftSidebar from '@/components/LeftSidebar';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/PostCard';
import api from '@/lib/api';
import { Post } from '@/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/useTranslation';

interface QuotesClientProps {
    // Which relation to query: quotes of a Post (repost_parent) or of a Review
    // (repost_parent_review) — see PostViewSet.get_queryset's quotes_of/quotes_of_review params.
    targetType: 'post' | 'review';
    targetId: string;
}

export default function QuotesClient({ targetType, targetId }: QuotesClientProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const [quotes, setQuotes] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observerRef = useRef<HTMLDivElement>(null);

    const paramKey = targetType === 'post' ? 'quotes_of' : 'quotes_of_review';

    const fetchQuotes = useCallback(async (pageToFetch: number, reset: boolean) => {
        if (reset) setIsLoading(true); else setIsLoadingMore(true);
        try {
            const res = await api.get('/posts/', { params: { [paramKey]: targetId, page: pageToFetch } });
            const data = res.data;
            const results: Post[] = Array.isArray(data) ? data : (data.results || []);
            setQuotes(prev => (reset ? results : [...prev, ...results]));
            setHasMore(Array.isArray(data) ? false : !!data.next);
        } catch (err) {
            console.error('Failed to fetch quotes:', err);
            if (reset) setQuotes([]);
            setHasMore(false);
        } finally {
            if (reset) setIsLoading(false); else setIsLoadingMore(false);
        }
    }, [paramKey, targetId]);

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        fetchQuotes(1, true);
    }, [fetchQuotes]);

    // Infinite scroll sentinel — same IntersectionObserver pattern as ExploreClient.
    useEffect(() => {
        if (!hasMore || isLoading || isLoadingMore) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchQuotes(nextPage, false);
            }
        }, { threshold: 1.0 });

        const currentTarget = observerRef.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMore, isLoading, isLoadingMore, page, fetchQuotes]);

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-6">
                        {/* Sticky header — stays pinned below the navbar while the list scrolls,
                            so the back arrow is always reachable without scrolling up. */}
                        <div className="sticky top-16 z-30 -mx-4 px-4 pt-6 pb-4 bg-zinc-950/95 backdrop-blur flex items-center gap-4">
                            <button
                                onClick={() => router.back()}
                                className="p-2 hover:bg-zinc-900 rounded-full transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5 text-zinc-400" />
                            </button>
                            <h1 className="text-xl font-bold">{t('quotes')}</h1>
                        </div>

                        <div className="pb-6">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                                </div>
                            ) : quotes.length > 0 ? (
                                <div className="flex flex-col gap-4">
                                    {quotes.map((quote) => (
                                        <PostCard key={quote.id} post={quote} />
                                    ))}
                                    {hasMore && (
                                        <div ref={observerRef} className="flex justify-center py-6">
                                            {isLoadingMore && <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-zinc-500">
                                    {t('noQuotesYet')}
                                </div>
                            )}
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
