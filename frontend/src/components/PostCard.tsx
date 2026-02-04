import React from 'react';
import Link from 'next/link';
import { MoreHorizontal, MessageCircle, Heart, Share2 } from 'lucide-react';
import { Post } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useReplyModal } from '@/context/ReplyModalContext';

interface PostCardProps {
    post: Post;
    isDetailView?: boolean;
    hideNewsQuote?: boolean;
}

export default function PostCard({ post, isDetailView = false, hideNewsQuote = false }: PostCardProps) {
    const router = useRouter();
    const { openReplyModal } = useReplyModal();

    const handleCardClick = () => {
        router.push(`/${post.user.username}/status/${post.id}`);
    };

    return (
        <div
            onClick={handleCardClick}
            className={`bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-900/80 p-4 transition-colors cursor-pointer`}
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
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/${post.user.username}`}
                                className="font-bold text-white hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {post.user.username}
                            </Link>
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
                        <button
                            className="text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 p-1 rounded-full transition-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
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
                                                // TODO: Open lightbox
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

                        <button
                            className="flex items-center gap-2 hover:text-pink-500 group transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-2 rounded-full group-hover:bg-pink-500/10 transition-colors">
                                <Heart className="h-4 w-4" />
                            </div>
                            <span className="text-sm">{post.likes || 0}</span>
                        </button>

                        <button
                            className="flex items-center gap-2 hover:text-blue-500 group transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                                <Share2 className="h-4 w-4" />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
