import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal, MessageCircle, Heart, Share2, Bookmark, Trash2, Link as LinkIcon, Repeat2, Send } from 'lucide-react';
import { Post } from '@/types';
import { getImageUrl, getRelativeTime } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useReplyModal } from '@/context/ReplyModalContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import ShareModal from '@/components/ShareModal';
import ImageModal from '@/components/modals/ImageModal';
import { useTranslation } from '@/lib/useTranslation';

const renderContentWithLinks = (content: string | undefined) => {
    if (!content) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, index) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-emerald-500 hover:text-emerald-400 hover:underline break-all font-medium"
                >
                    {part}
                </a>
            );
        }
        return part;
    });
};

interface PostCardProps {
    post: Post;
    isDetailView?: boolean;
    hideNewsQuote?: boolean;
}

export default function PostCard({ post, isDetailView = false, hideNewsQuote = false }: PostCardProps) {
    const router = useRouter();
    const { openReplyModal, openQuoteModal } = useReplyModal();
    const { user } = useAuth();
    const { t } = useTranslation();

    const [isLiked, setIsLiked] = useState(post.is_liked || false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [shouldShowShowMore, setShouldShowShowMore] = useState(false);
    const contentRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        const checkOverflow = () => {
            if (contentRef.current) {
                const element = contentRef.current;
                if (!isExpanded) {
                    setShouldShowShowMore(element.scrollHeight > element.clientHeight);
                }
            }
        };

        // Run check after layout
        const timer = setTimeout(checkOverflow, 50);

        window.addEventListener('resize', checkOverflow);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkOverflow);
        };
    }, [post.content, isExpanded, isDetailView]);
    const [likesCount, setLikesCount] = useState(post.likes_count ?? (Array.isArray(post.likes) ? post.likes.length : post.likes) ?? 0);
    const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false);
    const [bookmarksCount, setBookmarksCount] = useState(post.bookmarks_count || 0);

    const [isReposted, setIsReposted] = useState(post.is_reposted || false);
    const [repostsCount, setRepostsCount] = useState(post.reposts_count || 0);
    const [showRepostMenu, setShowRepostMenu] = useState(false);
    const repostMenuRef = useRef<HTMLDivElement>(null);

    const [showShareMenu, setShowShareMenu] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const shareMenuRef = useRef<HTMLDivElement>(null);

    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Image Modal states
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [modalImages, setModalImages] = useState<string[]>([]);
    const [modalInitialIndex, setModalInitialIndex] = useState(0);

    const openImageModal = (images: string[], index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setModalImages(images);
        setModalInitialIndex(index);
        setIsImageModalOpen(true);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
            if (repostMenuRef.current && !repostMenuRef.current.contains(event.target as Node)) {
                setShowRepostMenu(false);
            }
            if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
                setShowShareMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setIsLiked(post.is_liked || false);
        setLikesCount(post.likes_count ?? (Array.isArray(post.likes) ? post.likes.length : post.likes) ?? 0);
        setIsBookmarked(post.is_bookmarked || false);
        setBookmarksCount(post.bookmarks_count || 0);
    }, [post]);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return router.push('/login');
        
        try {
            setIsLiked(!isLiked);
            setLikesCount(prev => Math.max(0, isLiked ? prev - 1 : prev + 1));
            await api.post('/likes/', { post: post.id });
        } catch (error) {
            console.error('Failed to toggle like', error);
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
            await api.post('/bookmarks/', { post: post.id });
        } catch (error) {
            console.error('Failed to toggle bookmark', error);
            setIsBookmarked(isBookmarked);
            setBookmarksCount(prev => isBookmarked ? prev + 1 : prev - 1);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this post?")) return;
        
        try {
            await api.delete(`/posts/${post.id}/`);
            window.location.reload();
        } catch (error) {
            console.error("Failed to delete post", error);
        }
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/${post.user.username}/status/${post.id}`;
        navigator.clipboard.writeText(url);
        setShowMenu(false);
    };

    const handleRepost = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return router.push('/login');
        
        try {
            const previousIsReposted = isReposted;
            const previousCount = repostsCount;
            
            setIsReposted(!isReposted);
            setRepostsCount(prev => Math.max(0, isReposted ? prev - 1 : prev + 1));
            setShowRepostMenu(false);
            
            const res = await api.post(`/posts/${post.id}/repost/`);
            if (res.data.status === 'reposted') {
                setIsReposted(true);
            } else {
                setIsReposted(false);
            }
            setRepostsCount(res.data.reposts_count);
        } catch (error) {
            console.error('Failed to toggle repost', error);
            setIsReposted(isReposted);
            setRepostsCount(repostsCount);
        }
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/${post.user.username}/status/${post.id}`;
        const shareData = {
            title: post.title || `${post.user.username}'s post`,
            text: post.content?.slice(0, 100) || '',
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
            router.push(`/${post.user.username}/status/${post.id}`);
        }
    };

    const isDirectRepost = post.repost_parent && !post.content && !post.image && !post.media_file && !post.gif_url && !post.poll_options;

    if (isDirectRepost && post.repost_details) {
        return (
            <div className="flex flex-col">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 mb-1.5 pl-12">
                    <Repeat2 className="h-3.5 w-3.5 text-green-500" />
                    <span>{post.user.real_name || post.user.username} {t('reposted')}</span>
                </div>
                <PostCard post={post.repost_details} isDetailView={isDetailView} hideNewsQuote={hideNewsQuote} />
            </div>
        );
    }

    return (
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
                            <span className="text-zinc-500">{t('replyingTo')}</span>
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
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/${post.user.username}`}
                                className="font-bold text-white hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {post.user.real_name || post.user.username}
                            </Link>
                            <Link
                                href={`/${post.user.username}`}
                                className="text-zinc-500 text-sm hover:text-zinc-400"
                                onClick={(e) => e.stopPropagation()}
                            >
                                @{post.user.username.toLowerCase()}
                            </Link>
                            <span className="text-zinc-700 text-sm">•</span>
                            <span className="text-zinc-500 text-sm hover:underline" title={new Date(post.timestamp).toLocaleString()}>
                                {new Date(post.timestamp).toLocaleDateString()} • {getRelativeTime(post.timestamp)}
                            </span>
                            {post.news_details && !hideNewsQuote && (
                                <span className="ml-2 text-zinc-500 text-sm font-normal">
                                    • Commented on this news
                                </span>
                            )}
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
                                    {user && user.username === post.user.username && (
                                        <button
                                            onClick={handleDelete}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-zinc-800 transition-colors text-sm font-medium"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            {t('deletePost')}
                                        </button>
                                    )}
                                    <button
                                        onClick={handleCopyLink}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm font-medium"
                                    >
                                        <LinkIcon className="h-4 w-4" />
                                        {t('copyLink')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Content and Media Layout */}
                    <div className="flex flex-col gap-3 mt-2 mb-3">
                        {/* Title and Text */}
                        <div className="min-w-0 flex flex-col">
                            {post.title && (
                                <div className="mb-2">
                                    {post.project_parent && (
                                        <div className="mb-1">
                                            <Link
                                                href={`/projects/${post.project_parent}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-emerald-500 hover:text-emerald-400 font-bold text-sm hover:underline transition-colors tracking-wide"
                                            >
                                                {post.project_details?.title || 'PROJECT DEVLOG'}
                                            </Link>
                                        </div>
                                    )}
                                    <h3 className={`font-bold text-white mb-2 leading-tight ${isDetailView ? 'text-2xl' : 'text-xl'}`}>
                                        {post.title}
                                    </h3>
                                </div>
                            )}

                            <p
                                ref={contentRef}
                                className={`text-zinc-300 whitespace-pre-wrap leading-relaxed ${
                                    isDetailView 
                                        ? 'text-lg' 
                                        : isExpanded 
                                            ? '' 
                                            : 'line-clamp-2'
                                }`}
                            >
                                {renderContentWithLinks(post.content)}
                            </p>

                            {!isDetailView && shouldShowShowMore && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsExpanded(!isExpanded);
                                    }}
                                    className="text-emerald-500 hover:text-emerald-400 hover:underline text-sm font-semibold transition-colors mt-1 block w-fit"
                                >
                                    {isExpanded ? t('showLess') : `${t('showMore')}...`}
                                </button>
                            )}
                        </div>

                        {/* Media (Images/Videos/Gifs) */}
                        {((post.media && post.media.length > 0) || post.media_file || post.image || post.gif_url) && (
                            <div className="w-full max-w-[450px]">
                                {(post.media && post.media.length > 0) ? (
                                    <div className={`grid gap-1 rounded-xl overflow-hidden border border-zinc-800 ${
                                        post.media.length === 1 ? 'grid-cols-1' :
                                        post.media.length === 2 ? 'grid-cols-2' :
                                        post.media.length === 3 ? 'grid-cols-2' : 'grid-cols-2'
                                    }`}>
                                        {post.media.slice(0, 4).map((media, index) => (
                                            <div
                                                key={media.id}
                                                className={`relative bg-black ${post.media!.length === 3 && index === 0 ? 'row-span-2' : ''} aspect-square`}
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
                                                            const allImgUrls = post.media!.map(m => getImageUrl(m.file));
                                                            openImageModal(allImgUrls, index, e);
                                                        }}
                                                    />
                                                )}
                                                {index === 3 && post.media!.length > 4 && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm">
                                                        +{post.media!.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (post.media_file || post.image) ? (
                                    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black max-h-[512px] flex items-center justify-center">
                                        {post.media_type === 'video' ? (
                                            <video
                                                src={getImageUrl(post.media_file || post.image || '')}
                                                controls
                                                className="w-full max-h-[512px] object-contain bg-black"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <img
                                                src={getImageUrl(post.media_file || post.image || '')}
                                                alt="Post media"
                                                className="w-full max-h-[512px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                                onClick={(e) => {
                                                    const imgUrl = getImageUrl(post.media_file || post.image || '');
                                                    openImageModal([imgUrl], 0, e);
                                                }}
                                            />
                                        )}
                                    </div>
                                ) : post.gif_url && (
                                    <div className="rounded-xl overflow-hidden border border-zinc-800 max-h-[400px]">
                                        <img
                                            src={post.gif_url}
                                            alt="GIF content"
                                            className="w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                            onClick={(e) => {
                                                openImageModal([post.gif_url || ''], 0, e);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Nested Quoted Post Card */}
                        {post.repost_details && (
                            <div 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/${post.repost_details!.user.username}/status/${post.repost_details!.id}`);
                                }}
                                className="border border-zinc-800 hover:border-zinc-700 bg-zinc-950/30 rounded-xl p-3 flex flex-col gap-2 transition-all cursor-pointer hover:bg-zinc-950/50"
                            >
                                <div className="flex items-center gap-2">
                                    <img
                                        src={getImageUrl(post.repost_details.user.avatar, post.repost_details.user.username)}
                                        alt={post.repost_details.user.username}
                                        className="h-5 w-5 rounded-full object-cover"
                                    />
                                    <span className="font-bold text-white text-xs">{post.repost_details.user.real_name || post.repost_details.user.username}</span>
                                    <span className="text-zinc-500 text-xs">@{post.repost_details.user.username.toLowerCase()}</span>
                                    <span className="text-zinc-600 text-xs">•</span>
                                    <span className="text-zinc-500 text-xs">{new Date(post.repost_details.timestamp).toLocaleDateString()}</span>
                                </div>
                                {post.repost_details.title && (
                                    <h4 className="font-bold text-sm text-white">{post.repost_details.title}</h4>
                                )}
                                <p className="text-zinc-300 text-xs line-clamp-3 whitespace-pre-wrap leading-relaxed">
                                    {renderContentWithLinks(post.repost_details.content)}
                                </p>
                                {(post.repost_details.media_file || post.repost_details.image) && (
                                    <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black aspect-video max-h-48 mt-1">
                                        <img src={getImageUrl(post.repost_details.media_file || post.repost_details.image || '')} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                {post.repost_details.gif_url && (
                                    <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black aspect-video max-h-48 mt-1">
                                        <img src={post.repost_details.gif_url} className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Nested Quoted Review Card */}
                        {post.repost_review_details && (
                            <div 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/${post.repost_review_details!.user.username}/review/${post.repost_review_details!.id}`);
                                }}
                                className="border border-zinc-800 hover:border-zinc-700 bg-zinc-950/30 rounded-xl p-3 flex flex-col gap-2 transition-all cursor-pointer hover:bg-zinc-950/50"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <img
                                        src={getImageUrl(post.repost_review_details.user.avatar, post.repost_review_details.user.username)}
                                        alt={post.repost_review_details.user.username}
                                        className="h-5 w-5 rounded-full object-cover"
                                    />
                                    <span className="font-bold text-white text-xs">{post.repost_review_details.user.real_name || post.repost_review_details.user.username}</span>
                                    <span className="text-zinc-500 text-xs">@{post.repost_review_details.user.username.toLowerCase()}</span>
                                    <span className="text-zinc-600 text-xs">•</span>
                                    <span className="text-zinc-500 text-xs">{new Date(post.repost_review_details.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="flex gap-3">
                                    {post.repost_review_details.game?.cover_image && (
                                        <img src={getImageUrl(post.repost_review_details.game.cover_image)} className="w-16 h-24 object-cover rounded-md flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-white mb-0.5">{post.repost_review_details.game?.title}</div>
                                        <div className="text-emerald-500 text-xs font-bold mb-1">Logged: {post.repost_review_details.rating}/10</div>
                                        <p className="text-zinc-300 text-xs line-clamp-3 whitespace-pre-wrap leading-relaxed">
                                            {renderContentWithLinks(post.repost_review_details.content) || 'No review written.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

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
                            className="flex items-center gap-2 hover:text-emerald-500 group transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                openReplyModal({ ...post, type: 'post' });
                            }}
                        >
                            <div className="p-2 rounded-full group-hover:bg-emerald-500/10 transition-colors">
                                <MessageCircle className="h-4 w-4" />
                            </div>
                            <span className="text-sm">{post.comments || 0}</span>
                        </button>

                        <div className="relative" ref={repostMenuRef}>
                            <button
                                className={`flex items-center gap-2 hover:text-green-500 group transition-colors ${isReposted ? 'text-green-500' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowRepostMenu(!showRepostMenu);
                                }}
                            >
                                <div className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors">
                                    <Repeat2 className="h-4 w-4" />
                                </div>
                                <span className="text-sm">{repostsCount || 0}</span>
                            </button>
                            {showRepostMenu && (
                                <div className="absolute left-0 mt-1 w-32 bg-zinc-900 border border-zinc-850 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <button
                                        onClick={handleRepost}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-zinc-300 hover:bg-zinc-800 transition-colors text-xs font-semibold text-left"
                                    >
                                        <Repeat2 className="h-3.5 w-3.5" />
                                        {isReposted ? t('undoRepost') : t('repost')}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRepostMenu(false);
                                            openQuoteModal({ ...post, type: 'post' });
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-zinc-300 hover:bg-zinc-800 transition-colors text-xs font-semibold text-left border-t border-zinc-800"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                        {t('quotePost')}
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            className={`flex items-center gap-2 hover:text-pink-500 group transition-colors ${isLiked ? 'text-pink-500' : ''}`}
                            onClick={handleLike}
                        >
                            <div className="p-2 rounded-full group-hover:bg-pink-500/10 transition-colors">
                                <Heart className={`h-4 w-4 ${isLiked ? 'fill-pink-500' : ''}`} />
                            </div>
                            <span className="text-sm">{likesCount}</span>
                        </button>

                        <div className="relative" ref={shareMenuRef}>
                            <button
                                className="flex items-center gap-2 hover:text-blue-500 group transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowShareMenu(!showShareMenu);
                                }}
                            >
                                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                                    <Share2 className="h-4 w-4" />
                                </div>
                            </button>
                            {showShareMenu && (
                                <div className="absolute right-0 mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowShareMenu(false);
                                            setIsShareModalOpen(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-zinc-300 hover:bg-zinc-800 transition-colors text-xs font-semibold text-left"
                                    >
                                        <Send className="h-3.5 w-3.5 text-emerald-500" />
                                        {t('sendViaDm')}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowShareMenu(false);
                                            const url = `${window.location.origin}/${post.user.username}/status/${post.id}`;
                                            navigator.clipboard.writeText(url);
                                            alert(t('linkCopied'));
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-zinc-300 hover:bg-zinc-800 transition-colors text-xs font-semibold text-left border-t border-zinc-800"
                                    >
                                        <LinkIcon className="h-3.5 w-3.5 text-zinc-500" />
                                        {t('copyLink')}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowShareMenu(false);
                                            handleShare(e);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-zinc-300 hover:bg-zinc-800 transition-colors text-xs font-semibold text-left border-t border-zinc-800"
                                    >
                                        <Share2 className="h-3.5 w-3.5 text-zinc-550" />
                                        {t('shareVia')}
                                    </button>
                                </div>
                            )}
                        </div>

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
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                itemType="post"
                itemId={post.id}
                title={post.content?.slice(0, 50) || post.title || 'Post'}
            />
            <ImageModal
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                images={modalImages}
                initialIndex={modalInitialIndex}
                post={post}
            />
        </div>
    );
}
