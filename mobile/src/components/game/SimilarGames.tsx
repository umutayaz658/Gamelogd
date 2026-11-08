import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Shapes } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Image } from '@/components/ui/Image';
import api, { unwrapList } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { Game } from '@/types';

interface SimilarGamesProps {
  currentId: number;
  genres?: string[];
}

interface ScoredGame extends Game {
  _matchScore?: number;
  average_rating?: number;
}

const GRID_PADDING = 16;
const GAP = 16;

// Port of frontend/src/components/SimilarGames.tsx — same client-side "fetch all games,
// score by genre-match count, fall back to average_rating" logic (the plain /games/ list
// endpoint never actually returns average_rating, so that fallback is a no-op on web
// too — porting it as-is rather than silently fixing a pre-existing web quirk).
//
// Grid dimensions use explicit pixel width/height (not aspectRatio + percentage) — the
// same Yoga quirk already worked around in TopFavoritesGrid.
export default function SimilarGames({ currentId, genres }: SimilarGamesProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/games/');
        let results: ScoredGame[] = unwrapList(data);
        results = results.filter((g) => g.id !== currentId);

        if (genres && genres.length > 0) {
          results.forEach((g) => {
            const gameGenres = g.genres || [];
            g._matchScore = gameGenres.filter((genre) => genres.includes(genre)).length;
          });
          results.sort((a, b) => {
            if ((b._matchScore || 0) !== (a._matchScore || 0)) return (b._matchScore || 0) - (a._matchScore || 0);
            return (b.average_rating || 0) - (a.average_rating || 0);
          });
        }

        if (active) setGames(results.slice(0, 6));
      } catch (err) {
        console.error('Failed to fetch similar games:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentId, genres]);

  if (loading || games.length === 0) return null;

  const slotWidth = (windowWidth - GRID_PADDING * 2 - GAP) / 2;
  const slotHeight = (slotWidth * 4) / 3;

  return (
    <View className="mb-16 mt-16 border-t border-zinc-800/50 px-4 pt-12">
      <View className="mb-6 flex-row items-center gap-2">
        <Shapes size={22} color="#6366f1" />
        <Text className="text-2xl font-bold text-white">{strings.similarGames}</Text>
      </View>
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {games.map((game) => (
          <Pressable
            key={game.id}
            onPress={() => router.push(`/games/${game.id}` as never)}
            style={{ width: slotWidth, height: slotHeight, borderRadius: 16, overflow: 'hidden' }}
            className="bg-zinc-900"
          >
            {game.cover_image ? (
              <Image source={{ uri: getImageUrl(game.cover_image) }} style={{ flex: 1 }} contentFit="cover" />
            ) : (
              <View className="flex-1 items-center justify-center bg-zinc-800">
                <Text className="font-medium text-zinc-600">{strings.noCover}</Text>
              </View>
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.4)', 'transparent']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, transform: [{ translateY: 16 }] }}>
              <Text numberOfLines={2} className="text-sm font-bold leading-tight text-white">
                {game.title}
              </Text>
              {game.release_date && (
                <Text className="text-xs font-semibold text-zinc-400">{new Date(game.release_date).getFullYear()}</Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
