'use client';

import { useReplyModal } from '@/context/ReplyModalContext';
import { useFeed } from '@/context/FeedContext';
import { Post, Review } from '@/types';
import { X, Loader2, ImagePlay, Smile, BarChart2, Plus, Trash2, FileImage } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import PostCard from './PostCard';
import ReviewCard from './ReviewCard';
import PostMediaGrid, { GridMediaItem } from '@/components/PostMediaGrid';
import GifPicker from '@/components/GifPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import api from '@/lib/api';

import MentionAutocomplete from '@/components/MentionAutocomplete';

// Grid display still caps at 4 visible cells (Twitter standard, with a "+N" overlay
// past that) — this only bounds how many files a single post can attach.
const MAX_MEDIA_ITEMS = 10;

interface ComposerMediaItem {
    file: File;
    preview: string;
    type: 'image' | 'video';
}

// Mirrors PostCard.tsx's getPostMediaItems — used only for the quote-mode embed
// preview, which only ever receives a Post-shaped activeItem (Review has no media fields).
const getQuotedMediaItems = (item: Post): GridMediaItem[] => {
    if (item.media && item.media.length > 0) {
        return item.media.map(m => ({ url: getImageUrl(m.file), type: m.media_type }));
    }
    if (item.media_file || item.image) {
        return [{ url: getImageUrl(item.media_file || item.image || ''), type: item.media_type === 'video' ? 'video' : 'image' }];
    }
    if (item.gif_url) {
        return [{ url: item.gif_url, type: 'image' }];
    }
    return [];
};

