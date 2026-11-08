import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Port of frontend/src/components/skeletons/FeedSkeleton.tsx — web's `animate-pulse` CSS
// loop becomes a Reanimated opacity loop (0.5 <-> 1, matching Tailwind's pulse timing).
function PulsingCard() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={animatedStyle} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 rounded-full bg-zinc-800" />
        <View className="flex-1 gap-2">
          <View className="h-3.5 w-32 rounded bg-zinc-800" />
          <View className="h-3 w-20 rounded bg-zinc-800" />
        </View>
      </View>
      <View className="mt-3 gap-2">
        <View className="h-3.5 w-full rounded bg-zinc-800" />
        <View className="h-3.5 w-5/6 rounded bg-zinc-800" />
        <View className="h-3.5 w-2/3 rounded bg-zinc-800" />
      </View>
      <View className="mt-4 flex-row gap-6">
        <View className="h-3 w-8 rounded bg-zinc-800" />
        <View className="h-3 w-8 rounded bg-zinc-800" />
        <View className="h-3 w-8 rounded bg-zinc-800" />
      </View>
    </Animated.View>
  );
}

export default function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View className="gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PulsingCard key={i} />
      ))}
    </View>
  );
}
