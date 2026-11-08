import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CirclePlus, Pencil, Repeat } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Image } from '@/components/ui/Image';
import { getImageUrl, getRatingColor } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { GameDetail, Review } from '@/types';

interface GameDetailHeaderProps {
  game: GameDetail;
  myReview: Review | null;
  onPressLogGame: () => void;
  onPressLogReplay: () => void;
}

function Pill({ children }: { children: string }) {
  return (
    <View className="rounded-full border border-zinc-700/50 bg-zinc-900/80 px-3 py-1">
      <Text className="text-xs font-semibold tracking-wide text-zinc-300">{children}</Text>
    </View>
  );
}

// Port of GameDetailClient.tsx's hero section — mobile-width classes only (the base
// Tailwind classes; md:/lg:/sm: variants never apply at phone widths so are dropped
// entirely, matching what actually renders on web's own mobile view).
//
// Developer name chips are plain (non-pressable) here: web links them to
// /developer/[name], a Faz 6 screen that doesn't exist yet — same "render faithfully,
// wire later" treatment as other not-yet-built destinations this phase.
//
// The Log Game/Edit Log/Log Replay buttons open LogGameModal (step 13), owned by the
// parent screen along with the myReview fetch that decides which buttons show.
export default function GameDetailHeader({ game, myReview, onPressLogGame, onPressLogReplay }: GameDetailHeaderProps) {
  const coverUrl = getImageUrl(game.cover_image);
  const bannerUrl = game.screenshots && game.screenshots.length > 0 ? game.screenshots[0] : coverUrl;
  const developers = game.developer ? game.developer.split(',').map((d) => d.trim()) : [];
  const ratingColor = game.average_rating ? getRatingColor(game.average_rating) : '#71717a';
  // Matches GameDetailClient.tsx's avgRatingGlowClass thresholds/colors exactly — RN
  // Text's textShadow* (unlike View's shadow/elevation) renders a colored blur on both
  // iOS and Android, so this is a faithful port, not a platform-limited approximation.
  const ratingGlowColor = !game.average_rating
    ? 'transparent'
    : game.average_rating < 5.0
      ? 'rgba(239,68,68,0.6)'
      : game.average_rating < 8.0
        ? 'rgba(234,179,8,0.6)'
        : 'rgba(16,185,129,0.6)';

  return (
    <View className="mb-6">
      <View className="h-64 w-full overflow-hidden rounded-2xl">
        <Image source={{ uri: bannerUrl }} style={{ flex: 1 }} contentFit="cover" />
        <LinearGradient
          colors={['#09090b', 'rgba(9,9,11,0.2)', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <View className="px-4" style={{ marginTop: -96 }}>
        <View className="h-48 w-36 overflow-hidden rounded-xl border-4 border-zinc-950 bg-zinc-900">
          {game.cover_image ? (
            <Image source={{ uri: coverUrl }} style={{ flex: 1 }} contentFit="cover" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-xs font-medium text-zinc-500">{strings.noCover}</Text>
            </View>
          )}
        </View>

        <View className="mt-4">
          <Text className="mb-3 text-3xl font-black text-white">{game.title}</Text>

          <View className="mb-4 flex-row flex-wrap items-center gap-3">
            {game.release_date && <Pill>{String(new Date(game.release_date).getFullYear())}</Pill>}
            {developers.map((dev) => (
              <Pill key={dev}>{dev}</Pill>
            ))}
          </View>

          {!!game.genres?.length && (
            <View className="mb-4">
              <Text className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{strings.genres}</Text>
              <View className="flex-row flex-wrap gap-2">
                {game.genres.map((genre) => (
                  <View key={genre} className="rounded-md border border-zinc-700/50 bg-zinc-800/80 px-3 py-1">
                    <Text className="text-xs font-semibold tracking-wide text-zinc-300">{genre.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!!game.platforms?.length && (
            <View className="mb-6">
              <Text className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{strings.platforms}</Text>
              <View className="flex-row flex-wrap gap-2">
                {game.platforms.map((plat) => (
                  <View key={plat} className="rounded-md border border-zinc-700/50 bg-zinc-800/80 px-3 py-1">
                    <Text className="text-xs font-semibold tracking-wide text-zinc-300">{plat}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className="mt-4 gap-3">
            <View className="flex-row items-center gap-6">
              <Text
                style={{
                  color: ratingColor,
                  textShadowColor: ratingGlowColor,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 12,
                }}
                className="text-3xl font-black"
              >
                {'★'} {game.average_rating ? game.average_rating.toFixed(1) : '-'}
              </Text>
              <View className="gap-0.5 border-l border-zinc-700/80 pl-6">
                <Text className="text-xs font-medium text-zinc-300">
                  <Text className="font-bold text-white">{game.review_count || 0}</Text> {strings.reviews}
                </Text>
                <Text className="text-xs font-medium text-zinc-300">
                  <Text className="font-bold text-white">{game.log_count || 0}</Text> {strings.logs}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={onPressLogGame}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-6 py-2.5 ${myReview ? 'bg-blue-600' : 'bg-emerald-600'}`}
              >
                {myReview ? <Pencil size={16} color="#ffffff" /> : <CirclePlus size={16} color="#ffffff" />}
                <Text className="text-center text-sm font-bold text-white">{myReview ? strings.editLog : strings.logGame}</Text>
              </Pressable>
              {!!myReview && (
                <Pressable onPress={onPressLogReplay} className="flex-row items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5">
                  <Repeat size={16} color="#ffffff" />
                  <Text className="text-center text-sm font-bold text-white">{strings.logReplay}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
