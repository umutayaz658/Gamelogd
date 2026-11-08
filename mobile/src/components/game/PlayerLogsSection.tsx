import { Pressable, ScrollView, Text, View } from 'react-native';
import { MessageSquare } from 'lucide-react-native';

import { strings } from '@/lib/strings';

export const REVIEW_ORDER_FILTERS = [
  { id: '-likes_count', label: strings.filterPopular },
  { id: '-timestamp', label: strings.filterRecent },
  { id: '-rating', label: strings.filterHighest },
  { id: 'rating', label: strings.filterLowest },
];

interface PlayerLogsHeaderProps {
  order: string;
  onOrderChange: (order: string) => void;
}

// Port of GameDetailClient.tsx's "Player Logs" title + sort-filter row. This is only the
// header now — the review cards themselves moved into GameDetailScreen's own FlatList
// `data`/`renderItem` (see [id].tsx), because a plain `.map()` of ReviewCardReadOnly
// here mounted every review at once with no virtualization, and this section always
// used to sit inside the screen's outer ScrollView, which rules out giving it its own
// nested FlatList (RN disallows/breaks virtualization for a same-orientation
// VirtualizedList nested in a ScrollView) — same constraint ProfileTabs.tsx already
// solved by making the whole screen one top-level FlatList.
export default function PlayerLogsHeader({ order, onOrderChange }: PlayerLogsHeaderProps) {
  return (
    <View className="mb-8 gap-3 border-b border-zinc-800 px-4 pb-4">
      <View className="flex-row items-center gap-2">
        <MessageSquare size={22} color="#6366f1" />
        <Text className="text-2xl font-bold text-white">{strings.playerLogs}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {REVIEW_ORDER_FILTERS.map((filter) => {
            const isActive = order === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => onOrderChange(filter.id)}
                style={
                  isActive
                    ? {
                        backgroundColor: '#4f46e5',
                        shadowColor: '#4f46e5',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 15,
                        elevation: 8,
                      }
                    : { backgroundColor: 'rgba(39,39,42,0.5)' }
                }
                className="rounded-xl px-4 py-2"
              >
                <Text className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-zinc-400'}`}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
