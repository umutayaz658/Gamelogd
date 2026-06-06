'use client';

import Link from 'next/link';
import { MoreHorizontal, MessageCircle, Heart, Share2, Check, EyeOff, Eye, Bookmark, Trash2, Link as LinkIcon } from 'lucide-react';
import { Review } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useReplyModal } from '@/context/ReplyModalContext';
import { useState, useId, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

interface ReviewCardProps {
    review: Review;
    isDetailView?: boolean;
}

export default function ReviewCard({ review, isDetailView = false }: ReviewCardProps) {
    const router = useRouter();
    const { openReplyModal } = useReplyModal();
    const { user } = useAuth();
    const [isSpoilerVisible, setIsSpoilerVisible] = useState(false);
    const baseId = useId().replace(/:/g, '-');

    const [isLiked, setIsLiked] = useState(review.is_liked_by_user || false);
    const [likesCount, setLikesCount] = useState(review.likes_count || 0);
    const [isBookmarked, setIsBookmarked] = useState(review.is_bookmarked || false);
    const [bookmarksCount, setBookmarksCount] = useState(review.bookmarks_count || 0);

    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setIsLiked(review.is_liked_by_user || false);
        setLikesCount(review.likes_count || 0);
        setIsBookmarked(review.is_bookmarked || false);
        setBookmarksCount(review.bookmarks_count || 0);
    }, [review]);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return router.push('/login');
        try {
            setIsLiked(!isLiked);
            setLikesCount(prev => Math.max(0, isLiked ? prev - 1 : prev + 1));
            await api.post('/likes/', { review: review.id });
        } catch (error) {
            setIsLiked(isLiked);
            setLikesCount(prev => Math.max(0, isLiked ? prev + 1 : prev - 1));
        }
    };

    const handleBookmark = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return router.push('/login');
        try {
            setIsBookmarked(!isBookmarked);
            setBookmarksCount(prev => isBookmarked ? prev - 1 : prev + 1);
            await api.post('/bookmarks/', { review: review.id });
        } catch (error) {
            setIsBookmarked(isBookmarked);
            setBookmarksCount(prev => isBookmarked ? prev + 1 : prev - 1);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this review?")) return;
        try {
            await api.delete(`/reviews/${review.id}/`);
            window.location.reload();
        } catch (error) {
            console.error("Failed to delete review", error);
        }
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/${review.user.username}/review/${review.id}`;
        navigator.clipboard.writeText(url);
        setShowMenu(false);
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/${review.user.username}/review/${review.id}`;
        const shareData = {
            title: `${review.user.username}'s review of ${review.game.title}`,
            text: review.content?.slice(0, 100) || '',
            url,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(url);
                alert('Link copied to clipboard!');
            }
        } catch (error) {
            // User cancelled share dialog, ignore
        }
    };

    const handleCardClick = () => {
        if (!isDetailView) {
            router.push(`/${review.user.username}/review/${review.id}`);
        }
    };

    return (
        <div
            onClick={handleCardClick}
            className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-colors ${!isDetailView ? 'hover:bg-zinc-900/80 cursor-pointer' : ''}`}
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
                        <div className="relative" ref={menuRef}>
                            <button
                                className="text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 p-1 rounded-full transition-all"
                                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                                    {user && user.username === review.user.username && (
                                        <button
                                            onClick={handleDelete}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-zinc-800 transition-colors text-sm font-medium"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete Review
                                        </button>
                                    )}
                                    <button
                                        onClick={handleCopyLink}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm font-medium"
                                    >
                                        <LinkIcon className="h-4 w-4" />
                                        Copy Link
                                    </button>
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

                                            // The viewBox is 0 0 24 24, so calculate absolute width
                                            const absoluteWidth = (fillPercentage / 100) * 24;

                                            // Ensure unique IDs across the entire DOM, even if the same review is rendered twice
                                            const clipId = `star-clip-${baseId}-${review.id}-${i}`;

                                            return (
                                                <div key={i} className="relative h-4 w-4">
                                                    {/* Empty star background */}
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute top-0 left-0 h-4 w-4 opacity-30">
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                    </svg>
                                                    {/* Filled star foreground */}
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
                            className="flex items-center gap-2 hover:text-emerald-500 group transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                openReplyModal({ ...review, type: 'review' });
                            }}
                        >
                            <div className="p-2 rounded-full group-hover:bg-emerald-500/10 transition-colors">
                                <MessageCircle className="h-4 w-4" />
                            </div>
                            <span className="text-sm">0</span>
                        </button>

                        <button
                            className={`flex items-center gap-2 hover:text-pink-500 group transition-colors ${isLiked ? 'text-pink-500' : ''}`}
                            onClick={handleLike}
                        >
                            <div className="p-2 rounded-full group-hover:bg-pink-500/10 transition-colors">
                                <Heart className={`h-4 w-4 ${isLiked ? 'fill-pink-500' : ''}`} />
                            </div>
                            <span className="text-sm">{likesCount || 0}</span>
                        </button>

                        <button
                            className="flex items-center gap-2 hover:text-blue-500 group transition-colors"
                            onClick={handleShare}
                        >
                            <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                                <Share2 className="h-4 w-4" />
                            </div>
                        </button>
                        
                        <button
                            className={`flex items-center gap-2 hover:text-emerald-500 group transition-colors ${isBookmarked ? 'text-emerald-500' : ''}`}
                            onClick={handleBookmark}
                        >
                            <div className="p-2 rounded-full group-hover:bg-emerald-500/10 transition-colors">
                                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-emerald-500' : ''}`} />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
