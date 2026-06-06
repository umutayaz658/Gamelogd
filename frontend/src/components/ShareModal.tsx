'use client';

import { useState, useEffect } from 'react';
import { X, Search, Send, Check, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemType: 'post' | 'review' | 'news';
    itemId: number;
    title: string;
}

interface Conversation {
    id: number;
    is_group: boolean;
    name: string | null;
    avatar: string | null;
    other_user?: {
        username: string;
        real_name: string;
        avatar: string | null;
    };
}

export default function ShareModal({ isOpen, onClose, itemType, itemId, title }: ShareModalProps) {
    const { user: currentUser } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sendingStates, setSendingStates] = useState<{ [chatId: number]: 'idle' | 'sending' | 'sent' }>({});

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSendingStates({});
            return;
        }

        const fetchChats = async () => {
            setIsLoading(true);
            try {
                const res = await api.get('/conversations/');
                setConversations(res.data);
            } catch (error) {
                console.error("Failed to fetch conversations for sharing:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChats();
    }, [isOpen]);

    const handleSend = async (chatId: number) => {
        setSendingStates(prev => ({ ...prev, [chatId]: 'sending' }));
        try {
            const payload: any = {
                conversation: chatId,
                content: `Shared a ${itemType === 'review' ? 'game log' : itemType}:`
            };
            if (itemType === 'post') payload.shared_post = itemId;
            if (itemType === 'review') payload.shared_review = itemId;
            if (itemType === 'news') payload.shared_news = itemId;

            await api.post('/messages/', payload);
            setSendingStates(prev => ({ ...prev, [chatId]: 'sent' }));

            // Automatically close after a short delay if sent
            setTimeout(() => {
                // If only one chat was chosen or just standard, let user see "Sent" for 1 second
            }, 1000);
        } catch (error) {
            console.error("Failed to share item:", error);
            alert("Failed to share. Please try again.");
            setSendingStates(prev => ({ ...prev, [chatId]: 'idle' }));
        }
    };

    if (!isOpen) return null;

    // Filter conversations
    const filteredChats = conversations.filter(chat => {
        const chatName = chat.is_group 
            ? chat.name || 'Group Chat' 
            : chat.other_user?.real_name || chat.other_user?.username || '';
        return chatName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div>
                        <h2 className="text-lg font-bold text-white">Send to Chat</h2>
                        <p className="text-xs text-zinc-500 truncate max-w-[280px]">Sharing: {title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-zinc-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-650"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto p-2 min-h-[250px]">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-7 w-7 text-emerald-500 animate-spin" />
                        </div>
                    ) : filteredChats.length > 0 ? (
                        <div className="space-y-1">
                            {filteredChats.map((chat) => {
                                const chatName = chat.is_group 
                                    ? chat.name || 'Group Chat' 
                                    : chat.other_user?.real_name || chat.other_user?.username || 'Chat';
                                const chatAvatar = chat.is_group 
                                    ? chat.avatar 
                                    : chat.other_user?.avatar;
                                const chatUsername = chat.is_group ? 'Group' : `@${chat.other_user?.username}`;

                                const status = sendingStates[chat.id] || 'idle';

                                return (
                                    <div
                                        key={chat.id}
                                        className="flex items-center justify-between p-3 hover:bg-zinc-800/40 rounded-xl transition-all"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                                                <img
                                                    src={getImageUrl(chatAvatar, chat.other_user?.username || 'group')}
                                                    alt={chatName}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-white text-sm truncate">{chatName}</div>
                                                <div className="text-xs text-zinc-500 truncate">{chatUsername}</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleSend(chat.id)}
                                            disabled={status !== 'idle'}
                                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                status === 'sent'
                                                    ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                                                    : status === 'sending'
                                                    ? 'bg-zinc-800 text-zinc-450 border border-zinc-700'
                                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                                            }`}
                                        >
                                            {status === 'sent' ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    <span>Sent</span>
                                                </>
                                            ) : status === 'sending' ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    <span>Sending</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="h-3 w-3" />
                                                    <span>Send</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-zinc-500 text-sm">
                            No conversations found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
