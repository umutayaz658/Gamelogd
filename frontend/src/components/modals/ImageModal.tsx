import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Heart, MessageCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { Post } from '@/types';
import { useTranslation } from '@/lib/useTranslation';
import Link from 'next/link';

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: string[];
    initialIndex?: number;
    post?: Post;
}

const renderContentWithLinks = (content: string | undefined) => {
    if (!content) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hashtagRegex = /(#[a-zA-Z0-9_]+)/g;
    const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;
    
    const urlParts = content.split(urlRegex);
    
    return urlParts.map((urlPart, urlIndex) => {
        if (urlPart.match(urlRegex)) {
            return (
                <a
                    key={`url-${urlIndex}`}
                    href={urlPart}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-emerald-500 hover:text-emerald-400 hover:underline break-all font-medium"
                >
                    {urlPart}
                </a>
            );
        }
        
        const hashtagParts = urlPart.split(hashtagRegex);
        return hashtagParts.map((hashtagPart, hashtagIndex) => {
            if (hashtagPart.match(hashtagRegex)) {
                const cleanTag = hashtagPart.slice(1);
                return (
                    <Link
                        key={`tag-${urlIndex}-${hashtagIndex}`}
                        href={`/explore?hashtag=${cleanTag}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-emerald-500 hover:text-emerald-400 font-bold hover:underline"
                    >
                        {hashtagPart}
                    </Link>
                );
            }
            
            const mentionParts = hashtagPart.split(mentionRegex);
            return mentionParts.map((mentionPart, mentionIndex) => {
                if (mentionPart.match(mentionRegex)) {
                    const username = mentionPart.slice(1);
                    return (
                        <Link
                            key={`mention-${urlIndex}-${hashtagIndex}-${mentionIndex}`}
                            href={`/${username}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-emerald-500 hover:text-emerald-400 font-bold hover:underline"
                        >
                            {mentionPart}
                        </Link>
                    );
                }
                return mentionPart;
            });
        });
    });
};

