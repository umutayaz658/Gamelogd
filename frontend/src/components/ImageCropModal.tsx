'use client';

import { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Check, X, ZoomIn } from 'lucide-react';
import { useTranslation } from '@/lib/useTranslation';

interface ImageCropModalProps {
    imageSrc: string;
    aspect: number;
    cropShape: 'round' | 'rect';
    onCancel: () => void;
    onConfirm: (blob: Blob) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function getCroppedBlob(imageSrc: string, cropPixels: Area): Promise<Blob> {
    const image = await loadImage(imageSrc);
    const canvas = document.createElement('canvas');
    canvas.width = cropPixels.width;
    canvas.height = cropPixels.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    ctx.drawImage(
        image,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        cropPixels.width,
        cropPixels.height,
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Failed to export cropped image'))),
            'image/jpeg',
            0.92,
        );
    });
}

export default function ImageCropModal({ imageSrc, aspect, cropShape, onCancel, onConfirm }: ImageCropModalProps) {
    const { t } = useTranslation();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixelsValue: Area) => {
        setCroppedAreaPixels(croppedAreaPixelsValue);
    }, []);

    const handleApply = async () => {
        if (!croppedAreaPixels) return;
        setIsProcessing(true);
        try {
            const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
            onConfirm(blob);
        } catch (err) {
            console.error('Failed to crop image:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-black border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <button onClick={onCancel} className="p-2 rounded-full hover:bg-zinc-800 transition-colors">
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                    <h2 className="text-base font-bold text-white">{t('cropImage')}</h2>
                    <button
                        onClick={handleApply}
                        disabled={isProcessing || !croppedAreaPixels}
                        className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-full hover:bg-emerald-500 disabled:opacity-50 transition-colors text-sm flex items-center gap-1.5"
                    >
                        <Check className="h-4 w-4" />
                        {t('apply')}
                    </button>
                </div>

                <div className="relative w-full h-[360px] bg-zinc-950">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        cropShape={cropShape}
                        showGrid={cropShape === 'rect'}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                    />
                </div>

                <div className="flex items-center gap-3 px-6 py-4">
                    <ZoomIn className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        aria-label={t('zoom')}
                        className="w-full accent-emerald-500"
                    />
                </div>
            </div>
        </div>
    );
}
