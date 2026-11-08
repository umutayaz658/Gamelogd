import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useAnonBanner } from '@/context/AnonBannerContext';
import AnonBanner from './AnonBanner';
import MobileTabBar from './MobileTabBar';

interface BottomBarStackProps {
  onHeightChange: (height: number) => void;
}

// Combines AnonBanner + MobileTabBar into one fixed-bottom block and reports their
// combined rendered height upward (replaces web's BottomBarStack + `--bottom-reserve`
// CSS var — see BottomInsetContext.tsx for the consuming side). Simpler than web's
// version: no independent scroll-hide "lift" math is needed here, because Phase 1
// defers the tab bar's scroll-hide behavior entirely (Faz 1 plan decision 6) — once that
// ships, this is where the lift synchronization would be added.
export default function BottomBarStack({ onHeightChange }: BottomBarStackProps) {
  const { user, isLoading } = useAuth();
  const { dismissed, dismiss } = useAnonBanner();
  const [bannerHeight, setBannerHeight] = useState(0);
  const [tabBarHeight, setTabBarHeight] = useState(0);

  const showBanner = !isLoading && !user && !dismissed;

  useEffect(() => {
    onHeightChange((showBanner ? bannerHeight : 0) + tabBarHeight);
  }, [showBanner, bannerHeight, tabBarHeight, onHeightChange]);

  return (
    <View>
      {showBanner && (
        <AnonBanner onDismiss={dismiss} onLayout={(e) => setBannerHeight(e.nativeEvent.layout.height)} />
      )}
      <MobileTabBar onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)} />
    </View>
  );
}
