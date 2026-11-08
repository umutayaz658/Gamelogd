import { ComponentRef, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MoreHorizontal, Pencil } from 'lucide-react-native';

import FollowButton from './FollowButton';
import ProfileOverflowMenu from './ProfileOverflowMenu';
import EditProfileModal from './EditProfileModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ReportModal from '@/components/modals/ReportModal';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { strings } from '@/lib/strings';
import { User } from '@/types';

interface ProfileActionsRowProps {
  profileUser: User;
  isOwnProfile: boolean;
  onUpdate: (patch: Partial<User>) => void;
  onRefetch: () => void;
}

// Port of ProfileClient.tsx's mobile name-row action slot. On mobile, Message isn't a
// separate button — web's own comment notes the row only has room for two elements
// (3-dot + Follow), so Message lives inside the 3-dot dropdown alongside Mute/Report/
// Block. Step 6 added Follow, step 7 added the 3-dot menu's real Mute/Report/Block
// actions, step 8 wires Edit Profile to the real EditProfileModal. Message's real
// destination (Messaging, Faz 5) stays visually complete but inert — same stub
// precedent Faz 1 established.
export default function ProfileActionsRow({ profileUser, isOwnProfile, onUpdate, onRefetch }: ProfileActionsRowProps) {
  const toast = useToast();
  const triggerRef = useRef<ComponentRef<typeof View>>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  if (profileUser.has_blocked_me) return null;

  if (isOwnProfile) {
    return (
      <>
        <Pressable
          onPress={() => setEditVisible(true)}
          className="flex-shrink-0 flex-row items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5"
        >
          <Pencil size={14} color="#d4d4d8" />
          <Text className="text-sm font-medium text-zinc-300">{strings.editProfile}</Text>
        </Pressable>
        <EditProfileModal
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          user={profileUser}
          onUpdate={(updated) => onUpdate(updated)}
        />
      </>
    );
  }

  const isBlocked = !!profileUser.is_blocked;
  const isMuted = !!profileUser.is_muted;

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y + height + 4, right: 16 });
      setMenuVisible(true);
    });
  };

  const handleMuteToggle = async () => {
    try {
      await api.post(`/users/${profileUser.username}/${isMuted ? 'unmute' : 'mute'}/`);
      onUpdate({ is_muted: !isMuted });
    } catch (error) {
      console.error('Failed to toggle mute status:', error);
      toast.error(strings.failedToUpdateMuteStatus);
    }
  };

  const handleBlockConfirm = async () => {
    try {
      if (isBlocked) {
        await api.post(`/users/${profileUser.username}/unblock/`);
        onUpdate({ is_blocked: false });
      } else {
        await api.post(`/users/${profileUser.username}/block/`);
        onUpdate({
          is_blocked: true,
          is_following: false,
          followers_count: profileUser.followers_count ? Math.max(0, profileUser.followers_count - 1) : 0,
        });
      }
      onRefetch();
    } catch (error) {
      console.error('Failed to toggle block status:', error);
      toast.error(strings.failedToUpdateBlockStatus);
    }
  };

  return (
    <View className="flex-shrink-0 flex-row items-center gap-2">
      <View ref={triggerRef} collapsable={false}>
        <Pressable onPress={openMenu} className="rounded-lg border border-zinc-700 bg-zinc-800 p-2">
          <MoreHorizontal size={16} color="#ffffff" />
        </Pressable>
      </View>
      {!isBlocked && (
        <FollowButton
          username={profileUser.username}
          isFollowing={!!profileUser.is_following}
          isRequested={!!profileUser.is_requested}
          isPrivateProfile={!!profileUser.settings?.privateProfile}
          followersCount={profileUser.followers_count || 0}
          onUpdate={onUpdate}
        />
      )}

      <ProfileOverflowMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchor={anchor}
        isMuted={isMuted}
        isBlocked={isBlocked}
        onMessage={() => {
          /* Messaging doesn't exist yet (Faz 5) — same inert-stub treatment as the rest
             of this phase's not-yet-built destinations. */
        }}
        onMuteToggle={handleMuteToggle}
        onReport={() => setReportVisible(true)}
        onBlockToggle={() => setConfirmVisible(true)}
      />

      <ConfirmDialog
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={handleBlockConfirm}
        title={isBlocked ? 'Unblock User' : 'Block User'}
        message={
          isBlocked
            ? `Are you sure you want to unblock @${profileUser.username}?`
            : `Are you sure you want to block @${profileUser.username}?`
        }
        confirmText={isBlocked ? strings.unblock : strings.block}
        isDanger={!isBlocked}
      />

      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} targetType="user" targetId={profileUser.id} />
    </View>
  );
}
