'use client';

import { useState, useEffect, useRef } from 'react';
import { 
    MessageSquare, ChevronUp, ChevronDown, X, ArrowLeft, Send, 
    Image as ImageIcon, Smile, Loader2, FileImage, CornerUpLeft, 
    Check, CheckCheck, Trash2, Ban, Shield
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { getImageUrl } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import GifPicker from '@/components/GifPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslation } from '@/lib/useTranslation';
import { useToast } from '@/context/ToastContext';

// API Data Types
interface MessageReaction {
    id: number;
    emoji: string;
    username: string;
    user: number;
}

interface Message {
    id: number;
    conversation: number;
    sender: {
        id: number;
        username: string;
        avatar: string | null;
    };
    content: string;
    is_read: boolean;
    created_at: string;
    is_me: boolean;
    image?: string | null;
    gif_url?: string | null;
    is_pinned?: boolean;
    is_edited?: boolean;
    is_deleted?: boolean;
    edited_at?: string | null;
    reactions?: MessageReaction[];
    reply_to?: number | null;
    reply_to_details?: {
        id: number;
        content: string;
        sender_username: string;
        image?: string | null;
        gif_url?: string | null;
    } | null;
}

interface ConversationMember {
    id: number;
    user: {
        id: number;
        username: string;
        avatar: string | null;
        real_name: string;
        is_blocked?: boolean;
        has_blocked_me?: boolean;
    };
    is_admin: boolean;
    status: string;
}

interface Conversation {
    id: number;
    participants: number[];
    is_group: boolean;
    name: string | null;
    avatar: string | null;
    other_user: {
        id: number;
        username: string;
        avatar: string | null;
        real_name: string;
        is_blocked?: boolean;
        has_blocked_me?: boolean;
    } | null;
    last_message: {
        content: string;
        created_at: string;
        sender_username: string;
    } | null;
    unread_count: number;
    updated_at: string;
    is_pending_invite?: boolean;
    my_membership_status?: string;
    memberships?: ConversationMember[];
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessagesDrawer() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { unreadMessages } = useNotifications();
    const { t } = useTranslation();
    const toast = useToast();

    const [isOpen, setIsOpen] = useState(false);
    const [activeChatId, setActiveChatId] = useState<number | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastMessageIdRef = useRef<number | null>(null);

    // Confirm Modal State
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({
        title: '',
        message: '',
        onConfirm: () => {}
    });

    // Media & upload state
    const [selectedGif, setSelectedGif] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Pickers state
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [activeEmojiMenuMsgId, setActiveEmojiMenuMsgId] = useState<number | null>(null);

    // Thread/Reply state
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setInputText((prev) => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleGifSelect = (url: string) => {
        setSelectedGif(url);
        setShowGifPicker(false);
        setImageFile(null);
        setImagePreview(null);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size must be less than 10MB");
            return;
        }
        
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setSelectedGif(null);
    };

    const clearAttachments = () => {
        setSelectedGif(null);
        setImageFile(null);
        setImagePreview(null);
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    // Fetch Conversations
    const fetchConversations = async () => {
        try {
            const res = await api.get('/conversations/');
            setConversations(res.data);
        } catch (error) {
            console.error("Failed to fetch conversations:", error);
        }
    };

    useEffect(() => {
        if (user && isOpen) {
            fetchConversations();
        }
    }, [user, isOpen]);

    // Fetch Messages & Start Polling
    useEffect(() => {
        let isMounted = true;
        let pollInterval: NodeJS.Timeout;
        lastMessageIdRef.current = null;

        const fetchInitial = async () => {
            if (!activeChatId) return;
            setIsLoading(true);
            try {
                const res = await api.get(`/messages/?conversation_id=${activeChatId}`);
                if (isMounted) {
                    const results: Message[] = res.data.results;
                    setMessages(results);
                    lastMessageIdRef.current = results.length > 0 ? results[results.length - 1].id : null;
                }
            } catch (error) {
                console.error("Failed to fetch messages:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        // Polling only fetches messages newer than the last one we know about — a chat's
        // full history used to be refetched wholesale every 3 seconds.
        const fetchNewMessages = async () => {
            if (!activeChatId) return;
            try {
                const url = lastMessageIdRef.current != null
                    ? `/messages/?conversation_id=${activeChatId}&after_id=${lastMessageIdRef.current}`
                    : `/messages/?conversation_id=${activeChatId}`;
                const res = await api.get(url);
                if (!isMounted) return;
                const newOnes: Message[] = res.data.results;
                if (newOnes.length > 0) {
                    setMessages(prev => {
                        if (lastMessageIdRef.current == null) return newOnes;
                        // Defensive dedup — guards against ever double-appending a message
                        // that was already added optimistically (e.g. by a local send).
                        const existingIds = new Set(prev.map(m => m.id));
                        return [...prev, ...newOnes.filter(m => !existingIds.has(m.id))];
                    });
                    lastMessageIdRef.current = newOnes[newOnes.length - 1].id;
                }
            } catch (error) {
                console.error("Failed to poll messages:", error);
            }
        };

        if (activeChatId) {
            fetchInitial();
            // Poll every 3 seconds
            pollInterval = setInterval(fetchNewMessages, 3000);
        }

        return () => {
            isMounted = false;
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [activeChatId]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const hasText = inputText.trim().length > 0;
        const hasGif = !!selectedGif;
        const hasImage = !!imageFile;
        if ((!hasText && !hasGif && !hasImage) || !activeChatId) return;

        try {
            let resData;
            if (hasImage) {
                // Multipart form data
                const formData = new FormData();
                formData.append('conversation', activeChatId.toString());
                formData.append('content', inputText);
                formData.append('image', imageFile);
                if (replyingTo) {
                    formData.append('reply_to', replyingTo.id.toString());
                }
                const res = await api.post('/messages/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                resData = res.data;
            } else {
                // Simple JSON
                const payload: any = {
                    conversation: activeChatId,
                    content: inputText,
                };
                if (selectedGif) payload.gif_url = selectedGif;
                if (replyingTo) payload.reply_to = replyingTo.id;
                
                const res = await api.post('/messages/', payload);
                resData = res.data;
            }

            setMessages(prev => [...prev, resData]);
            lastMessageIdRef.current = resData.id;
            setInputText('');
            clearAttachments();
            setReplyingTo(null);
            setShowEmojiPicker(false);
            setShowGifPicker(false);
            fetchConversations(); // Update last message in list
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    // React to a message
    const handleMessageReact = async (messageId: number, emoji: string) => {
        try {
            await api.post(`/messages/${messageId}/react/`, { emoji });
            setMessages(prev => prev.map(msg => {
                if (msg.id !== messageId) return msg;
                const existing = msg.reactions?.find(r => r.emoji === emoji && r.username === user?.username);
                let updatedReactions = msg.reactions ? [...msg.reactions] : [];
                if (existing) {
                    updatedReactions = updatedReactions.filter(r => r.id !== existing.id);
                } else {
                    updatedReactions.push({
                        id: Date.now(),
                        emoji,
                        username: user?.username || '',
                        user: user?.id || 0
                    });
                }
                return { ...msg, reactions: updatedReactions };
            }));
            setActiveEmojiMenuMsgId(null);
        } catch (error) {
            console.error("Failed to react to message:", error);
        }
    };

    // Invite flow handlers
    const handleAcceptInvite = async (chatId: number) => {
        try {
            await api.post(`/conversations/${chatId}/accept-invite/`);
            fetchConversations();
        } catch (error) {
            console.error("Failed to accept invite:", error);
        }
    };

    const handleDeclineInvite = async (chatId: number) => {
        try {
            await api.post(`/conversations/${chatId}/decline-invite/`);
            setActiveChatId(null);
            fetchConversations();
        } catch (error) {
            console.error("Failed to decline invite:", error);
        }
    };

    const handleBlockGroup = async (chatId: number) => {
        setConfirmConfig({
            title: 'Block Group Invite?',
            message: 'Are you sure you want to block invitation from this group?',
            onConfirm: async () => {
                try {
                    await api.post(`/conversations/${chatId}/block-group/`);
                    setActiveChatId(null);
                    fetchConversations();
                } catch (error) {
                    console.error("Failed to block group:", error);
                }
                setIsConfirmOpen(false);
            }
        });
        setIsConfirmOpen(true);
    };

    const handleChatClick = (chatId: number) => {
        setActiveChatId(chatId);
        setConversations(prev => prev.map(c =>
            c.id === chatId ? { ...c, unread_count: 0 } : c
        ));
    };

    const activeChat = conversations.find(c => c.id === activeChatId);

    const getChatName = (chat: Conversation) => {
        if (chat.is_group) return chat.name || "Group Chat";
        
        if (chat.other_user?.is_blocked) {
            return `${chat.other_user?.real_name || chat.other_user?.username} (${t('blocked')})`;
        }
        if (chat.other_user?.has_blocked_me) {
            return "Gamer";
        }
        return chat.other_user?.real_name || chat.other_user?.username || "Gamer Chat";
    };

    const getChatAvatar = (chat: Conversation) => {
        if (chat.is_group) {
            return chat.avatar || "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=100&auto=format&fit=crop";
        }
        
        if (chat.other_user?.is_blocked || chat.other_user?.has_blocked_me) {
            return "https://ui-avatars.com/api/?name=%3F&background=3f3f46&color=a1a1aa";
        }
        return getImageUrl(chat.other_user?.avatar, chat.other_user?.username);
    };

    if (!user || pathname?.startsWith('/messages')) return null;

    return (
        <div className="fixed bottom-0 right-4 z-50 hidden lg:flex flex-col items-end">

            {/* Drawer Container */}
            <div
                className={`bg-zinc-900 border border-zinc-800 rounded-t-2xl shadow-2xl w-80 transition-all duration-300 overflow-hidden flex flex-col ${
                    isOpen ? 'h-[420px]' : 'h-12'
                }`}
            >
                <div
                    className={`h-12 bg-zinc-900 flex items-center justify-between px-4 cursor-pointer hover:bg-zinc-800 transition-colors ${
                        isOpen ? 'border-b border-zinc-800' : ''
                    }`}
                    onClick={() => !activeChatId && setIsOpen(!isOpen)}
                >
                    {activeChat ? (
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveChatId(null); setReplyingTo(null); }}
                                className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4 text-zinc-400" />
                            </button>
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="h-6 w-6 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                                    <img
                                        src={getChatAvatar(activeChat)}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="font-bold text-xs truncate max-w-[130px] text-zinc-200">
                                    {getChatName(activeChat)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 font-bold text-sm text-white">
                            <MessageSquare className="h-4.5 w-4.5 text-emerald-500" />
                            <span>{t('messages')}</span>
                            {unreadMessages > 0 && (
                                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                                    {unreadMessages}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                            className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
                        >
                            {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronUp className="h-4 w-4 text-zinc-400" />}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {isOpen && (
                    <div className="flex-1 bg-zinc-950 flex flex-col overflow-hidden relative">
                        {activeChatId && activeChat ? (
                            // Chat Messaging View
                            <>
                                <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                                    {isLoading && messages.length === 0 ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div key={msg.id} className="flex flex-col gap-0.5 group">
                                                
                                                {/* Group Sender ID badge */}
                                                {activeChat.is_group && !msg.is_me && (
                                                    <span className="text-[9px] text-zinc-500 pl-1">@{msg.sender.username}</span>
                                                )}

                                                {/* flex-row-reverse for the non-own side keeps the bubble the closest item to
                                                    the container's own edge (matching how justify-end already does this for
                                                    is_me), with the reply/react panel on the inner side instead of pushing
                                                    the bubble away from the edge. */}
                                                <div className={`flex items-end gap-1.5 ${msg.is_me ? 'flex-row justify-end' : 'flex-row-reverse justify-start'}`}>

                                                    {/* Hover Action Panel (Reply / React) — self-center so it's vertically
                                                        centered against the bubble rather than pinned to the row's bottom
                                                        (which would follow the reactions row when one is present). */}
                                                    {!msg.is_deleted && (
                                                        <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 z-10">
                                                            
                                                            {/* React Button */}
                                                            <div className="relative">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setActiveEmojiMenuMsgId(activeEmojiMenuMsgId === msg.id ? null : msg.id)}
                                                                    className="p-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white"
                                                                    title="React"
                                                                >
                                                                    <Smile className="h-3 w-3" />
                                                                </button>
                                                                
                                                                {activeEmojiMenuMsgId === msg.id && (
                                                                    <div className="absolute bottom-6 right-0 bg-zinc-900 border border-zinc-800 rounded-full py-1 px-1.5 flex gap-1 shadow-2xl z-50">
                                                                        {QUICK_EMOJIS.map(emoji => (
                                                                            <button
                                                                                key={emoji}
                                                                                onClick={() => handleMessageReact(msg.id, emoji)}
                                                                                className="hover:scale-125 transition-transform text-xs"
                                                                            >
                                                                                {emoji}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Reply Button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setReplyingTo(msg)}
                                                                className="p-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white"
                                                                title="Reply"
                                                            >
                                                                <CornerUpLeft className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Message bubble itself */}
                                                    <div className="flex flex-col max-w-[75%]">
                                                        <div className={`px-3 py-2 rounded-xl text-xs flex flex-col ${
                                                            msg.is_me 
                                                                ? 'bg-emerald-600 text-white rounded-tr-none' 
                                                                : 'bg-zinc-900 text-zinc-200 rounded-tl-none border border-zinc-800/80'
                                                        }`}>
                                                            {/* Reply Details */}
                                                            {msg.reply_to_details && (
                                                                <div className={`p-1.5 rounded-lg mb-1 text-[10px] border-l-2 border-emerald-400 truncate ${
                                                                    msg.is_me ? 'bg-emerald-950/20 text-emerald-100' : 'bg-zinc-950 text-zinc-400'
                                                                }`}>
                                                                    <span className="font-bold">@{msg.reply_to_details.sender_username}</span>
                                                                    <p className="truncate mt-0.5">{msg.reply_to_details.content || 'Photo/Attachment'}</p>
                                                                </div>
                                                            )}

                                                            {/* Content */}
                                                            {msg.is_deleted ? (
                                                                <span className="italic text-zinc-500">This message was deleted</span>
                                                            ) : (
                                                                <span>{msg.content}</span>
                                                            )}

                                                            {/* Attachment renderers */}
                                                            {msg.image && (
                                                                <img src={msg.image} alt="Attachment" className="mt-1.5 rounded-lg max-h-32 object-contain bg-black/40 border border-zinc-800" />
                                                            )}
                                                            {msg.gif_url && (
                                                                <img src={msg.gif_url} alt="GIF" className="mt-1.5 rounded-lg max-h-32 object-contain" />
                                                            )}

                                                            {/* Timestamp / Indicators */}
                                                            <div className={`text-[8px] mt-1.5 text-right flex items-center justify-end gap-1 ${
                                                                msg.is_me ? 'text-emerald-250' : 'text-zinc-500'
                                                            }`}>
                                                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                                                {msg.is_edited && <span>(edited)</span>}
                                                                {msg.is_me && (
                                                                    msg.is_read 
                                                                        ? <CheckCheck className="h-2.5 w-2.5 text-emerald-350" /> 
                                                                        : <Check className="h-2.5 w-2.5 opacity-70" />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Emoji Reactions badges */}
                                                        {msg.reactions && msg.reactions.length > 0 && (
                                                            <div className="flex gap-1 mt-0.5">
                                                                {Object.entries(
                                                                    msg.reactions.reduce((acc: { [emoji: string]: number }, r) => {
                                                                        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                                                        return acc;
                                                                    }, {})
                                                                ).map(([emoji, count]) => (
                                                                    <span key={emoji} className="bg-zinc-900 border border-zinc-800 rounded-full px-1.5 py-0.5 text-[9px] text-zinc-400">
                                                                        {emoji} {count}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Reply Preview Box */}
                                {replyingTo && (
                                    <div className="px-3 py-1.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between animate-in slide-in-from-bottom-1 duration-150">
                                        <div className="min-w-0">
                                            <span className="text-[9px] font-bold text-emerald-500">Replying to @{replyingTo.sender.username}</span>
                                            <p className="text-[10px] text-zinc-400 truncate">{replyingTo.content || 'Attachment'}</p>
                                        </div>
                                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}

                                {/* WhatsApp-style Pending Invite Flow */}
                                {activeChat.my_membership_status === 'pending' ? (
                                    <div className="p-4 border-t border-zinc-800 bg-zinc-900 text-center flex flex-col gap-2">
                                        <div className="text-xs font-bold text-zinc-400 mb-1 flex items-center justify-center gap-1.5">
                                            <Shield className="h-4 w-4 text-emerald-500" />
                                            <span>Group Invitation</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mb-2 leading-relaxed">
                                            You have been invited to join this group chat. Accept to see messages and participate.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAcceptInvite(activeChat.id)}
                                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all"
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => handleDeclineInvite(activeChat.id)}
                                                className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Decline
                                            </button>
                                            <button
                                                onClick={() => handleBlockGroup(activeChat.id)}
                                                className="p-1.5 bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40 rounded-lg"
                                                title="Block Group invitations"
                                            >
                                                <Ban className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // Chat Composer input bar
                                    <form onSubmit={handleSendMessage} className="p-2 border-t border-zinc-800 bg-zinc-900 relative">
                                        <div className="flex items-center gap-2">
                                            
                                            {/* Image upload trigger */}
                                            <input 
                                                type="file" 
                                                ref={imageInputRef} 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={handleImageSelect} 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => imageInputRef.current?.click()} 
                                                className="text-zinc-400 hover:text-white"
                                                title="Upload Image"
                                            >
                                                <ImageIcon className="h-4.5 w-4.5" />
                                            </button>

                                            <button type="button" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }} className="text-zinc-400 hover:text-white">
                                                <Smile className="h-4.5 w-4.5" />
                                            </button>
                                            <button type="button" onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }} className="text-zinc-400 hover:text-white">
                                                <FileImage className="h-4.5 w-4.5" />
                                            </button>
                                            
                                            <input
                                                value={inputText}
                                                onChange={(e) => setInputText(e.target.value)}
                                                placeholder="Type a message..."
                                                className="flex-1 bg-zinc-800 text-white text-xs rounded-full px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                            <button type="submit" disabled={!inputText.trim() && !selectedGif && !imageFile} className="text-emerald-500 hover:text-emerald-400 disabled:opacity-50 flex-shrink-0">
                                                <Send className="h-4.5 w-4.5" />
                                            </button>
                                        </div>

                                        {/* Image/GIF Previews */}
                                        {(selectedGif || imagePreview) && (
                                            <div className="mt-2 relative inline-block bg-black/40 p-1 rounded-lg border border-zinc-800">
                                                <img src={imagePreview || selectedGif!} alt="Preview" className="h-14 rounded object-cover" />
                                                <button type="button" onClick={clearAttachments} className="absolute -top-1.5 -right-1.5 bg-zinc-950 text-zinc-450 border border-zinc-800 hover:text-white rounded-full p-0.5">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Pickers popovers */}
                                        {showEmojiPicker && (
                                            <div className="absolute bottom-14 left-0 z-50 animate-in fade-in zoom-in-95 duration-200">
                                                <EmojiPicker 
                                                    onEmojiClick={onEmojiClick} 
                                                    theme={Theme.DARK} 
                                                    lazyLoadEmojis={true}
                                                    width={280}
                                                    height={300}
                                                />
                                            </div>
                                        )}
                                        {showGifPicker && (
                                            <div className="absolute bottom-14 left-0 z-50 w-full p-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
                                                <div className="flex items-center justify-between mb-2 pb-1 border-b border-zinc-800">
                                                    <span className="text-[10px] font-bold text-zinc-400">Select GIF</span>
                                                    <button type="button" onClick={() => setShowGifPicker(false)} className="text-zinc-500 hover:text-white">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                <div className="max-h-52 overflow-y-auto scrollbar-thin">
                                                    <GifPicker onSelected={handleGifSelect} />
                                                </div>
                                            </div>
                                        )}
                                    </form>
                                )}
                            </>
                        ) : (
                            // Conversation Lists View
                            <div className="flex-1 overflow-y-auto">
                                {conversations.length === 0 ? (
                                    <div className="p-4 text-center text-zinc-500 text-xs leading-relaxed">
                                        {t('noConversations')}
                                        <br />
                                        <Link href="/messages" className="text-emerald-500 hover:underline mt-2 inline-block font-semibold">
                                            {t('goToMessagesPage')}
                                        </Link>
                                    </div>
                                ) : (
                                    conversations.map((chat) => (
                                        <button
                                            key={chat.id}
                                            onClick={() => handleChatClick(chat.id)}
                                            className={`w-full p-3 flex items-center gap-3 hover:bg-zinc-900/50 transition-colors border-b border-zinc-900/40 relative ${
                                                chat.is_pending_invite ? 'bg-emerald-950/10' : ''
                                            }`}
                                        >
                                            <div className="relative flex-shrink-0">
                                                <div className="h-9 w-9 rounded-full overflow-hidden bg-zinc-800">
                                                    <img
                                                        src={getChatAvatar(chat)}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                {chat.is_group && (
                                                    <span className="absolute -bottom-1 -right-1 bg-zinc-900 border border-zinc-800 text-[8px] px-1 rounded font-bold text-zinc-500">
                                                        GP
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-left flex-1 min-w-0">
                                                <div className="font-bold text-xs text-zinc-200 truncate flex items-center gap-1.5">
                                                    {getChatName(chat)}
                                                    {chat.is_pending_invite && (
                                                        <span className="bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-full font-bold">
                                                            Invite
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                                    {chat.last_message ? (
                                                        <span>
                                                            <span className="font-medium text-zinc-400">@{chat.last_message.sender_username}: </span>
                                                            {chat.last_message.content}
                                                        </span>
                                                    ) : (
                                                        t('noMessages')
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Unread badge */}
                                            {chat.unread_count > 0 && (
                                                <div className="h-2 w-2 bg-emerald-500 rounded-full flex-shrink-0" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
            />
        </div>
    );
}
