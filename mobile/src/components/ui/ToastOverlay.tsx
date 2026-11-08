import { Pressable, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';
import Animated, { FadeOut, SlideInRight } from 'react-native-reanimated';

import { ToastItem, useToastState } from '@/context/ToastContext';

const ICONS: Record<ToastItem['type'], React.ReactNode> = {
  success: <CheckCircle2 size={20} color="#34d399" />,
  error: <AlertCircle size={20} color="#f87171" />,
  info: <Info size={20} color="#60a5fa" />,
};

const BORDER_COLORS: Record<ToastItem['type'], string> = {
  success: 'rgba(16,185,129,0.4)',
  error: 'rgba(220,38,38,0.4)',
  info: 'rgba(37,99,235,0.4)',
};

interface ToastOverlayProps {
  bottomInset: number;
}

// Mirrors frontend/src/context/ToastContext.tsx's visual stack (bottom-anchored,
// per-type accent border/icon, slide+fade transitions) but anchored above the mobile tab
// bar/AnonBanner via the already-known `bottomInset` (Faz 2 plan decision 4) rather than
// web's fixed bottom-4. Uses Reanimated's Layout Animation `entering`/`exiting` props
// (not the legacy `LayoutAnimation` API, which no-ops on Android's New Architecture — see
// mobile init memory) so each toast animates in/out automatically as the list changes.
export default function ToastOverlay({ bottomInset }: ToastOverlayProps) {
  const { toasts, dismiss } = useToastState();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: bottomInset + 16, gap: 10, alignItems: 'flex-end' }}
    >
      {toasts.map((toast) => (
        <Animated.View
          key={toast.id}
          entering={SlideInRight.duration(220)}
          exiting={FadeOut.duration(150)}
          style={{ width: '100%', maxWidth: 320, borderColor: BORDER_COLORS[toast.type] }}
          className="flex-row items-start gap-3 rounded-xl border bg-zinc-900 px-4 py-3.5 shadow-lg"
        >
          {ICONS[toast.type]}
          <Text className="flex-1 text-sm font-medium leading-snug text-zinc-200">{toast.message}</Text>
          <Pressable onPress={() => dismiss(toast.id)} hitSlop={8}>
            <X size={16} color="#71717a" />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
