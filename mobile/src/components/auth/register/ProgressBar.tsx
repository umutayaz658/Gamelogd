import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const widthPercent = useSharedValue((currentStep / totalSteps) * 100);

  useEffect(() => {
    widthPercent.value = withTiming((currentStep / totalSteps) * 100, { duration: 300 });
  }, [currentStep, totalSteps, widthPercent]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${widthPercent.value}%` }));

  return (
    <View className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
      <Animated.View style={animatedStyle} className="h-full bg-emerald-500" />
    </View>
  );
}
