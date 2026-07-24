import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Calendar, ExternalLink } from 'lucide-react';
import api, { unwrapList } from '@/lib/api';
import { Post, Review, News, FeedItem } from '@/types';
import PostCard from '@/components/PostCard';
import ReviewCard from '@/components/ReviewCard';
import PostComposer from '@/components/PostComposer';
import FeedSkeleton from '@/components/skeletons/FeedSkeleton';
import { useRouter } from 'next/navigation';

interface FeedProps {
    initialItems?: FeedItem[];
    hideComposer?: boolean;
}

export default function Feed({ initialItems = [], hideComposer = false }: FeedProps) {
    const [items, setItems] = useState<FeedItem[]>(initialItems);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Posts & Reviews
    useEffect(() => {
        let isMounted = true;

        const fetchFeed = async () => {
            if (initialItems.length > 0) {
                setItems(initialItems);
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                // Parallel fetch
                const [postsRes, reviewsRes] = await Promise.all([
                    api.get('/posts/'),
                    api.get('/reviews/')
                ]);

                if (isMounted) {
                    const posts = unwrapList<Post>(postsRes.data).map((p: Post) => ({ ...p, type: 'post' }));
                    const reviews = unwrapList<Review>(reviewsRes.data).map((r: Review) => ({ ...r, type: 'review' }));

                    // Merge and Sort by timestamp desc
                    const combined = [...posts, ...reviews].sort((a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );

                    setItems(combined);
                }
            } catch (err) {
                console.error('Failed to fetch feed:', err);
                if (isMounted) {
                    setError('Failed to load feed.');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchFeed();

        const handleCreated = (e: Event) => {
            const customEvent = e as CustomEvent<Post>;
            if (customEvent.detail) {
                setItems(prev => {
                    if (prev.some(item => item.id === customEvent.detail.id)) return prev;
                    return [{ ...customEvent.detail, type: 'post' }, ...prev];
                });
            }
        };
        window.addEventListener('post-created', handleCreated);

        return () => {
            isMounted = false;
            window.removeEventListener('post-created', handleCreated);
        };
    // initialItems değişince (sekme değişimi gibi) feed'i yeniden yükle
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialItems.length]);

    const handlePostCreated = (newPost: Post) => {
        setItems([{ ...newPost, type: 'post' }, ...items]);
    };

    // Type Guard Helper (simplified for this context since we mapped 'type' property manually above if needed, 
    // but better to check unique props if relying on raw API data. 
    // However, since we merged them, let's distinguish clearly.)

    // Note: The API response objects don't naturally have a 'type' field unless we add it.
    // We added it in the map above. But for type safety, let's handle it.

    const router = useRouter();

    const isReview = (item: FeedItem): item is Review => {
        return item.type === 'review' || ('game' in item && !('link' in item));
    };

    const isNews = (item: FeedItem): item is News => {
        return item.type === 'news' || 'link' in item;
    };

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Create Post Section */}
            {!hideComposer && <PostComposer onPostCreated={handlePostCreated} />}

            {/* Feed List */}
            {isLoading && items.length === 0 ? (
                <FeedSkeleton />
            ) : error ? (
                <div className="text-center py-10 text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
                    {error}
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">
                    No activity yet. Be the first to share something!
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {items.map((item) => {
                        // Use ID + type specific prefix for key to avoid collision if IDs overlap between tables
                        if (isReview(item)) {
                            return <ReviewCard key={`review-${item.id}`} review={item} />;
                        } else if (isNews(item)) {
                            return (
                                <div
                                    key={`news-${item.id}`}
                                    onClick={() => router.push(`/news/${item.id}`)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors flex flex-col sm:flex-row group cursor-pointer"
                                >
                                    {item.image_url && (
                                        <div className="relative w-full sm:w-48 h-32 sm:h-auto overflow-hidden flex-shrink-0">
                                            {/* News images/icons come from arbitrary RSS source domains that
                                                can't be enumerated in next.config.ts's remotePatterns —
                                                unoptimized still gets next/image's lazy-loading for free. */}
                                            <Image
                                                src={item.image_url}
                                                alt={item.title}
                                                fill
                                                unoptimized
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        </div>
                                    )}
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                                                {item.source_icon && (
                                                    <Image
                                                        src={item.source_icon}
                                                        alt={item.source_name}
                                                        width={16}
                                                        height={16}
                                                        unoptimized
                                                        className="w-4 h-4 rounded-full"
                                                    />
                                                )}
                                                <span className="font-medium text-zinc-300">{item.source_name}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(item.pub_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-bold leading-snug line-clamp-2 mb-2 group-hover:text-emerald-400 transition-colors">
                                                {item.title}
                                            </h3>
                                            <p className="text-zinc-400 text-xs line-clamp-2 mb-3">
                                                {item.description ? item.description.replace(/<[^>]*>/g, '').replace('...', '') : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between mt-auto">
                                            <span className="bg-emerald-950/55 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase tracking-wide">
                                                {item.category || 'News'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium hover:text-emerald-400">
                                                Read <ExternalLink className="h-3 w-3" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        } else {
                            return <PostCard key={`post-${item.id}`} post={item as Post} />;
                        }
                    })}
                </div>
            )}
        </div>
    );
}
