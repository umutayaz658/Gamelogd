import { Modal, Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from '@/components/ui/Image';

interface ImageViewerModalProps {
  visible: boolean;
  onClose: () => void;
  uri: string | null;
}

// Scoped-down port of frontend/src/components/modals/ImageModal.tsx for the single-image
// case Profile actually uses it for (`images={viewerImage ? [viewerImage] : []}`, no
// `post` prop) — full-screen black backdrop, tap anywhere to close, contain-fit image.
// Deliberately drops the zoom/rotate toolbar and multi-image chevron nav: this call site
// never has more than one image, and pinch-zoom gesture handling for a single avatar/
// cover view isn't worth the complexity it would add — flagged simplification, not a
// silent cut. Multi-image swipe support (for post media) stays deferred to whenever
// PostMediaGrid itself becomes tappable (still fully inert per Faz 1 decision 4).
export default function ImageViewerModal({ visible, onClose, uri }: ImageViewerModalProps) {
  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/95" onPress={onClose}>
        <SafeAreaView className="flex-1">
          <View className="absolute left-4 top-4 z-10">
            <Pressable
              onPress={onClose}
              className="rounded-full bg-zinc-900/50 p-2"
              hitSlop={8}
            >
              <X size={24} color="#ffffff" />
            </Pressable>
          </View>

          <View className="flex-1 items-center justify-center p-4">
            <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
