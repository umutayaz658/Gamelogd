import { ReactNode, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import useSWR from 'swr';

import { fetcher, unwrapList } from '@/lib/api';
import { strings } from '@/lib/strings';
import { FeedItem, Post, Review } from '@/types';
import FeedItemCard, { getFeedItemKey } from '@/components/feed/Feed';
import FeedSkeleton from '@/components/feed/FeedSkeleton';

type TabKey = 'activity' | 'reviews' | 'replies' | 'opinions' | 'portfolio';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'activity', label: strings.tabActivity },
  { key: 'reviews', label: strings.tabReviews },
  { key: 'replies', label: strings.tabReplies },
  { key: 'opinions', label: strings.tabOpinions },
  { key: 'portfolio', label: strings.tabPortfolio },
];

function byTimestampDesc<T extends { timestamp: string }>(a: T, b: T): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

interface ProfileTabsProps {
  username: string;
  header: ReactNode;
  bottomInset: number;
}

// Port of ProfileClient.tsx's tab strip + per-tab filtering of its own `userPosts`
// (GET /posts/?username= + GET /reviews/?username=, combined). This is one single
// top-level FlatList for the whole screen (header is ListHeaderComponent, items are the
// FlatList's data) rather than a FlatList nested inside the screen's ScrollView — RN
// warns against (and effectively breaks virtualization for) a VirtualizedList nested
// inside a same-orientation ScrollView, so the screen hands its entire "above the tabs"
// content to this component as `header` instead of wrapping it separately.
//
// Replies tab (decision 7): web merges fetched replies with any reply already visible in
// the live global feed context for instant feedback on a just-posted reply; mobile has
// no such shared feed context, so this only ever shows the fetched replies — same data
// once a refresh happens, just not live-updating the instant a reply is posted elsewhere.
export default function ProfileTabs({ username, header, bottomInset }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('activity');

  const { data: postsData, isLoading: postsLoading } = useSWR(`/posts/?username=${username}`, fetcher);
  const { data: reviewsData, isLoading: reviewsLoading } = useSWR(`/reviews/?username=${username}`, fetcher);
  const isLoading = postsLoading || reviewsLoading;

  const posts = useMemo<Post[]>(
    () => unwrapList<Post>(postsData).map((p) => ({ ...p, type: 'post' as const })),
    [postsData]
  );
  const reviews = useMemo<Review[]>(
    () => unwrapList<Review>(reviewsData).map((r) => ({ ...r, type: 'review' as const })),
    [reviewsData]
  );

  const items = useMemo<FeedItem[]>(() => {
    switch (activeTab) {
      case 'activity': {
        const rootPosts = posts.filter((p) => !p.parent && !p.review_parent);
        return [...rootPosts, ...reviews].sort(byTimestampDesc);
      }
      case 'reviews':
        return [...reviews].sort(byTimestampDesc);
      case 'replies':
        return posts.filter((p) => p.parent || p.review_parent).sort(byTimestampDesc);
      case 'opinions':
        return posts.filter((p) => p.news_parent || p.news_details).sort(byTimestampDesc);
      default:
        return [];
    }
  }, [posts, reviews, activeTab]);

  const emptyText: Record<TabKey, string> = {
    activity: strings.noActivityYet,
    reviews: strings.noReviewsYetProfile,
    replies: strings.noRepliesYetProfile,
    opinions: strings.noOpinionsYet,
    portfolio: strings.portfolioContentComingSoon,
  };

  // Memoized — without this, any unrelated re-render (e.g. the parent screen's
  // Followers/Following modal toggling) rebuilds a brand-new ListHeaderComponent/
  // renderItem each time, which forces the FlatList to reconcile every on-screen row.
  // That exact pattern measurably stalled the JS thread for ~700-900ms on the Library
  // screen's filter pickers earlier this phase; the fix there was the same shape as here.
  const tabBar = useMemo(
    () => (
      <View className="mb-6 border-b border-zinc-800">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-6 px-4">
            {TABS.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} className="pb-4">
                  <Text className={`text-base font-bold ${isActive ? 'text-white' : 'text-zinc-500'}`}>{tab.label}</Text>
                  {isActive && <View className="absolute bottom-0 left-0 h-1 w-full rounded-t-full bg-emerald-500" />}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    ),
    [activeTab]
  );

  const listHeader = useMemo(
    () => (
      <>
        {header}
        {tabBar}
      </>
    ),
    [header, tabBar]
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <View className="px-4">
        <FeedItemCard item={item} />
      </View>
    ),
    []
  );

  return (
    <FlatList
      data={activeTab === 'portfolio' ? [] : items}
      keyExtractor={getFeedItemKey}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        isLoading && activeTab !== 'portfolio' ? (
          <View className="px-4">
            <FeedSkeleton />
          </View>
        ) : (
          <View className="mx-4 items-center rounded-2xl border border-dashed border-zinc-800 py-12">
            <Text className="text-center text-zinc-500">{emptyText[activeTab]}</Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View className="h-4" />}
      contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
    />
  );
}
