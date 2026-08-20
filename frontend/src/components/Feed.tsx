import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Calendar, ExternalLink } from 'lucide-react';
import { Post, Review, News, FeedItem } from '@/types';
import PostCard from '@/components/PostCard';
import ReviewCard from '@/components/ReviewCard';
import PostComposer from '@/components/PostComposer';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';

const DOT_SEPARATOR = '•';

interface FeedProps {
    initialItems?: FeedItem[];
    hideComposer?: boolean;
}

export default function Feed({ initialItems = [], hideComposer = false }: FeedProps) {
    const { t } = useTranslation();
    const [items, setItems] = useState<FeedItem[]>(initialItems);

    // Every caller (HomeClient, bookmarks, ProfileClient's activity/reviews/replies/opinions
    // tabs) already fetches its own data and hands it down as `initialItems` — Feed itself
    // has no business fetching. It used to fall back to an unfiltered `/posts/` + `/reviews/`
    // fetch whenever `initialItems` was empty, which couldn't tell "parent hasn't fetched yet"
    // apart from "parent fetched and the real answer is zero results" — a brand-new user with
    // zero follows got an empty (correct) response from /feed/following/, and Feed silently
    // replaced it with everyone's posts.
    useEffect(() => {
        setItems(initialItems);

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
            window.removeEventListener('post-created', handleCreated);
        };
    // Re-sync whenever the parent hands us a new initialItems array — not just when its
    // length changes. HomeClient passes SWR's `posts` straight through as initialItems;
    // SWR revalidates in the background (e.g. after a like/bookmark toggle elsewhere) and
    // produces a new array with the SAME length but updated per-item fields (is_liked,
    // likes_count, ...). Depending on `.length` alone meant that revalidation was silently
    // ignored — items[] stayed frozen at whatever the very first render passed in, so a
    // like made just before a refresh could keep showing as unliked indefinitely even
    // though the backend and every other data source already had the correct state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialItems]);

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
            {items.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">
                    {t('noActivityYetShareSomething')}
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
                                                <span aria-hidden="true">{DOT_SEPARATOR}</span>
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
                                                {t('readLabel')} <ExternalLink className="h-3 w-3" />
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
