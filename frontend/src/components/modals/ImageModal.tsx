import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Post } from '@/types';
import { useTranslation } from '@/lib/useTranslation';
import PostCard from '@/components/PostCard';
import PostComposer from '@/components/PostComposer';

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    initialIndex?: number;
    post?: Post;
}

export default function ImageModal({ isOpen, onClose, images, initialIndex = 0, post }: ImageModalProps) {
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Sidebar States — the thread panel reuses PostCard/PostComposer for the root
    // post, reply composer, and reply list, so only the reply data itself lives here.
    const [replies, setReplies] = useState<Post[]>([]);
    const [loadingReplies, setLoadingReplies] = useState(false);

    const closedViaPopstate = useRef(false);

    // Reset when changing images or posts
    useEffect(() => {
        setZoom(1);
        setRotation(0);
    }, [currentIndex]);

    useEffect(() => {
        if (post) {
            setCurrentIndex(initialIndex);
        }
    }, [post, initialIndex]);

    // Fetch replies
    useEffect(() => {
        if (isOpen && post?.id) {
            setReplies([]);
            setLoadingReplies(true);
            api.get('/posts/', { params: { parent: post.id } })
                .then((res) => {
                    setReplies(res.data.results || res.data || []);
                })
                .catch((err) => {
                    console.error('Failed to load replies in image modal:', err);
                })
                .finally(() => {
                    setLoadingReplies(false);
                });
        }
    }, [isOpen, post?.id]);

    // Sync modal state with browser history / popstate
    useEffect(() => {
        if (!isOpen) return;

        closedViaPopstate.current = false;
        // Push a state into browser history when modal opens
        window.history.pushState({ modalOpen: true }, '');

        const handlePopState = (e: PopStateEvent) => {
            closedViaPopstate.current = true;
            onClose();
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            // If closed manually (not via popstate/back button), trigger back() to clean up the history stack
            if (!closedViaPopstate.current) {
                window.history.back();
            }
        };
    }, [isOpen, onClose]);

    // Handle ESC and Arrow keys to close/navigate, unless user is typing in inputs
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            // Prevent shortcut actions while typing in text inputs or textareas
            const activeElem = document.activeElement;
            if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
                return;
            }

            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && images.length > 1) handleNext();
            if (e.key === 'ArrowLeft' && images.length > 1) handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex, images]);

    if (!isOpen || images.length === 0) return null;

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
    const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

    return (
        <div
            className="fixed inset-0 z-[100] flex bg-black/95 select-none animate-in fade-in duration-200"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
            {/* Left Column: Image Viewer */}
            <div
                className="relative flex-1 flex items-center justify-center bg-black overflow-hidden h-full"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
            >
                {/* Close Button */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="absolute top-4 left-4 p-2 text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 rounded-full transition-colors z-50 cursor-pointer"
                    title="Close"
                >
                    <X className="h-6 w-6" />
                </button>

                {/* Toolbar */}
                <div 
                    className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/60 to-transparent z-40"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="text-sm font-semibold text-zinc-400 ml-12">
                        {currentIndex + 1} / {images.length}
                    </span>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleZoomOut}
                            className="p-2 text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
                            title="Zoom Out"
                        >
                            <ZoomOut className="h-5 w-5" />
                        </button>
                        <button 
                            onClick={handleZoomIn}
                            className="p-2 text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
                            title="Zoom In"
                        >
                            <ZoomIn className="h-5 w-5" />
                        </button>
                        <button 
                            onClick={handleRotate}
                            className="p-2 text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
                            title="Rotate"
                        >
                            <RotateCw className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Left Navigation Chevron */}
                {images.length > 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                        className="absolute left-6 p-3 bg-zinc-900/60 hover:bg-zinc-800 text-white rounded-full transition-colors z-45 border border-zinc-850 cursor-pointer"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                )}

                {/* Image Wrapper (Letting wrapper click trigger onClose) */}
                <div
                    className="w-full h-full max-w-[85vw] max-h-[85vh] flex items-center justify-center p-4"
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                >
                    <img
                        src={images[currentIndex]}
                        alt="Post media expanded view"
                        style={{
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                        className="max-w-full max-h-full object-contain rounded shadow-2xl pointer-events-auto cursor-default"
                        onClick={(e) => e.stopPropagation()} // Clicking on the image itself does not close the modal
                    />
                </div>

                {/* Right Navigation Chevron */}
                {images.length > 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="absolute right-6 p-3 bg-zinc-900/60 hover:bg-zinc-800 text-white rounded-full transition-colors z-45 border border-zinc-850 cursor-pointer"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>
                )}
            </div>

            {/* Right Column: Thread panel (Desktop only) — reuses the app's own PostCard/
                PostComposer so the root post, reply composer, and replies all look and
                behave exactly like everywhere else in the app (full action bar, real
                links, standard composer with media/GIF/emoji/poll). */}
            {post && (
                <div
                    className="hidden lg:flex flex-col w-[380px] xl:w-[420px] h-full bg-zinc-950 border-l border-zinc-900 overflow-y-auto text-zinc-200 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent p-4 gap-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <PostCard post={post} isDetailView />

                    <PostComposer
                        onPostCreated={(newReply) => setReplies((prev) => [newReply, ...prev])}
                        replyingTo={post.user}
                        parentId={post.id}
                        parentType="post"
                    />

                    {loadingReplies ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                        </div>
                    ) : replies.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            {replies.map((reply) => (
                                <PostCard key={reply.id} post={reply} />
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-xs text-zinc-500 font-medium">
                            {t('noRepliesYet')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
