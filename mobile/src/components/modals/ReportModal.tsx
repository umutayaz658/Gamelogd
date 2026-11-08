import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Flag, X } from 'lucide-react-native';
import type { AxiosError } from 'axios';

import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { strings } from '@/lib/strings';

export type ReportTargetType = 'post' | 'review' | 'user' | 'conversation';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: number;
}

const REASON_KEYS = ['spam', 'harassment', 'hate_speech', 'nudity', 'violence', 'misinformation', 'self_harm', 'impersonation', 'other'] as const;

const REASON_LABELS: Record<(typeof REASON_KEYS)[number], string> = {
  spam: strings.reportReasonSpam,
  harassment: strings.reportReasonHarassment,
  hate_speech: strings.reportReasonHateSpeech,
  nudity: strings.reportReasonNudity,
  violence: strings.reportReasonViolence,
  misinformation: strings.reportReasonMisinformation,
  self_harm: strings.reportReasonSelfHarm,
  impersonation: strings.reportReasonImpersonation,
  other: strings.reportReasonOther,
};

// Generic port of frontend/src/components/modals/ReportModal.tsx — built reusable
// (targetType: post|review|user|conversation) per Faz 2 plan §2, but only wired up from
// one call site this phase (Profile's overflow menu, targetType="user"). The post/
// review/conversation call sites are Faz 3+'s job.
export default function ReportModal({ visible, onClose, targetType, targetId }: ReportModalProps) {
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setReason(null);
    setDetails('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/reports/', { target_type: targetType, target_id: targetId, reason, details });
      toast.success(strings.reportSubmitted);
      handleClose();
    } catch (error) {
      const message = (error as AxiosError<{ error?: string }>)?.response?.data?.error;
      toast.error(message === 'You cannot report your own content.' ? strings.cannotReportOwnContent : strings.reportFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 items-center justify-center bg-black/75 p-4">
        <View
          style={{ maxHeight: '85%' }}
          className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 bg-zinc-950/40 p-5">
            <View className="flex-row items-center gap-2">
              <Flag size={16} color="#ef4444" />
              <Text className="text-sm font-bold uppercase tracking-wider text-white">{strings.reportModalTitle}</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={8}>
              <X size={18} color="#71717a" />
            </Pressable>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20 }}>
            <Text className="mb-3 text-sm font-medium text-zinc-300">{strings.reportReasonPrompt}</Text>
            <View className="gap-1.5">
              {REASON_KEYS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setReason(key)}
                  className={`rounded-xl border px-4 py-2.5 ${
                    reason === key ? 'border-emerald-600/50 bg-emerald-600/15' : 'border-transparent'
                  }`}
                >
                  <Text className={`text-sm font-medium ${reason === key ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {REASON_LABELS[key]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={details}
              onChangeText={(text) => setDetails(text.slice(0, 1000))}
              placeholder={strings.reportDetailsPlaceholder}
              placeholderTextColor="#52525b"
              multiline
              numberOfLines={3}
              className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white"
              style={{ textAlignVertical: 'top' }}
            />
          </ScrollView>

          <View className="flex-row justify-end gap-3.5 border-t border-zinc-800 bg-zinc-950/40 p-5">
            <Pressable onPress={handleClose} className="rounded-xl border border-zinc-800 px-5 py-2">
              <Text className="text-center text-xs font-bold text-zinc-400">{strings.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!reason || submitting}
              className={`rounded-xl bg-red-650 px-6 py-2 ${!reason || submitting ? 'opacity-40' : ''}`}
            >
              <Text className="text-center text-xs font-bold text-white">{strings.submitReport}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
