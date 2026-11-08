import { Pressable, Text, View } from 'react-native';

import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { strings } from '@/lib/strings';
import { User } from '@/types';

interface BlockedStateViewProps {
  profileUser: User;
  onUpdate: (patch: Partial<User>) => void;
  onRefetch: () => void;
}

// Port of ProfileClient.tsx's two full-page-takeover blocked states — replaces
// everything below the header/stats/request-banner area (favorites, Steam widget,
// GameDNA, tabs) on either side of a block, matching web's `has_blocked_me`/`isBlocked`
// branches exactly.
export default function BlockedStateView({ profileUser, onUpdate, onRefetch }: BlockedStateViewProps) {
  const toast = useToast();

  if (profileUser.has_blocked_me) {
    return (
      <View className="mx-4 mt-8 items-center rounded-3xl border border-zinc-850 bg-zinc-900/50 p-8">
        <Text className="mb-2 text-center text-xl font-bold text-white">{`@${profileUser.username} blocked you`}</Text>
        <Text className="text-center text-sm text-zinc-400">
          {strings.userBlockedYouDesc.replace(/\{username\}/g, `@${profileUser.username}`)}
        </Text>
      </View>
    );
  }

  const handleUnblock = async () => {
    try {
      await api.post(`/users/${profileUser.username}/unblock/`);
      onUpdate({ is_blocked: false });
      onRefetch();
    } catch (error) {
      console.error('Failed to toggle block status:', error);
      toast.error(strings.failedToUpdateBlockStatus);
    }
  };

  return (
    <View className="mx-4 mt-8 items-center rounded-3xl border border-zinc-850 bg-zinc-900/50 p-8">
      <Text className="mb-4 text-center text-xl font-bold text-white">{`You blocked @${profileUser.username}`}</Text>
      <Text className="mb-6 text-center text-sm text-zinc-400">{strings.youBlockedUserDesc}</Text>
      <Pressable onPress={handleUnblock} className="rounded-xl bg-emerald-600 px-6 py-2.5">
        <Text className="text-center font-bold text-white">{strings.unblock}</Text>
      </Pressable>
    </View>
  );
}
