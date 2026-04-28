'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, ChevronUp, ChevronDown, X, ArrowLeft, Send, Image as ImageIcon, Smile, Loader2, Maximize2, Plus, ArrowUpRight, Gamepad2, Star, CheckCheck, Check } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { getImageUrl } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// API Data Types
interface SharedPostDetails {
    id: number;
    user: { username: string; avatar: string | null };
    content: string;
    media_url: string | null;
    timestamp: string;
}

interface SharedReviewDetails {
    id: number;
    user: { username: string; avatar: string | null };
    game_title: string;
    game_cover: string | null;
    rating: number;
    content: string;
    timestamp: string;
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
    shared_post_details?: SharedPostDetails | null;
    shared_review_details?: SharedReviewDetails | null;
    is_read: boolean;
    created_at: string;
    is_me: boolean;
}

interface Conversation {
    id: number;
    participants: number[];
    other_user: {
        id: number;
        username: string;
        avatar: string | null;
        real_name: string;
    };
    last_message: {
        content: string;
        created_at: string;
        sender_username: string;
    } | null;
    unread_count: number;
    updated_at: string;
}

function MiniSharedPost({ details, isMe }: { details: SharedPostDetails; isMe: boolean }) {
    return (
        <Link
            href={`/${details.user.username}/status/${details.id}`}
            className={`block rounded-lg border overflow-hidden mt-1 hover:opacity-80 transition-opacity ${
                isMe ? 'border-emerald-500/20 bg-emerald-700/20' : 'border-zinc-700 bg-zinc-800/50'
            }`}
        >
            <div className="p-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold ${isMe ? 'text-emerald-200' : 'text-white'}`}>
                        @{details.user.username}
                    </span>
                </div>
                <p className={`text-[10px] line-clamp-2 ${isMe ? 'text-emerald-100/70' : 'text-zinc-400'}`}>
                    {details.content}
                </p>
            </div>
            <div className={`px-2 py-1 flex items-center gap-1 text-[9px] font-medium border-t ${
                isMe ? 'border-emerald-500/20 text-emerald-300' : 'border-zinc-700 text-zinc-500'
            }`}>
                <ArrowUpRight className="h-2.5 w-2.5" />
                View Post
            </div>
        </Link>
    );
}

function MiniSharedReview({ details, isMe }: { details: SharedReviewDetails; isMe: boolean }) {
    return (
        <Link
            href={`/${details.user.username}/review/${details.id}`}
            className={`block rounded-lg border overflow-hidden mt-1 hover:opacity-80 transition-opacity ${
                isMe ? 'border-emerald-500/20 bg-emerald-700/20' : 'border-zinc-700 bg-zinc-800/50'
            }`}
        >
            <div className="p-2">
                <div className="flex items-center gap-1 mb-0.5">
                    <Gamepad2 className={`h-2.5 w-2.5 ${isMe ? 'text-emerald-300' : 'text-emerald-500'}`} />
                    <span className={`text-[10px] font-bold truncate ${isMe ? 'text-emerald-200' : 'text-white'}`}>
                        {details.game_title}
                    </span>
                    <Star className={`h-2.5 w-2.5 fill-current ${
                        details.rating >= 8 ? 'text-emerald-500' : details.rating >= 5 ? 'text-yellow-500' : 'text-red-500'
                    }`} />
                    <span className={`text-[9px] font-bold ${
                        details.rating >= 8 ? 'text-emerald-500' : details.rating >= 5 ? 'text-yellow-500' : 'text-red-500'
                    }`}>{details.rating.toFixed(1)}</span>
                </div>
            </div>
            <div className={`px-2 py-1 flex items-center gap-1 text-[9px] font-medium border-t ${
                isMe ? 'border-emerald-500/20 text-emerald-300' : 'border-zinc-700 text-zinc-500'
            }`}>
                <ArrowUpRight className="h-2.5 w-2.5" />
                View Review
            </div>
        </Link>
    );
}

