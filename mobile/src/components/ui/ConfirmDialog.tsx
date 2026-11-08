import { Modal, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

interface ConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

// Generic port of frontend/src/components/ui/ConfirmModal.tsx (centered card, uppercase
// header + close X, cancel/confirm footer, danger=red-650 vs. default=emerald-600) —
// built reusable now so Faz 2's Block/Unblock confirm can use it, and any later phase can
// reuse it for its own destructive-action confirmations.
export default function ConfirmDialog({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/75 p-4">
        <View className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <View className="flex-row items-center justify-between border-b border-zinc-800 bg-zinc-950/40 p-5">
            <Text className="text-sm font-bold uppercase tracking-wider text-white">{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color="#71717a" />
            </Pressable>
          </View>

          <View className="p-6">
            <Text className="text-sm font-medium leading-relaxed text-zinc-300">{message}</Text>
          </View>

          <View className="flex-row justify-end gap-3.5 border-t border-zinc-800 bg-zinc-950/40 p-5">
            <Pressable onPress={onClose} className="rounded-xl border border-zinc-800 px-5 py-2">
              <Text className="text-center text-xs font-bold text-zinc-400">{cancelText}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onConfirm();
                onClose();
              }}
              className={`rounded-xl px-6 py-2 ${isDanger ? 'bg-red-650' : 'bg-emerald-600'}`}
            >
              <Text className="text-center text-xs font-bold text-white">{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
