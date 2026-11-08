import { Text, View, ViewStyle } from 'react-native';
import { Play } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';

export interface GridMediaItem {
  url: string;
  type?: 'image' | 'video';
}

interface PostMediaGridProps {
  items: GridMediaItem[];
  compact?: boolean;
}

// Simplified port of frontend/src/components/PostMediaGrid.tsx's 1/2/3/4+ layout logic.
// One flagged simplification: video items show a static poster + play-icon overlay
// instead of actual playback — adding real video support (expo-video) for this one spot
// is out of scope for Phase 1's read-only feed (decision 4: cards are visual-only, no
// interactive media playback either way).
function MediaCell({ item, style }: { item: GridMediaItem; style: ViewStyle }) {
  return (
    <View style={style} className="relative bg-black">
      <Image source={{ uri: item.url }} style={{ flex: 1 }} contentFit="cover" />
      {item.type === 'video' && (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-black/60">
            <Play size={18} color="#ffffff" fill="#ffffff" />
          </View>
        </View>
      )}
    </View>
  );
}

export default function PostMediaGrid({ items, compact = false }: PostMediaGridProps) {
  if (items.length === 0) return null;

  if (items.length === 1) {
    const height = compact ? 240 : 340;
    return (
      <View style={{ height }} className="overflow-hidden rounded-xl border border-zinc-800">
        <MediaCell item={items[0]} style={{ flex: 1 }} />
      </View>
    );
  }

  const visible = items.slice(0, 4);
  const count = visible.length;
  const height = compact ? 180 : 240;

  if (count === 2) {
    return (
      <View style={{ height }} className="flex-row gap-0.5 overflow-hidden rounded-xl border border-zinc-800">
        {visible.map((item, i) => (
          <MediaCell key={i} item={item} style={{ flex: 1 }} />
        ))}
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={{ height }} className="flex-row gap-0.5 overflow-hidden rounded-xl border border-zinc-800">
        <MediaCell item={visible[0]} style={{ flex: 1 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <MediaCell item={visible[1]} style={{ flex: 1 }} />
          <MediaCell item={visible[2]} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ height }} className="gap-0.5 overflow-hidden rounded-xl border border-zinc-800">
      <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
        <MediaCell item={visible[0]} style={{ flex: 1 }} />
        <MediaCell item={visible[1]} style={{ flex: 1 }} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
        <MediaCell item={visible[2]} style={{ flex: 1 }} />
        <View style={{ flex: 1 }}>
          <MediaCell item={visible[3]} style={{ flex: 1 }} />
          {items.length > 4 && (
            <View className="absolute inset-0 items-center justify-center bg-black/60">
              <Text className="text-xl font-bold text-white">+{items.length - 4}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
