'use client';

import { usePostModal } from '@/context/PostModalContext';
import { useFeed } from '@/context/FeedContext';
import { useTranslation } from '@/lib/useTranslation';
import { X } from 'lucide-react';
import PostComposer from './PostComposer';
import { Post } from '@/types';

export default function PostModal() {
    const { isOpen, closePostModal } = usePostModal();
    const { addFeedItem } = useFeed();
    const { t } = useTranslation();

    if (!isOpen) return null;

    const handlePostCreated = (post: Post) => {
        addFeedItem(post);
        closePostModal();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={closePostModal}
        >
            <div
                className="w-full max-w-xl bg-black border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black/50 backdrop-blur-md z-10">
                    <button
                        onClick={closePostModal}
                        className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                    <span className="font-bold text-white">{t('post')}</span>
                    <div className="w-9" />
                </div>

                {/* Composer — PostComposer renders its own bg-zinc-900/border-zinc-800 box,
                    same nested-card look ReplyModal uses inside this bg-black shell. */}
                <div className="flex-1 overflow-y-auto scrollbar-thin-dark p-4">
                    <PostComposer onPostCreated={handlePostCreated} />
                </div>
            </div>
        </div>
    );
}
