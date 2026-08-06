'use client';

import { useState } from 'react';
import { X, Flag } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/useTranslation';
import { useToast } from '@/context/ToastContext';

export type ReportTargetType = 'post' | 'review' | 'user' | 'conversation';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetType: ReportTargetType;
    targetId: number;
}

const REASON_KEYS = [
    'spam', 'harassment', 'hate_speech', 'nudity', 'violence',
    'misinformation', 'self_harm', 'impersonation', 'other',
] as const;

export default function ReportModal({ isOpen, onClose, targetType, targetId }: ReportModalProps) {
    const { t } = useTranslation();
    const toast = useToast();
    const [reason, setReason] = useState<string | null>(null);
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const reasonLabels: Record<typeof REASON_KEYS[number], string> = {
        spam: t('reportReasonSpam'),
        harassment: t('reportReasonHarassment'),
        hate_speech: t('reportReasonHateSpeech'),
        nudity: t('reportReasonNudity'),
        violence: t('reportReasonViolence'),
        misinformation: t('reportReasonMisinformation'),
        self_harm: t('reportReasonSelfHarm'),
        impersonation: t('reportReasonImpersonation'),
        other: t('reportReasonOther'),
    };

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
            toast.success(t('reportSubmitted'));
            handleClose();
        } catch (error: unknown) {
            const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(message === 'You cannot report your own content.' ? t('cannotReportOwnContent') : t('reportFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/40">
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider leading-none flex items-center gap-2">
                        <Flag className="h-4 w-4 text-red-500" />
                        {t('reportModalTitle')}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-1.5 text-zinc-500 hover:text-white rounded-full transition-colors cursor-pointer"
                    >
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>

                <div className="p-5 bg-zinc-900 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm text-zinc-300 font-medium mb-3">{t('reportReasonPrompt')}</p>
                    <div className="space-y-1.5">
                        {REASON_KEYS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setReason(key)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                                    reason === key
                                        ? 'bg-emerald-600/15 border border-emerald-600/50 text-emerald-400'
                                        : 'border border-transparent text-zinc-300 hover:bg-zinc-800'
                                }`}
                            >
                                {reasonLabels[key]}
                            </button>
                        ))}
                    </div>

                    <textarea
                        value={details}
                        onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
                        placeholder={t('reportDetailsPlaceholder')}
                        rows={3}
                        className="mt-4 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors resize-none"
                    />
                </div>

                <div className="p-5 border-t border-zinc-800 bg-zinc-950/40 flex justify-end gap-3.5">
                    <button
                        onClick={handleClose}
                        className="px-5 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850 font-bold transition-all text-xs cursor-pointer"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!reason || submitting}
                        className="px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer bg-red-650 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-red-950/20"
                    >
                        {t('submitReport')}
                    </button>
                </div>
            </div>
        </div>
    );
}
