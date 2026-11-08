import { useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Bell, ChevronUp, Hash, Home, LogIn, LucideIcon, MessageSquare, Newspaper, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAuth } from '@/context/AuthContext';
import { TAB_BAR_HEIGHT } from './constants';

interface TabItem {
  key: string;
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TabButton({
  item,
  active,
  onPress,
}: {
  item: TabItem;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? '#ffffff' : '#71717a';
  return (
    <Pressable onPress={onPress} className="flex-1 items-center justify-center gap-0.5">
      <View>
        <item.Icon size={20} color={color} />
        {/* Badge slot — always 0/hidden in Phase 1 (no notification/message polling
            wired up yet), kept so the widget's final shape is already correct.
            Colors/position/"9+" cap match frontend/src/components/MobileTabBar.tsx. */}
        {!!item.badge && (
          <View className="absolute -right-2 -top-1 h-4 w-4 items-center justify-center rounded-full border-2 border-zinc-950 bg-emerald-600">
            <Text className="text-[10px] font-bold text-white">{item.badge > 9 ? '9+' : item.badge}</Text>
          </View>
        )}
      </View>
      <Text style={{ color }} className="text-[10px] leading-none">
        {item.label}
      </Text>
    </Pressable>
  );
}

// Mirrors frontend/src/components/MobileTabBar.tsx — a custom fixed overlay, not Expo
// Router's built-in <Tabs/> navigator (web itself doesn't use a native tab primitive
// either, so neither does this, to guarantee behavior parity).
interface MobileTabBarProps {
  onLayout?: (event: LayoutChangeEvent) => void;
}

export default function MobileTabBar({ onLayout }: MobileTabBarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  // Mirrors web's own mechanism exactly: an always-mounted, overflow-hidden row whose
  // height animates between 0 and TAB_BAR_HEIGHT (web: height 0px <-> 3.5rem, 300ms) —
  // not a conditional mount/unmount. RN's legacy LayoutAnimation API is unreliable on
  // Android under the New Architecture (silently no-ops), which is why this uses
  // Reanimated directly instead.
  const drawerHeight = useSharedValue(0);
  const animatedDrawerStyle = useAnimatedStyle(() => ({ height: drawerHeight.value }));

  const setExpandedAnimated = (next: boolean) => {
    setExpanded(next);
    // Reanimated shared values are intentionally mutated via `.value` — not React state.
    // eslint-disable-next-line react-hooks/immutability
    drawerHeight.value = withTiming(next ? TAB_BAR_HEIGHT : 0, { duration: 300 });
  };

  const collapse = () => {
    if (!expanded) return;
    setExpandedAnimated(false);
  };

  const navigate = (href: string) => {
    collapse();
    router.push(href as never);
  };

  if (!user) {
    const anonymousTabs: TabItem[] = [
      { key: 'home', href: '/', label: 'Home', Icon: Home },
      { key: 'explore', href: '/explore', label: 'Explore', Icon: Hash },
      { key: 'news', href: '/news', label: 'News', Icon: Newspaper },
      { key: 'login', href: '/login', label: 'Login', Icon: LogIn },
    ];
    return (
      <View
        onLayout={onLayout}
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        className="border-t border-zinc-800 bg-zinc-900"
      >
        <View style={{ height: TAB_BAR_HEIGHT }} className="flex-row">
          {anonymousTabs.map((tab) => (
            <TabButton
              key={tab.key}
              item={tab}
              active={isActive(pathname, tab.href)}
              onPress={() => navigate(tab.href)}
            />
          ))}
        </View>
      </View>
    );
  }

  const isExpandedGroupActive = expanded || isActive(pathname, '/news') || isActive(pathname, '/recommended');

  return (
    <View
      onLayout={onLayout}
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      className="border-t border-zinc-800 bg-zinc-900"
    >
      {/* Main row comes first so it's the one pushed upward when the drawer below it
          grows — the News/Recommended row becomes the new bottom-most strip instead of
          appearing above the main row (matches web's explicit DOM-order comment). */}
      <View style={{ height: TAB_BAR_HEIGHT }} className="flex-row">
        <TabButton
          item={{ key: 'home', href: '/', label: 'Home', Icon: Home }}
          active={isActive(pathname, '/')}
          onPress={() => navigate('/')}
        />
        <TabButton
          item={{ key: 'explore', href: '/explore', label: 'Explore', Icon: Hash }}
          active={isActive(pathname, '/explore')}
          onPress={() => navigate('/explore')}
        />
        <Pressable onPress={() => setExpandedAnimated(!expanded)} className="flex-1 items-center justify-center">
          <ChevronUp
            size={20}
            color={isExpandedGroupActive ? '#ffffff' : '#71717a'}
            style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          />
        </Pressable>
        <TabButton
          item={{ key: 'notifications', href: '/notifications', label: 'Alerts', Icon: Bell, badge: 0 }}
          active={isActive(pathname, '/notifications')}
          onPress={() => navigate('/notifications')}
        />
        <TabButton
          item={{ key: 'messages', href: '/messages', label: 'Messages', Icon: MessageSquare, badge: 0 }}
          active={isActive(pathname, '/messages')}
          onPress={() => navigate('/messages')}
        />
      </View>

      {/* Expandable drawer — no divider line against the main row above it (matches
          web: only the whole bar's own top border exists, nothing between these rows). */}
      <Animated.View style={[{ overflow: 'hidden' }, animatedDrawerStyle]} className="flex-row">
        <TabButton
          item={{ key: 'news', href: '/news', label: 'News', Icon: Newspaper }}
          active={isActive(pathname, '/news')}
          onPress={() => navigate('/news')}
        />
        <TabButton
          item={{ key: 'recommended', href: '/recommended', label: 'For You', Icon: Sparkles }}
          active={isActive(pathname, '/recommended')}
          onPress={() => navigate('/recommended')}
        />
      </Animated.View>
    </View>
  );
}
