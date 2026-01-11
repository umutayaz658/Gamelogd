'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, ChevronUp, ChevronDown, X, ArrowLeft, Send, Image as ImageIcon, Smile, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { getImageUrl } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// API Data Types
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

export default function MessagesDrawer() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { unreadMessages } = useNotifications();

    if (pathname?.startsWith('/messages')) return null;
    const [isOpen, setIsOpen] = useState(false);
    const [activeChatId, setActiveChatId] = useState<number | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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
            fetchConversations(); // Update last message in list
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    const handleChatClick = (chatId: number) => {
        setActiveChatId(chatId);
        // Optimistically mark as read in the list
        setConversations(prev => prev.map(c =>
            c.id === chatId ? { ...c, unread_count: 0 } : c
        ));
    };

    const activeChat = conversations.find(c => c.id === activeChatId);

    if (!user) return null;

    return (
        <div className="fixed bottom-0 right-4 z-50 hidden md:flex flex-col items-end">

            {/* Drawer Content */}
            <div
                className={`bg-zinc-900 border border-zinc-800 rounded-t-xl shadow-2xl w-80 transition-all duration-300 overflow-hidden flex flex-col ${isOpen ? 'h-96' : 'h-12'
                    }`}
            >
                {/* Header */}
                <div
                    className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 cursor-pointer hover:bg-zinc-800 transition-colors"
                    onClick={() => !activeChatId && setIsOpen(!isOpen)}
                >
                    {activeChat ? (
                        <div className="flex items-center gap-3 flex-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveChatId(null); }}
                                className="p-1 hover:bg-zinc-700 rounded-full transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4 text-zinc-400" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="relative h-6 w-6">
                                    <img
                                        src={getImageUrl(activeChat.other_user?.avatar, activeChat.other_user?.username)}
                                        alt={activeChat.other_user?.username}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                </div>
                                <span className="font-bold text-sm truncate max-w-[120px]">{activeChat.other_user?.real_name || activeChat.other_user?.username}</span>
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

                    <div className="flex items-center gap-1">
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
                                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                    {isLoading ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div key={msg.id} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.is_me
                                                    ? 'bg-emerald-600 text-white rounded-tr-none'
                                                    : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                                                    }`}>
                                                    {msg.content}
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
                            <div className="flex-1 overflow-y-auto">
                                {conversations.length === 0 ? (
                                    <div className="p-4 text-center text-zinc-500 text-sm">
                                        No conversations.
                                        <br />
                                        <Link href="/messages" className="text-emerald-500 hover:underline mt-2 inline-block">
                                            Go to Messages Page
                                        </Link>
                                    </div>
                                ) : (
                                    conversations.map((chat) => (
                                        <button
                                            key={chat.id}
                                            onClick={() => handleChatClick(chat.id)}
                                            className="w-full p-3 flex items-center gap-3 hover:bg-zinc-900 transition-colors border-b border-zinc-900"
                                        >
                                            <div className="relative h-10 w-10">
                                                <img
                                                    src={getImageUrl(chat.other_user?.avatar, chat.other_user?.username)}
                                                    alt={chat.other_user?.username}
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            </div>
                                            <div className="text-left flex-1 min-w-0">
                                                <div className="font-bold text-sm text-white truncate">{chat.other_user?.real_name || chat.other_user?.username}</div>
                                                <div className="text-xs text-zinc-500 truncate">
                                                    {chat.last_message ? chat.last_message.content : 'No messages'}
                                                </div>
                                            </div>
                                            {chat.unread_count > 0 && (
                                                <div className="h-2 w-2 bg-emerald-500 rounded-full" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
