'use client';

import { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';

interface User {
    id: number;
    username: string;
    real_name: string;
    avatar: string | null;
}

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChatStarted: (conversation: any) => void;
}

export default function NewChatModal({ isOpen, onClose, onChatStarted }: NewChatModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isStartingChat, setIsStartingChat] = useState(false);

    // Debounced Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim()) {
                setIsLoading(true);
                try {
                    const res = await api.get(`/users/?search=${searchQuery}`);
                    setResults(res.data.results || res.data); // Handle pagination if present, or list
                } catch (error) {
                    console.error("Failed to search users:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleUserSelect = async (username: string) => {
        setIsStartingChat(true);
        try {
            const res = await api.post('/conversations/start_chat/', { username });
            onChatStarted(res.data);
            onClose();
        } catch (error) {
            console.error("Failed to start chat:", error);
            alert("Failed to start chat.");
        } finally {
            setIsStartingChat(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">New Message</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-4 border-b border-zinc-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                        </div>
                    ) : results.length > 0 ? (
                        <div className="space-y-1">
                            {results.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleUserSelect(user.username)}
                                    disabled={isStartingChat}
                                    className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                                        <img
                                            src={getImageUrl(user.avatar, user.username)}
                                            alt={user.username}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white truncate">{user.real_name || user.username}</div>
                                        <div className="text-xs text-zinc-500 truncate">@{user.username}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : searchQuery ? (
                        <div className="text-center py-8 text-zinc-500">
                            No users found.
                        </div>
                    ) : (
                        <div className="text-center py-8 text-zinc-600 text-sm">
                            Type to search for users to chat with.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