export default function MessagesDrawer() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const { unreadMessages } = useNotifications();

    if (pathname?.startsWith('/messages')) return null;
    const [isOpen, setIsOpen] = useState(false);
    const [activeChatId, setActiveChatId] = useState<number | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Fetch Messages
    useEffect(() => {
        if (activeChatId) {
            const fetchMessages = async () => {
                setIsLoading(true);
                try {
                    const res = await api.get(`/messages/?conversation_id=${activeChatId}`);
                    setMessages(res.data);
                } catch (error) {
                    console.error("Failed to fetch messages:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchMessages();

            // Poll for new messages
            const intervalId = setInterval(async () => {
                try {
                    const res = await api.get(`/messages/?conversation_id=${activeChatId}`);
                    setMessages(res.data);
                } catch {}
            }, 4000);

            return () => clearInterval(intervalId);
        }
    }, [activeChatId]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeChatId) return;

        try {
            const res = await api.post('/messages/', {
                conversation: activeChatId,
                content: inputText
            });

            setMessages([...messages, res.data]);
            setInputText('');
            fetchConversations();
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    const handleChatClick = (chatId: number) => {
        setActiveChatId(chatId);
        setConversations(prev => prev.map(c =>
            c.id === chatId ? { ...c, unread_count: 0 } : c
        ));
    };

    const filteredConversations = conversations.filter(c =>
        !searchQuery ||
        c.other_user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.other_user?.real_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeChat = conversations.find(c => c.id === activeChatId);

    if (!user) return null;

    return (
        <div className="fixed bottom-0 right-4 z-40 hidden md:flex flex-col items-end">

            {/* Drawer Content */}
            <div
                className={`bg-zinc-900 border border-zinc-800 rounded-t-xl shadow-2xl w-80 transition-all duration-300 overflow-hidden flex flex-col ${isOpen ? 'h-[28rem]' : 'h-12'
                    }`}
            >
                {/* Header */}
                <div
                    className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-3 cursor-pointer hover:bg-zinc-800 transition-colors flex-shrink-0"
                    onClick={() => !activeChatId && setIsOpen(!isOpen)}
                >
                    {activeChat ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveChatId(null); }}
                                className="p-1 hover:bg-zinc-700 rounded-full transition-colors flex-shrink-0"
                            >
                                <ArrowLeft className="h-4 w-4 text-zinc-400" />
                            </button>
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="relative h-6 w-6 flex-shrink-0">
                                    <img
                                        src={getImageUrl(activeChat.other_user?.avatar, activeChat.other_user?.username)}
                                        alt={activeChat.other_user?.username}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                </div>
                                <span className="font-bold text-sm truncate">{activeChat.other_user?.real_name || activeChat.other_user?.username}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 font-bold text-white">
                            <MessageSquare className="h-5 w-5 text-emerald-500" />
                            <span>Messages</span>
                            {unreadMessages > 0 && (
                                <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                                    {unreadMessages}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* Expand to full page */}
                        <button
                            onClick={(e) => { e.stopPropagation(); router.push('/messages'); }}
                            className="p-1 hover:bg-zinc-700 rounded-full transition-colors"
                            title="Open full messages"
                        >
                            <Maximize2 className="h-3.5 w-3.5 text-zinc-400" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                            className="p-1 hover:bg-zinc-700 rounded-full transition-colors"
                        >
                            {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronUp className="h-4 w-4 text-zinc-400" />}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {isOpen && (
                    <div className="flex-1 bg-zinc-950 flex flex-col overflow-hidden">
                        {activeChatId ? (
                            // Chat View
                            <>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                    {isLoading ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div key={msg.id} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] ${msg.shared_post_details || msg.shared_review_details ? 'w-full' : ''}`}>
                                                    {msg.content && (
                                                        <div className={`rounded-2xl px-3 py-2 text-sm ${msg.is_me
                                                            ? 'bg-emerald-600 text-white rounded-tr-none'
                                                            : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                                                        }`}>
                                                            {msg.content}
                                                        </div>
                                                    )}
                                                    {msg.shared_post_details && (
                                                        <MiniSharedPost details={msg.shared_post_details} isMe={msg.is_me} />
                                                    )}
                                                    {msg.shared_review_details && (
                                                        <MiniSharedReview details={msg.shared_review_details} isMe={msg.is_me} />
                                                    )}
                                                    {/* Time + read receipt */}
                                                    <div className={`flex items-center gap-0.5 mt-0.5 ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                                                        <span className="text-[9px] text-zinc-600">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {msg.is_me && (
                                                            msg.is_read ? (
                                                                <CheckCheck className="h-2.5 w-2.5 text-emerald-500" />
                                                            ) : (
                                                                <Check className="h-2.5 w-2.5 text-zinc-600" />
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                                <form onSubmit={handleSendMessage} className="p-2 border-t border-zinc-800 bg-zinc-900 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-full py-1.5 px-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                                    />
                                    <button type="submit" disabled={!inputText.trim()} className="p-1.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 disabled:opacity-50">
                                        <Send className="h-3 w-3" />
                                    </button>
                                </form>
                            </>
                        ) : (
                            // User List View
                            <div className="flex-1 overflow-y-auto flex flex-col">
                                {/* Mini search */}
                                <div className="p-2 border-b border-zinc-800">
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-1.5 px-3 text-xs focus:outline-none focus:border-emerald-500/50 transition-all"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    {filteredConversations.length === 0 ? (
                                        <div className="p-4 text-center text-zinc-500 text-sm">
                                            {searchQuery ? 'No results.' : 'No conversations.'}
                                            <br />
                                            <Link href="/messages" className="text-emerald-500 hover:underline mt-2 inline-block">
                                                Go to Messages Page
                                            </Link>
                                        </div>
                                    ) : (
                                        filteredConversations.map((chat) => (
                                            <button
                                                key={chat.id}
                                                onClick={() => handleChatClick(chat.id)}
                                                className="w-full p-3 flex items-center gap-3 hover:bg-zinc-900 transition-colors border-b border-zinc-900"
                                            >
                                                <div className="relative h-10 w-10 flex-shrink-0">
                                                    <img
                                                        src={getImageUrl(chat.other_user?.avatar, chat.other_user?.username)}
                                                        alt={chat.other_user?.username}
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                </div>
                                                <div className="text-left flex-1 min-w-0">
                                                    <div className="font-bold text-sm text-white truncate">{chat.other_user?.real_name || chat.other_user?.username}</div>
                                                    <div className="text-xs text-zinc-500 truncate">
                                                        {chat.last_message ? (chat.last_message.content || 'Shared a post') : 'No messages'}
                                                    </div>
                                                </div>
                                                {chat.unread_count > 0 && (
                                                    <span className="h-5 w-5 flex items-center justify-center bg-emerald-500 text-black text-[10px] font-bold rounded-full flex-shrink-0">
                                                        {chat.unread_count}
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
