import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { Image } from '@/components/ui/Image';

const ANIMATION_DURATION = 300;
const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 320);

interface AccountDrawerProps {
  visible: boolean;
  onClose: () => void;
}

// Mirrors frontend/src/components/MobileSidebarDrawer.tsx's visual language (left slide,
// 80%-width-capped-at-320px panel, dark backdrop) but cut down per Faz 1 plan decision
// 7: only the account header (non-interactive — no Profile screen to link to yet) and a
// working Logout button. The shared LeftSidebarContent menu (Explore/Notifications/
// Messages/Bookmarks/Settings/Log Game) is skipped — those destinations either already
// exist as tabs or don't have a screen yet.
export default function AccountDrawer({ visible, onClose }: AccountDrawerProps) {
  const { user, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(visible);
  const progress = useSharedValue(0);

  // Mount immediately when `visible` turns true — a direct render-phase state adjustment
  // (React's documented pattern for reacting to a prop change), not a side effect.
  if (visible && !isMounted) {
    setIsMounted(true);
  }

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, { duration: ANIMATION_DURATION });
      return undefined;
    }

    progress.value = withTiming(0, { duration: ANIMATION_DURATION });
    const timeout = setTimeout(() => setIsMounted(false), ANIMATION_DURATION);
    return () => clearTimeout(timeout);
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.6 }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * PANEL_WIDTH }],
  }));

  if (!isMounted || !user) return null;

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000000' }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            { position: 'absolute', left: 0, top: 0, bottom: 0, width: PANEL_WIDTH },
            panelStyle,
          ]}
          className="border-r border-zinc-800 bg-zinc-950"
        >
          <View className="flex-row items-center gap-3 border-b border-zinc-800 p-4">
            <Image
              source={{ uri: getImageUrl(user.avatar, user.real_name || user.username) }}
              className="h-11 w-11 rounded-full bg-zinc-700"
            />
            <View className="flex-shrink">
              <Text numberOfLines={1} className="text-sm font-bold text-white">
                {user.real_name || user.username}
              </Text>
              <Text numberOfLines={1} className="text-xs text-zinc-400">
                @{user.username.toLowerCase()}
              </Text>
            </View>
          </View>

          <View className="flex-1" />

          <Pressable
            onPress={handleLogout}
            className="m-2 flex-row items-center gap-3 rounded-xl px-4 py-3"
          >
            <LogOut size={16} color="#f43f5e" />
            <Text className="text-sm text-rose-500">{strings.logOut}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
