'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useTranslation } from '@/lib/useTranslation';

// Generous on purpose: card generation involves the server fetching a remote cover image
// itself (Satori rasterizes it), which can legitimately take longer than a typical page
// load, especially over a slower dev-environment network path.
const LOAD_TIMEOUT_MS = 25000;

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
    const [loadError, setLoadError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [sharing, setSharing] = useState(false);

    const baseCardUrl = `/api/share-card/${cardType}/${entityId}`;
    const cardUrl = retryCount > 0 ? `${baseCardUrl}?retry=${retryCount}` : baseCardUrl;
    const fileName = `gamelogd-${cardType}-${entityId}.png`;

    // The <img> never gets an onError for a route that hangs (as opposed to one that fails
    // fast) — without this timeout, a slow/never-resolving card generation left the spinner
    // spinning forever with no way for the user to know something had gone wrong.
    useEffect(() => {
        if (!isOpen || imageLoaded) return;
        const timer = setTimeout(() => setLoadError(true), LOAD_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [isOpen, imageLoaded, cardUrl]);

    if (!isOpen) return null;

    const handleRetry = () => {
        setImageLoaded(false);
        setLoadError(false);
        setRetryCount((n) => n + 1);
    };

    const handleShare = async () => {
        setSharing(true);
        try {
            const res = await fetch(cardUrl);
            if (!res.ok) throw new Error('share card fetch failed');
            const blob = await res.blob();
            const file = new File([blob], fileName, { type: 'image/png' });
            if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: shareTitle, text: shareText });
            } else {
                toast.error(t('shareNotSupported'));
            }
        } catch {
            // User cancelling the native share sheet lands here too, alongside real failures —
            // there's no reliable way to tell them apart, so we stay silent rather than show a
            // false-positive error every time someone backs out of the share sheet.
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

                <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl">
                    {!imageLoaded && !loadError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                        </div>
                    )}
                    {loadError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                            <AlertCircle className="h-8 w-8 text-red-400" />
                            <p className="text-sm text-zinc-400">{t('shareCardError')}</p>
                            <button
                                onClick={handleRetry}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                <RefreshCw className="h-4 w-4" />
                                {t('tryAgain')}
                            </button>
                        </div>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={cardUrl}
                            alt="Share card"
                            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => setLoadError(true)}
                        />
                    )}
                </div>

                <div className="flex items-center gap-3 w-full">
                    <a
                        href={cardUrl}
                        download={fileName}
                        aria-disabled={!imageLoaded}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
                            imageLoaded
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                : 'bg-zinc-800/50 text-zinc-500 pointer-events-none'
                        }`}
                    >
                        <Download className="h-4 w-4" />
                        {t('downloadCard')}
                    </a>
                    <button
                        onClick={handleShare}
                        disabled={sharing || !imageLoaded}
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