export default function ReplyModal() {
    const { isOpen, activeItem: rawActiveItem, mode, closeReplyModal } = useReplyModal();
    const activeItem = rawActiveItem as (Post | Review) | null;
    const { addFeedItem } = useFeed();
    const { user } = useAuth();

    // Core State
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Mention Autocomplete
    const { handleKeyDown: handleMentionKeyDown, renderSuggestions } = MentionAutocomplete({
        textareaRef,
        value: content,
        onChange: setContent,
    });

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [content]);

    // Media State
    const [mediaItems, setMediaItems] = useState<ComposerMediaItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // GIF State
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [selectedGif, setSelectedGif] = useState<string | null>(null);

    // Emoji State
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Poll State
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

    if (!isOpen || !activeItem) return null;

    // --- Handlers ---

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setSelectedGif(null);
            setShowGifPicker(false);

            const newItems: ComposerMediaItem[] = Array.from(files).map(file => ({
                file,
                preview: URL.createObjectURL(file),
                type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
            }));
            setMediaItems(prev => [...prev, ...newItems].slice(0, MAX_MEDIA_ITEMS));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeMediaItem = (index: number) => {
        setMediaItems(prev => {
            const item = prev[index];
            if (item) URL.revokeObjectURL(item.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleGifSelect = (url: string) => {
        mediaItems.forEach(item => URL.revokeObjectURL(item.preview));
        setMediaItems([]);
        if (fileInputRef.current) fileInputRef.current.value = '';

        setSelectedGif(url);
        setShowGifPicker(false);
    };

    const clearMedia = () => {
        mediaItems.forEach(item => URL.revokeObjectURL(item.preview));
        setMediaItems([]);
        setSelectedGif(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setContent((prev) => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    // Poll Handlers
    const handlePollOptionChange = (index: number, value: string) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const addPollOption = () => {
        if (pollOptions.length < 4) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const removePollOption = (index: number) => {
        if (pollOptions.length > 2) {
            const newOptions = pollOptions.filter((_, i) => i !== index);
            setPollOptions(newOptions);
        }
    };

    const togglePollCreator = () => {
        if (showPollCreator) {
            setPollOptions(['', '']);
            setShowPollCreator(false);
        } else {
            setShowPollCreator(true);
        }
    };

    const handleSubmit = async () => {
        const hasContent = content.trim().length > 0;
        const hasMedia = mediaItems.length > 0 || !!selectedGif;
        const validPoll = showPollCreator && pollOptions.filter(o => o.trim()).length >= 2;

        if (!hasContent && !hasMedia && !validPoll) return;

        setIsSubmitting(true);
        try {
            // FormData
            const formData = new FormData();
            formData.append('content', content);

            if (activeItem.id) {
                if (mode === 'quote') {
                    const isReviewItem = (activeItem as any).rating !== undefined;
                    if (isReviewItem) {
                        formData.append('repost_parent_review', activeItem.id.toString());
                    } else {
                        formData.append('repost_parent', activeItem.id.toString());
                    }
                } else {
                    const isReviewItem = (activeItem as any).rating !== undefined;
                    if (isReviewItem) {
                        formData.append('review_parent', activeItem.id.toString());
                    } else {
                        formData.append('parent', activeItem.id.toString());
                    }
                    formData.append('type', 'reply');
                }
            }
            mediaItems.forEach(item => formData.append('uploaded_media', item.file));
            if (selectedGif) {
                formData.append('gif_url', selectedGif);
            }
            if (showPollCreator && pollOptions.filter(o => o.trim()).length >= 2) {
                formData.append('poll_options', JSON.stringify(pollOptions.filter(o => o.trim())));
            }

            // API Call
            const res = await api.post('/posts/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Add to Global Feed dynamically
            if (mode === 'quote') {
                addFeedItem({ ...res.data, type: 'post' });
                window.dispatchEvent(new CustomEvent('post-created', { detail: res.data }));
            } else {
                addFeedItem({ ...res.data, type: 'reply' });
            }

            // Reset
            setContent('');
            clearMedia();
            setShowPollCreator(false);
            setPollOptions(['', '']);
            closeReplyModal();
        } catch (error) {
            console.error('Failed to reply:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isReview = (item: any): item is import('@/types').Review => {
        return item.type === 'review';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-xl bg-black border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black/50 backdrop-blur-md z-10">
                    <button
                        onClick={closeReplyModal}
                        className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                    <span className="font-bold text-white">{mode === 'quote' ? 'Quote Post' : 'Reply'}</span>
                    <div className="w-9" />
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto scrollbar-thin-dark p-4">
                    {/* Target Item (Context) - Only for Reply mode */}
                    {mode !== 'quote' && (
                        <div className="mb-4 relative">
                            <div className="pointer-events-none opacity-80">
                                {isReview(activeItem) ? (
                                    <ReviewCard review={activeItem} />
                                ) : (
                                    <PostCard post={activeItem} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Reply Input Area */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                {user?.avatar ? (
                                    <img
                                        src={getImageUrl(user.avatar)}
                                        alt={user.username}
                                        className="h-10 w-10 rounded-full bg-zinc-800 object-cover"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded-full bg-zinc-800" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {mode !== 'quote' && (
                                    <div className="mb-2">
                                        <span className="text-zinc-500 text-sm">Replying to </span>
                                        <span className="text-emerald-500 text-sm font-medium">@{activeItem.user.username}</span>
                                    </div>
                                )}

                                <textarea
                                    ref={textareaRef}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder={mode === 'quote' ? "Add a comment..." : "Post your reply"}
                                    className="w-full bg-transparent text-lg text-zinc-200 placeholder-zinc-500 border-none focus:outline-none focus:ring-0 resize-none min-h-[100px] p-0 mb-2 overflow-hidden"
                                    autoFocus
                                    maxLength={350}
                                    onKeyDown={handleMentionKeyDown}
                                />

                                {/* Mention Suggestions Popup */}
                                {renderSuggestions()}

                                {/* Embedded Quoted Post (ONLY if mode === 'quote') */}
                                {mode === 'quote' && (
                                    <div className="mt-2.5 mb-4 border border-zinc-800 rounded-xl p-3 bg-zinc-950/45 text-left flex flex-col gap-2 max-w-full">
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={getImageUrl(activeItem.user.avatar, activeItem.user.username)}
                                                alt={activeItem.user.username}
                                                className="h-5 w-5 rounded-full object-cover bg-zinc-800"
                                            />
                                            <span className="font-bold text-white text-xs leading-none">{activeItem.user.real_name || activeItem.user.username}</span>
                                            <span className="text-zinc-500 text-xs leading-none">@{activeItem.user.username.toLowerCase()}</span>
                                            <span className="text-zinc-650 text-xs leading-none">·</span>
                                            <span className="text-zinc-500 text-xs leading-none">
                                                {isReview(activeItem) 
                                                    ? new Date((activeItem as any).timestamp).toLocaleDateString()
                                                    : new Date(activeItem.timestamp).toLocaleDateString()
                                                }
                                            </span>
                                        </div>
                                        {isReview(activeItem) ? (
                                            <div>
                                                <div className="text-emerald-500 text-xs font-bold mb-1">Logged: {(activeItem as any).rating}/10</div>
                                                <p className="text-zinc-300 text-xs line-clamp-3 leading-relaxed">{activeItem.content || 'No review written.'}</p>
                                            </div>
                                        ) : (
                                            <div>
                                                {activeItem.title && <h4 className="font-bold text-sm text-white mb-1">{activeItem.title}</h4>}
                                                <p className="text-zinc-350 text-xs line-clamp-3 whitespace-pre-wrap leading-relaxed">{activeItem.content}</p>
                                                {(() => {
                                                    const quotedMediaItems = getQuotedMediaItems(activeItem);
                                                    if (quotedMediaItems.length === 0) return null;
                                                    return <PostMediaGrid items={quotedMediaItems} compact className="mt-1.5" />;
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Media Preview */}
                                {mediaItems.length > 0 && (
                                    <div className="mb-4">
                                        <PostMediaGrid
                                            items={mediaItems.map(m => ({ url: m.preview, type: m.type }))}
                                            editable
                                            onRemove={removeMediaItem}
                                        />
                                    </div>
                                )}
                                {selectedGif && (
                                    <div className="relative mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-black">
                                        <button
                                            onClick={clearMedia}
                                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full z-10 transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                        <img src={selectedGif} alt="Preview" className="w-full max-h-[300px] object-contain" />
                                    </div>
                                )}

                                {/* Poll Creator */}
                                {showPollCreator && (
                                    <div className="mb-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-zinc-400">POLL OPTIONS</span>
                                            <button onClick={togglePollCreator} className="text-zinc-500 hover:text-red-500 transition-colors">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {pollOptions.map((option, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder={`Option ${index + 1}`}
                                                        value={option}
                                                        onChange={(e) => handlePollOptionChange(index, e.target.value)}
                                                        className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                                                    />
                                                    {pollOptions.length > 2 && (
                                                        <button
                                                            onClick={() => removePollOption(index)}
                                                            className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {pollOptions.length < 4 && (
                                            <button
                                                onClick={addPollOption}
                                                className="mt-2 text-emerald-500 text-xs font-bold hover:underline flex items-center gap-1"
                                            >
                                                <Plus className="h-3 w-3" /> ADD OPTION
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Toolbar & Send Button */}
                                <div className="flex items-center justify-between border-t border-zinc-800 pt-3 relative">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/png, image/jpeg, image/gif, video/mp4, video/quicktime"
                                            onChange={handleMediaChange}
                                            multiple
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={mediaItems.length >= MAX_MEDIA_ITEMS}
                                            className="flex items-center gap-2 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 rounded-full transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                            title="Media"
                                        >
                                            <ImagePlay className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowGifPicker(!showGifPicker);
                                                setShowEmojiPicker(false);
                                            }}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-sm font-medium ${showGifPicker ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                                            title="GIF"
                                        >
                                            <FileImage className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowEmojiPicker(!showEmojiPicker);
                                                setShowGifPicker(false);
                                            }}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-sm font-medium ${showEmojiPicker ? 'bg-zinc-800 text-yellow-500' : 'text-zinc-400 hover:text-yellow-500 hover:bg-zinc-800'}`}
                                            title="Emoji"
                                        >
                                            <Smile className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={togglePollCreator}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-sm font-medium ${showPollCreator ? 'bg-zinc-800 text-blue-500' : 'text-zinc-400 hover:text-blue-500 hover:bg-zinc-800'}`}
                                            title="Poll"
                                        >
                                            <BarChart2 className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {content.length > 0 && (
                                            <span className={`text-xs font-semibold select-none transition-colors ${
                                                content.length >= 350 ? 'text-red-500 font-bold' :
                                                content.length >= 320 ? 'text-amber-500' : 'text-zinc-500'
                                            }`}>
                                                {350 - content.length}
                                            </span>
                                        )}
                                        <button
                                            onClick={handleSubmit}
                                            disabled={(!content.trim() && mediaItems.length === 0 && !selectedGif && !(showPollCreator && pollOptions.filter(o => o.trim()).length >= 2)) || content.length > 350 || isSubmitting}
                                            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-full font-medium text-sm transition-colors flex items-center gap-2"
                                        >
                                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                            {mode === 'quote' ? 'Post' : 'Reply'}
                                        </button>
                                    </div>
                                </div>
                                {/* Emoji Picker Popover */}
                                {showEmojiPicker && (
                                    <div className="absolute top-12 left-0 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="shadow-2xl rounded-xl overflow-hidden border border-zinc-700">
                                            <EmojiPicker
                                                onEmojiClick={onEmojiClick}
                                                theme={Theme.DARK}
                                                lazyLoadEmojis={true}
                                                width={300}
                                                height={400}
                                            />
                                        </div>
                                    </div>
                                )}
                                {/* GIF Picker */}
                                {showGifPicker && (
                                    <div className="mt-4 animate-in fade-in zoom-in-95 duration-200">
                                        <GifPicker onSelected={handleGifSelect} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
