import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Clock, UserPlus, UserX } from 'lucide-react-native';

import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { strings } from '@/lib/strings';
import { User } from '@/types';

interface FollowButtonProps {
  username: string;
  isFollowing: boolean;
  isRequested: boolean;
  isPrivateProfile: boolean;
  followersCount: number;
  onUpdate: (patch: Partial<User>) => void;
  compact?: boolean;
}

// Port of frontend/src/app/[username]/ProfileClient.tsx's handleFollowToggle — same
// optimistic flip-and-revert-on-failure shape, and the same quirk where cancelling a
// pending request also goes through the /unfollow/ endpoint rather than a separate one.
// One deliberate correction: web's post-response branch resets followersCount back to
// its pre-click value whenever the server confirms `is_following: false` — which fires
// on every ordinary unfollow and silently undoes the correct optimistic decrement (a
// real counter bug, not a design choice worth mirroring). This keeps the optimistic
// count as final instead of re-deriving it from that formula.
// Shared between ProfileActionsRow and (later) FollowersFollowingModal's per-row button
// via the `compact` variant.
export default function FollowButton({
  username,
  isFollowing,
  isRequested,
  isPrivateProfile,
  followersCount,
  onUpdate,
  compact = false,
}: FollowButtonProps) {
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);

  const handlePress = async () => {
    if (isPending) return;
    const wasFollowing = isFollowing;
    const wasRequested = isRequested;
    const previousCount = followersCount;

    if (wasFollowing || wasRequested) {
      onUpdate({ is_following: false, is_requested: false, followers_count: wasFollowing ? Math.max(0, previousCount - 1) : previousCount });
    } else if (isPrivateProfile) {
      onUpdate({ is_following: false, is_requested: true });
    } else {
      onUpdate({ is_following: true, is_requested: false, followers_count: previousCount + 1 });
    }

    setIsPending(true);
    try {
      const endpoint = wasFollowing || wasRequested ? 'unfollow' : 'follow';
      const { data } = await api.post<{ is_following?: boolean; is_requested?: boolean }>(
        `/users/${username}/${endpoint}/`
      );
      onUpdate({ is_following: !!data.is_following, is_requested: !!data.is_requested });
    } catch (error) {
      console.error('Follow action failed:', error);
      onUpdate({ is_following: wasFollowing, is_requested: wasRequested, followers_count: previousCount });
      toast.error(strings.failedToUpdateFollowStatus);
    } finally {
      setIsPending(false);
    }
  };

  const active = isFollowing || isRequested;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isPending}
      className={`flex-row items-center gap-2 rounded-lg px-4 ${compact ? 'py-1' : 'py-1.5'} ${
        active ? 'border border-zinc-600' : 'bg-emerald-600'
      }`}
    >
      {isFollowing ? (
        <UserX size={14} color="#d4d4d8" />
      ) : isRequested ? (
        <Clock size={14} color="#a1a1aa" />
      ) : (
        <UserPlus size={14} color="#ffffff" />
      )}
      <Text className={`text-sm font-bold ${active ? 'text-zinc-300' : 'text-white'}`}>
        {isFollowing ? strings.unfollow : isRequested ? strings.requested : strings.follow}
      </Text>
    </Pressable>
  );
}
