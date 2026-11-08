import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

interface ComingSoonScreenProps {
  title: string;
  Icon: LucideIcon;
}

// Shared stub for every Phase 1 tab destination whose real content ships in a later
// phase (Faz 1 plan decision 3) — the tab bar itself is built in full now, only the
// screen content behind each stub destination is deferred.
export default function ComingSoonScreen({ title, Icon }: ComingSoonScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-zinc-950 p-4">
      <Icon size={40} color="#52525b" />
      <Text className="mt-4 text-lg font-bold text-white">{title}</Text>
      <Text className="mt-1 text-zinc-500">Coming soon</Text>
    </View>
  );
}
