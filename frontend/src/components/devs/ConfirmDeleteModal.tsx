import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
    /** 'danger' (default, red) for destructive actions; 'warning' (amber) for serious-but-non-destructive ones like an ownership transfer. */
    variant?: 'danger' | 'warning';
    confirmLabel?: string;
}

export default function ConfirmDeleteModal({ isOpen, title, description, onConfirm, onCancel, variant = 'danger', confirmLabel }: ConfirmDeleteModalProps) {
    if (!isOpen) return null;

    const isWarning = variant === 'warning';

    return (
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={onCancel}
        >
            <div
                className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-900 transition-all cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${isWarning ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <AlertTriangle className={`w-5 h-5 ${isWarning ? 'text-amber-400' : 'text-red-400'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-400 text-xs font-bold hover:bg-zinc-900 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-lg cursor-pointer ${
                            isWarning ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/20' : 'bg-red-600 hover:bg-red-500 shadow-red-950/20'
                        }`}
                    >
                        {confirmLabel ?? 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
