'use client';

import { useState } from 'react';
import { X, Download, Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useTranslation } from '@/lib/useTranslation';

export type ShareCardType = 'review' | 'devlog' | 'project' | 'organisation' | 'game-dna';

interface ShareCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    cardType: ShareCardType;
    entityId: string | number;
    shareTitle?: string;
    shareText?: string;
}

export default function ShareCardModal({
    isOpen,
    onClose,
    cardType,
    entityId,
    shareTitle,
    shareText,
}: ShareCardModalProps) {
    const { t } = useTranslation();
    const toast = useToast();
    const [imageLoaded, setImageLoaded] = useState(false);
    const [sharing, setSharing] = useState(false);

    if (!isOpen) return null;

    const cardUrl = `/api/share-card/${cardType}/${entityId}`;
    const fileName = `gamelogd-${cardType}-${entityId}.png`;

    const handleShare = async () => {
        setSharing(true);
        try {
            const res = await fetch(cardUrl);
            const blob = await res.blob();
            const file = new File([blob], fileName, { type: 'image/png' });
            if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: shareTitle, text: shareText });
            } else {
                toast.error(t('shareNotSupported'));
            }
        } catch {
            // User cancelled the native share sheet, or the share failed silently — either
            // way there's nothing actionable to show the user here.
        } finally {
            setSharing(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4"
            onClick={onClose}
        >
            <div
                className="relative flex flex-col items-center gap-5 w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
                    title="Close"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl">
                    {!imageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                        </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={cardUrl}
                        alt="Share card"
                        className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setImageLoaded(true)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full">
                    <a
                        href={cardUrl}
                        download={fileName}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-semibold text-sm transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        {t('downloadCard')}
                    </a>
                    <button
                        onClick={handleShare}
                        disabled={sharing}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer disabled:cursor-default"
                    >
                        {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                        {t('shareCard')}
                    </button>
                </div>
            </div>
        </div>
    );
}
