'use client';

import { useReplyModal } from '@/context/ReplyModalContext';
import { useFeed } from '@/context/FeedContext';
import { X, Loader2, ImagePlay, Smile, BarChart2, Plus, Trash2, FileImage } from 'lucide-react';
import { useState, useRef } from 'react';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import PostCard from './PostCard';
import ReviewCard from './ReviewCard';
import GifPicker from '@/components/GifPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import api from '@/lib/api';

export default function ReplyModal() {
    const { isOpen, activeItem, closeReplyModal } = useReplyModal();
    const { addFeedItem } = useFeed();
    const { user } = useAuth();

    // Core State
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Media State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedGif(null);
        setShowGifPicker(false);

        const type = file.type.startsWith('video/') ? 'video' : 'image';
        setSelectedFile(file);
        setMediaType(type);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleGifSelect = (url: string) => {
        setSelectedFile(null);
        setMediaType(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        setSelectedGif(url);
        setShowGifPicker(false);
    };

    const clearMedia = () => {
        setSelectedFile(null);
        setMediaType(null);
        setPreviewUrl(null);
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
        const hasMedia = !!selectedFile || !!selectedGif;
        const validPoll = showPollCreator && pollOptions.filter(o => o.trim()).length >= 2;

        if (!hasContent && !hasMedia && !validPoll) return;

        setIsSubmitting(true);
        try {
            // FormData
            const formData = new FormData();
            formData.append('content', content);

            if (activeItem.id) {
                // Check if active item is a review by checking if 'rating' exists (typical for Review)
                // Using explicit cast or check
                const isReviewItem = (activeItem as any).rating !== undefined;

                if (isReviewItem) {
                    formData.append('review_parent', activeItem.id.toString());
                } else {
                    formData.append('parent', activeItem.id.toString());
                }
                formData.append('type', 'reply');
            }
            if (mediaType && selectedFile) {
                formData.append('media_file', selectedFile);
                formData.append('media_type', mediaType);
            }
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

            // Add to Global Feed (Backend response includes all fields)
            addFeedItem({ ...res.data, type: 'reply' }); // Explicitly mark as reply for frontend filtering if needed, though backend structure is same

            console.log('Reply created:', res.data);

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
                    <span className="font-bold text-white">Reply</span>
                    <div className="w-9" />
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto scrollbar-thin-dark p-4">
                    {/* Target Item (Context) */}
                    <div className="mb-4 relative">
                        <div className="pointer-events-none opacity-80">
                            {isReview(activeItem) ? (
                                <ReviewCard review={activeItem} />
                            ) : (
                                <PostCard post={activeItem} />
                            )}
                        </div>
                    </div>

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
                                <div className="mb-2">
                                    <span className="text-zinc-500 text-sm">Replying to </span>
                                    <span className="text-emerald-500 text-sm font-medium">@{activeItem.user.username}</span>
                                </div>

                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Post your reply"
                                    className="w-full bg-transparent text-lg text-zinc-200 placeholder-zinc-500 border-none focus:outline-none focus:ring-0 resize-none min-h-[100px] p-0 mb-2"
                                    autoFocus
                                />

                                {/* Media Preview */}
                                {(previewUrl || selectedGif) && (
                                    <div className="relative mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-black">
                                        <button
                                            onClick={clearMedia}
                                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full z-10 transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>

                                        {mediaType === 'video' ? (
                                            <video src={previewUrl!} controls className="w-full max-h-[300px] object-contain" />
                                        ) : (
                                            <img src={previewUrl || selectedGif!} alt="Preview" className="w-full max-h-[300px] object-contain" />
                                        )}
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
                                            onChange={handleFileSelect}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-2 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 rounded-full transition-all text-sm font-medium"
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

                                    <button
                                        onClick={handleSubmit}
                                        disabled={!content.trim() && !selectedFile && !selectedGif && !(showPollCreator && pollOptions.filter(o => o.trim()).length >= 2) || isSubmitting}
                                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-full font-medium text-sm transition-colors flex items-center gap-2"
                                    >
                                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Reply
                                    </button>
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
