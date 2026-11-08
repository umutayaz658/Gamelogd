import { Modal, Pressable, Text, View } from 'react-native';
import { MessageSquare } from 'lucide-react-native';

import { strings } from '@/lib/strings';

interface Anchor {
  top: number;
  right: number;
}

interface ProfileOverflowMenuProps {
  visible: boolean;
  onClose: () => void;
  anchor: Anchor | null;
  isMuted: boolean;
  isBlocked: boolean;
  onMessage: () => void;
  onMuteToggle: () => void;
  onReport: () => void;
  onBlockToggle: () => void;
}

// Port of ProfileClient.tsx's mobile 3-dot dropdown (Message + Mute/Unmute + Report +
// Block/Unblock — web's own comment notes Message lives here on mobile since the row
// only has room for 3-dot + Follow). Positioned via a measured anchor (the 3-dot
// button's on-screen coordinates) rather than web's CSS `absolute right-0 mt-2`, since RN
// has no equivalent relative-positioning-from-parent shorthand.
export default function ProfileOverflowMenu({
  visible,
  onClose,
  anchor,
  isMuted,
  isBlocked,
  onMessage,
  onMuteToggle,
  onReport,
  onBlockToggle,
}: ProfileOverflowMenuProps) {
  if (!anchor) return null;

  const item = (label: string, onPress: () => void, danger = false) => (
    <Pressable
      onPress={() => {
        onClose();
        onPress();
      }}
      className="rounded-lg px-3 py-2"
    >
      <Text className={`text-xs font-bold ${danger ? 'text-red-500' : 'text-zinc-300'}`}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1" onPress={onClose}>
        <View
          style={{ position: 'absolute', top: anchor.top, right: anchor.right }}
          className="w-40 gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1 shadow-2xl"
        >
          {!isBlocked && (
            <Pressable
              onPress={() => {
                onClose();
                onMessage();
              }}
              className="flex-row items-center gap-2 rounded-lg px-3 py-2"
            >
              <MessageSquare size={14} color="#d4d4d8" />
              <Text className="text-xs font-bold text-zinc-300">{strings.messageBtn}</Text>
            </Pressable>
          )}
          {item(isMuted ? strings.unmuteUser : strings.muteUser, onMuteToggle)}
          {item(strings.reportUser, onReport)}
          {item(isBlocked ? strings.unblock : strings.block, onBlockToggle, true)}
        </View>
      </Pressable>
    </Modal>
  );
}
