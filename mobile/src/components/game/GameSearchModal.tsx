import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import GameSearchResultsList from './GameSearchResultsList';
import { useGameSearch } from '@/lib/hooks/useGameSearch';
import { strings } from '@/lib/strings';
import { Game } from '@/types';

interface GameSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGame: (game: Game) => void;
}

// Port of frontend/src/components/GameSearchModal.tsx — thin Modal wrapper around the
// shared GameSearchResultsList/useGameSearch (Faz 2 plan decision 9). Used by
// TopFavoritesGrid's empty-slot picker.
export default function GameSearchModal({ visible, onClose, onSelectGame }: GameSearchModalProps) {
  const { query, setQuery, results, isLoading } = useGameSearch();

  // A Modal's `visible` prop hides it without unmounting, so local hook state would
  // otherwise persist across opens (unlike web's `if (!isOpen) return null`, which
  // remounts fresh each time) — reset the query when this modal is opened again.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setQuery('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/80 p-4">
        <View style={{ height: '70%' }} className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <View className="flex-row items-center justify-between border-b border-zinc-800 p-4">
            <Text className="text-lg font-bold text-white">{strings.selectFavoriteGame}</Text>
            <Pressable onPress={onClose} hitSlop={8} className="rounded-full p-2">
              <X size={20} color="#a1a1aa" />
            </Pressable>
          </View>
          <GameSearchResultsList
            query={query}
            setQuery={setQuery}
            results={results}
            isLoading={isLoading}
            onSelectGame={(game) => {
              onSelectGame(game);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
