'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2, ArrowLeft, Camera, Check } from 'lucide-react';
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
    
    // Multi-select state
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    
    // Group creation state
    const [step, setStep] = useState<'select' | 'group-details'>('select');
    const [groupName, setGroupName] = useState('');
    const [groupAvatar, setGroupAvatar] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state on open/close
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setResults([]);
            setSelectedUsers([]);
            setStep('select');
            setGroupName('');
            setGroupAvatar(null);
            setAvatarPreview(null);
        }
    }, [isOpen]);

    // Debounced Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim()) {
                setIsLoading(true);
                try {
                    const res = await api.get(`/users/?search=${searchQuery}`);
                    setResults(res.data.results || res.data); // Handle pagination or list
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

    const toggleUserSelection = (user: User) => {
        if (selectedUsers.some(u => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setGroupAvatar(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleCreateChat = async () => {
        if (selectedUsers.length === 0) return;

        setIsStartingChat(true);
        try {
            if (selectedUsers.length === 1) {
                // Direct Chat
                const username = selectedUsers[0].username;
                const res = await api.post('/conversations/start_chat/', { username });
                onChatStarted(res.data);
                onClose();
            } else {
                // Transition to Group Details step
                setStep('group-details');
            }
        } catch (error) {
            console.error("Failed to start chat:", error);
            alert("Failed to start chat.");
        } finally {
            setIsStartingChat(false);
        }
    };

    const handleCreateGroup = async () => {
        if (selectedUsers.length < 2) return;
        setIsStartingChat(true);
        try {
            const formData = new FormData();
            formData.append('name', groupName.trim() || 'Group Chat');
            
            // Append usernames
            selectedUsers.forEach(u => {
                formData.append('usernames', u.username);
            });

            if (groupAvatar) {
                formData.append('avatar', groupAvatar);
            }

            const res = await api.post('/conversations/create_group/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            onChatStarted(res.data);
            onClose();
        } catch (error) {
            console.error("Failed to create group:", error);
            alert("Failed to create group.");
        } finally {
            setIsStartingChat(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {step === 'group-details' && (
                            <button
                                onClick={() => setStep('select')}
                                className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        )}
                        <h2 className="text-lg font-bold text-white">
                            {step === 'select' ? 'New Message' : 'Create Group'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {step === 'select' ? (
                    <>
                        {/* Search Input */}
                        <div className="p-4 border-b border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Search people..."
                                    value={searchQuery || ''}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-650"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Selected Users Horizontal Scroll */}
                        {selectedUsers.length > 0 && (
                            <div className="p-3 border-b border-zinc-800 bg-zinc-900/30 flex gap-2 overflow-x-auto min-h-[58px] scrollbar-thin">
                                {selectedUsers.map(user => (
                                    <div
                                        key={user.id}
                                        className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 rounded-full pl-1.5 pr-2.5 py-1 text-xs font-semibold whitespace-nowrap animate-in zoom-in-90 duration-150"
                                    >
                                        <img
                                            src={getImageUrl(user.avatar, user.username)}
                                            alt=""
                                            className="h-5 w-5 rounded-full object-cover bg-zinc-800"
                                        />
                                        <span>@{user.username}</span>
                                        <button
                                            onClick={() => toggleUserSelection(user)}
                                            className="text-emerald-500 hover:text-emerald-300 transition-colors ml-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Results List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                </div>
                            ) : results.length > 0 ? (
                                <div className="space-y-1">
                                    {results.map((user) => {
                                        const isSelected = selectedUsers.some(u => u.id === user.id);
                                        return (
                                            <button
                                                key={user.id}
                                                onClick={() => toggleUserSelection(user)}
                                                disabled={isStartingChat}
                                                className={`w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-xl transition-all text-left disabled:opacity-50 ${isSelected ? 'bg-zinc-800/40 border border-zinc-800' : 'border border-transparent'}`}
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
                                                <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-zinc-700 bg-transparent'}`}>
                                                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : searchQuery ? (
                                <div className="text-center py-8 text-zinc-500">
                                    No users found.
                                </div>
                            ) : (
                                <div className="text-center py-8 text-zinc-650 text-sm">
                                    Type to search for users to chat with.
                                </div>
                            )}
                        </div>

                        {/* Footer button */}
                        {selectedUsers.length > 0 && (
                            <div className="p-4 border-t border-zinc-800 bg-zinc-950/40">
                                <button
                                    onClick={handleCreateChat}
                                    disabled={isStartingChat}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2"
                                >
                                    {isStartingChat ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        selectedUsers.length === 1 ? 'Start Chat' : `Next (${selectedUsers.length} selected)`
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Group Details Setup Step */}
                        <div className="p-6 flex flex-col gap-6 overflow-y-auto flex-1">
                            
                            {/* Group Avatar Upload */}
                            <div className="flex flex-col items-center gap-2">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-24 w-24 rounded-full overflow-hidden bg-zinc-850 border-2 border-dashed border-zinc-750 hover:border-emerald-500/50 cursor-pointer flex flex-col items-center justify-center text-zinc-500 hover:text-white transition-all relative group"
                                >
                                    {avatarPreview ? (
                                        <>
                                            <img
                                                src={avatarPreview}
                                                alt="Group Preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-full">
                                                <Camera className="h-6 w-6 text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Camera className="h-6 w-6 mb-1" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wider">Photo</span>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                />
                                <span className="text-xs text-zinc-500">Add a group photo (optional)</span>
                            </div>

                            {/* Group Name Input */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Group Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter group name..."
                                    value={groupName || ''}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-650 font-semibold"
                                    maxLength={50}
                                    required
                                />
                            </div>

                            {/* Group Members List for verification */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Members ({selectedUsers.length})</label>
                                <div className="space-y-2 border border-zinc-800 bg-zinc-900/10 rounded-xl p-3 max-h-36 overflow-y-auto">
                                    {selectedUsers.map(user => (
                                        <div key={user.id} className="flex items-center gap-3">
                                            <img
                                                src={getImageUrl(user.avatar, user.username)}
                                                alt=""
                                                className="h-6 w-6 rounded-full object-cover bg-zinc-850"
                                            />
                                            <span className="text-xs font-semibold text-zinc-300">
                                                {user.real_name || user.username} (@{user.username})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer button */}
                        <div className="p-4 border-t border-zinc-800 bg-zinc-950/40">
                            <button
                                onClick={handleCreateGroup}
                                disabled={isStartingChat || !groupName.trim()}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-950/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isStartingChat ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    'Create Group'
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
