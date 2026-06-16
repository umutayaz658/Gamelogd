'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Search, Loader2, UserMinus, UserCheck, UserPlus, MoreHorizontal } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import ConfirmModal from './ui/ConfirmModal';

interface User {
    id: number;
    username: string;
    real_name?: string;
    avatar?: string;
    is_following?: boolean;
    is_blocked?: boolean;
}

interface FollowersFollowingModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
    initialTab: 'followers' | 'following';
    onCountChange?: () => void;
}

export default function FollowersFollowingModal({
    isOpen,
    onClose,
    username,
    initialTab,
    onCountChange
}: FollowersFollowingModalProps) {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
    const [openMenuUserId, setOpenMenuUserId] = useState<number | null>(null);

    // Confirm Modal State
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({
        title: '',
        message: '',
        onConfirm: () => {}
    });

    // Sync activeTab with initialTab when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setSearchQuery('');
        }
    }, [isOpen, initialTab]);

    // Fetch followers or following list (debounced search)
    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        const delayDebounceFn = setTimeout(async () => {
            setIsLoading(true);
            try {
                const endpoint = activeTab === 'followers' 
                    ? `/users/${username}/followers/` 
                    : `/users/${username}/following-list/`;
                
                const res = await api.get(endpoint, {
                    params: searchQuery.trim() ? { search: searchQuery } : {}
                });

                if (active) {
                    setUsers(res.data);
                }
            } catch (error) {
                console.error(`Failed to fetch ${activeTab}:`, error);
                if (active) {
                    setUsers([]);
                }
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        }, searchQuery.trim() ? 400 : 0);

        return () => {
            active = false;
            clearTimeout(delayDebounceFn);
        };
    }, [isOpen, activeTab, username, searchQuery]);

    const handleFollowToggle = async (targetUser: User) => {
        if (!currentUser) return;
        setActionLoadingId(targetUser.id);

        const wasFollowing = targetUser.is_following;
        
        // Optimistic UI Update
        setUsers(prev => prev.map(u => {
            if (u.id === targetUser.id) {
                return { ...u, is_following: !wasFollowing };
            }
            return u;
        }));

        try {
            if (wasFollowing) {
                await api.post(`/users/${targetUser.username}/unfollow/`);
            } else {
                await api.post(`/users/${targetUser.username}/follow/`);
            }
            if (onCountChange) {
                onCountChange();
            }
        } catch (error) {
            console.error("Action failed:", error);
            // Revert on error
            setUsers(prev => prev.map(u => {
                if (u.id === targetUser.id) {
                    return { ...u, is_following: wasFollowing };
                }
                return u;
            }));
            alert("Failed to update follow status.");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRemoveFollower = async (targetUser: User) => {
        if (!currentUser) return;
        setActionLoadingId(targetUser.id);

        // Optimistic UI Update (Remove user from list)
        const previousUsers = [...users];
        setUsers(prev => prev.filter(u => u.id !== targetUser.id));

        try {
            await api.post(`/users/${targetUser.username}/remove-follower/`);
            if (onCountChange) {
                onCountChange();
            }
        } catch (error) {
            console.error("Failed to remove follower:", error);
            // Revert on error
            setUsers(previousUsers);
            alert("Failed to remove follower.");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleBlockUser = async (targetUser: User) => {
        if (!currentUser) return;
        setConfirmConfig({
            title: 'Block User',
            message: `Are you sure you want to block @${targetUser.username}?`,
            onConfirm: async () => {
                setActionLoadingId(targetUser.id);
                try {
                    await api.post(`/users/${targetUser.username}/block/`);
                    setUsers(prev => prev.filter(u => u.id !== targetUser.id));
                    if (onCountChange) {
                        onCountChange();
                    }
                } catch (error) {
                    console.error("Block failed:", error);
                    alert("Failed to block user.");
                } finally {
                    setActionLoadingId(null);
                    setOpenMenuUserId(null);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    if (!isOpen) return null;

    const isOwnProfile = currentUser?.username === username;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[60vh] max-h-[500px] animate-in zoom-in-95 duration-200">
                
                {/* Header with Navigation Tabs */}
                <div className="border-b border-zinc-800 flex flex-col">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <span className="font-bold text-white text-lg">Connections</span>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex px-4 gap-6">
                        <button
                            onClick={() => {
                                setActiveTab('followers');
                                setSearchQuery('');
                            }}
                            className={`pb-3 text-sm font-bold transition-all relative ${
                                activeTab === 'followers' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Followers
                            {activeTab === 'followers' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full" />
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('following');
                                setSearchQuery('');
                            }}
                            className={`pb-3 text-sm font-bold transition-all relative ${
                                activeTab === 'following' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Following
                            {activeTab === 'following' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-3 border-b border-zinc-800 bg-zinc-900/40">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
                        />
                    </div>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                        </div>
                    ) : users.length > 0 ? (
                        <div className="space-y-1">
                            {users.map((user) => {
                                const isSelf = currentUser?.username === user.username;
                                return (
                                    <div
                                        key={user.id}
                                        className="p-2.5 flex items-center justify-between hover:bg-zinc-800/30 rounded-xl transition-all border border-transparent hover:border-zinc-800/50"
                                    >
                                        <Link
                                            href={`/${user.username}`}
                                            onClick={onClose}
                                            className="flex items-center gap-3 flex-1 min-w-0 group"
                                        >
                                            <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700/50">
                                                <img
                                                    src={getImageUrl(user.avatar, user.username)}
                                                    alt={user.username}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <div className="font-bold text-white text-sm truncate group-hover:text-emerald-400 transition-colors">
                                                    {user.real_name || user.username}
                                                </div>
                                                <div className="text-xs text-zinc-500 truncate">
                                                    @{user.username}
                                                </div>
                                            </div>
                                        </Link>

                                        {/* Action Button & Menu */}
                                        {!isSelf && currentUser && (
                                            <div className="ml-3 flex items-center gap-2 relative">
                                                {activeTab === 'followers' && isOwnProfile ? (
                                                    <button
                                                        onClick={() => handleRemoveFollower(user)}
                                                        disabled={actionLoadingId === user.id}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700/80 hover:text-red-400 hover:border-red-500/30 text-zinc-300 transition-all text-xs font-bold"
                                                    >
                                                        {actionLoadingId === user.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <UserMinus className="h-3.5 w-3.5" />
                                                                <span>Remove</span>
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleFollowToggle(user)}
                                                        disabled={actionLoadingId === user.id}
                                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                            user.is_following
                                                                ? 'bg-zinc-800 border border-zinc-750 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20'
                                                        }`}
                                                    >
                                                        {actionLoadingId === user.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : user.is_following ? (
                                                            <>
                                                                <UserCheck className="h-3.5 w-3.5" />
                                                                <span>Unfollow</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserPlus className="h-3.5 w-3.5" />
                                                                <span>Follow</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}

                                                <div className="relative">
                                                    <button
                                                        onClick={() => setOpenMenuUserId(openMenuUserId === user.id ? null : user.id)}
                                                        className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-200"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>

                                                    {openMenuUserId === user.id && (
                                                        <div className="absolute right-0 mt-1 w-24 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl z-50 p-1 animate-in fade-in duration-100">
                                                            <button
                                                                onClick={() => handleBlockUser(user)}
                                                                className="w-full text-left px-2 py-1 text-[11px] text-red-500 hover:bg-red-500/10 rounded-md font-bold transition-colors"
                                                            >
                                                                Block
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : searchQuery ? (
                        <div className="text-center py-12 text-zinc-500 text-sm">
                            No connections found matching "{searchQuery}"
                        </div>
                    ) : (
                        <div className="text-center py-12 text-zinc-500 text-sm">
                            No {activeTab} yet.
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
                isDanger={true}
                confirmText="Block"
            />
        </div>
    );
}
