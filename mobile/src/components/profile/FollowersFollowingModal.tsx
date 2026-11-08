import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MoreHorizontal, Search, UserMinus, X } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FollowButton from './FollowButton';
import api, { unwrapList } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatHandle, getImageUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';

interface ConnectionUser {
  id: number;
  username: string;
  real_name?: string;
  avatar?: string;
  is_following?: boolean;
  is_requested?: boolean;
  followers_count?: number;
  settings?: { privateProfile?: boolean };
}

interface FollowersFollowingModalProps {
  visible: boolean;
  onClose: () => void;
  username: string;
  initialTab: 'followers' | 'following';
  onCountChange?: () => void;
}

// Port of frontend/src/components/FollowersFollowingModal.tsx — tabs, 400ms-debounced
// server-side search (immediate on tab switch, matching web's 0ms-when-empty delay),
// per-row FollowButton (compact, same component ProfileActionsRow uses — fixes a real
// bug where this row used to flip is_following optimistically and never corrected it
// against the server response, so following a private user here showed "Unfollow"
// instead of "Requested") or "Remove" on own Followers tab, tap row to navigate + close.
// The 3-dot's only item on web is "Block", which itself just opens the
// same confirm dialog this also opens directly — skipping that single-item intermediate
// dropdown and going straight to the confirm is a simplification with an identical end
// result, not a visual deviation worth building a positioned-dropdown component for.
// Not in the original 16-step build-order list (an oversight in that plan) — added here
// in step 9 since it's exactly what the profile stats row's Followers/Following taps
// (gated by canViewContent) need to open.
export default function FollowersFollowingModal({ visible, onClose, username, initialTab, onCountChange }: FollowersFollowingModalProps) {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<ConnectionUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [blockTarget, setBlockTarget] = useState<ConnectionUser | null>(null);

  // Reset tab/search each time the modal opens — render-phase sync (not an effect, which
  // the lint rule flags for a synchronous setState) matching the wasVisible pattern
  // already used by GameSearchModal/EditProfileModal for the same "Modal stays mounted,
  // local state needs a fresh start per open" situation.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setActiveTab(initialTab);
      setSearchQuery('');
    }
  }

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    const timeout = setTimeout(
      async () => {
        setIsLoading(true);
        try {
          const endpoint = activeTab === 'followers' ? `/users/${username}/followers/` : `/users/${username}/following-list/`;
          const { data } = await api.get(endpoint, { params: searchQuery.trim() ? { search: searchQuery } : {} });
          if (active) setUsers(unwrapList(data));
        } catch (error) {
          console.error(`Failed to fetch ${activeTab}:`, error);
          if (active) setUsers([]);
        } finally {
          if (active) setIsLoading(false);
        }
      },
      searchQuery.trim() ? 400 : 0
    );
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [visible, activeTab, username, searchQuery]);

  const isOwnProfile = currentUser?.username?.toLowerCase() === username.toLowerCase();

  const handleRemoveFollower = async (target: ConnectionUser) => {
    setActionLoadingId(target.id);
    const previous = users;
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
    try {
      await api.post(`/users/${target.username}/remove-follower/`);
      onCountChange?.();
    } catch (error) {
      console.error('Failed to remove follower:', error);
      setUsers(previous);
      toast.error('Failed to remove follower.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBlockConfirm = async () => {
    if (!blockTarget) return;
    const target = blockTarget;
    setActionLoadingId(target.id);
    try {
      await api.post(`/users/${target.username}/block/`);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      onCountChange?.();
    } catch (error) {
      console.error('Block failed:', error);
      toast.error('Failed to block user.');
    } finally {
      setActionLoadingId(null);
      setBlockTarget(null);
    }
  };

  const goToProfile = (username_: string) => {
    onClose();
    router.push(`/${username_}` as never);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-4">
        <View style={{ height: '60%', maxHeight: 500 }} className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <View className="border-b border-zinc-800">
            <View className="flex-row items-center justify-between px-4 pb-3 pt-4">
              <Text className="text-lg font-bold text-white">{strings.connections}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color="#a1a1aa" />
              </Pressable>
            </View>
            <View className="mt-1 flex-row gap-6 px-4">
              {(['followers', 'following'] as const).map((tab) => (
                <Pressable key={tab} onPress={() => setActiveTab(tab)} className="pb-3">
                  <Text className={`text-sm font-bold ${activeTab === tab ? 'text-white' : 'text-zinc-500'}`}>
                    {tab === 'followers' ? strings.followers : strings.following}
                  </Text>
                  {activeTab === tab && <View className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-emerald-500" />}
                </Pressable>
              ))}
            </View>
          </View>

          <View className="border-b border-zinc-800 bg-zinc-900/40 p-3">
            <View className="flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950 px-3">
              <Search size={16} color="#71717a" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search people..."
                placeholderTextColor="#52525b"
                className="ml-2 flex-1 py-2 text-sm text-white"
              />
            </View>
          </View>

          {isLoading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="small" color="#10b981" />
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(u) => String(u.id)}
              contentContainerStyle={{ padding: 8 }}
              ListEmptyComponent={
                <Text className="py-12 text-center text-sm text-zinc-500">
                  {searchQuery
                    ? `${strings.noConnectionsFoundMatching} "${searchQuery}"`
                    : activeTab === 'followers'
                      ? strings.noFollowersYet
                      : strings.noFollowingYet}
                </Text>
              }
              renderItem={({ item }) => {
                const isSelf = currentUser?.username?.toLowerCase() === item.username.toLowerCase();
                return (
                  <View className="flex-row items-center justify-between rounded-xl p-2.5">
                    <Pressable onPress={() => goToProfile(item.username)} className="flex-1 flex-row items-center gap-3">
                      <View className="h-10 w-10 overflow-hidden rounded-full border border-zinc-700/50 bg-zinc-800">
                        <Image source={{ uri: getImageUrl(item.avatar, item.username) }} style={{ flex: 1 }} contentFit="cover" />
                      </View>
                      <View className="flex-1">
                        <Text numberOfLines={1} className="text-sm font-bold text-white">
                          {item.real_name || item.username}
                        </Text>
                        <Text numberOfLines={1} className="text-xs text-zinc-500">
                          {formatHandle(item.username)}
                        </Text>
                      </View>
                    </Pressable>

                    {!isSelf && currentUser && (
                      <View className="ml-3 flex-row items-center gap-2">
                        {activeTab === 'followers' && isOwnProfile ? (
                          <Pressable
                            onPress={() => handleRemoveFollower(item)}
                            disabled={actionLoadingId === item.id}
                            className="flex-row items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5"
                          >
                            {actionLoadingId === item.id ? (
                              <ActivityIndicator size="small" color="#d4d4d8" />
                            ) : (
                              <>
                                <UserMinus size={14} color="#d4d4d8" />
                                <Text className="text-xs font-bold text-zinc-300">{strings.remove}</Text>
                              </>
                            )}
                          </Pressable>
                        ) : (
                          <FollowButton
                            username={item.username}
                            isFollowing={!!item.is_following}
                            isRequested={!!item.is_requested}
                            isPrivateProfile={!!item.settings?.privateProfile}
                            followersCount={item.followers_count || 0}
                            compact
                            onUpdate={(patch) => {
                              setUsers((prev) =>
                                prev.map((u) => (u.id === item.id ? { ...u, ...(patch as Partial<ConnectionUser>) } : u))
                              );
                              onCountChange?.();
                            }}
                          />
                        )}

                        <Pressable onPress={() => setBlockTarget(item)} className="rounded-lg p-1.5">
                          <MoreHorizontal size={16} color="#71717a" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>

      <ConfirmDialog
        visible={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        onConfirm={handleBlockConfirm}
        title="Block User"
        message={blockTarget ? `Are you sure you want to block @${blockTarget.username}?` : ''}
        confirmText={strings.block}
        isDanger
      />
    </Modal>
  );
}
