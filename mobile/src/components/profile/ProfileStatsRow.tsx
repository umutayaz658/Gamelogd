import { Pressable, Text, View } from 'react-native';

import { strings } from '@/lib/strings';
import { User } from '@/types';

interface ProfileStatsRowProps {
  profileUser: User;
  canViewContent: boolean;
  onPressFollowers: () => void;
  onPressFollowing: () => void;
}

// Mobile-width port of ProfileClient.tsx's `lg:hidden` stats bar. Followers/Following
// taps open FollowersFollowingModal, gated by canViewContent (web's buttons no-op when
// gated rather than disabling visually — matched here via a plain early-return instead
// of RN's `disabled` prop, so the text doesn't dim and still reads as a normal stat).
export default function ProfileStatsRow({ profileUser, canViewContent, onPressFollowers, onPressFollowing }: ProfileStatsRowProps) {
  return (
    <View className="mx-4 mt-3 flex-row items-center justify-around rounded-xl border border-zinc-800/50 bg-zinc-900/50 px-3 py-2">
      <Pressable onPress={() => canViewContent && onPressFollowers()} className="items-center">
        <Text className="text-base font-bold text-white">{profileUser.followers_count || 0}</Text>
        <Text className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{strings.followers}</Text>
      </Pressable>
      <Pressable onPress={() => canViewContent && onPressFollowing()} className="items-center">
        <Text className="text-base font-bold text-white">{profileUser.following_count || 0}</Text>
        <Text className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{strings.following}</Text>
      </Pressable>
      <View className="items-center">
        <Text className="text-base font-bold text-emerald-400">{profileUser.reviews_count || 0}</Text>
        <Text className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">{strings.reviews}</Text>
      </View>
    </View>
  );
}
