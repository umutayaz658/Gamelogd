import { useState } from 'react';
import { View } from 'react-native';
import { Slot, usePathname } from 'expo-router';

import TopHeader from '@/components/nav/TopHeader';
import BottomBarStack from '@/components/nav/BottomBarStack';
import ToastOverlay from '@/components/ui/ToastOverlay';
import { BottomInsetProvider } from '@/context/BottomInsetContext';
import { useAuth } from '@/context/AuthContext';
import CoverPage from '@/components/CoverPage/CoverPage';

// Mirrors web's fixed-overlay nav shell (TopHeader + content + AnonBanner/MobileTabBar)
// rather than Expo Router's built-in <Tabs/> navigator — see MobileTabBar.tsx's own
// comment for why. Chrome is hidden at '/' for a true-anonymous visitor (hasn't tapped
// "Continue without logging in" yet) — mirrors frontend/src/lib/publicPaths.ts's
// isChromeHiddenPath, which hides web's nav chrome on the landing page the same way;
// any other route keeps normal chrome even while anonymous.
export default function TabsLayout() {
  const [bottomInset, setBottomInset] = useState(0);
  const { user, hasContinuedAsGuest } = useAuth();
  const pathname = usePathname();

  const hideChrome = pathname === '/' && !user && !hasContinuedAsGuest;

  if (hideChrome) {
    return <CoverPage />;
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <TopHeader />
      <BottomInsetProvider value={bottomInset}>
        <View className="flex-1">
          <Slot />
        </View>
      </BottomInsetProvider>
      <BottomBarStack onHeightChange={setBottomInset} />
      <ToastOverlay bottomInset={bottomInset} />
    </View>
  );
}
