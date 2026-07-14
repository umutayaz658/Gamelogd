'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import { 
    Search, Plus, MoreVertical, Phone, Video, Info, 
    Image as ImageIcon, Send, Smile, Loader2, Bell, BellOff, 
    LogOut, UserPlus, UserMinus, Shield, FileImage, X, Check, Edit2, CornerUpLeft,
    Ban, Trash2, Pin, PinOff, Flag, CheckCheck, MailQuestion
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import NewChatModal from '@/components/NewChatModal';
import { useNotifications } from '@/context/NotificationContext';
import GifPicker from '@/components/GifPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslation } from '@/lib/useTranslation';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';

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
    shared_post_details?: any | null;
    shared_review_details?: any | null;
    shared_news_details?: any | null;
    reactions?: MessageReaction[];
    reply_to?: number | null;
    reply_to_details?: {
        id: number;
        content: string;
        sender_username: string;
        image?: string | null;
        gif_url?: string | null;
    } | null;
    is_edited?: boolean;
    is_deleted?: boolean;
    is_pinned?: boolean;
}

interface ConversationMember {
    id: number;
    user: {
        id: number;
        username: string;
        avatar: string | null;
        real_name: string;
    };
    is_admin: boolean;
    is_muted: boolean;
    joined_at: string;
}

interface Conversation {
    id: number;
    is_group: boolean;
    name: string | null;
    avatar: string | null;
    participants: number[];
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
    memberships?: ConversationMember[];
    is_pending_invite?: boolean;
    my_membership_status?: string;
}

