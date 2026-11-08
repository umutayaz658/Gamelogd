import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import useSWR from 'swr';

import { fetcher, unwrapList } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useBottomInset } from '@/context/BottomInsetContext';
import { strings } from '@/lib/strings';
import { GameDetail, Review } from '@/types';
import GameDetailHeader from '@/components/game/GameDetailHeader';
import ScreenshotsCarousel from '@/components/game/ScreenshotsCarousel';
import GameStatsSection from '@/components/game/GameStatsSection';
import SimilarGames from '@/components/game/SimilarGames';
import PlayerLogsHeader, { REVIEW_ORDER_FILTERS } from '@/components/game/PlayerLogsSection';
import ReviewCardReadOnly from '@/components/feed/ReviewCardReadOnly';
import LogGameModal from '@/components/game/LogGameModal';

// Same character-count heuristic as ProfileHeader's bio show-more (web measures DOM
// scrollHeight against a 5-line clamp; RN has no equivalent, so this is an approximation
// — flagged simplification, not pixel-exact about which descriptions qualify).
const DESC_SHOW_MORE_THRESHOLD = 240;

// Step 11 (core) + step 12 (Similar Games) + step 13 (LogGameModal wiring) + step 14
// (Player Logs). One top-level FlatList for the whole screen (same reasoning as
// ProfileTabs.tsx) — everything above the Player Logs list is ListHeaderComponent, the
// reviews themselves are the FlatList's data, so a game with many reviews doesn't mount
// them all into a plain ScrollView at once.
export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: viewer } = useAuth();
  const bottomInset = useBottomInset();
  const [descExpanded, setDescExpanded] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logIsReplay, setLogIsReplay] = useState(false);
  const [order, setOrder] = useState(REVIEW_ORDER_FILTERS[0].id);
  const { data: game, error, isLoading, mutate } = useSWR<GameDetail>(id ? `/games/${id}/details/` : null, fetcher);

  const myReviewKey = id && viewer ? `/reviews/?game_id=${id}&username=${viewer.username}` : null;
  const { data: myReviewData, mutate: mutateMyReview } = useSWR<Review[] | { results: Review[] }>(myReviewKey, fetcher);
  const myReview = myReviewData ? unwrapList(myReviewData)[0] ?? null : null;

  const reviewsKey = id ? `/reviews/?game_id=${id}&ordering=${order}` : null;
  const { data: reviewsData, isLoading: reviewsLoading, mutate: mutateReviews } = useSWR<Review[] | { results: Review[] }>(
    reviewsKey,
    fetcher
  );
  const reviews = unwrapList<Review>(reviewsData);

  const handleLogSuccess = useCallback(() => {
    mutate();
    mutateMyReview();
    mutateReviews();
  }, [mutate, mutateMyReview, mutateReviews]);

  const renderReview = useCallback(
    ({ item }: { item: Review }) => (
      <View className="px-4">
        <ReviewCardReadOnly review={item} />
      </View>
    ),
    []
  );

  const header = useMemo(() => {
    if (!game) return undefined;
    const description = game.summary || game.description || strings.noDescriptionAvailable;
    const showDescToggle = description.length > DESC_SHOW_MORE_THRESHOLD;
    return (
      <>
        <GameDetailHeader
          game={game}
          myReview={myReview}
          onPressLogGame={() => {
            setLogIsReplay(false);
            setLogModalVisible(true);
          }}
          onPressLogReplay={() => {
            setLogIsReplay(true);
            setLogModalVisible(true);
          }}
        />

        <View className="mb-12 px-4">
          <Text numberOfLines={descExpanded ? undefined : 5} className="text-lg font-medium leading-relaxed text-zinc-300">
            {description}
          </Text>
          {showDescToggle && (
            <Pressable onPress={() => setDescExpanded((v) => !v)} className="mt-2">
              <Text className="text-xs font-semibold text-emerald-500">
                {descExpanded ? strings.showLess : `${strings.showMore}...`}
              </Text>
            </Pressable>
          )}
        </View>

        {!!game.screenshots?.length && <ScreenshotsCarousel screenshots={game.screenshots} />}

        <GameStatsSection game={game} />

        <SimilarGames currentId={game.id} genres={game.genres} />

        <PlayerLogsHeader order={order} onOrderChange={setOrder} />
      </>
    );
  }, [game, myReview, descExpanded, order]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-950">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (error || !game) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-zinc-950 p-4">
        <Text className="text-center text-zinc-400">{strings.gameRemovedOrNotExist}</Text>
        <Pressable onPress={() => router.replace('/')} className="rounded-full bg-emerald-600 px-6 py-2">
          <Text className="text-center text-sm font-bold text-white">{strings.goBackHome}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <FlatList
        data={reviews}
        keyExtractor={(review) => String(review.id)}
        renderItem={renderReview}
        ListHeaderComponent={header}
        ListEmptyComponent={
          reviewsLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="small" color="#6366f1" />
            </View>
          ) : (
            <View className="mx-4 items-center rounded-2xl border border-dashed border-zinc-800/50 bg-zinc-900/50 py-16">
              <Text className="mb-3 text-4xl">🎮</Text>
              <Text className="mb-1 text-lg font-bold text-zinc-300">{strings.noLogsYet}</Text>
              <Text className="text-zinc-500">{strings.beFirstToLogGame}</Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-4" />}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
      />

      <LogGameModal
        visible={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        onSuccess={handleLogSuccess}
        initialGame={game}
        existingReview={logIsReplay ? null : myReview}
        isReplay={logIsReplay}
      />
    </View>
  );
}
