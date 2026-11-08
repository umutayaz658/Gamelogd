import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bookmark, Check, EyeOff, Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import { Review } from '@/types';
import { formatCount, formatHandle, getAbsoluteDateTime, getImageUrl, getRatingColor, getRelativeTime } from '@/lib/utils';
import { strings } from '@/lib/strings';
import StarRating from './StarRating';

interface ReviewCardReadOnlyProps {
  review: Review;
  showAbsoluteTimestamp?: boolean;
  repostedBy?: { name: string };
}

function PlaythroughOrdinal(n: number): string {
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// Read-only port of frontend/src/components/ReviewCard.tsx — full visual parity (avatar,
// game cover, proportional star rating, platforms/badges rows, comment). Every action
// (reply/repost/like/share/bookmark) is still inert (Faz 1 decision 4), but Faz 2
// decision 1 now wires the author avatar+name/handle to /<username> and the game
// cover+title to /games/<id>. Spoiler content stays permanently blurred — no toggle is
// wired up, and defaulting to *visible* would leak spoiler content, the opposite of the
// bug this same component's logic was written to prevent on web.
export default function ReviewCardReadOnly({ review, showAbsoluteTimestamp, repostedBy }: ReviewCardReadOnlyProps) {
  const ratingColor = getRatingColor(Number(review.rating));

  return (
    <View className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      {repostedBy && (
        <View className="mb-2 flex-row items-center gap-2 pl-12">
          <Repeat2 size={14} color="#71717a" />
          <Text className="text-xs font-bold text-zinc-500">{repostedBy.name} reposted</Text>
        </View>
      )}

      <View className="flex-row gap-4">
        <Pressable onPress={() => router.push(`/${review.user.username}` as never)}>
          <Image
            source={{ uri: getImageUrl(review.user.avatar, review.user.real_name || review.user.username) }}
            className="h-10 w-10 rounded-full bg-zinc-800"
          />
        </Pressable>

        <View className="flex-1">
          <Pressable
            onPress={() => router.push(`/${review.user.username}` as never)}
            className="mb-2 flex-row items-center gap-1.5"
          >
            <Text numberOfLines={1} className="shrink font-bold text-white">
              {review.user.real_name || review.user.username}
            </Text>
            <Text numberOfLines={1} className="shrink text-sm text-zinc-500">
              {formatHandle(review.user.username.toLowerCase())}
            </Text>
            <Text className="text-sm text-zinc-700">•</Text>
            <Text className="flex-shrink-0 text-sm text-zinc-500">
              {showAbsoluteTimestamp ? getAbsoluteDateTime(review.timestamp) : getRelativeTime(review.timestamp)}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push(`/games/${review.game.id}` as never)} className="mb-3 flex-row gap-4">
            <View className="h-24 w-16 overflow-hidden rounded-md bg-zinc-800">
              {review.game.cover_image && (
                <Image source={{ uri: getImageUrl(review.game.cover_image) }} className="h-full w-full" contentFit="cover" />
              )}
            </View>

            <View className="flex-1">
              <Text numberOfLines={1} className="mb-1 text-lg font-bold leading-tight text-white">
                {review.game.title}
              </Text>

              <View className="mb-2 flex-row flex-wrap items-center gap-1">
                <View className="flex-row items-center gap-1">
                  <StarRating rating={Number(review.rating)} color={ratingColor} />
                  <Text style={{ color: ratingColor }} className="text-sm font-bold">
                    {Number(review.rating).toFixed(1)}
                  </Text>
                </View>
                {review.playtime_hours != null && review.playtime_hours > 0 && (
                  <Text className="text-sm font-medium text-zinc-500">
                    {Number.isInteger(review.playtime_hours) ? review.playtime_hours : review.playtime_hours.toFixed(1)}h
                  </Text>
                )}
              </View>

              {review.platforms && review.platforms.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                  <View className="flex-row gap-2">
                    {review.platforms.map((platform) => (
                      <View key={platform} className="rounded border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5">
                        <Text className="text-xs font-bold text-zinc-400">{platform}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {!!review.playthrough_number && review.playthrough_number > 1 && (
                    <View className="flex-row items-center gap-1 rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5">
                      <Text className="text-xs font-bold text-purple-400">
                        {PlaythroughOrdinal(review.playthrough_number)} {strings.playthrough}
                      </Text>
                    </View>
                  )}
                  {review.is_liked && (
                    <View className="flex-row items-center gap-1 rounded border border-pink-500/20 bg-pink-500/10 px-2 py-0.5">
                      <Heart size={12} color="#ec4899" fill="#ec4899" />
                      <Text className="text-xs font-bold text-pink-500">{strings.liked}</Text>
                    </View>
                  )}
                  {review.is_completed && (
                    <View className="flex-row items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5">
                      <Check size={12} color="#10b981" />
                      <Text className="text-xs font-bold text-emerald-500">{strings.completed}</Text>
                    </View>
                  )}
                  {review.contains_spoilers && (
                    <View className="flex-row items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5">
                      <EyeOff size={12} color="#f59e0b" />
                      <Text className="text-xs font-bold text-amber-500">{strings.spoilers}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </Pressable>

          {review.contains_spoilers ? (
            // RN's <Text> has no CSS-style blur filter (unlike web's blur-sm) and no
            // toggle is wired up in Phase 1 (decision 4) — showing a placeholder instead
            // of the real content is the safe choice; defaulting to *visible* would leak
            // spoilers, the exact bug this logic exists to prevent on web.
            <Text className="mb-3 italic leading-relaxed text-zinc-500">Contains spoilers — hidden.</Text>
          ) : !!review.content && (
            <Text className="mb-3 leading-relaxed text-zinc-300">{review.content}</Text>
          )}

          <View className="flex-row items-center justify-between border-t border-zinc-800/50 pt-3">
            <View className="flex-1 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <MessageCircle size={16} color="#71717a" />
                <Text className="text-sm text-zinc-500">{formatCount(review.replies_count || 0)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Repeat2 size={16} color="#71717a" />
                <Text className="text-sm text-zinc-500">{formatCount(review.reposts_count || 0)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Heart size={16} color="#71717a" />
                <Text className="text-sm text-zinc-500">{formatCount(review.likes_count || 0)}</Text>
              </View>
              <Share2 size={16} color="#71717a" />
            </View>
            <Bookmark size={16} color="#71717a" style={{ marginLeft: 4 }} />
          </View>
        </View>
      </View>
    </View>
  );
}
