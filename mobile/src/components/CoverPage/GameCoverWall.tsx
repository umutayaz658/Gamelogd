import { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { Image } from '@/components/ui/Image';

interface CoverImage {
  id: number;
  cover_image: string;
}

// Same curated, hand-picked list as frontend/src/components/GameCoverWall.tsx (kept
// short here — full 27-title list ported verbatim from the web source).
const CURATED_COVERS: CoverImage[] = [
  { id: 271590, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/271590/library_600x900.jpg' },
  { id: 1245620, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900.jpg' },
  { id: 1086940, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1086940/library_600x900.jpg' },
  { id: 1817070, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1817070/library_600x900.jpg' },
  { id: 489830, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/489830/library_600x900.jpg' },
  { id: 289070, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/289070/library_600x900.jpg' },
  { id: 1174180, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1174180/library_600x900.jpg' },
  { id: 292030, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/library_600x900.jpg' },
  { id: 1091500, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg' },
  { id: 1593500, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1593500/library_600x900.jpg' },
  { id: 990080, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/990080/library_600x900.jpg' },
  { id: 208650, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/208650/library_600x900.jpg' },
  { id: 1659420, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1659420/library_600x900.jpg' },
  { id: 367520, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900.jpg' },
  { id: 413150, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/413150/library_600x900.jpg' },
  { id: 620, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/620/library_600x900.jpg' },
  { id: 546560, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/546560/library_600x900.jpg' },
  { id: 374320, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/374320/library_600x900.jpg' },
  { id: 814380, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/814380/library_600x900.jpg' },
  { id: 2050650, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/2050650/library_600x900.jpg' },
  { id: 1151640, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1151640/library_600x900.jpg' },
  { id: 1190460, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1190460/library_600x900.jpg' },
  { id: 782330, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/782330/library_600x900.jpg' },
  { id: 1551360, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1551360/library_600x900.jpg' },
  { id: 1426210, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1426210/library_600x900.jpg' },
  { id: 435150, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/435150/library_600x900.jpg' },
  { id: 730, cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/730/library_600x900.jpg' },
];

const TILES_PER_COLUMN = 10;
const TILE_HEIGHT = 160;
const TILE_WIDTH = 112;
const GOLDEN_RATIO_CONJUGATE = 0.6180339887;
// Web only reveals its first 4 columns at mobile widths (the rest are `hidden sm:flex`/
// `hidden lg:flex`) — so 4 is full parity here, not a cut-down simplification.
const COLUMN_COUNT = 4;

function buildColumn(offset: number): CoverImage[] {
  const n = CURATED_COVERS.length;
  const start = offset % n;
  const rotated = [...CURATED_COVERS.slice(start), ...CURATED_COVERS.slice(0, start)];
  const list: CoverImage[] = [];
  while (list.length < TILES_PER_COLUMN) {
    list.push(...rotated);
  }
  list.length = TILES_PER_COLUMN;
  // Duplicated once so a seamless-loop translateY animation works (see Column below).
  return [...list, ...list];
}

function Column({ index }: { index: number }) {
  const offset = Math.floor(index * CURATED_COVERS.length * GOLDEN_RATIO_CONJUGATE);
  const tiles = buildColumn(offset);
  const halfHeight = TILES_PER_COLUMN * (TILE_HEIGHT + 12);
  const reverse = index % 2 !== 0;
  const duration = (40 + index * 8) * 1000;

  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = reverse ? -halfHeight : 0;
    translateY.value = withRepeat(
      withTiming(reverse ? 0 : -halfHeight, { duration, easing: Easing.linear }),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <View style={{ width: TILE_WIDTH, overflow: 'hidden', height: '100%' }}>
      <Animated.View style={animatedStyle}>
        {tiles.map((cover, idx) => (
          <Image
            key={`${cover.id}-${idx}`}
            source={{ uri: cover.cover_image }}
            style={{ width: TILE_WIDTH, height: TILE_HEIGHT, marginBottom: 12, borderRadius: 6 }}
            contentFit="cover"
          />
        ))}
      </Animated.View>
    </View>
  );
}

// Simplified port of frontend/src/components/GameCoverWall.tsx — web only shows 4
// columns at mobile widths anyway, so this is full parity for that breakpoint, not a
// cut-down version. One flagged deviation: no 2px blur filter (RN has no CSS-style blur
// without an extra library like expo-blur, not pulled in for this one decorative
// background) — covers render crisp instead of softly blurred.
export default function GameCoverWall() {
  const screenWidth = Dimensions.get('window').width;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', inset: 0, flexDirection: 'row', gap: 12, padding: 16 }}>
        {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
          <Column key={i} index={i} />
        ))}
      </View>

      {/* Overlay gradients — approximated with flat semi-transparent layers (web uses a
          CSS gradient for the top/bottom fade; RN has no gradient primitive without
          react-native-linear-gradient/expo-linear-gradient, not pulled in for this one
          spot) so the wall reads as a dim background behind the cover-page content. */}
      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(9,9,11,0.7)' }} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: screenWidth * 0.3, backgroundColor: 'rgba(9,9,11,0.5)' }} />
    </View>
  );
}
