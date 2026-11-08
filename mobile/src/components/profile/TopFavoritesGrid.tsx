import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Plus, Trophy } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import GameSearchModal from '@/components/game/GameSearchModal';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { getImageUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { Game, TopFavoriteSlot, User } from '@/types';

interface TopFavoritesGridProps {
  profileUser: User;
  isOwnProfile: boolean;
  onUpdate: (patch: Partial<User>) => void;
}

// Port of ProfileClient.tsx's "Top 4 Showcase". Unlike web, this derives the 4 slots
// directly from profileUser.top_favorites on every render instead of syncing into local
// state via an effect (web's loadedGames useEffect) — fewer moving parts, and avoids the
// react-hooks/set-state-in-effect pattern already worked around elsewhere this phase.
//
// Web's pencil/clear-slot icons on a filled slot are hover-only
// (`opacity-0 group-hover:opacity-100`), and the user confirmed web's own mobile view
// never reveals them either (no :hover on touch) — so, per their explicit choice, this
// mobile port never shows them either. Tapping a filled slot (own profile only) just
// reopens GameSearchModal to replace the game; there is no separate "clear slot" control,
// matching web mobile's real (if awkward) behavior exactly.
const GRID_PADDING = 16; // matches px-4 on the grid's own wrapper
const GAP = 16;

export default function TopFavoritesGrid({ profileUser, isOwnProfile, onUpdate }: TopFavoritesGridProps) {
  const toast = useToast();
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const { width: windowWidth } = useWindowDimensions();

  // Explicit pixel dimensions rather than `aspectRatio` + percentage width: that
  // combination left empty slots (no intrinsic content to force a size) rendering
  // small/square until something changed their content and forced a Yoga re-layout —
  // the same class of RN layout quirk already worked around elsewhere this phase
  // (the -bottom/-right badge, the max-h-[60%] modal body).
  const slotWidth = (windowWidth - GRID_PADDING * 2 - GAP) / 2;
  const slotHeight = (slotWidth * 4) / 3;

  const slots: (TopFavoriteSlot | null)[] = [0, 1, 2, 3].map(
    (slot) => profileUser.top_favorites?.find((f) => f.slot === slot) ?? null
  );

  const handleSelectGame = async (game: Game) => {
    if (activeSlotIndex === null) return;
    const slot = activeSlotIndex;
    setActiveSlotIndex(null);
    const previous = profileUser.top_favorites || [];
    const newFavorites = previous
      .filter((f) => f.slot !== slot)
      .concat([{ slot, game_id: game.id, title: game.title, cover: getImageUrl(game.cover_image) }])
      .sort((a, b) => a.slot - b.slot);

    onUpdate({ top_favorites: newFavorites });
    try {
      await api.patch('/users/me/', { top_favorites: newFavorites });
    } catch (error) {
      console.error('Failed to save favorite slot:', error);
      onUpdate({ top_favorites: previous });
      toast.error(strings.failedToSaveFavorites);
    }
  };

  return (
    <View className="mb-8 mt-6 px-4">
      <View className="mb-4 flex-row items-center gap-2">
        <Trophy size={16} color="#f59e0b" />
        <Text className="text-sm font-bold uppercase tracking-wider text-zinc-400">{strings.allTimeFavorites}</Text>
      </View>
      <View className="flex-row flex-wrap" style={{ gap: 16 }}>
        {slots.map((game, index) => (
          <Pressable
            key={index}
            onPress={() => isOwnProfile && setActiveSlotIndex(index)}
            disabled={!isOwnProfile}
            style={{ width: slotWidth, height: slotHeight }}
            className={`items-center justify-center overflow-hidden rounded-xl border bg-zinc-900 ${
              game ? 'border-zinc-800' : 'border-dashed border-zinc-700'
            }`}
          >
            {game ? (
              <Image source={{ uri: getImageUrl(game.cover) }} style={{ flex: 1, width: '100%' }} contentFit="cover" />
            ) : (
              <View className="items-center gap-2">
                {isOwnProfile ? (
                  <>
                    <Plus size={32} color="#52525b" />
                    <Text className="text-xs font-bold uppercase text-zinc-600">{strings.addGame}</Text>
                  </>
                ) : (
                  <Text className="text-xs font-bold uppercase text-zinc-700">{strings.emptySlot}</Text>
                )}
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <GameSearchModal visible={activeSlotIndex !== null} onClose={() => setActiveSlotIndex(null)} onSelectGame={handleSelectGame} />
    </View>
  );
}
