import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { strings } from '@/lib/strings';
import { User } from '@/types';

interface IncomingRequestBannerProps {
  username: string;
  onUpdate: (patch: Partial<User>) => void;
  onRefetch: () => void;
}

// Port of ProfileClient.tsx's mobile incoming-request banner. Despite the name, this
// shows on the OTHER person's profile page, not your own — `has_requested_me` means
// "this profile's user has sent ME a pending follow request" (confirmed against
// backend's UserSerializer.get_has_requested_me), so you resolve it right where you're
// looking at them, not on your own profile.
//
// Approving changes the VIEWED profile's own following_count (they now follow you) —
// not something this component can compute locally, so after a successful response it
// both dismisses the banner (onUpdate) and refetches the viewed profile (onRefetch) to
// pick up the corrected count — mirrors web's handleAcceptIncomingRequest exactly
// (await the request, then setHasRequestedMe(false) + refreshProfileCounts(); no
// optimistic update before the request, so no revert-on-failure branch is needed).
export default function IncomingRequestBanner({ username, onUpdate, onRefetch }: IncomingRequestBannerProps) {
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);

  const respond = async (action: 'approve-request' | 'reject-request') => {
    if (isPending) return;
    setIsPending(true);
    try {
      await api.post(`/users/${username}/${action}/`);
      onUpdate({ has_requested_me: false });
      onRefetch();
    } catch (error) {
      console.error('Failed to respond to follow request:', error);
      toast.error(strings.failedToUpdateFollowStatus);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <View className="mx-4 mt-2 flex-row items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
      <Text numberOfLines={1} className="flex-1 text-xs text-zinc-300">
        {strings.followRequestHeader}
      </Text>
      <Pressable disabled={isPending} onPress={() => respond('approve-request')} className="rounded-lg bg-emerald-600 px-3 py-1">
        <Text className="text-center text-xs font-bold text-white">{strings.accept}</Text>
      </Pressable>
      <Pressable disabled={isPending} onPress={() => respond('reject-request')} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1">
        <Text className="text-center text-xs font-bold text-zinc-300">{strings.decline}</Text>
      </Pressable>
    </View>
  );
}
