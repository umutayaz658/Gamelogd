import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Polygon, Rect } from 'react-native-svg';

const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';

// The star polygon's own leftmost/rightmost points sit at x=2/x=22 (not 0/24 — the
// viewBox's edges are just padding), so clipping from x=0 wastes part of the fill
// percentage on empty space. Ported from ReviewCard.tsx's own fix for this exact bug.
const STAR_X_OFFSET = 2;
const STAR_X_SPAN = 20;

export default function StarRating({ rating, color, size = 16 }: { rating: number; color: string; size?: number }) {
  return (
    <View className="flex-row gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const ratingVal = rating / 2;
        const fillPercentage = Math.max(0, Math.min(100, (ratingVal - i) * 100));
        const absoluteWidth = STAR_X_OFFSET + (fillPercentage / 100) * STAR_X_SPAN;
        const clipId = `star-clip-${i}`;

        return (
          <View key={i} style={{ width: size, height: size }}>
            <Svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
              <Polygon points={STAR_POINTS} fill="none" stroke={color} strokeWidth={2} opacity={0.3} />
            </Svg>
            {fillPercentage > 0 && (
              <Svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
                <Defs>
                  <ClipPath id={clipId}>
                    <Rect x={0} y={0} width={absoluteWidth} height={24} />
                  </ClipPath>
                </Defs>
                <G clipPath={`url(#${clipId})`}>
                  <Polygon points={STAR_POINTS} fill={color} stroke={color} strokeWidth={2} />
                </G>
              </Svg>
            )}
          </View>
        );
      })}
    </View>
  );
}
