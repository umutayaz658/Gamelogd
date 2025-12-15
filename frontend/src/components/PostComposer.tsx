"use client";

import { useState, useRef } from 'react';
import { Image as ImageIcon, ImagePlay, FileImage, X, Smile, BarChart2, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import api from '@/lib/api';
import GifPicker from '@/components/GifPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Post } from '@/types';

interface PostComposerProps {
    onPostCreated: (post: Post) => void;
}

export default function PostComposer({ onPostCreated }: PostComposerProps) {
    const { user } = useAuth();

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
            const formData = new FormData();
            formData.append('content', content);

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

            onPostCreated(response.data);

            // Reset
            setContent('');
            clearMedia();
            setShowPollCreator(false);
            setPollOptions(['', '']);
            setShowEmojiPicker(false);
            setShowGifPicker(false);
        } catch (error) {
            console.error('Failed to create post:', error);
            alert('Failed to create post. Please try again.');
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
                <div className="flex-1 relative">
                    <textarea
                        placeholder="What's happening in the game world?"
                        className="w-full bg-transparent text-zinc-200 placeholder:text-zinc-500 focus:outline-none text-lg mb-2 resize-none min-h-[60px]"
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

                        <button
                            onClick={handlePost}
                            disabled={isPosting || (!content.trim() && !selectedFile && !selectedGif && !(showPollCreator && pollOptions.filter(o => o.trim()).length >= 2))}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-full font-medium text-sm transition-colors flex items-center gap-2"
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
