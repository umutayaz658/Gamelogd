import { ComponentRef, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import { strings } from '@/lib/strings';

interface ScreenshotsCarouselProps {
  screenshots: string[];
}

// Port of GameDetailClient.tsx's screenshot carousel. Web continuously interpolates
// scale/opacity while dragging; this snaps and updates the active index only once
// momentum scrolling ends (RN has no cheap per-frame scroll-position readout here) — the
// resting state (one scaled-up/full-opacity item, others dimmed) matches exactly, only
// the mid-drag animation is simplified. The web's arrows are visible (not hover-gated) on
// its own mobile view too, so they're always-rendered here as well.
export default function ScreenshotsCarousel({ screenshots }: ScreenshotsCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const ITEM_WIDTH = windowWidth * 0.85;
  const GAP = 16;
  const SIDE_PADDING = windowWidth * 0.075;
  const SNAP_INTERVAL = ITEM_WIDTH + GAP;

  if (!screenshots.length) return null;

  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= screenshots.length) return;
    scrollRef.current?.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
    setActiveIndex(index);
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveIndex(Math.max(0, Math.min(screenshots.length - 1, index)));
  };

  return (
    <View className="mb-16">
      <View className="mb-6 flex-row items-center gap-2 px-4">
        <ImageIcon size={22} color="#6366f1" />
        <Text className="text-2xl font-bold text-white">{strings.screenshots}</Text>
      </View>

      <View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, gap: GAP }}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {screenshots.map((url, index) => {
            const isActive = index === activeIndex;
            return (
              <Pressable
                key={index}
                onPress={() => scrollToIndex(index)}
                style={{
                  width: ITEM_WIDTH,
                  aspectRatio: 16 / 9,
                  opacity: isActive ? 1 : 0.4,
                  transform: [{ scale: isActive ? 1 : 0.95 }],
                  borderRadius: 16,
                  overflow: 'hidden',
                  borderWidth: isActive ? 1 : 0,
                  borderColor: 'rgba(99,102,241,0.5)',
                }}
              >
                <Image source={{ uri: url }} style={{ flex: 1 }} contentFit="cover" />
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => scrollToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            marginTop: -22,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: 12,
            opacity: activeIndex === 0 ? 0 : 0.6,
          }}
        >
          <ChevronLeft size={24} color="#ffffff" />
        </Pressable>
        <Pressable
          onPress={() => scrollToIndex(activeIndex + 1)}
          disabled={activeIndex === screenshots.length - 1}
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            marginTop: -22,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: 12,
            opacity: activeIndex === screenshots.length - 1 ? 0 : 0.6,
          }}
        >
          <ChevronRight size={24} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}
