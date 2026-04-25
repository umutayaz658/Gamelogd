'use client';

import { useState, useEffect } from 'react';
import { X, Search, Send, Loader2, Check } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

interface Conversation {
    id: number;
    other_user: {
        id: number;
        username: string;
        avatar: string | null;
        real_name: string;
    };
    last_message: {
        content: string;
        created_at: string;
    } | null;
}

interface SharePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    postId?: number;
    reviewId?: number;
    contentPreview?: string;
}

export default function SharePostModal({ isOpen, onClose, postId, reviewId, contentPreview }: SharePostModalProps) {
    const { showToast } = useToast();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sentTo, setSentTo] = useState<Set<number>>(new Set());
    const [sending, setSending] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchConversations();
            setSentTo(new Set());
            setSearchQuery('');
        }
    }, [isOpen]);

    const fetchConversations = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/conversations/');
            setConversations(res.data);
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (conversationId: number) => {
        if (sentTo.has(conversationId)) return;
        setSending(conversationId);

        try {
            const payload: any = {
                conversation: conversationId,
                content: '',
            };
            if (postId) payload.shared_post = postId;
            if (reviewId) payload.shared_review = reviewId;

            await api.post('/messages/', payload);
            setSentTo(prev => new Set(prev).add(conversationId));
            showToast('Post shared!', 'success');
        } catch (error) {
            console.error('Failed to share:', error);
            showToast('Failed to share post', 'error');
        } finally {
            setSending(null);
        }
    };

    const filteredConversations = conversations.filter(c =>
        !searchQuery ||
        c.other_user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.other_user?.real_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                    <h2 className="font-bold text-white">Send via Message</h2>
                    <div className="w-9" />
                </div>

                {/* Search */}
                <div className="p-3 border-b border-zinc-800">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        />
                        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
                    </div>
                </div>

                {/* Preview of shared content */}
                {contentPreview && (
                    <div className="px-4 py-2 bg-zinc-800/30 border-b border-zinc-800">
                        <p className="text-xs text-zinc-500">Sharing:</p>
                        <p className="text-sm text-zinc-300 truncate">{contentPreview}</p>
                    </div>
                )}

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-6 text-center text-zinc-500 text-sm">
                            {searchQuery ? 'No conversations found' : 'No conversations yet. Start a chat first!'}
                        </div>
                    ) : (
                        filteredConversations.map((conv) => (
                            <div
                                key={conv.id}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                            >
                                <img
                                    src={getImageUrl(conv.other_user?.avatar, conv.other_user?.username)}
                                    alt={conv.other_user?.username}
                                    className="h-10 w-10 rounded-full bg-zinc-800 object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-white truncate">
                                        {conv.other_user?.real_name || conv.other_user?.username}
                                    </p>
                                    <p className="text-xs text-zinc-500 truncate">
                                        @{conv.other_user?.username}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleSend(conv.id)}
                                    disabled={sentTo.has(conv.id) || sending === conv.id}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                                        sentTo.has(conv.id)
                                            ? 'bg-zinc-800 text-emerald-500 border border-emerald-500/30'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    } disabled:cursor-not-allowed`}
                                >
                                    {sending === conv.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : sentTo.has(conv.id) ? (
                                        <>
                                            <Check className="h-3.5 w-3.5" />
                                            Sent
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-3.5 w-3.5" />
                                            Send
                                        </>
                                    )}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
