'use client';

import { X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/40">
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider leading-none">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-500 hover:text-white rounded-full transition-colors cursor-pointer"
                    >
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>

                {/* Message */}
                <div className="p-6 bg-zinc-900">
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium">{message}</p>
                </div>

                {/* Footer Buttons */}
                <div className="p-5 border-t border-zinc-800 bg-zinc-950/40 flex justify-end gap-3.5">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850 font-bold transition-all text-xs cursor-pointer"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
                            isDanger
                                ? 'bg-red-650 hover:bg-red-600 text-white shadow-red-950/20'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