export default function ImageModal({ isOpen, onClose, images, initialIndex = 0, post }: ImageModalProps) {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Sidebar States
    const [replies, setReplies] = useState<Post[]>([]);
    const [loadingReplies, setLoadingReplies] = useState(false);
    const [isLiked, setIsLiked] = useState(post?.is_liked || false);
    const [likesCount, setLikesCount] = useState(post?.likes_count ?? (Array.isArray(post?.likes) ? post?.likes.length : post?.likes) ?? 0);
    const [replyContent, setReplyContent] = useState('');
    const [isPostingReply, setIsPostingReply] = useState(false);

    const closedViaPopstate = useRef(false);

    // Reset when changing images or posts
    useEffect(() => {
        setZoom(1);
        setRotation(0);
    }, [currentIndex]);

    useEffect(() => {
        if (post) {
            setIsLiked(post.is_liked || false);
            setLikesCount(post.likes_count ?? (Array.isArray(post.likes) ? post.likes.length : post.likes) ?? 0);
            setCurrentIndex(initialIndex);
        }
    }, [post, initialIndex]);

    // Fetch replies
    useEffect(() => {
        if (isOpen && post?.id) {
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

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !post) return;

        try {
            setIsLiked(!isLiked);
            setLikesCount((prev) => Math.max(0, isLiked ? prev - 1 : prev + 1));
            await api.post('/likes/', { post: post.id });
        } catch (error) {
            console.error('Failed to toggle like', error);
            setIsLiked(isLiked);
            setLikesCount((prev) => Math.max(0, isLiked ? prev + 1 : prev - 1));
        }
    };

    const handlePostReply = async () => {
        if (!replyContent.trim() || !post) return;
        setIsPostingReply(true);
        try {
            const formData = new FormData();
            formData.append('content', replyContent);
            formData.append('parent', post.id.toString());
            formData.append('type', 'reply');

            const response = await api.post('/posts/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setReplies((prev) => [response.data, ...prev]);
            setReplyContent('');
        } catch (err) {
            console.error('Failed to post reply:', err);
            alert('Failed to send reply');
        } finally {
            setIsPostingReply(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex bg-black/95 select-none animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Left Column: Image Viewer */}
            <div 
                className="relative flex-1 flex items-center justify-center bg-black overflow-hidden h-full"
                onClick={onClose}
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
                    onClick={onClose}
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

            {/* Right Column: Premium Twitter-style Sidebar (Desktop only) */}
            {post && (
                <div 
                    className="hidden lg:flex flex-col w-[380px] xl:w-[420px] h-full bg-zinc-950 border-l border-zinc-900 overflow-y-auto text-zinc-200 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header details */}
                    <div className="p-4 border-b border-zinc-900 flex flex-col gap-3.5 bg-zinc-950">
                        {/* User Profile Info */}
                        <div className="flex items-center gap-3">
                            <img
                                src={getImageUrl(post.user.avatar, post.user.username)}
                                alt={post.user.username}
                                className="h-10 w-10 rounded-full bg-zinc-800 object-cover border border-zinc-900"
                            />
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white text-sm leading-snug truncate hover:underline cursor-pointer">
                                    {post.user.real_name || post.user.username}
                                </h4>
                                <p className="text-zinc-500 text-xs truncate">
                                    @{post.user.username.toLowerCase()}
                                </p>
                            </div>
                        </div>

                        {/* Title (if any) */}
                        {post.title && (
                            <h3 className="font-bold text-base text-zinc-100 leading-snug">
                                {post.title}
                            </h3>
                        )}

                        {/* Text Content */}
                        <div className="text-[14.5px] text-zinc-200 whitespace-pre-wrap break-words leading-relaxed tracking-normal font-normal">
                            {renderContentWithLinks(post.content)}
                        </div>

                        {/* Timestamp */}
                        <div className="text-[11.5px] text-zinc-500 pt-2.5 border-t border-zinc-900/60 flex flex-wrap gap-1.5 font-medium">
                            <span>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>{new Date(post.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>                        {/* Likes & Replies Stats (Failsafe 0 checks) */}
                        <div className="flex gap-4 text-xs font-semibold py-2.5 border-t border-b border-zinc-900/80">
                            <span><strong className="text-white font-bold text-sm">{likesCount ?? 0}</strong> <span className="text-zinc-500 font-medium">{t('likes')}</span></span>
                            <span><strong className="text-white font-bold text-sm">{replies.length}</strong> <span className="text-zinc-500 font-medium">{t('replies')}</span></span>
                        </div>

                        {/* Action Buttons with Twitter-style Hovers */}
                        <div className="flex justify-around items-center pt-1 text-zinc-400">
                            <button 
                                onClick={() => {
                                    document.getElementById('modal-reply-textarea')?.focus();
                                }}
                                className="flex items-center gap-2 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all duration-200 py-1.5 px-4 rounded-full cursor-pointer"
                            >
                                <MessageCircle className="h-4 w-4" />
                                <span className="text-xs font-bold">{t('reply')}</span>
                            </button>

                            <button 
                                onClick={handleLike} 
                                className={`flex items-center gap-2 hover:text-pink-500 hover:bg-pink-500/10 transition-all duration-200 py-1.5 px-4 rounded-full cursor-pointer ${isLiked ? 'text-pink-500' : ''}`}
                            >
                                <Heart className={`h-4 w-4 ${isLiked ? 'fill-pink-500' : ''}`} />
                                <span className="text-xs font-bold">{t('like')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Sticky Reply Composer (Sleeker integration) */}
                    <div className="p-4 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-10 flex gap-3">
                        {user ? (
                            <>
                                <img
                                    src={getImageUrl(user.avatar, user.username)}
                                    alt={user.username}
                                    className="h-8 w-8 rounded-full bg-zinc-800 object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <textarea
                                        id="modal-reply-textarea"
                                        placeholder={t('postYourReply')}
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handlePostReply();
                                            }
                                        }}
                                        className="w-full bg-transparent text-zinc-200 placeholder:text-zinc-655 text-sm focus:outline-none resize-none min-h-[44px] max-h-[120px] leading-relaxed"
                                    />
                                    <div className="flex justify-end mt-2">
                                        <button
                                            onClick={handlePostReply}
                                            disabled={isPostingReply || !replyContent.trim()}
                                            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-850 disabled:text-zinc-550 disabled:cursor-not-allowed text-white text-xs font-bold px-4.5 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                        >
                                            {isPostingReply ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    <span>{t('replying')}</span>
                                                </>
                                            ) : (
                                                <span>{t('reply')}</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-2 w-full text-xs text-zinc-500">
                                {t('signInToReply')}
                            </div>
                        )}
                    </div>

                    {/* Replies List (Modern, spaced layout) */}
                    <div className="flex-1 bg-zinc-950/20">
                        {loadingReplies ? (
                            <div className="flex justify-center items-center py-10">
                                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                            </div>
                        ) : replies.length > 0 ? (
                            <div className="divide-y divide-zinc-900/60">
                                {replies.map((reply) => (
                                    <div key={reply.id} className="p-4 flex gap-3 hover:bg-zinc-900/10 transition-colors duration-200">
                                        <img
                                            src={getImageUrl(reply.user.avatar, reply.user.username)}
                                            alt={reply.user.username}
                                            className="h-8 w-8 rounded-full bg-zinc-800 object-cover flex-shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <span className="font-bold text-white text-xs truncate hover:underline cursor-pointer">
                                                    {reply.user.real_name || reply.user.username}
                                                </span>
                                                <span className="text-zinc-500 text-[10px] truncate">
                                                    @{reply.user.username.toLowerCase()}
                                                </span>
                                                <span className="text-zinc-700 text-[10px]">•</span>
                                                <span className="text-zinc-550 text-[10px]">
                                                    {new Date(reply.timestamp).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed font-normal">
                                                {renderContentWithLinks(reply.content)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-xs text-zinc-500 font-medium">
                                {t('noRepliesYet')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
