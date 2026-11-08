import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LogIn, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import { Image } from '@/components/ui/Image';
import AccountDrawer from './AccountDrawer';

// Mirrors the *behavior* of frontend/src/components/Navbar.tsx's mobile-only row
// (avatar→drawer, centered wordmark, search icon→overlay) — not its desktop block,
// which has no mobile equivalent on web either. Colors/height match that row exactly
// (bg-zinc-900, border-b border-zinc-800, h-16). The search icon stays inert (Phase 4).
export default function TopHeader() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <View style={{ paddingTop: insets.top }} className="border-b border-zinc-800 bg-zinc-900">
        <View className="h-16 flex-row items-center justify-between px-4">
          <View className="h-9 w-9 items-center justify-center">
            {user ? (
              <Pressable onPress={() => setDrawerOpen(true)}>
                <Image
                  source={{ uri: getImageUrl(user.avatar, user.real_name || user.username) }}
                  className="h-9 w-9 rounded-full bg-zinc-800"
                />
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push('/login')}>
                <LogIn size={22} color="#ffffff" />
              </Pressable>
            )}
          </View>

          <Text className="text-lg font-bold text-white">Gamelogd</Text>

          <View className="h-9 w-9 items-center justify-center">
            <Search size={20} color="#ffffff" />
          </View>
        </View>
      </View>

      <AccountDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
