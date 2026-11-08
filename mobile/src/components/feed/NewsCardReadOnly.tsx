import { Text, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import { News } from '@/types';

interface NewsCardReadOnlyProps {
  news: News;
}

// Read-only port of the inline news-card markup in frontend/src/components/Feed.tsx.
// Web stacks image-above-content on mobile (flex-col, sm:flex-row only at desktop
// widths) — matched here. Inert: no navigation to the news detail screen (Phase 6).
export default function NewsCardReadOnly({ news }: NewsCardReadOnlyProps) {
  const description = news.description ? news.description.replace(/<[^>]*>/g, '').replace('...', '') : '';

  return (
    <View className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      {!!news.image_url && <Image source={{ uri: news.image_url }} className="h-32 w-full" contentFit="cover" />}
      <View className="flex-1 justify-between p-4">
        <View>
          <View className="mb-2 flex-row items-center gap-2">
            {!!news.source_icon && <Image source={{ uri: news.source_icon }} className="h-4 w-4 rounded-full" />}
            <Text className="text-xs font-medium text-zinc-300">{news.source_name}</Text>
            <Text className="text-xs text-zinc-500">• {new Date(news.pub_date).toLocaleDateString()}</Text>
          </View>
          <Text numberOfLines={2} className="mb-2 text-base font-bold leading-snug text-white">
            {news.title}
          </Text>
          {!!description && (
            <Text numberOfLines={2} className="mb-3 text-xs text-zinc-400">
              {description}
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between">
          <View className="rounded border border-emerald-500/20 bg-emerald-950/55 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">
              {news.category || 'News'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-xs font-medium text-emerald-500">Read</Text>
            <ExternalLink size={12} color="#10b981" />
          </View>
        </View>
      </View>
    </View>
  );
}
