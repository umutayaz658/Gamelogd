"use client";

import { useState, useRef } from 'react';
import { Image as ImageIcon, ImagePlay, FileImage, X, Smile, BarChart2, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getImageUrl } from '@/lib/utils';
import api from '@/lib/api';
import GifPicker from '@/components/GifPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Post } from '@/types';

const MAX_CHARS = 500;

interface PostComposerProps {
    onPostCreated: (post: Post) => void;
    replyingTo?: { username: string };
    parentId?: number;
    parentType?: 'post' | 'review' | 'news';
}

export default function PostComposer({ onPostCreated, replyingTo, parentId, parentType = 'post' }: PostComposerProps) {
    const { user } = useAuth();
    const { showToast } = useToast();

    // Create Post State
    const [content, setContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);

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

    // Handlers
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

    const handlePost = async () => {
        const hasContent = content.trim().length > 0;
        const hasMedia = !!selectedFile || !!selectedGif;
        const validPoll = showPollCreator && pollOptions.filter(o => o.trim()).length >= 2;

        if (!hasContent && !hasMedia && !validPoll) return;

        setIsPosting(true);
        try {
            // FormData
            const formData = new FormData();
            formData.append('content', content);

            if (parentId) {
                if (parentType === 'review') {
                    formData.append('review_parent', parentId.toString());
                    formData.append('type', 'reply');
                } else if (parentType === 'news') {
                    formData.append('news_parent', parentId.toString());
                    // We treat news comments as root posts linked to news, 
                    // unless they are replies to other comments (which would be handled differently if intended, 
                    // but for now, direct news comments are cleaner as is)
                } else {
                    // Standard post reply
                    formData.append('parent', parentId.toString());
                    formData.append('type', 'reply');
                }
            }

            if (selectedFile) {
                formData.append('media_file', selectedFile);
                if (mediaType) formData.append('media_type', mediaType);
            }

            if (selectedGif) {
                formData.append('gif_url', selectedGif);
            }

            if (validPoll) {
                const finalOptions = pollOptions.filter(o => o.trim());
                formData.append('poll_options', JSON.stringify(finalOptions));
            }

            const response = await api.post('/posts/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            onPostCreated({ ...response.data, type: 'reply' }); // Ensure type is set for context if needed

            // Reset
            setContent('');
            clearMedia();
            setShowPollCreator(false);
            setPollOptions(['', '']);
            setShowEmojiPicker(false);
            setShowGifPicker(false);
        } catch (error) {
            console.error('Failed to create post:', error);
            showToast('Failed to create post. Please try again.', 'error');
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 transition-all duration-300 focus-within:border-zinc-700 focus-within:glow-emerald">
            <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full ring-2 ring-emerald-500/20 overflow-hidden flex-shrink-0">
                    <img
                        src={getImageUrl(user?.avatar, user?.username)}
                        alt="User"
                        className="h-full w-full rounded-full bg-zinc-800 object-cover"
                    />
                </div>
                <div className="flex-1 relative">
                    {replyingTo && (
                        <div className="mb-2">
                            <span className="text-zinc-500 text-sm">Replying to </span>
                            <span className="text-emerald-500 text-sm font-medium">@{replyingTo.username}</span>
                        </div>
                    )}
                    <textarea
                        placeholder="What's happening in the game world?"
                        className="w-full bg-transparent text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-0 text-lg mb-2 resize-none min-h-[60px]"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handlePost();
                            }
                        }}
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
                                <video src={previewUrl!} controls className="w-full max-h-[400px] object-contain" />
                            ) : (
                                <img src={previewUrl || selectedGif!} alt="Preview" className="w-full max-h-[400px] object-contain" />
                            )}
                        </div>
                    )}

                    {/* Poll Creator */}
                    {showPollCreator && (
                        <div className="mb-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-zinc-400">Poll Options</span>
                                <button onClick={togglePollCreator} className="text-zinc-500 hover:text-red-500 transition-colors">
                                    <X className="h-4 w-4" />
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
                                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                onClick={() => removePollOption(index)}
                                                className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
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
                                    className="mt-3 text-emerald-500 text-sm font-medium hover:underline flex items-center gap-1"
                                >
                                    <Plus className="h-3 w-3" /> Add Option
                                </button>
                            )}
                        </div>
                    )}

                    {/* Toolbar */}
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
                                title="Image/Video"
                            >
                                <ImagePlay className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setShowGifPicker(!showGifPicker);
                                    setShowEmojiPicker(false);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-sm font-medium ${showGifPicker ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                                title="GIF"
                            >
                                <FileImage className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setShowEmojiPicker(!showEmojiPicker);
                                    setShowGifPicker(false);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-sm font-medium ${showEmojiPicker ? 'bg-zinc-800 text-yellow-500' : 'text-zinc-400 hover:text-yellow-500 hover:bg-zinc-800'}`}
                                title="Emoji"
                            >
                                <Smile className="h-4 w-4" />
                            </button>
                            <button
                                onClick={togglePollCreator}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-sm font-medium ${showPollCreator ? 'bg-zinc-800 text-blue-500' : 'text-zinc-400 hover:text-blue-500 hover:bg-zinc-800'}`}
                                title="Poll"
                            >
                                <BarChart2 className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Character Counter */}
                        {content.length > 0 && (
                            <div className="flex items-center gap-2 mr-2">
                                <div className="relative h-6 w-6">
                                    <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" fill="none" stroke="#27272a" strokeWidth="2" />
                                        <circle
                                            cx="12" cy="12" r="10" fill="none"
                                            stroke={content.length > MAX_CHARS ? '#ef4444' : content.length > MAX_CHARS * 0.8 ? '#f59e0b' : '#10b981'}
                                            strokeWidth="2"
                                            strokeDasharray={`${(content.length / MAX_CHARS) * 62.83} 62.83`}
                                            strokeLinecap="round"
                                            className="transition-all duration-200"
                                        />
                                    </svg>
                                </div>
                                {content.length > MAX_CHARS * 0.8 && (
                                    <span className={`text-xs font-bold ${content.length > MAX_CHARS ? 'text-red-500' : 'text-amber-500'}`}>
                                        {MAX_CHARS - content.length}
                                    </span>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handlePost}
                            disabled={isPosting || content.length > MAX_CHARS || (!content.trim() && !selectedFile && !selectedGif && !(showPollCreator && pollOptions.filter(o => o.trim()).length >= 2))}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isPosting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Posting...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Post
                                </>
                            )}
                        </button>

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
                    </div>

                    {/* GIF Picker */}
                    {showGifPicker && (
                        <div className="mt-4 animate-in fade-in zoom-in-95 duration-200">
                            <GifPicker onSelected={handleGifSelect} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
