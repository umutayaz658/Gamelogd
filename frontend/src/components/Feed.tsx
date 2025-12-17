import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Post, Review, FeedItem } from '@/types';
import PostCard from '@/components/PostCard';
import ReviewCard from '@/components/ReviewCard';
import PostComposer from '@/components/PostComposer';

interface FeedProps {
    initialItems?: FeedItem[];
}

export default function Feed({ initialItems = [] }: FeedProps) {
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
                    const posts = postsRes.data.map((p: Post) => ({ ...p, type: 'post' }));
                    const reviews = reviewsRes.data.map((r: Review) => ({ ...r, type: 'review' }));

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

        return () => {
            isMounted = false;
        };
    }, []);

    const handlePostCreated = (newPost: Post) => {
        setItems([{ ...newPost, type: 'post' }, ...items]);
    };

    // Type Guard Helper (simplified for this context since we mapped 'type' property manually above if needed, 
    // but better to check unique props if relying on raw API data. 
    // However, since we merged them, let's distinguish clearly.)

    // Note: The API response objects don't naturally have a 'type' field unless we add it.
    // We added it in the map above. But for type safety, let's handle it.

    const isReview = (item: FeedItem): item is Review => {
        return 'game' in item;
    };

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Create Post Section */}
            <PostComposer onPostCreated={handlePostCreated} />

            {/* Feed List */}
            {isLoading && items.length === 0 ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                </div>
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
                        const key = isReview(item) ? `review-${item.id}` : `post-${item.id}`;

                        if (isReview(item)) {
                            return <ReviewCard key={key} review={item} />;
                        } else {
                            return <PostCard key={key} post={item as Post} />;
                        }
                    })}
                </div>
            )}
        </div>
    );
}
