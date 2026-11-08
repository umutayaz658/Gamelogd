import { useState } from 'react';
import { Modal, Pressable, Text } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';

const OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
];

interface CustomGenderSelectProps {
  value: string;
  onChange: (value: string) => void;
}

// Web's version is an absolutely-positioned inline dropdown; this uses a native Modal
// instead (RN absolute-positioned overlays clip awkwardly inside ScrollViews) — same
// dark-card/checkmark visual language, different presentation mechanism.
export default function CustomGenderSelect({ value, onChange }: CustomGenderSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = OPTIONS.find((option) => option.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-2.5"
      >
        <Text className={selected ? 'font-semibold text-zinc-200' : 'text-zinc-600'}>
          {selected ? selected.label : 'Select Gender'}
        </Text>
        <ChevronDown size={16} color="#71717a" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/60 p-4" onPress={() => setOpen(false)}>
          <Pressable
            className="w-full max-w-xs overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-1"
            onPress={(e) => e.stopPropagation()}
          >
            {OPTIONS.map((option) => {
              const isSelected = value === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex-row items-center justify-between rounded-lg px-3 py-2.5 ${
                    isSelected ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <Text className={isSelected ? 'text-sm font-bold text-emerald-500' : 'text-sm text-zinc-300'}>
                    {option.label}
                  </Text>
                  {isSelected && <Check size={16} color="#10b981" />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
