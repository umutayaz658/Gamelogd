import React from 'react';
import Link from 'next/link';
import { MoreHorizontal, MessageCircle, Heart, Share2, Trash2, Flag, UserX, VolumeX, ExternalLink, Link2, Send, Copy } from 'lucide-react';
import { Post } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useReplyModal } from '@/context/ReplyModalContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useFeed } from '@/context/FeedContext';
import api from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import SharePostModal from './SharePostModal';

interface PostCardProps {
    post: Post;
    isDetailView?: boolean;
    hideNewsQuote?: boolean;
}

export default function PostCard({ post, isDetailView = false, hideNewsQuote = false }: PostCardProps) {
    const router = useRouter();
    const { openReplyModal } = useReplyModal();
    const { user } = useAuth();
    const { showToast } = useToast();
    const { removeFeedItem } = useFeed();
    
    const [isLiked, setIsLiked] = useState(post.is_liked || false);
    const [likeCount, setLikeCount] = useState(post.likes_count ?? 0);
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

    const isOwner = user?.username === post.user.username;

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        const previousIsLiked = isLiked;
        const previousLikeCount = likeCount;
        
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);

        // Trigger animation
        if (!isLiked) {
            setLikeAnimation(true);
            setTimeout(() => setLikeAnimation(false), 400);
        }

        try {
            await api.post('/likes/', { post: post.id });
        } catch (error) {
            console.error('Failed to toggle like', error);
            setIsLiked(previousIsLiked);
            setLikeCount(previousLikeCount);
        }
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/${post.user.username}/status/${post.id}`;
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
        const url = `${window.location.origin}/${post.user.username}/status/${post.id}`;
        if (navigator.share) {
            navigator.share({
                title: `Post by @${post.user.username}`,
                text: post.content?.substring(0, 100) || '',
                url: url,
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(url);
            showToast('Link copied!', 'success');
        }
        setShowShareMenu(false);
    };

    const handleDeletePost = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMoreMenu(false);
        
        try {
            await api.delete(`/posts/${post.id}/`);
            removeFeedItem(post.id);
            showToast('Post deleted', 'success');
        } catch (error) {
            console.error('Failed to delete post', error);
            showToast('Failed to delete post', 'error');
        }
    };

    const handleReport = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMoreMenu(false);
        showToast('Post reported. Thank you for your feedback.', 'info');
    };

    const handleNotInterested = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMoreMenu(false);
        showToast('You will see fewer posts like this.', 'info');
    };

    const handleMuteUser = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMoreMenu(false);
        showToast(`@${post.user.username} has been muted`, 'success');
    };

    const handleCardClick = () => {
        if (!isDetailView) {
            router.push(`/${post.user.username}/status/${post.id}`);
        }
    };

    return (
        <>
            <div
            onClick={handleCardClick}
            className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-colors ${!isDetailView ? 'hover:bg-zinc-900/80 cursor-pointer' : ''}`}
        >
            <div className="flex gap-4">
                <div className="flex flex-col items-center flex-shrink-0 w-fit">
                    <Link
                        href={`/${post.user.username}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={getImageUrl(post.user.avatar, post.user.username)}
                            alt={post.user.username}
                            className="h-10 w-10 rounded-full bg-zinc-800 object-cover hover:opacity-80 transition-opacity"
                        />
                    </Link>
                </div>

                    <div className="flex-1 min-w-0">
                        {post.reply_to_username && !post.news_details && (
                            <div className="mb-1 flex items-center gap-1 text-sm">
                                <span className="text-zinc-500">Replying to</span>
                                <Link
                                    href={`/${post.reply_to_username}`}
                                    className="text-emerald-500 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    @{post.reply_to_username}
                                </Link>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                    href={`/${post.user.username}`}
                                    className="font-bold text-white hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {post.user.username}
                                </Link>
                                {post.user.segment && post.user.segment.label && (
                                    <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border leading-none"
                                        style={{
                                            color: post.user.segment.color,
                                            backgroundColor: post.user.segment.bg,
                                            borderColor: `${post.user.segment.color}30`,
                                        }}
                                    >
                                        {post.user.segment.label}
                                    </span>
                                )}
                                <Link
                                    href={`/${post.user.username}`}
                                    className="text-zinc-500 text-sm hover:text-zinc-400"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    @{post.user.username.toLowerCase()}
                                </Link>
                                <span className="text-zinc-700 text-sm">•</span>
                                <span className="text-zinc-500 text-sm hover:underline">
                                    {new Date(post.timestamp).toLocaleDateString()}
                                </span>
                                {post.news_details && !hideNewsQuote && (
                                    <span className="ml-2 text-zinc-500 text-sm font-normal">
                                        • Commented on this news
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {post.segment && post.segment.label && (
                                    <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border leading-none whitespace-nowrap"
                                        style={{
                                            color: post.segment.color,
                                            backgroundColor: post.segment.bg,
                                            borderColor: `${post.segment.color}30`,
                                        }}
                                    >
                                        {post.segment.label}
                                    </span>
                                )}
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
                                                <>
                                                    <button
                                                        className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                                        onClick={handleDeletePost}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete Post
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                                        onClick={handleNotInterested}
                                                    >
                                                        <VolumeX className="h-4 w-4" />
                                                        Not interested
                                                    </button>
                                                    <button
                                                        className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                                        onClick={handleMuteUser}
                                                    >
                                                        <UserX className="h-4 w-4" />
                                                        Mute @{post.user.username}
                                                    </button>
                                                    <div className="border-t border-zinc-800" />
                                                    <button
                                                        className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                                                        onClick={handleReport}
                                                    >
                                                        <Flag className="h-4 w-4" />
                                                        Report Post
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>


                        {/* Devlog Header (Title & Project) */}
                        {post.title && (
                            <div className="mb-2">
                                {/* Project Badge if available */}
                                {post.project_parent && (
                                    <Link
                                        href={`/projects/${post.project_parent}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-wider mb-2 hover:bg-emerald-500/20 transition-colors"
                                    >
                                        Devlog
                                    </Link>
                                )}
                                <h3 className={`font-bold text-white mb-1 ${isDetailView ? 'text-2xl' : 'text-xl'}`}>
                                    {post.title}
                                </h3>
                            </div>
                        )}

                        <p className={`text-zinc-300 mb-3 whitespace-pre-wrap leading-relaxed ${isDetailView ? 'text-lg' : ''}`}>
                            {post.content}
                        </p>

                        {/* Render Media: Gallery or Single */}
                        {(post.media && post.media.length > 0) ? (
                            <div className={`grid gap-1 mb-3 rounded-xl overflow-hidden border border-zinc-800 ${post.media.length === 1 ? 'grid-cols-1' :
                                post.media.length === 2 ? 'grid-cols-2' :
                                    post.media.length === 3 ? 'grid-cols-2' : 'grid-cols-2'
                                }`}>
                                {post.media.slice(0, 4).map((media, index) => (
                                    <div
                                        key={media.id}
                                        className={`relative bg-black ${post.media!.length === 3 && index === 0 ? 'row-span-2' : ''
                                            } ${post.media!.length > 0 ? 'aspect-video' : ''}`}
                                    >
                                        {media.media_type === 'video' ? (
                                            <video
                                                src={getImageUrl(media.file)}
                                                controls
                                                className="w-full h-full object-cover"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <img
                                                src={getImageUrl(media.file)}
                                                alt={`Post media ${index + 1}`}
                                                className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (media.file) {
                                                        window.open(getImageUrl(media.file), '_blank');
                                                    }
                                                }}
                                            />
                                        )}
                                        {/* Overlay for +N more images if length > 4 */}
                                        {index === 3 && post.media!.length > 4 && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl">
                                                +{post.media!.length - 4}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (post.media_file || post.image) && (
                            <div className={`rounded-xl overflow-hidden border border-zinc-800 mb-3 bg-black ${post.title ? 'aspect-video' : ''}`}>
                                {post.media_type === 'video' ? (
                                    <video
                                        src={post.media_file || post.image || ''}
                                        controls
                                        className="w-full h-full object-contain bg-black"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <img
                                        src={post.media_file || post.image || ''}
                                        alt="Post media"
                                        className={`w-full h-full ${post.title ? 'object-cover' : 'object-contain'} max-h-[500px]`}
                                    />
                                )}
                            </div>
                        )}

                        {post.gif_url && (
                            <div className="rounded-xl overflow-hidden border border-zinc-800 mb-3">
                                <img
                                    src={post.gif_url}
                                    alt="GIF content"
                                    className="w-full h-auto object-cover max-h-[500px]"
                                />
                            </div>
                        )}

                        {/* Render Poll */}
                        {post.poll_options && post.poll_options.length > 0 && (
                            <div
                                className="mb-3 border border-zinc-800 rounded-xl overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {post.poll_options.map((option, idx) => (
                                    <div key={idx} className="relative p-3 bg-zinc-950/50 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 transition-colors cursor-pointer group">
                                        <div className="flex justify-between items-center relative z-10">
                                            <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{option}</span>
                                            <span className="text-xs text-zinc-500">0%</span>
                                        </div>
                                        <div className="absolute left-0 top-0 bottom-0 bg-zinc-800/30 w-0 group-hover:w-full transition-all duration-500"></div>
                                    </div>
                                ))}
                                <div className="p-2 bg-zinc-900 text-center text-xs text-zinc-500 border-t border-zinc-800">
                                    0 votes • Final results
                                </div>
                            </div>
                        )}

                        {/* Render News Quote Card */}
                        {post.news_details && !hideNewsQuote && (
                            <div
                                className="mb-3 border border-zinc-800 rounded-xl overflow-hidden hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/news/${post.news_details!.id}`);
                                }}
                            >
                                <div className="flex bg-zinc-950/50">
                                    {post.news_details.image_url && (
                                        <div className="w-24 h-24 flex-shrink-0">
                                            <img
                                                src={post.news_details.image_url}
                                                alt={post.news_details.title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div className="p-3 flex flex-col justify-center min-w-0">
                                        <div className="flex items-center gap-1.5 mb-1 text-xs text-zinc-500">
                                            {post.news_details.source_icon && (
                                                <img src={post.news_details.source_icon} className="w-3 h-3 rounded-full" />
                                            )}
                                            <span>{post.news_details.source_name}</span>
                                        </div>
                                        <h4 className="text-sm font-bold leading-tight text-white line-clamp-2">{post.news_details.title}</h4>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-2 text-zinc-500">
                            <button
                                className="flex items-center gap-2 hover:text-emerald-500 group transition-all"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openReplyModal({ ...post, type: 'post' });
                                }}
                            >
                                <div className="p-2 rounded-full group-hover:bg-emerald-500/10 transition-all group-hover:scale-110 active:scale-95">
                                    <MessageCircle className="h-4 w-4" />
                                </div>
                                <span className="text-sm">{post.replies_count ?? 0}</span>
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

            {/* Share Post Modal */}
            <SharePostModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                postId={post.id}
                contentPreview={post.content?.substring(0, 80)}
            />
        </>
    );
}
