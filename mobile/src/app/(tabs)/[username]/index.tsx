import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import useSWR from 'swr';

import { fetcher } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useBottomInset } from '@/context/BottomInsetContext';
import { strings } from '@/lib/strings';
import { User } from '@/types';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileStatsRow from '@/components/profile/ProfileStatsRow';
import IncomingRequestBanner from '@/components/profile/IncomingRequestBanner';
import BlockedStateView from '@/components/profile/BlockedStateView';
import PrivateProfileBanner from '@/components/profile/PrivateProfileBanner';
import FollowersFollowingModal from '@/components/profile/FollowersFollowingModal';
import TopFavoritesGrid from '@/components/profile/TopFavoritesGrid';
import ProfileTabs from '@/components/profile/ProfileTabs';

// Step 15 added the real tabs (ProfileTabs) — a single top-level FlatList for the
// screen, not a FlatList nested inside a ScrollView (RN disallows/breaks virtualization
// for a VirtualizedList nested in a same-orientation ScrollView). When tabs/content
// aren't shown at all (blocked either direction, or a private profile not yet
// followed), there's nothing to virtualize, so that branch stays a plain ScrollView.
export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: viewer } = useAuth();
  const bottomInset = useBottomInset();
  const { data: profileUser, error, isLoading, mutate } = useSWR<User>(
    username ? `/users/${username}/` : null,
    fetcher
  );
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');
  const [followModalVisible, setFollowModalVisible] = useState(false);

  const handleUpdate = useCallback(
    (patch: Partial<User>) => {
      mutate((current) => (current ? { ...current, ...patch } : current), { revalidate: false });
    },
    [mutate]
  );

  const handleRefetch = useCallback(() => {
    mutate();
  }, [mutate]);

  const openFollowersModal = useCallback(() => {
    setFollowModalTab('followers');
    setFollowModalVisible(true);
  }, []);

  const openFollowingModal = useCallback(() => {
    setFollowModalTab('following');
    setFollowModalVisible(true);
  }, []);

  const isOwnProfile = viewer?.username?.toLowerCase() === profileUser?.username?.toLowerCase();
  const showStatsAndRequest = !profileUser?.has_blocked_me && !profileUser?.is_blocked;
  const isPrivateProfile = !!profileUser?.settings?.privateProfile;
  const canViewContent = !isPrivateProfile || isOwnProfile || !!profileUser?.is_following;

  // Memoized (all hooks called unconditionally, before the loading/error early returns
  // below, per the rules of hooks) — ProfileTabs itself memoizes what it does with this,
  // but that only helps if `header`'s own reference stays stable across renders that
  // don't actually change the profile (e.g. toggling the Followers/Following modal).
  // Without this, every such toggle was rebuilding the whole header and forcing
  // ProfileTabs' FlatList to reconcile every on-screen feed card — the same class of
  // ~700-900ms stall measured and fixed on the Library screen's filter pickers.
  const header = useMemo(() => {
    if (!profileUser) return null;
    return (
      <>
        <ProfileHeader profileUser={profileUser} isOwnProfile={isOwnProfile} onUpdate={handleUpdate} onRefetch={handleRefetch} />
        <ProfileStatsRow
          profileUser={profileUser}
          canViewContent={canViewContent}
          onPressFollowers={openFollowersModal}
          onPressFollowing={openFollowingModal}
        />
        {profileUser.has_requested_me && (
          <IncomingRequestBanner username={profileUser.username} onUpdate={handleUpdate} onRefetch={handleRefetch} />
        )}
        <TopFavoritesGrid profileUser={profileUser} isOwnProfile={isOwnProfile} onUpdate={handleUpdate} />
      </>
    );
  }, [profileUser, isOwnProfile, canViewContent, handleUpdate, handleRefetch, openFollowersModal, openFollowingModal]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-950">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (error || !profileUser) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-950">
        <Text className="text-lg font-bold text-white">{strings.userNotFound}</Text>
      </View>
    );
  }

  const followersModal = (
    <FollowersFollowingModal
      visible={followModalVisible}
      onClose={() => setFollowModalVisible(false)}
      username={profileUser.username}
      initialTab={followModalTab}
      onCountChange={handleRefetch}
    />
  );

  if (showStatsAndRequest && canViewContent) {
    return (
      <View className="flex-1 bg-zinc-950">
        <ProfileTabs username={profileUser.username} header={header} bottomInset={bottomInset} />
        {followersModal}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: bottomInset + 16 }}>
        <ProfileHeader profileUser={profileUser} isOwnProfile={isOwnProfile} onUpdate={handleUpdate} onRefetch={handleRefetch} />
        {showStatsAndRequest && (
          <ProfileStatsRow
            profileUser={profileUser}
            canViewContent={canViewContent}
            onPressFollowers={openFollowersModal}
            onPressFollowing={openFollowingModal}
          />
        )}
        {showStatsAndRequest && profileUser.has_requested_me && (
          <IncomingRequestBanner username={profileUser.username} onUpdate={handleUpdate} onRefetch={handleRefetch} />
        )}
        {!showStatsAndRequest && <BlockedStateView profileUser={profileUser} onUpdate={handleUpdate} onRefetch={handleRefetch} />}
        {showStatsAndRequest && !canViewContent && (
          <PrivateProfileBanner profileUser={profileUser} isOwnProfile={isOwnProfile} onUpdate={handleUpdate} />
        )}
      </ScrollView>
      {followersModal}
    </View>
  );
}
