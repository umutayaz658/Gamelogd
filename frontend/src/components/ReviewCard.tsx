'use client';

import Link from 'next/link';
import { MoreHorizontal, MessageCircle, Heart, Share2, Check, EyeOff, Eye } from 'lucide-react';
import { Review } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useState } from 'react';

interface ReviewCardProps {
    review: Review;
}

export default function ReviewCard({ review }: ReviewCardProps) {
    const [isSpoilerVisible, setIsSpoilerVisible] = useState(false);

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-colors hover:bg-zinc-900/80 cursor-pointer">
            <div className="flex gap-4">
                {/* User Avatar */}
                <Link href={`/${review.user.username}`} className="flex-shrink-0">
                    <img
                        src={getImageUrl(review.user.avatar, review.user.username)}
                        alt={review.user.username}
                        className="h-10 w-10 rounded-full bg-zinc-800 object-cover hover:opacity-80 transition-opacity"
                    />
                </Link>

                <div className="flex-1 min-w-0">
                    {/* Header: Name, Username, Date, More Button */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Link href={`/${review.user.username}`} className="font-bold text-white hover:underline">
                                {review.user.username}
                            </Link>
                            <Link href={`/${review.user.username}`} className="text-zinc-500 text-sm hover:text-zinc-400">
                                @{review.user.username.toLowerCase()}
                            </Link>
                            <span className="text-zinc-700 text-sm">•</span>
                            <span className="text-zinc-500 text-sm hover:underline">
                                {new Date(review.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                        <button className="text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 p-1 rounded-full transition-all">
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
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
                                    <div className={`flex ${Number(review.rating) >= 8 ? 'text-emerald-500' : Number(review.rating) >= 5 ? 'text-yellow-500' : 'text-red-500'}`}>
                                        {[...Array(5)].map((_, i) => (
                                            <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={i < Math.floor(Number(review.rating) / 2) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                            </svg>
                                        ))}
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
                        <button className="flex items-center gap-2 hover:text-emerald-500 group transition-colors">
                            <div className="p-2 rounded-full group-hover:bg-emerald-500/10 transition-colors">
                                <MessageCircle className="h-4 w-4" />
                            </div>
                            <span className="text-sm">0</span>
                        </button>

                        <button className="flex items-center gap-2 hover:text-pink-500 group transition-colors">
                            <div className="p-2 rounded-full group-hover:bg-pink-500/10 transition-colors">
                                <Heart className="h-4 w-4" />
                            </div>
                            <span className="text-sm">0</span>
                        </button>

                        <button className="flex items-center gap-2 hover:text-blue-500 group transition-colors">
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
