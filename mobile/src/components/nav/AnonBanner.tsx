import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';

import { strings } from '@/lib/strings';

interface AnonBannerProps {
  onDismiss: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

// Mirrors frontend/src/components/AnonBanner.tsx's content/styling (positioning lives in
// BottomBarStack, same split as web). One flagged deviation: web uses a semi-transparent
// backdrop-blur background (bg-zinc-900/95 backdrop-blur); RN has no built-in CSS-style
// backdrop blur, and pulling in expo-blur for this one bar isn't worth it in Phase 1 — a
// solid bg-zinc-900 is used instead.
export default function AnonBanner({ onDismiss, onLayout }: AnonBannerProps) {
  return (
    <View onLayout={onLayout} className="border-t border-zinc-800 bg-zinc-900 px-4 py-3.5">
      {/* Web stacks message above buttons on mobile (flex-col, sm:flex-row only at
          desktop widths) — matched here rather than placed side by side. */}
      <View className="items-center gap-3">
        <Text className="text-center text-sm text-zinc-300">{strings.anonBannerMessage}</Text>
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.push('/login')} className="rounded-lg px-4 py-2">
            <Text className="text-sm font-medium text-zinc-300">{strings.login}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/register')} className="rounded-lg bg-emerald-600 px-4 py-2">
            <Text className="text-sm font-medium text-white">{strings.signUp}</Text>
          </Pressable>
          <Pressable onPress={onDismiss} className="rounded-lg p-2">
            <X size={16} color="#71717a" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
