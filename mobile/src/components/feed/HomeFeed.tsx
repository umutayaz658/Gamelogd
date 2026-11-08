import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import useSWR from 'swr';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

import { fetcher } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useBottomInset } from '@/context/BottomInsetContext';
import { strings } from '@/lib/strings';
import { FeedItem } from '@/types';
import FeedItemCard, { getFeedItemKey } from './Feed';
import FeedSkeleton from './FeedSkeleton';

// Read-only port of frontend/src/app/HomeClient.tsx's feed section (not the whole page —
// the surrounding chrome, sidebars, PostComposer are out of scope, see Faz 1 plan).
// Same SWR fetch, same for-you/following tabs, same loading/error/empty-following
// states. No pagination (the backend endpoint has none either) and no "who to follow"
// rail in the Following-empty state (that's a whole extra widget, deferred).
//
// Uses FlatList (not a plain `.map()` inside a ScrollView) so only on-screen cards are
// mounted — the tab strip and every loading/error/empty state render via
// ListHeaderComponent/ListEmptyComponent so they still scroll together with the list.
export default function HomeFeed() {
  const { user } = useAuth();
  const bottomInset = useBottomInset();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');

  const feedKey = activeTab === 'following' ? '/feed/following/' : '/feed/for-you/';
  const { data: posts, error, isLoading, mutate } = useSWR<FeedItem[]>(feedKey, fetcher);

  const showList = !isLoading && !error;
  const listData = showList ? posts ?? [] : [];

  const header = user ? (
    <View className="mb-6 flex-row border-b border-zinc-800">
      <Pressable onPress={() => setActiveTab('for-you')} className="flex-1 items-center py-3">
        <Text className={`text-sm font-bold ${activeTab === 'for-you' && !error ? 'text-white' : 'text-zinc-500'}`}>
          {strings.forYou}
        </Text>
        {activeTab === 'for-you' && !error && <View className="absolute bottom-0 h-1 w-12 rounded-full bg-emerald-500" />}
      </Pressable>
      <Pressable onPress={() => setActiveTab('following')} className="flex-1 items-center py-3">
        <Text className={`text-sm font-bold ${activeTab === 'following' && !error ? 'text-white' : 'text-zinc-500'}`}>
          {strings.following}
        </Text>
        {activeTab === 'following' && !error && <View className="absolute bottom-0 h-1 w-12 rounded-full bg-emerald-500" />}
      </Pressable>
    </View>
  ) : (
    <View className="mb-6 border-b border-zinc-800 py-3">
      <Text className="text-sm font-bold text-zinc-400">{strings.exploreFeed}</Text>
    </View>
  );

  const empty =
    isLoading && !posts ? (
      <FeedSkeleton />
    ) : error ? (
      <View className="my-6 items-center rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-8">
        <View className="mb-4 rounded-full border border-red-500/20 bg-red-500/10 p-4">
          <AlertTriangle size={32} color="#ef4444" />
        </View>
        <Text className="mb-2 text-xl font-bold text-white">{strings.somethingWentWrong}</Text>
        <Text className="mb-6 max-w-xs text-center text-sm leading-relaxed text-zinc-400">
          {strings.failedToLoadFeed}
        </Text>
        <Pressable onPress={() => mutate()} className="flex-row items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5">
          <RefreshCw size={16} color="#ffffff" />
          <Text className="font-semibold text-white">{strings.tryAgain}</Text>
        </Pressable>
      </View>
    ) : activeTab === 'following' ? (
      <View className="items-center py-6">
        <Text className="mb-1 text-lg font-bold text-white">{strings.notFollowingAnyoneYet}</Text>
        <Text className="text-sm text-zinc-500">{strings.notFollowingAnyoneYetSubtitle}</Text>
      </View>
    ) : (
      <View className="items-center py-10">
        <Text className="text-zinc-500">{strings.noActivityYet}</Text>
      </View>
    );

  return (
    <FlatList
      data={listData}
      keyExtractor={getFeedItemKey}
      renderItem={({ item }) => <FeedItemCard item={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={() => <View className="h-4" />}
      contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 16 }}
    />
  );
}
