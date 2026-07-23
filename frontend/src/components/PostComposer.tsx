"use client";

import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, ImagePlay, FileImage, X, Smile, BarChart2, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import api from '@/lib/api';
import GifPicker from '@/components/GifPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Post } from '@/types';
import { useTranslation } from '@/lib/useTranslation';
import { useToast } from '@/context/ToastContext';
import PostMediaGrid from '@/components/PostMediaGrid';
import MentionAutocomplete from '@/components/MentionAutocomplete';

// Grid display still caps at 4 visible cells (Twitter standard, with a "+N" overlay
// past that) — this only bounds how many files a single post can attach.
const MAX_MEDIA_ITEMS = 10;

interface ComposerMediaItem {
    file: File;
    preview: string;
    type: 'image' | 'video';
}

interface PostComposerProps {
    onPostCreated: (post: Post) => void;
    replyingTo?: { username: string };
    parentId?: number;
    parentType?: 'post' | 'review' | 'news';
}

export default function PostComposer({ onPostCreated, replyingTo, parentId, parentType = 'post' }: PostComposerProps) {
    const { user } = useAuth();
    const { t } = useTranslation();
    const toast = useToast();

    // Create Post State
    const [content, setContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [category, setCategory] = useState('general');

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Mention Autocomplete
    const { handleKeyDown: handleMentionKeyDown, renderSuggestions } = MentionAutocomplete({
        textareaRef,
        value: content,
        onChange: setContent,
        onKeyDown: (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePost();
            }
        },
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

    // Cleanup object URLs on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            mediaItems.forEach(item => URL.revokeObjectURL(item.preview));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handlers
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

    const handlePost = async () => {
        const hasContent = content.trim().length > 0;
        const hasMedia = mediaItems.length > 0 || !!selectedGif;
        const validPoll = showPollCreator && pollOptions.filter(o => o.trim()).length >= 2;

        if (!hasContent && !hasMedia && !validPoll) return;

        setIsPosting(true);
        try {
            // FormData
            const formData = new FormData();
            formData.append('content', content);
            formData.append('category', category);

            if (parentId) {
                if (parentType === 'review') {
                    formData.append('review_parent', parentId.toString());
                    formData.append('type', 'reply');
                } else if (parentType === 'news') {
                    formData.append('news_parent', parentId.toString());
                } else {
                    // Standard post reply
                    formData.append('parent', parentId.toString());
                    formData.append('type', 'reply');
                }
            }

            mediaItems.forEach(item => formData.append('uploaded_media', item.file));

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

            onPostCreated({ ...response.data, type: 'reply' });

            // Reset
            setContent('');
            clearMedia();
            setShowPollCreator(false);
            setPollOptions(['', '']);
            setShowEmojiPicker(false);
            setShowGifPicker(false);
            setCategory('general');
        } catch (error: any) {
            console.error('Failed to create post:', error);
            if (error.response?.data?.traceback) {
                console.error('BACKEND TRACEBACK:\n', error.response.data.traceback);
                toast.error(`Failed to create post:\n${error.response.data.error || 'Server Error'}`);
            } else {
                toast.error('Failed to create post. Please try again.');
            }
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
            <div className="flex gap-4">
                <img
                    src={getImageUrl(user?.avatar, user?.username)}
                    alt="User"
                    className="h-10 w-10 rounded-full bg-zinc-800 object-cover"
                />
                <div className="flex-1 min-w-0 relative">
                    {replyingTo && (
                        <div className="mb-2">
                            <span className="text-zinc-500 text-sm">{t('replyingTo')} </span>
                            <span className="text-emerald-500 text-sm font-medium">@{replyingTo.username}</span>
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        placeholder={t('whatsHappening')}
                        className="w-full bg-transparent text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-0 text-lg mb-2 resize-none min-h-[60px] overflow-hidden"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        maxLength={350}
                        onKeyDown={handleMentionKeyDown}
                    />

                    {/* Mention Suggestions Popup */}
                    {renderSuggestions()}

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
                            <img src={selectedGif} alt="Preview" className="w-full max-h-[400px] object-contain" />
                        </div>
                    )}

                    {/* Poll Creator */}
                    {showPollCreator && (
                        <div className="mb-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-zinc-400">{t('pollOptions')}</span>
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
                    <div className="flex items-center gap-2 justify-between border-t border-zinc-800 pt-3 relative">
                        <div className="flex gap-1 items-center overflow-x-auto scrollbar-thin-dark min-w-0">
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
                                className="flex-shrink-0 flex items-center gap-2 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 p-2 sm:px-3 sm:py-1.5 rounded-full transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Image/Video"
                            >
                                <ImagePlay className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setShowGifPicker(!showGifPicker);
                                    setShowEmojiPicker(false);
                                }}
                                className={`flex-shrink-0 flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-full transition-all text-sm font-medium ${showGifPicker ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                                title="GIF"
                            >
                                <FileImage className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setShowEmojiPicker(!showEmojiPicker);
                                    setShowGifPicker(false);
                                }}
                                className={`flex-shrink-0 flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-full transition-all text-sm font-medium ${showEmojiPicker ? 'bg-zinc-800 text-yellow-500' : 'text-zinc-400 hover:text-yellow-500 hover:bg-zinc-800'}`}
                                title="Emoji"
                            >
                                <Smile className="h-4 w-4" />
                            </button>
                            <button
                                onClick={togglePollCreator}
                                className={`flex-shrink-0 flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-full transition-all text-sm font-medium ${showPollCreator ? 'bg-zinc-800 text-blue-500' : 'text-zinc-400 hover:text-blue-500 hover:bg-zinc-800'}`}
                                title="Poll"
                            >
                                <BarChart2 className="h-4 w-4" />
                            </button>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="flex-shrink-0 max-w-[6.5rem] sm:max-w-none bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1 text-xs text-zinc-450 hover:text-white transition-colors focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                                title="Select Post Category"
                            >
                                <option value="general">📁 General</option>
                                <option value="reviews">⭐ Reviews</option>
                                <option value="gameplay">🎮 Gameplay</option>
                                <option value="news">📰 News</option>
                                <option value="discussion">💬 Discussion</option>
                                <option value="memes">😂 Memes</option>
                                <option value="esports">🏆 Esports</option>
                                <option value="indie">🎨 Indie</option>
                                <option value="devlogs">🛠️ Dev Logs</option>
                                <option value="tips">📖 Tips & Guides</option>
                            </select>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                            {content.length > 0 && (
                                <span className={`text-xs font-semibold select-none transition-colors ${
                                    content.length >= 350 ? 'text-red-500 font-bold' :
                                    content.length >= 320 ? 'text-amber-500' : 'text-zinc-500'
                                }`}>
                                    {350 - content.length}
                                </span>
                            )}
                            <button
                                onClick={handlePost}
                                disabled={isPosting || (!content.trim() && mediaItems.length === 0 && !selectedGif && !(showPollCreator && pollOptions.filter(o => o.trim()).length >= 2)) || content.length > 350}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-3 sm:px-4 py-1.5 rounded-full font-medium text-sm transition-colors flex items-center gap-2"
                            >
                                {isPosting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="hidden sm:inline">{t('loading')}</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        <span className="hidden sm:inline">{t('post')}</span>
                                    </>
                                )}
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

