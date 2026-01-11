'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from "@/components/Navbar";
import { Search, Plus, MoreVertical, Phone, Video, Info, Image as ImageIcon, Send, Smile, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';
import NewChatModal from '@/components/NewChatModal';
import { useNotifications } from '@/context/NotificationContext';

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

function MessagesContent() {
    const { user } = useAuth();
    const { markMessagesRead } = useNotifications();
    const searchParams = useSearchParams();
    const initialChatId = searchParams.get('chatId');

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<number | null>(initialChatId ? parseInt(initialChatId) : null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isMessagesLoading, setIsMessagesLoading] = useState(false);
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

        fetchMessages(true); // Initial fetch

        const intervalId = setInterval(() => fetchMessages(false), 3000); // Poll every 3s

        return () => clearInterval(intervalId);
    }, [selectedChatId]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedChatId) return;

        try {
            const res = await api.post('/messages/', {
                conversation: selectedChatId,
                content: inputText
            });

            setMessages([...messages, res.data]);
            setInputText('');

            // Refresh conversations to update last message
            fetchConversations();

        } catch (error) {
            console.error("Failed to send message:", error);
            alert("Failed to send message.");
        }
    };

    const handleChatStarted = (newConversation: Conversation) => {
        // Check if conversation already exists in list
        const exists = conversations.find(c => c.id === newConversation.id);
        if (!exists) {
            setConversations([newConversation, ...conversations]);
        }
        setSelectedChatId(newConversation.id);
    };

    const handleChatClick = (chatId: number) => {
        setSelectedChatId(chatId);
        // Optimistically mark as read
        setConversations(prev => prev.map(c =>
            c.id === chatId ? { ...c, unread_count: 0 } : c
        ));
    };

    const activeChat = conversations.find(c => c.id === selectedChatId);

    if (isLoading) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

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
                        <h1 className="text-xl font-bold">Messages</h1>
                        <button
                            onClick={() => setIsNewChatOpen(true)}
                            className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-emerald-500"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search messages..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
                            />
                            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                        </div>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="p-4 text-center text-zinc-500 text-sm">
                                No conversations yet.
                            </div>
                        ) : (
                            conversations.map((chat) => (
                                <button
                                    key={chat.id}
                                    onClick={() => handleChatClick(chat.id)}
                                    className={`w-full p-4 flex items-center gap-4 hover:bg-zinc-900/50 transition-colors border-b border-zinc-900/50 ${selectedChatId === chat.id ? 'bg-zinc-900' : ''}`}
                                >
                                    <div className="relative">
                                        <div className="h-12 w-12 rounded-full overflow-hidden bg-zinc-800">
                                            <img
                                                src={getImageUrl(chat.other_user?.avatar, chat.other_user?.username)}
                                                alt={chat.other_user?.username}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold truncate text-sm">{chat.other_user?.real_name || chat.other_user?.username}</span>
                                            <span className="text-xs text-zinc-500 whitespace-nowrap ml-2">
                                                {chat.last_message ? new Date(chat.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className={`text-sm truncate ${chat.unread_count > 0 ? 'text-white font-medium' : 'text-zinc-500'}`}>
                                                {chat.last_message ? (
                                                    <>
                                                        {chat.last_message.sender_username === user?.username ? 'You: ' : ''}
                                                        {chat.last_message.content}
                                                    </>
                                                ) : (
                                                    <span className="italic text-zinc-600">No messages yet</span>
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
                <div className={`flex-1 flex flex-col bg-zinc-900/30 ${!selectedChatId ? 'hidden md:flex' : 'flex'}`}>
                    {activeChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setSelectedChatId(null)}
                                        className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
                                    >
                                        ←
                                    </button>
                                    <div className="relative">
                                        <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-800">
                                            <img
                                                src={getImageUrl(activeChat.other_user?.avatar, activeChat.other_user?.username)}
                                                alt={activeChat.other_user?.username}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-sm">{activeChat.other_user?.real_name || activeChat.other_user?.username}</h2>
                                        <p className="text-xs text-zinc-500">@{activeChat.other_user?.username}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                                        <Phone className="h-5 w-5" />
                                    </button>
                                    <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                                        <Video className="h-5 w-5" />
                                    </button>
                                    <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                                        <Info className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {isMessagesLoading ? (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div key={msg.id} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${msg.is_me
                                                ? 'bg-emerald-600 text-white rounded-tr-none'
                                                : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                                                }`}>
                                                <p className="text-sm">{msg.content}</p>
                                                <p className={`text-[10px] mt-1 text-right ${msg.is_me ? 'text-emerald-200' : 'text-zinc-500'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
                                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                    <button type="button" className="p-2 text-zinc-400 hover:text-white transition-colors">
                                        <ImageIcon className="h-5 w-5" />
                                    </button>
                                    <button type="button" className="p-2 text-zinc-400 hover:text-white transition-colors">
                                        <Smile className="h-5 w-5" />
                                    </button>
                                    <input
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!inputText.trim()}
                                        className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
                            <div className="h-20 w-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                                <Send className="h-8 w-8 text-zinc-600" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Your Messages</h3>
                            <p className="max-w-xs">Select a conversation from the list to start chatting or start a new one.</p>
                            <button
                                onClick={() => setIsNewChatOpen(true)}
                                className="mt-6 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold transition-colors"
                            >
                                New Message
                            </button>
                        </div>
                    )}
                </div>
            </div>
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
