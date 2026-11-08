import { memo } from 'react';

import { FeedItem, News, Post, Review } from '@/types';
import PostCardReadOnly from './PostCardReadOnly';
import ReviewCardReadOnly from './ReviewCardReadOnly';
import NewsCardReadOnly from './NewsCardReadOnly';

export function isReview(item: FeedItem): item is Review {
  return item.type === 'review' || ('game' in item && !('link' in item));
}

export function isNews(item: FeedItem): item is News {
  return item.type === 'news' || 'link' in item;
}

/** Mirrors web's `review-${id}`/`news-${id}`/`post-${id}` key prefixing — avoids
 * collisions between ids from different backend tables in the same list. */
export function getFeedItemKey(item: FeedItem): string {
  if (isReview(item)) return `review-${item.id}`;
  if (isNews(item)) return `news-${item.id}`;
  return `post-${item.id}`;
}

interface FeedItemCardProps {
  item: FeedItem;
}

// Read-only port of frontend/src/components/Feed.tsx's item-type discrimination — same
// isReview/isNews logic. Rendering a single item (rather than owning the whole list) so
// a FlatList (HomeFeed.tsx, ProfileTabs.tsx) can call this as its renderItem — a plain
// `.map()` inside a ScrollView mounts every card at once with no virtualization, which
// doesn't scale once a feed has more than a screenful of items. Memoized: a caller
// re-rendering for a reason unrelated to this specific item (e.g. opening an unrelated
// modal) shouldn't force every on-screen card to re-render too.
const FeedItemCard = memo(function FeedItemCard({ item }: FeedItemCardProps) {
  if (isReview(item)) {
    return <ReviewCardReadOnly review={item} />;
  }
  if (isNews(item)) {
    return <NewsCardReadOnly news={item} />;
  }
  return <PostCardReadOnly post={item as Post} />;
});

export default FeedItemCard;
