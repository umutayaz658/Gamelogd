'use client';

import Link from 'next/link';
import { MoreHorizontal, MessageCircle, Heart, Share2, Check, EyeOff, Eye, Trash2, Flag, UserX, VolumeX, ExternalLink, Copy, Send } from 'lucide-react';
import { Review } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useReplyModal } from '@/context/ReplyModalContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import api from '@/lib/api';
import { useState, useId, useRef, useEffect } from 'react';
import SharePostModal from './SharePostModal';

interface ReviewCardProps {
    review: Review;
    isDetailView?: boolean;
}

export default function ReviewCard({ review, isDetailView = false }: ReviewCardProps) {
    const router = useRouter();
    const { openReplyModal } = useReplyModal();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [isSpoilerVisible, setIsSpoilerVisible] = useState(false);
    const baseId = useId().replace(/:/g, '-');
    
    const [isLiked, setIsLiked] = useState(review.is_liked || false);
    const [likeCount, setLikeCount] = useState(review.likes_count ?? 0);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [likeAnimation, setLikeAnimation] = useState(false);
    
    const shareMenuRef = useRef<HTMLDivElement>(null);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
                setShowShareMenu(false);
            }
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isOwner = user?.username === review.user.username;

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        const previousIsLiked = isLiked;
        const previousLikeCount = likeCount;
        
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);

        if (!isLiked) {
            setLikeAnimation(true);
            setTimeout(() => setLikeAnimation(false), 400);
        }

        try {
            await api.post('/likes/', { review: review.id });
        } catch (error) {
            console.error('Failed to toggle like', error);
            setIsLiked(previousIsLiked);
            setLikeCount(previousLikeCount);
        }
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/${review.user.username}/review/${review.id}`;
        navigator.clipboard.writeText(url);
        setShowShareMenu(false);
        showToast('Link copied to clipboard!', 'success');
    };

    const handleShareViaMessage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowShareMenu(false);
        setShowShareModal(true);
    };

    const handleShareExternal = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/${review.user.username}/review/${review.id}`;
        if (navigator.share) {
            navigator.share({
                title: `${review.game.title} review by @${review.user.username}`,
                text: review.content?.substring(0, 100) || '',
                url: url,
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(url);
            showToast('Link copied!', 'success');
        }
        setShowShareMenu(false);
    };

    const handleReport = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMoreMenu(false);
        showToast('Review reported. Thank you for your feedback.', 'info');
    };

    const handleMuteUser = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMoreMenu(false);
        showToast(`@${review.user.username} has been muted`, 'success');
    };

    const handleDeleteReview = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMoreMenu(false);
        try {
            await api.delete(`/reviews/${review.id}/`);
            showToast('Review deleted', 'success');
            // Refresh page since reviews aren't in feed context
            window.location.reload();
        } catch (error) {
            console.error('Failed to delete review', error);
            showToast('Failed to delete review', 'error');
        }
    };

    const handleCardClick = () => {
        router.push(`/${review.user.username}/review/${review.id}`);
    };

    return (
        <>
            <div
                onClick={handleCardClick}
                className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 cursor-pointer card-hover`}
            >
                <div className="flex gap-4">
                    {/* User Avatar */}
                    <div className="flex flex-col items-center flex-shrink-0 w-fit">
                        <Link
                            href={`/${review.user.username}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={getImageUrl(review.user.avatar, review.user.username)}
                                alt={review.user.username}
                                className="h-10 w-10 rounded-full bg-zinc-800 object-cover hover:opacity-80 transition-opacity"
                            />
                        </Link>
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* Header: Name, Username, Date, More Button */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/${review.user.username}`}
                                    className="font-bold text-white hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {review.user.username}
                                </Link>
                                <Link
                                    href={`/${review.user.username}`}
                                    className="text-zinc-500 text-sm hover:text-zinc-400"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    @{review.user.username.toLowerCase()}
                                </Link>
                                <span className="text-zinc-700 text-sm">•</span>
                                <span className="text-zinc-500 text-sm hover:underline">
                                    {new Date(review.timestamp).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="relative" ref={moreMenuRef}>
                                <button
                                    className="text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 p-2 rounded-full transition-all hover:scale-110 active:scale-95"
                                    onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); setShowShareMenu(false); }}
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {showMoreMenu && (
                                    <div className="absolute right-0 mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                        {isOwner ? (
                                            <button
                                                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                                onClick={handleDeleteReview}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete Review
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                                    onClick={handleMuteUser}
                                                >
                                                    <UserX className="h-4 w-4" />
                                                    Mute @{review.user.username}
                                                </button>
                                                <div className="border-t border-zinc-800" />
                                                <button
                                                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                                    onClick={handleReport}
                                                >
                                                    <Flag className="h-4 w-4" />
                                                    Report Review
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Review Content */}
                        <div className="flex gap-4 mb-3">
                            {/* Game Cover */}
                            <div className="flex-shrink-0 w-24 aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden shadow-md">
                                {review.game.cover_image && (
                                    <img
                                        src={getImageUrl(review.game.cover_image)}
                                        alt={review.game.title}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>

                            {/* Review Details */}
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                    <h3 className="font-bold text-lg text-white leading-tight mb-1">{review.game.title}</h3>

                                    {/* Rating Stars */}
                                    <div className="flex items-center gap-1 mb-2">
                                        <div className={`flex gap-0.5 ${Number(review.rating) >= 8 ? 'text-emerald-500' : Number(review.rating) >= 5 ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {[...Array(5)].map((_, i) => {
                                                const ratingVal = Number(review.rating) / 2;
                                                const fillPercentage = Math.max(0, Math.min(100, (ratingVal - i) * 100));
                                                const absoluteWidth = (fillPercentage / 100) * 24;
                                                const clipId = `star-clip-${baseId}-${review.id}-${i}`;

                                                return (
                                                    <div key={i} className="relative h-4 w-4">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute top-0 left-0 h-4 w-4 opacity-30">
                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                        </svg>
                                                        {fillPercentage > 0 && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute top-0 left-0 h-4 w-4">
                                                                <defs>
                                                                    <clipPath id={clipId}>
                                                                        <rect x="0" y="0" width={absoluteWidth} height="24" />
                                                                    </clipPath>
                                                                </defs>
                                                                <g clipPath={`url(#${clipId})`}>
                                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                                </g>
                                                            </svg>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <span className={`text-sm font-bold ${Number(review.rating) >= 8 ? 'text-emerald-500' : Number(review.rating) >= 5 ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {Number(review.rating).toFixed(1)}
                                        </span>
                                    </div>

                                    {/* Badges */}
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {review.is_liked && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-pink-500/10 text-pink-500 border border-pink-500/20">
                                                <Heart className="h-3 w-3 fill-current" /> Liked
                                            </span>
                                        )}
                                        {review.is_completed && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                <Check className="h-3 w-3" /> Completed
                                            </span>
                                        )}
                                        {review.contains_spoilers && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsSpoilerVisible(!isSpoilerVisible);
                                                }}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors"
                                            >
                                                {isSpoilerVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                                Spoilers
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Review Comment (with Blur Logic) */}
                        {review.content && (
                            <div className="relative mb-3">
                                <p className={`text-zinc-300 whitespace-pre-wrap leading-relaxed transition-all duration-300 ${review.contains_spoilers && !isSpoilerVisible ? 'blur-sm select-none opacity-50' : ''}`}>
                                    {review.content}
                                </p>

                            </div>
                        )}

                        {/* Actions Footer */}
                        <div className="flex items-center justify-between mt-2 text-zinc-500 border-t border-zinc-800/50 pt-3">
                            <button
                                className="flex items-center gap-2 hover:text-emerald-500 group transition-all"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openReplyModal({ ...review, type: 'review' });
                                }}
                            >
                                <div className="p-2 rounded-full group-hover:bg-emerald-500/10 transition-all group-hover:scale-110 active:scale-95">
                                    <MessageCircle className="h-4 w-4" />
                                </div>
                                <span className="text-sm">{review.replies_count ?? 0}</span>
                            </button>

                            <button
                                className={`flex items-center gap-2 group transition-all ${isLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
                                onClick={handleLike}
                            >
                                <div className={`p-2 rounded-full group-hover:bg-pink-500/10 transition-all group-hover:scale-110 active:scale-95 ${likeAnimation ? 'scale-125' : 'scale-100'}`} style={{ transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                                    <Heart className={`h-4 w-4 transition-all ${isLiked ? 'fill-pink-500 text-pink-500' : ''} ${likeAnimation ? 'scale-110' : ''}`} />
                                </div>
                                <span className={`text-sm ${isLiked ? 'text-pink-500' : ''}`}>{likeCount}</span>
                            </button>

                            <div className="relative" ref={shareMenuRef}>
                                <button
                                    className="flex items-center gap-2 hover:text-blue-500 group transition-all"
                                    onClick={(e) => { e.stopPropagation(); setShowShareMenu(!showShareMenu); setShowMoreMenu(false); }}
                                >
                                    <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-all group-hover:scale-110 active:scale-95">
                                        <Share2 className="h-4 w-4" />
                                    </div>
                                </button>
                                {showShareMenu && (
                                    <div className="absolute right-0 bottom-full mb-1 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                            onClick={handleCopyLink}
                                        >
                                            <Copy className="h-4 w-4" />
                                            Copy Link
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                            onClick={handleShareViaMessage}
                                        >
                                            <Send className="h-4 w-4" />
                                            Send via Message
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                            onClick={handleShareExternal}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Share externally
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Share Review Modal */}
            <SharePostModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                reviewId={review.id}
                contentPreview={`${review.game.title} — ${review.content?.substring(0, 60) || ''}`}
            />
        </>
    );
}
