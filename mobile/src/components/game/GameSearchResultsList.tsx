import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Calendar, Search } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import { getImageUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { Game } from '@/types';

interface GameSearchResultsListProps {
  query: string;
  setQuery: (q: string) => void;
  results: Game[];
  isLoading: boolean;
  onSelectGame: (game: Game) => void;
  placeholder?: string;
  emptyBeforeTypeText?: string;
  emptyAfterSearchText?: string;
}

function ResultRow({ game, onSelect }: { game: Game; onSelect: () => void }) {
  return (
    <Pressable onPress={onSelect} className="flex-row items-center gap-3 rounded-xl p-2 active:bg-zinc-800">
      <View className="h-16 w-12 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800">
        {game.cover_image ? (
          <Image source={{ uri: getImageUrl(game.cover_image) }} style={{ flex: 1 }} contentFit="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Search size={16} color="#52525b" />
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-bold text-zinc-200">
          {game.title}
        </Text>
        {!!game.release_date && (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Calendar size={12} color="#71717a" />
            <Text className="text-xs text-zinc-500">{new Date(game.release_date).getFullYear()}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// Pure presentational — takes useGameSearch()'s return values as props rather than
// calling the hook itself, so it can render either inside its own Modal
// (GameSearchModal) or directly inside an already-open Modal (LogGameModal step 1)
// without nesting Modals. Mirrors frontend/src/components/GameSearchModal.tsx's results
// list (cover thumb + title + release year, loading/empty/no-results states).
export default function GameSearchResultsList({
  query,
  setQuery,
  results,
  isLoading,
  onSelectGame,
  placeholder = strings.searchForAGame,
  emptyBeforeTypeText = strings.typeToSearchGames,
  emptyAfterSearchText = strings.noGamesFoundMatching,
}: GameSearchResultsListProps) {
  return (
    <View className="flex-1">
      <View className="border-b border-zinc-800 bg-zinc-900/50 p-4">
        <View className="flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950 px-3">
          <Search size={18} color="#71717a" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor="#71717a"
            autoFocus
            className="ml-2 flex-1 py-2.5 text-white"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="items-center justify-center py-12">
          <ActivityIndicator size="large" color="#10b981" />
          <Text className="mt-2 text-zinc-500">{strings.searching}</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(game) => String(game.id)}
          renderItem={({ item }) => <ResultRow game={item} onSelect={() => onSelectGame(item)} />}
          contentContainerStyle={{ padding: 8 }}
        />
      ) : query.trim().length > 1 ? (
        <View className="items-center justify-center py-12">
          <Search size={32} color="#71717a" style={{ opacity: 0.5 }} />
          <Text className="mt-2 text-zinc-500">{`${emptyAfterSearchText} "${query}"`}</Text>
        </View>
      ) : (
        <View className="items-center justify-center py-12">
          <Text className="text-zinc-600">{emptyBeforeTypeText}</Text>
        </View>
      )}
    </View>
  );
}