function MessageAttachment({ msg }: { msg: Message }) {
    if (msg.image) {
        return (
            <div className="mt-2 rounded-xl overflow-hidden border border-zinc-800 bg-black max-w-sm max-h-60 cursor-pointer" onClick={() => window.open(getImageUrl(msg.image), '_blank')}>
                <img src={getImageUrl(msg.image)} className="w-full h-auto max-h-60 object-contain" alt="Attachment" />
            </div>
        );
    }
    if (msg.gif_url) {
        return (
            <div className="mt-2 rounded-xl overflow-hidden border border-zinc-800 bg-black max-w-sm max-h-60">
                <img src={msg.gif_url} className="w-full h-auto max-h-60 object-contain" alt="GIF Attachment" />
            </div>
        );
    }
    if (msg.shared_post_details) {
        const post = msg.shared_post_details;
        const isOpinion = !!post.news_parent;
        const isDevlog = !!post.project_parent;
        
        return (
            <Link 
                href={`/${post.user.username}/status/${post.id}`} 
                className="block mt-2 max-w-sm"
            >
                <div className="p-3 bg-zinc-950/45 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-100 text-left">
                    <div className="flex items-start gap-2.5 mb-2">
                        <img 
                            src={getImageUrl(post.user.avatar, post.user.username)} 
                            className="h-8 w-8 rounded-full object-cover border border-zinc-800/50" 
                            alt={post.user.username} 
                        />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-xs truncate max-w-[130px]">{post.user.real_name || post.user.username}</span>
                                <span className="text-[10px] text-zinc-500 truncate">@{post.user.username}</span>
                            </div>
                            <div className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider mt-0.5">
                                {isDevlog ? 'Devlog' : isOpinion ? 'Opinion' : 'Post'}
                            </div>
                        </div>
                    </div>
                    {post.title && <h4 className="font-bold text-xs text-white mb-1.5 leading-snug">{post.title}</h4>}
                    <p className="text-zinc-300 text-[11px] line-clamp-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                    {(post.media_file || post.image) && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-zinc-800/50 max-h-36">
                            <img 
                                src={getImageUrl(post.media_file || post.image || '')} 
                                className="w-full h-full object-cover" 
                                alt="Shared Media" 
                            />
                        </div>
                    )}
                    {post.gif_url && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-zinc-800/50 max-h-36">
                            <img 
                                src={post.gif_url} 
                                className="w-full h-full object-cover" 
                                alt="Shared GIF" 
                            />
                        </div>
                    )}
                </div>
            </Link>
        );
    }
    if (msg.shared_review_details) {
        const review = msg.shared_review_details;
        return (
            <Link 
                href={`/${review.user.username}/review/${review.id}`} 
                className="block mt-2 max-w-sm"
            >
                <div className="p-3 bg-zinc-950/45 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-100 text-left flex gap-3">
                    <div className="w-14 h-20 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800/40 flex-shrink-0">
                        {review.game.cover_image && <img src={getImageUrl(review.game.cover_image)} className="w-full h-full object-cover" alt="Game cover" />}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h4 className="font-bold text-xs text-white truncate mb-0.5">{review.game.title}</h4>
                        <div className="text-emerald-500 text-xs font-bold mb-1">Logged: {review.rating}/10</div>
                        <p className="text-zinc-400 text-[11px] line-clamp-2 leading-tight">{review.content || 'No review written.'}</p>
                        <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-500">
                            <span>By @{review.user.username}</span>
                        </div>
                    </div>
                </div>
            </Link>
        );
    }
    if (msg.shared_news_details) {
        const news = msg.shared_news_details;
        return (
            <Link 
                href={`/news/${news.id}`} 
                className="block mt-2 max-w-sm"
            >
                <div className="p-3 bg-zinc-950/45 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-100 text-left flex gap-3">
                    {news.image_url && (
                        <div className="w-16 h-16 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800/40 flex-shrink-0">
                            <img src={news.image_url} className="w-full h-full object-cover" alt="News thumbnail" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="text-[9px] text-zinc-500 flex items-center gap-1 mb-1">
                            {news.source_icon && <img src={news.source_icon} className="h-3 w-3 rounded-full" alt={news.source_name} />}
                            <span>{news.source_name}</span>
                        </div>
                        <h4 className="font-bold text-xs text-white leading-snug line-clamp-2">{news.title}</h4>
                    </div>
                </div>
            </Link>
        );
    }
    return null;
}

function ReactionButton({ msg, onReact }: { msg: Message; onReact: (msgId: number, emoji: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-850 transition-all focus:outline-none"
                title="React to message"
            >
                <Smile className="h-4 w-4" />
            </button>
            {isOpen && (
                <div className={`absolute bottom-8 z-30 bg-zinc-950 border border-zinc-800 rounded-full px-2 py-1 flex items-center gap-1.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 ${
                    msg.is_me ? 'right-0' : 'left-0'
                }`}>
                    {emojis.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                                onReact(msg.id, emoji);
                                setIsOpen(false);
                            }}
                            className="hover:scale-125 active:scale-95 transition-transform text-sm p-0.5"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function MessagesContent() {
    const { user, login } = useAuth();
    const router = useRouter();
    const { markMessagesRead } = useNotifications();
    const searchParams = useSearchParams();
    const initialChatId = searchParams.get('chatId');
    const { t, language } = useTranslation();
    const toast = useToast();
    const confirm = useConfirm();

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<number | null>(initialChatId ? parseInt(initialChatId) : null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isMessagesLoading, setIsMessagesLoading] = useState(false);
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    
    // Confirm Modal State
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({
        title: '',
        message: '',
        onConfirm: () => {},
        isDanger: false
    });
    
    // Do Not Disturb
    const [dndMode, setDndMode] = useState(user?.dnd_mode || false);
    
    // Details Drawer
    const [showDetails, setShowDetails] = useState(false);
    const [editingName, setEditingName] = useState('');
    const [isSavingDetails, setIsSavingDetails] = useState(false);
    const [groupAvatarFile, setGroupAvatarFile] = useState<File | null>(null);
    const [groupAvatarPreview, setGroupAvatarPreview] = useState<string | null>(null);

    // Add member inside group details
    const [addMemberQuery, setAddMemberQuery] = useState('');
    const [addMemberResults, setAddMemberResults] = useState<any[]>([]);
    const [isSearchingMembers, setIsSearchingMembers] = useState(false);

    // Media States in Message Composer
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedGif, setSelectedGif] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Replying
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Search in conversation
    const [showSearchMessages, setShowSearchMessages] = useState(false);
    const [searchMessagesQuery, setSearchMessagesQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Message[]>([]);

    // Message context menu
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: Message } | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [editContent, setEditContent] = useState('');

    const scrollToMessage = (msgId: number) => {
        const element = document.getElementById(`msg-${msgId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-emerald-500/10', 'border-emerald-500/20', 'scale-[1.01]');
            setTimeout(() => {
                element.classList.remove('bg-emerald-500/10', 'border-emerald-500/20', 'scale-[1.01]');
            }, 1200);
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const groupAvatarInputRef = useRef<HTMLInputElement>(null);

    // Fetch Conversations
    const fetchConversations = async () => {
        try {
            const res = await api.get('/conversations/');
            setConversations(res.data);
        } catch (error) {
            console.error("Failed to fetch conversations:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchConversations();
            markMessagesRead();
            setDndMode(user.dnd_mode || false);
        }
    }, [user]);

    // Fetch Messages when chat is selected (with Polling)
    useEffect(() => {
        if (!selectedChatId) return;

        const fetchMessages = async (isInitial = false) => {
            if (isInitial) setIsMessagesLoading(true);
            try {
                const res = await api.get(`/messages/?conversation_id=${selectedChatId}`);
                setMessages(res.data);
            } catch (error) {
                console.error("Failed to fetch messages:", error);
            } finally {
                if (isInitial) setIsMessagesLoading(false);
            }
        };

        fetchMessages(true);

        const intervalId = setInterval(() => fetchMessages(false), 3000); // Poll every 3s

        return () => clearInterval(intervalId);
    }, [selectedChatId]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Search users to add inside group
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (addMemberQuery.trim()) {
                setIsSearchingMembers(true);
                try {
                    const res = await api.get(`/users/?search=${addMemberQuery}`);
                    setAddMemberResults(res.data.results || res.data);
                } catch (error) {
                    console.error("Failed to search members:", error);
                } finally {
                    setIsSearchingMembers(false);
                }
            } else {
                setAddMemberResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [addMemberQuery]);

    // DND Toggle
    const handleToggleDnd = async () => {
        try {
            const newDnd = !dndMode;
            setDndMode(newDnd);
            const res = await api.patch('/users/me/', { dnd_mode: newDnd });
            // Update auth context user
            if (user) {
                user.dnd_mode = res.data.dnd_mode;
            }
        } catch (error) {
            console.error("Failed to toggle DND:", error);
            setDndMode(!dndMode);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedGif(null);
        setShowGifPicker(false);
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleGifSelect = (url: string) => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        setSelectedGif(url);
        setShowGifPicker(false);
    };

    const clearMedia = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setSelectedGif(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setInputText((prev) => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const hasText = inputText.trim().length > 0;
        const hasMedia = !!selectedFile || !!selectedGif;
        if ((!hasText && !hasMedia) || !selectedChatId || isSending) return;

        setIsSending(true);
        try {
            const formData = new FormData();
            formData.append('conversation', selectedChatId.toString());
            formData.append('content', inputText);
            if (selectedFile) {
                formData.append('image', selectedFile);
            }
            if (selectedGif) {
                formData.append('gif_url', selectedGif);
            }
            if (replyingTo) {
                formData.append('reply_to', replyingTo.id.toString());
            }

            const res = await api.post('/messages/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setMessages([...messages, res.data]);
            setInputText('');
            clearMedia();
            setReplyingTo(null);

            // Refresh conversations to update last message
            fetchConversations();
        } catch (error) {
            console.error("Failed to send message:", error);
            toast.error("Failed to send message.");
        } finally {
            setIsSending(false);
        }
    };

    const handleMessageReact = async (messageId: number, emoji: string) => {
        try {
            const res = await api.post(`/messages/${messageId}/react/`, { emoji });
            const updatedMsg = res.data.message;
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: updatedMsg.reactions } : m));
        } catch (error) {
            console.error("Failed to toggle reaction:", error);
        }
    };

    const handleChatStarted = (newConversation: Conversation) => {
        const exists = conversations.find(c => c.id === newConversation.id);
        if (!exists) {
            setConversations([newConversation, ...conversations]);
        }
        setSelectedChatId(newConversation.id);
        setShowDetails(false);
    };

    const handleChatClick = (chatId: number) => {
        setSelectedChatId(chatId);
        setShowDetails(false);
        setConversations(prev => prev.map(c =>
            c.id === chatId ? { ...c, unread_count: 0 } : c
        ));
    };

    // Mute/Unmute Chat Settings
    const activeChat = conversations.find(c => c.id === selectedChatId);
    const myMembership = activeChat?.memberships?.find(m => m.user.id === user?.id);
    const isMuted = myMembership?.is_muted || false;
    const isAdmin = myMembership?.is_admin || false;

    const handleToggleMute = async () => {
        if (!selectedChatId) return;
        try {
            const res = await api.post(`/conversations/${selectedChatId}/toggle-mute/`);
            // Update local state
            setConversations(prev => prev.map(c => {
                if (c.id === selectedChatId && c.memberships) {
                    return {
                        ...c,
                        memberships: c.memberships.map(m => m.user.id === user?.id ? { ...m, is_muted: res.data.is_muted } : m)
                    };
                }
                return c;
            }));
        } catch (error) {
            console.error("Failed to toggle mute:", error);
        }
    };

    const handleToggleBlock = async () => {
        if (!selectedChatId || !activeChat || !activeChat.other_user) return;
        const otherUser = activeChat.other_user;
        const isBlocked = otherUser.is_blocked;

        setConfirmConfig({
            title: isBlocked ? t('unblockUser') : t('blockUser'),
            message: isBlocked 
                ? t('areYouSureUnblock').replace('{username}', otherUser.username)
                : t('areYouSureBlock').replace('{username}', otherUser.username),
            isDanger: !isBlocked,
            onConfirm: async () => {
                try {
                    if (isBlocked) {
                        await api.post(`/users/${otherUser.username}/unblock/`);
                    } else {
                        await api.post(`/users/${otherUser.username}/block/`);
                    }
                    // Refresh conversations to update blocked state
                    fetchConversations();
                } catch (error) {
                    console.error("Failed to toggle block:", error);
                    toast.error("Failed to update block status.");
                }
            }
        });
        setIsConfirmOpen(true);
    };

    // Group Admin Settings Actions
    const handleAddMember = async (username: string) => {
        if (!selectedChatId) return;
        try {
            await api.post(`/conversations/${selectedChatId}/add-members/`, { usernames: [username] });
            setAddMemberQuery('');
            setAddMemberResults([]);
            // Refresh conversation data
            fetchConversations();
            toast.success(`Added ${username} successfully.`);
        } catch (error) {
            console.error("Failed to add member:", error);
            toast.error("Failed to add member.");
        }
    };

    const handleRemoveMember = async (username: string) => {
        if (!selectedChatId) return;
        setConfirmConfig({
            title: t('removeMember'),
            message: t('removeMemberDesc').replace('{username}', username),
            isDanger: true,
            onConfirm: async () => {
                try {
                    await api.post(`/conversations/${selectedChatId}/remove-member/`, { username });
                    fetchConversations();
                } catch (error) {
                    console.error("Failed to remove member:", error);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    const handleMakeAdmin = async (username: string) => {
        if (!selectedChatId) return;
        setConfirmConfig({
            title: t('promoteToAdmin'),
            message: t('promoteToAdminDesc').replace('{username}', username),
            isDanger: false,
            onConfirm: async () => {
                try {
                    await api.post(`/conversations/${selectedChatId}/make-admin/`, { username });
                    fetchConversations();
                } catch (error) {
                    console.error("Failed to make admin:", error);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    const handleLeaveGroup = async () => {
        if (!selectedChatId) return;
        setConfirmConfig({
            title: t('leaveGroup'),
            message: t('areYouSureLeaveGroup'),
            isDanger: true,
            onConfirm: async () => {
                try {
                    await api.post(`/conversations/${selectedChatId}/leave/`);
                    setSelectedChatId(null);
                    setShowDetails(false);
                    fetchConversations();
                } catch (error) {
                    console.error("Failed to leave group:", error);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    const handleGroupDetailsSave = async () => {
        if (!selectedChatId) return;
        setIsSavingDetails(true);
        try {
            const formData = new FormData();
            if (editingName.trim()) {
                formData.append('name', editingName);
            }
            if (groupAvatarFile) {
                formData.append('avatar', groupAvatarFile);
            }

            const res = await api.patch(`/conversations/${selectedChatId}/update-group-details/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Update conversation in lists
            setConversations(prev => prev.map(c => c.id === selectedChatId ? { ...c, name: res.data.name, avatar: res.data.avatar } : c));
            setGroupAvatarFile(null);
            setGroupAvatarPreview(null);
            toast.success("Group details updated successfully.");
        } catch (error) {
            console.error("Failed to update group details:", error);
            toast.error("Failed to update group.");
        } finally {
            setIsSavingDetails(false);
        }
    };

    const handleGroupAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setGroupAvatarFile(file);
        setGroupAvatarPreview(URL.createObjectURL(file));
    };

    // Search messages client-side
    const handleSearchMessages = (query: string) => {
        setSearchMessagesQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        const results = messages.filter(m =>
            m.content?.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(results);
    };

    // Block user (individual chats)
    const handleBlockUser = async () => {
        if (!selectedChatId) return;
        if (!(await confirm({ message: 'Are you sure you want to block this user? You will no longer receive messages from them.', confirmText: 'Block', isDanger: true }))) return;
        try {
            await api.post(`/conversations/${selectedChatId}/block-user/`);
            setSelectedChatId(null);
            setShowDetails(false);
            fetchConversations();
        } catch (error) {
            console.error('Failed to block user:', error);
            toast.error('Failed to block user.');
        }
    };

    // Report conversation
    const handleReportConversation = async () => {
        if (!selectedChatId) return;
        const reason = window.prompt('Please describe why you are reporting this conversation:');
        if (!reason) return;
        try {
            await api.post(`/conversations/${selectedChatId}/report/`, { reason });
            toast.success('Report submitted. Thank you.');
        } catch (error) {
            console.error('Failed to report conversation:', error);
            toast.error('Failed to submit report.');
        }
    };

    // Delete conversation
    const handleDeleteConversation = async () => {
        if (!selectedChatId) return;
        if (!(await confirm({ message: 'Are you sure you want to delete this conversation? This action cannot be undone.', confirmText: 'Delete', isDanger: true }))) return;
        try {
            await api.delete(`/conversations/${selectedChatId}/`);
            setSelectedChatId(null);
            setShowDetails(false);
            fetchConversations();
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            toast.error('Failed to delete conversation.');
        }
    };

    // Pin/Unpin message
    const handlePinMessage = async (messageId: number) => {
        try {
            const res = await api.post(`/messages/${messageId}/pin/`);
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: res.data.is_pinned } : m));
        } catch (error) {
            console.error('Failed to pin message:', error);
        }
    };

    // Edit message
    const handleEditMessage = async (messageId: number, newContent: string) => {
        try {
            const res = await api.patch(`/messages/${messageId}/`, { content: newContent });
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: res.data.content, is_edited: true } : m));
            setEditingMessage(null);
            setEditContent('');
        } catch (error) {
            console.error('Failed to edit message:', error);
            toast.error('Failed to edit message. You can only edit messages within 15 minutes.');
        }
    };

    // Delete message
    const handleDeleteMessage = async (messageId: number) => {
        if (!(await confirm({ message: 'Delete this message?', confirmText: 'Delete', isDanger: true }))) return;
        try {
            await api.delete(`/messages/${messageId}/`);
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: '' } : m));
        } catch (error) {
            console.error('Failed to delete message:', error);
            toast.error('Failed to delete message.');
        }
    };

    // Group invitation handlers
    const handleAcceptInvite = async () => {
        if (!selectedChatId) return;
        try {
            await api.post(`/conversations/${selectedChatId}/accept-invite/`);
            fetchConversations();
        } catch (error) {
            console.error('Failed to accept invite:', error);
            toast.error('Failed to accept invitation.');
        }
    };

    const handleDeclineInvite = async () => {
        if (!selectedChatId) return;
        try {
            await api.post(`/conversations/${selectedChatId}/decline-invite/`);
            setSelectedChatId(null);
            fetchConversations();
        } catch (error) {
            console.error('Failed to decline invite:', error);
            toast.error('Failed to decline invitation.');
        }
    };

    const handleBlockGroup = async () => {
        if (!selectedChatId) return;
        if (!(await confirm({ message: 'Block this group? You will no longer receive invitations from it.', confirmText: 'Block', isDanger: true }))) return;
        try {
            await api.post(`/conversations/${selectedChatId}/block-group/`);
            setSelectedChatId(null);
            fetchConversations();
        } catch (error) {
            console.error('Failed to block group:', error);
        }
    };

    // Context menu handler
    const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
        if (!msg.is_me || msg.is_deleted) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, msg });
    };

    const canEditMessage = (msg: Message) => {
        const fifteenMinutes = 15 * 60 * 1000;
        return msg.is_me && !msg.is_deleted && (Date.now() - new Date(msg.created_at).getTime()) < fifteenMinutes;
    };

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // Chat rendering metadata helpers
    const getChatName = (chat: Conversation) => {
        if (chat.is_group) return chat.name || "Group Chat";
        if (chat.other_user?.is_blocked) {
            return `${chat.other_user?.real_name || chat.other_user?.username} (Blocked)`;
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

    return (
        <div className="h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 flex flex-col overflow-hidden">
            <Navbar />

            <NewChatModal
                isOpen={isNewChatOpen}
                onClose={() => setIsNewChatOpen(false)}
                onChatStarted={handleChatStarted}
            />

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Conversation List */}
                <div className={`w-full md:w-1/3 lg:w-1/4 border-r border-zinc-800 flex flex-col bg-zinc-950 ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>

                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950 z-10">
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            {t('messages')}
                            {dndMode && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Do Not Disturb active" />}
                        </h1>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleToggleDnd}
                                className={`p-2 rounded-full hover:bg-zinc-900 transition-colors ${dndMode ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                                title={dndMode ? t('dndDisabled') : t('dndEnabled')}
                            >
                                {dndMode ? <BellOff className="h-4.5 w-4.5" /> : <Bell className="h-4.5 w-4.5" />}
                            </button>
                            <button
                                onClick={() => setIsNewChatOpen(true)}
                                className="p-2 rounded-full hover:bg-zinc-900 transition-colors text-emerald-500"
                                title={t('newConversationGroup')}
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="p-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={t('searchMessagesPlaceholder')}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
                            />
                            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                        </div>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin-dark">
                        {conversations.length === 0 ? (
                            <div className="p-4 text-center text-zinc-500 text-sm">
                                {t('noConversationsYet')}
                            </div>
                        ) : (
                            conversations.map((chat) => (
                                <button
                                    key={chat.id}
                                    onClick={() => handleChatClick(chat.id)}
                                    className={`w-full p-4 flex items-center gap-4 hover:bg-zinc-900/50 transition-colors border-b border-zinc-900/50 ${selectedChatId === chat.id ? 'bg-zinc-900' : ''}`}
                                >
                                    <div className="relative">
                                        <div className="h-12 w-12 rounded-full overflow-hidden bg-zinc-850 flex-shrink-0">
                                            <img
                                                src={getChatAvatar(chat)}
                                                alt={getChatName(chat)}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        {chat.is_group && (
                                            <div className="absolute -bottom-1 -right-1 bg-zinc-900 border border-zinc-800 text-[9px] px-1 rounded font-bold text-zinc-500">
                                                GP
                                            </div>
                                        )}
                                        {chat.is_pending_invite && (
                                            <div className="absolute -top-1 -right-1 bg-amber-500 border border-amber-600 text-[8px] px-1 rounded font-bold text-black">
                                                INVITE
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold truncate text-sm">{getChatName(chat)}</span>
                                            <span className="text-xs text-zinc-500 whitespace-nowrap ml-2">
                                                {chat.last_message ? new Date(chat.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className={`text-sm truncate ${chat.unread_count > 0 ? 'text-white font-medium' : 'text-zinc-500'}`}>
                                                {chat.last_message ? (
                                                    <>
                                                        {chat.last_message.sender_username === user?.username ? 'You: ' : `${chat.last_message.sender_username}: `}
                                                        {chat.last_message.content || 'Sent an attachment'}
                                                    </>
                                                ) : (
                                                    <span className="italic text-zinc-650">{t('noMessagesYet')}</span>
                                                )}
                                            </p>
                                            {chat.unread_count > 0 && (
                                                <span className="ml-2 h-5 w-5 flex items-center justify-center bg-emerald-500 text-black text-xs font-bold rounded-full">
                                                    {chat.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Window */}
                <div className={`flex-1 flex bg-zinc-900/30 ${!selectedChatId ? 'hidden md:flex' : 'flex'} overflow-hidden`}>
                    {activeChat ? (
                        <>
                            {/* Inner flex layout for Chat panel + Details sidebar */}
                            <div className="flex-1 flex flex-col overflow-hidden relative">
                                {/* Chat Header */}
                                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md z-10">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <button
                                            onClick={() => setSelectedChatId(null)}
                                            className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
                                        >
                                            ←
                                        </button>
                                        {activeChat.is_group ? (
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="relative">
                                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-850 flex-shrink-0">
                                                        <img
                                                            src={getChatAvatar(activeChat)}
                                                            alt={getChatName(activeChat)}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="font-bold text-sm truncate">{getChatName(activeChat)}</h2>
                                                    <p className="text-xs text-zinc-500 truncate">
                                                        {t('memberCount').replace('{count}', activeChat.participants.length.toString())}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <Link 
                                                href={`/${activeChat.other_user?.username || ''}`}
                                                className="flex items-center gap-4 min-w-0 hover:opacity-85 transition-opacity"
                                            >
                                                <div className="relative">
                                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-850 flex-shrink-0">
                                                        <img
                                                            src={getChatAvatar(activeChat)}
                                                            alt={getChatName(activeChat)}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="font-bold text-sm truncate hover:underline">{getChatName(activeChat)}</h2>
                                                    <p className="text-xs text-zinc-500 truncate">
                                                        @{activeChat.other_user?.username}
                                                    </p>
                                                </div>
                                            </Link>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <button 
                                            onClick={() => {
                                                setShowDetails(!showDetails);
                                                setEditingName(activeChat.name || '');
                                            }}
                                            className={`p-2 rounded-full transition-colors ${showDetails ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800'}`}
                                            title="Chat Details & Customization"
                                        >
                                            <Info className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin-dark">
                                    {isMessagesLoading ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : activeChat.is_pending_invite ? (
                                        /* Pending Invite View */
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                            <div className="h-20 w-20 bg-amber-950/30 rounded-full flex items-center justify-center mb-4 border border-amber-900/40">
                                                <MailQuestion className="h-8 w-8 text-amber-500" />
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-2">Group Invitation</h3>
                                            <p className="text-sm text-zinc-400 mb-6 max-w-xs">
                                                You&apos;ve been invited to join <span className="font-bold text-white">{getChatName(activeChat)}</span>. Would you like to accept?
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleAcceptInvite}
                                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-sm transition-all shadow-lg shadow-emerald-950/30"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={handleDeclineInvite}
                                                    className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold text-sm transition-all"
                                                >
                                                    Decline
                                                </button>
                                                <button
                                                    onClick={handleBlockGroup}
                                                    className="px-4 py-2.5 bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 text-red-500 rounded-full font-bold text-sm transition-all"
                                                    title="Block this group"
                                                >
                                                    <Ban className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-150 group relative rounded-2xl transition-all duration-300`} onContextMenu={(e) => handleContextMenu(e, msg)}>
                                                <div className={`flex items-center gap-2 max-w-[75%] ${msg.is_me ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    
                                                    {!msg.is_deleted && (
                                                        <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 ${msg.is_me ? 'flex-row-reverse' : 'flex-row'}`}>
                                                            <ReactionButton msg={msg} onReact={handleMessageReact} />
                                                            <button
                                                                type="button"
                                                                onClick={() => setReplyingTo(msg)}
                                                                className="p-1 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-850 transition-colors"
                                                                title="Reply to message"
                                                            >
                                                                <CornerUpLeft className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className={`flex flex-col ${msg.is_me ? 'items-end' : 'items-start'}`}>
                                                        
                                                        {/* Sender name in groups */}
                                                        {activeChat.is_group && !msg.is_me && (
                                                            <span className="text-[10px] text-zinc-500 mb-1 pl-2">@{msg.sender.username}</span>
                                                        )}

                                                        {/* Pinned indicator */}
                                                        {msg.is_pinned && (
                                                            <div className="flex items-center gap-1 text-[9px] text-amber-500 mb-0.5">
                                                                <Pin className="h-2.5 w-2.5" />
                                                                <span>Pinned</span>
                                                            </div>
                                                        )}
                                                        
                                                        {msg.is_deleted ? (
                                                            <div className={`rounded-2xl px-4 py-2 ${msg.is_me
                                                                ? 'bg-zinc-800/50 rounded-tr-none'
                                                                : 'bg-zinc-800/50 rounded-tl-none border border-zinc-750/50'
                                                            }`}>
                                                                <p className="text-sm italic text-zinc-500">This message was deleted</p>
                                                            </div>
                                                        ) : editingMessage?.id === msg.id ? (
                                                            <div className={`rounded-2xl px-4 py-2 ${msg.is_me
                                                                ? 'bg-emerald-600 text-white rounded-tr-none shadow-lg shadow-emerald-950/20'
                                                                : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-750'
                                                            }`}>
                                                                <input
                                                                    type="text"
                                                                    value={editContent}
                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleEditMessage(msg.id, editContent);
                                                                        if (e.key === 'Escape') { setEditingMessage(null); setEditContent(''); }
                                                                    }}
                                                                    className="bg-transparent border-b border-white/30 text-sm w-full focus:outline-none py-0.5"
                                                                    autoFocus
                                                                />
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <button onClick={() => handleEditMessage(msg.id, editContent)} className="text-[10px] font-bold hover:underline">Save</button>
                                                                    <button onClick={() => { setEditingMessage(null); setEditContent(''); }} className="text-[10px] opacity-70 hover:underline">Cancel</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                        <div className={`rounded-2xl px-4 py-2 ${msg.is_me
                                                            ? 'bg-emerald-600 text-white rounded-tr-none shadow-lg shadow-emerald-950/20'
                                                            : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-750'
                                                            }`}>
                                                            
                                                            {/* Reply Quote Preview */}
                                                            {msg.reply_to_details && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => scrollToMessage(msg.reply_to_details!.id)}
                                                                    className={`w-full text-left mb-2 p-1.5 rounded-lg border-l-2 border-emerald-450 transition-colors flex flex-col gap-0.5 ${
                                                                        msg.is_me 
                                                                            ? 'bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-100' 
                                                                            : 'bg-zinc-900/60 hover:bg-zinc-900/80 text-zinc-300'
                                                                    }`}
                                                                >
                                                                    <span className={`text-[10px] font-bold ${msg.is_me ? 'text-emerald-250' : 'text-emerald-400'}`}>
                                                                        @{msg.reply_to_details.sender_username}
                                                                    </span>
                                                                    <span className="text-[11px] truncate opacity-90">
                                                                        {msg.reply_to_details.content || (msg.reply_to_details.image ? '📷 Photo' : msg.reply_to_details.gif_url ? 'GIF' : 'Attachment')}
                                                                    </span>
                                                                </button>
                                                            )}

                                                            {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>}
                                                            
                                                            {/* Attachment renderer */}
                                                            <MessageAttachment msg={msg} />

                                                            <p className={`text-[9px] mt-1 text-right flex items-center justify-end gap-1 ${msg.is_me ? 'text-emerald-200' : 'text-zinc-550'}`}>
                                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                {msg.is_edited && <span className="italic">(edited)</span>}
                                                                {msg.is_me && (
                                                                    msg.is_read 
                                                                        ? <span title="Read"><CheckCheck className="h-3 w-3 text-emerald-300" /></span>
                                                                        : <span title="Sent"><Check className="h-3 w-3 opacity-70" /></span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        )}

                                                        {/* Reactions Display */}
                                                        {msg.reactions && msg.reactions.length > 0 && (
                                                            <div className={`flex flex-wrap gap-1 mt-1 ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                                                                {Object.entries(
                                                                    msg.reactions.reduce((acc: { [emoji: string]: { count: number; users: string[]; reactedByMe: boolean } }, r: any) => {
                                                                        if (!acc[r.emoji]) {
                                                                            acc[r.emoji] = { count: 0, users: [], reactedByMe: false };
                                                                        }
                                                                        acc[r.emoji].count += 1;
                                                                        acc[r.emoji].users.push(r.username);
                                                                        if (r.username === user?.username) {
                                                                            acc[r.emoji].reactedByMe = true;
                                                                        }
                                                                        return acc;
                                                                    }, {})
                                                                ).map(([emoji, data]: [string, any]) => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => handleMessageReact(msg.id, emoji)}
                                                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] transition-all border ${
                                                                            data.reactedByMe
                                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                                                : 'bg-zinc-950 text-zinc-400 border-zinc-850 hover:border-zinc-700'
                                                                        }`}
                                                                        title={data.users.join(', ')}
                                                                    >
                                                                        <span>{emoji}</span>
                                                                        <span className="text-[9px] font-bold">{data.count}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}

                                    {/* Context Menu */}
                                    {contextMenu && (
                                        <div
                                            className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                                            style={{ top: contextMenu.y, left: contextMenu.x }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {canEditMessage(contextMenu.msg) && (
                                                <button
                                                    onClick={() => {
                                                        setEditingMessage(contextMenu.msg);
                                                        setEditContent(contextMenu.msg.content);
                                                        setContextMenu(null);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                    Edit Message
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    handlePinMessage(contextMenu.msg.id);
                                                    setContextMenu(null);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                                            >
                                                {contextMenu.msg.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                                {contextMenu.msg.is_pinned ? 'Unpin Message' : 'Pin Message'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleDeleteMessage(contextMenu.msg.id);
                                                    setContextMenu(null);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Delete Message
                                            </button>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                                {/* Input Composer Area */}
                                {!activeChat.is_group && activeChat.other_user?.is_blocked ? (
                                    <div className="flex flex-col items-center justify-center gap-2.5 p-6 bg-zinc-950 border-t border-zinc-800 text-zinc-400 text-sm animate-in fade-in duration-200">
                                        <p className="font-semibold text-zinc-400">{t('youBlockedUserAlert').replace('{username}', activeChat.other_user.username)}</p>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setConfirmConfig({
                                                    title: t('unblockUser'),
                                                    message: t('areYouSureUnblock').replace('{username}', activeChat.other_user!.username),
                                                    isDanger: false,
                                                    onConfirm: async () => {
                                                        try {
                                                            await api.post(`/users/${activeChat.other_user!.username}/unblock/`);
                                                            fetchConversations();
                                                        } catch (err) {
                                                            console.error("Failed to unblock:", err);
                                                        }
                                                    }
                                                });
                                                setIsConfirmOpen(true);
                                            }}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-950/20"
                                        >
                                            {t('unblockUser')}
                                        </button>
                                    </div>
                                ) : !activeChat.is_group && activeChat.other_user?.has_blocked_me ? (
                                    <div className="flex items-center justify-center p-6 bg-zinc-950 border-t border-zinc-800 text-zinc-550 text-sm italic font-semibold animate-in fade-in duration-200">
                                        {t('youCannotMessage')}
                                    </div>
                                ) : (
                                    <div className="p-4 border-t border-zinc-800 bg-zinc-950">
                                        <form onSubmit={handleSendMessage} className="flex flex-col gap-2 relative">
                                            
                                            {/* Replying To Preview */}
                                            {replyingTo && (
                                                <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-zinc-900/60 border-l-4 border-emerald-500 border border-zinc-800/80 text-left animate-in slide-in-from-bottom-2 duration-200">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[10px] font-bold text-emerald-400">
                                                            {t('replyingTo')} @{replyingTo.sender.username}
                                                        </div>
                                                        <div className="text-xs text-zinc-400 truncate mt-0.5">
                                                            {replyingTo.content || (replyingTo.image ? '📷 Photo' : replyingTo.gif_url ? 'GIF' : 'Attachment')}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReplyingTo(null)}
                                                        className="p-1 hover:bg-zinc-800 rounded-full text-zinc-550 hover:text-white transition-colors ml-2"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {/* Media Upload / GIF Previews */}
                                            {(previewUrl || selectedGif) && (
                                                <div className="relative p-2 rounded-xl border border-zinc-800 bg-black/40 flex items-center gap-3 w-fit animate-in zoom-in-95 duration-200">
                                                    <button
                                                        type="button"
                                                        onClick={clearMedia}
                                                        className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white p-0.5 rounded-full z-10 transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                    <img src={previewUrl || selectedGif!} className="h-16 w-auto rounded object-cover border border-zinc-800" alt="Composer Preview" />
                                                    <span className="text-xs text-zinc-500 font-medium">{selectedGif ? 'GIF selected' : 'Image ready'}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {/* Hidden file input */}
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    className="hidden"
                                                    accept="image/png, image/jpeg, image/gif"
                                                    onChange={handleFileSelect}
                                                />
                                                
                                                <button 
                                                    type="button" 
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="p-2 text-zinc-400 hover:text-white transition-colors"
                                                    title={t('uploadImage')}
                                                >
                                                    <ImageIcon className="h-5 w-5" />
                                                </button>
                                                
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setShowGifPicker(!showGifPicker);
                                                        setShowEmojiPicker(false);
                                                    }}
                                                    className={`p-2 transition-colors ${showGifPicker ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
                                                    title={t('selectGif')}
                                                >
                                                    <FileImage className="h-5 w-5" />
                                                </button>

                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        setShowEmojiPicker(!showEmojiPicker);
                                                        setShowGifPicker(false);
                                                    }}
                                                    className={`p-2 transition-colors ${showEmojiPicker ? 'text-yellow-500' : 'text-zinc-400 hover:text-yellow-500'}`}
                                                    title={t('addEmoji')}
                                                >
                                                    <Smile className="h-5 w-5" />
                                                </button>
                                                
                                                <input
                                                    type="text"
                                                    value={inputText}
                                                    onChange={(e) => setInputText(e.target.value)}
                                                    placeholder={t('typeAMessage')}
                                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
                                                />
                                                
                                                <button
                                                    type="submit"
                                                    disabled={isSending || (!inputText.trim() && !selectedFile && !selectedGif)}
                                                    className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950/20"
                                                >
                                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                </button>
                                            </div>

                                            {/* Emoji Picker Popover */}
                                            {showEmojiPicker && (
                                                <div className="absolute bottom-14 left-0 z-50 animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="shadow-2xl rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
                                                        <EmojiPicker
                                                            onEmojiClick={onEmojiClick}
                                                            theme={Theme.DARK}
                                                            lazyLoadEmojis={true}
                                                            width={300}
                                                            height={380}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* GIF Picker Popover */}
                                            {showGifPicker && (
                                                <div className="absolute bottom-14 left-0 right-0 z-50 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 shadow-2xl max-h-[350px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Trending GIFs</span>
                                                        <button type="button" onClick={() => setShowGifPicker(false)} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
                                                    </div>
                                                    <GifPicker onSelected={handleGifSelect} />
                                                </div>
                                            )}

                                        </form>
                                    </div>
                                )}
                            </div>

                            {/* Details & Settings Drawer */}
                            {showDetails && (
                                <div className="w-80 border-l border-zinc-800 bg-zinc-950 p-5 flex flex-col gap-6 overflow-y-auto scrollbar-thin-dark animate-in slide-in-from-right duration-300">
                                    
                                    {/* Drawer Header */}
                                    <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                                        <h3 className="font-bold text-base text-white">{t('detailsTitle')}</h3>
                                        <button 
                                            onClick={() => setShowDetails(false)} 
                                            className="p-1.5 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {/* Mute Setting */}
                                    <div>
                                        <button
                                            onClick={handleToggleMute}
                                            className="w-full flex items-center justify-between p-3.5 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl hover:bg-zinc-900 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {isMuted 
                                                    ? <BellOff className="h-5 w-5 text-amber-500" /> 
                                                    : <Bell className="h-5 w-5 text-emerald-500" />
                                                }
                                                <span className="text-sm font-semibold text-zinc-200">{t('muteNotifications')}</span>
                                            </div>
                                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${isMuted ? 'bg-emerald-600' : 'bg-zinc-800'}`}>
                                                <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-200 ${isMuted ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </div>
                                        </button>
                                    </div>

                                    {/* Search in Conversation */}
                                    <div>
                                        <button
                                            onClick={() => setShowSearchMessages(!showSearchMessages)}
                                            className="w-full flex items-center gap-3 p-3.5 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl hover:bg-zinc-900 transition-colors"
                                        >
                                            <Search className="h-5 w-5 text-zinc-400" />
                                            <span className="text-sm font-semibold text-zinc-200">Search in Conversation</span>
                                        </button>
                                        {showSearchMessages && (
                                            <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <input
                                                    type="text"
                                                    value={searchMessagesQuery}
                                                    onChange={(e) => handleSearchMessages(e.target.value)}
                                                    placeholder="Search messages..."
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                                    autoFocus
                                                />
                                                {searchResults.length > 0 && (
                                                    <div className="max-h-[200px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                                                        {searchResults.map(result => (
                                                            <button
                                                                key={result.id}
                                                                onClick={() => {
                                                                    scrollToMessage(result.id);
                                                                    setShowSearchMessages(false);
                                                                    setSearchMessagesQuery('');
                                                                    setSearchResults([]);
                                                                }}
                                                                className="w-full p-2 text-left bg-zinc-900/50 hover:bg-zinc-800 rounded-lg text-xs transition-colors"
                                                            >
                                                                <span className="text-zinc-500">@{result.sender.username}</span>
                                                                <p className="text-zinc-300 truncate">{result.content}</p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {searchMessagesQuery && searchResults.length === 0 && (
                                                    <p className="text-xs text-zinc-500 text-center py-2">No messages found</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Block User Setting (Only for direct messages) */}
                                    {!activeChat.is_group && activeChat.other_user && (
                                        <div className="border-t border-zinc-850 pt-4">
                                            <button
                                                onClick={handleToggleBlock}
                                                className={`w-full flex items-center justify-center gap-2.5 p-3.5 rounded-2xl font-semibold text-sm transition-all ${
                                                    activeChat.other_user.is_blocked 
                                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md' 
                                                        : 'bg-red-950/20 hover:bg-red-950/45 border border-red-900/30 hover:border-red-900/50 text-red-500 cursor-pointer'
                                                }`}
                                            >
                                                <Shield className="h-5 w-5" />
                                                {activeChat.other_user.is_blocked ? t('unblockUser') : t('blockUser')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Group customization (For Groups only) */}
                                    {activeChat.is_group && (
                                        <div className="space-y-4 border-t border-zinc-850 pt-4">
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('groupSettings')}</h4>
                                            
                                            {/* Avatar Edit */}
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="relative group">
                                                    <div className="h-20 w-20 rounded-full overflow-hidden bg-zinc-850 border-2 border-zinc-800">
                                                        <img 
                                                            src={groupAvatarPreview || getChatAvatar(activeChat)} 
                                                            className="w-full h-full object-cover" 
                                                            alt="Group preview" 
                                                        />
                                                    </div>
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={() => groupAvatarInputRef.current?.click()}
                                                            className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                                            title={t('changeGroupPhoto')}
                                                        >
                                                            <Edit2 className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <input 
                                                    type="file" 
                                                    ref={groupAvatarInputRef}
                                                    className="hidden" 
                                                    accept="image/*"
                                                    onChange={handleGroupAvatarChange}
                                                />
                                            </div>

                                            {/* Name Input */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-zinc-400">{t('groupName')}</label>
                                                <input
                                                    type="text"
                                                    disabled={!isAdmin}
                                                    placeholder={t('editGroupNamePlaceholder')}
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                                                />
                                            </div>

                                            {/* Save Button */}
                                            {isAdmin && (editingName !== activeChat.name || groupAvatarFile) && (
                                                <button
                                                    onClick={handleGroupDetailsSave}
                                                    disabled={isSavingDetails}
                                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                                                >
                                                    {isSavingDetails ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('saveGroupChanges')}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Members Section (Groups only) */}
                                    {activeChat.is_group && (
                                        <div className="space-y-4 border-t border-zinc-850 pt-4 flex-1 flex flex-col min-h-0">
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('groupMembers')} ({activeChat.memberships?.length || 0})</h4>
                                            
                                            {/* Add member (Admin only) */}
                                            {isAdmin && (
                                                <div className="relative">
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder={t('addMemberPlaceholder')}
                                                            value={addMemberQuery}
                                                            onChange={(e) => setAddMemberQuery(e.target.value)}
                                                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                                                        />
                                                    </div>
                                                    
                                                    {/* Member Add Search Results */}
                                                    {addMemberResults.length > 0 && (
                                                        <div className="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 max-h-40 overflow-y-auto scrollbar-thin-dark z-20">
                                                            {addMemberResults.map(u => (
                                                                <button
                                                                    key={u.id}
                                                                    onClick={() => handleAddMember(u.username)}
                                                                    className="w-full p-2 flex items-center gap-2 hover:bg-zinc-800 rounded-lg text-left"
                                                                >
                                                                    <img src={getImageUrl(u.avatar, u.username)} className="h-5 w-5 rounded-full object-cover" alt="" />
                                                                    <div className="text-xs font-semibold text-white truncate">@{u.username}</div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Member List */}
                                            <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                                                {activeChat.memberships?.map((member) => (
                                                    <div key={member.id} className="flex items-center justify-between group py-1.5">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <img
                                                                src={getImageUrl(member.user.avatar, member.user.username)}
                                                                alt=""
                                                                className="h-8 w-8 rounded-full object-cover bg-zinc-850 flex-shrink-0"
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-white text-xs truncate flex items-center gap-1.5">
                                                                    {member.user.real_name || member.user.username}
                                                                    {member.is_admin && <span title="Group Admin"><Shield className="h-3 w-3 text-emerald-500" /></span>}
                                                                </div>
                                                                <div className="text-[10px] text-zinc-500 truncate">@{member.user.username}</div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Admin options for other users */}
                                                        {isAdmin && member.user.id !== user?.id && (
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {!member.is_admin && (
                                                                    <button
                                                                        onClick={() => handleMakeAdmin(member.user.username)}
                                                                        className="p-1 hover:bg-zinc-800 rounded text-emerald-500"
                                                                        title={t('makeGroupAdmin')}
                                                                    >
                                                                        <Shield className="h-3.5 w-3.5" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleRemoveMember(member.user.username)}
                                                                    className="p-1 hover:bg-zinc-800 rounded text-red-500"
                                                                    title={t('removeFromGroup')}
                                                                >
                                                                    <UserMinus className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Individual chat action buttons */}
                                    {!activeChat.is_group && (
                                        <div className="space-y-2 border-t border-zinc-850 pt-4">
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Conversation Actions</h4>
                                            <button
                                                onClick={handleBlockUser}
                                                className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl hover:bg-red-950/20 hover:border-red-900/30 transition-colors text-sm font-semibold text-zinc-300 hover:text-red-400"
                                            >
                                                <Ban className="h-4.5 w-4.5" />
                                                Block User
                                            </button>
                                            <button
                                                onClick={handleReportConversation}
                                                className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl hover:bg-amber-950/20 hover:border-amber-900/30 transition-colors text-sm font-semibold text-zinc-300 hover:text-amber-400"
                                            >
                                                <Flag className="h-4.5 w-4.5" />
                                                Report Conversation
                                            </button>
                                            <button
                                                onClick={handleDeleteConversation}
                                                className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl hover:bg-red-950/20 hover:border-red-900/30 transition-colors text-sm font-semibold text-zinc-300 hover:text-red-400"
                                            >
                                                <Trash2 className="h-4.5 w-4.5" />
                                                Delete Conversation
                                            </button>
                                        </div>
                                    )}

                                    {/* Action button at bottom */}
                                    <div className="border-t border-zinc-850 pt-4 mt-auto">
                                        {activeChat.is_group ? (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={handleLeaveGroup}
                                                    className="w-full flex items-center justify-center gap-2 p-3 bg-red-950/20 hover:bg-red-950/45 border border-red-900/30 hover:border-red-900/50 rounded-2xl text-red-500 transition-all font-bold text-sm"
                                                >
                                                    <LogOut className="h-4.5 w-4.5" />
                                                    {t('leaveGroup')}
                                                </button>
                                                <button
                                                    onClick={handleReportConversation}
                                                    className="w-full flex items-center justify-center gap-2 p-2.5 hover:bg-amber-950/20 rounded-2xl text-zinc-500 hover:text-amber-400 transition-all text-xs"
                                                >
                                                    <Flag className="h-3.5 w-3.5" />
                                                    Report Group
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        onClick={handleDeleteConversation}
                                                        className="w-full flex items-center justify-center gap-2 p-2.5 hover:bg-red-950/20 rounded-2xl text-zinc-500 hover:text-red-400 transition-all text-xs"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Delete Group
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center text-xs text-zinc-650">
                                                Encrypted Direct Message
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center bg-zinc-950/10">
                            <div className="h-20 w-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                                <Send className="h-8 w-8 text-zinc-600 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('yourMessages')}</h3>
                            <p className="max-w-xs text-sm text-zinc-550">{t('selectConversationToChat')}</p>
                            <button
                                onClick={() => setIsNewChatOpen(true)}
                                className="mt-6 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold transition-all shadow-lg shadow-emerald-950/30"
                            >
                                {t('sendMessage')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                isDanger={confirmConfig.isDanger}
            />
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="h-8 w-8 text-emerald-500 animate-spin" /></div>}>
            <MessagesContent />
        </Suspense>
    );
}
