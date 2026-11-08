import { Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import { getImageUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { User } from '@/types';
import FollowButton from './FollowButton';

interface PrivateProfileBannerProps {
  profileUser: User;
  isOwnProfile: boolean;
  onUpdate: (patch: Partial<User>) => void;
}

// Port of ProfileClient.tsx's "Integrated Private Profile Banner" — dimmed avatar + lock
// badge, header + pending/follow-prompt copy, and (for a non-owner) the same FollowButton
// used elsewhere. Shown in place of the tabs/content area when !canViewContent.
export default function PrivateProfileBanner({ profileUser, isOwnProfile, onUpdate }: PrivateProfileBannerProps) {
  const name = profileUser.real_name || profileUser.username;
  const handle = `@${profileUser.username}`;
  const isRequested = !!profileUser.is_requested;

  return (
    <View className="mx-4 mt-6 items-center gap-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 px-8 py-16">
      <View style={{ position: 'relative' }}>
        <View className="h-20 w-20 overflow-hidden rounded-full border-2 border-zinc-700/70 bg-zinc-800">
          <Image source={{ uri: getImageUrl(profileUser.avatar, name) }} style={{ flex: 1, opacity: 0.6 }} contentFit="cover" />
        </View>
        {/* Explicit inline position/size rather than NativeWind's `-bottom-1 -right-1
            h-7 w-7` utilities — those weren't resolving correctly here (badge rendered
            top-left and undersized relative to the icon it holds). */}
        <View
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="border border-zinc-700 bg-zinc-900"
        >
          <Lock size={14} color="#a1a1aa" />
        </View>
      </View>

      <View className="items-center gap-1.5">
        <Text className="text-lg font-bold text-white">{strings.accountPrivateHeader}</Text>
        <Text className="max-w-xs text-center text-sm text-zinc-500">
          {(isRequested ? strings.followRequestPending : strings.followPrivateDesc).replace('{username}', handle)}
        </Text>
      </View>

      {!isOwnProfile && (
        <View className="mt-2">
          <FollowButton
            username={profileUser.username}
            isFollowing={!!profileUser.is_following}
            isRequested={isRequested}
            isPrivateProfile
            followersCount={profileUser.followers_count || 0}
            onUpdate={onUpdate}
          />
        </View>
      )}
    </View>
  );
}
