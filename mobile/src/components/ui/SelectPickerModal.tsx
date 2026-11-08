import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectPickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: SelectOption[];
  value: string;
  onSelect: (value: string) => void;
}

// Generic single-select modal — same small-card-with-checkable-rows shape as
// LogGameModal's PlatformPickerModal (multi-select), just closing itself on pick since
// only one value can be selected at a time. Stands in for web's FilterDropdown popover,
// which has no mobile equivalent.
export default function SelectPickerModal({ visible, onClose, title, options, value, onSelect }: SelectPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 p-4" onPress={onClose}>
        <View style={{ maxHeight: '70%' }} className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <View className="flex-row items-center justify-between border-b border-zinc-800 p-4">
            <Text className="text-base font-bold text-white">{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color="#a1a1aa" />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 8 }}>
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  className="flex-row items-center justify-between rounded-xl p-3 active:bg-zinc-800"
                >
                  <Text className={isSelected ? 'text-sm font-bold text-emerald-400' : 'text-sm text-zinc-200'}>{opt.label}</Text>
                  {isSelected && <Check size={16} color="#10b981" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}
