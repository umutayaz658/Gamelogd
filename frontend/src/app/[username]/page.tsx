'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import Link from 'next/link';
import Navbar from "@/components/Navbar";
import GameDNA from "@/components/Profile/GameDNA";
import Feed from "@/components/Feed";
import GameSearchModal from "@/components/GameSearchModal";
import { getImageUrl } from "@/lib/utils";
import { sanitizeUrl } from "@/lib/url";
import api, { unwrapList } from "@/lib/api";
import { MapPin, Link as LinkIcon, Calendar, Gamepad2, Twitter, Github, Pencil, UserPlus, Trophy, Plus, Loader2, Cake, MessageSquare, Eye, EyeOff, MoreHorizontal, X, Clock, Lock, UserX, Dna, ChevronDown, ArrowRight } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useFeed } from "@/context/FeedContext";
import EditProfileModal from "@/components/EditProfileModal";
import ImageModal from "@/components/modals/ImageModal";
import FollowersFollowingModal from "@/components/FollowersFollowingModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useTranslation } from "@/lib/useTranslation";
import { useToast } from "@/context/ToastContext";

interface Game {
    id: number;
    title: string;
    image: string;
}

interface UserProfile {
    id: number;
    username: string;
    real_name?: string;
    avatar?: string;
    cover_image?: string;
    bio?: string;
    location?: string;
    date_joined?: string;
    birth_date?: string;
    show_birth_date?: boolean;
    role?: string;
    social_links?: any;
    top_favorites?: any[];
    interests?: string[];
    followers_count?: number;
    following_count?: number;
    is_following?: boolean;
    is_blocked?: boolean;
    has_blocked_me?: boolean;
    steam_id?: string;
    settings?: any;
    is_gamer?: boolean;
    is_developer?: boolean;
    is_investor?: boolean;
    reviews_count?: number;
}

interface SteamStatus {
    is_playing: boolean;
    game_title: string | null;
    steam_appid: number | null;
    cover_image: string | null;
}

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = use(params);
    const { user: currentUser } = useAuth();
    const { items: feedItems } = useFeed();
    const { t, language } = useTranslation();
    const toast = useToast();
    const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('activity');

    // Top 4 State
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
    const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
    const [topGames, setTopGames] = useState<(Game | null)[]>([null, null, null, null]);
    const [userPosts, setUserPosts] = useState<any[]>([]);
    const [isPostsLoading, setIsPostsLoading] = useState(true);

    // Game DNA
    const [gameDNA, setGameDNA] = useState<any>({ genres: [], platforms: [] });

    // Follow State
    const [isFollowing, setIsFollowing] = useState(false);
    const [isRequested, setIsRequested] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [isBlocked, setIsBlocked] = useState(false);
    const [hasRequestedMe, setHasRequestedMe] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Confirm Modal State
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmModalConfig, setConfirmModalConfig] = useState({
        title: '',
        message: '',
        onConfirm: () => {}
    });

    // Steam Status State
    const [steamStatus, setSteamStatus] = useState<SteamStatus | null>(null);
    const [isSteamStatusLoading, setIsSteamStatusLoading] = useState(false);
    const [isSteamPrivate, setIsSteamPrivate] = useState(false);
    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

    // Mobile-only: Bio show-more/less + Game DNA accordion
    const [isBioExpanded, setIsBioExpanded] = useState(false);
    const [shouldShowBioShowMore, setShouldShowBioShowMore] = useState(false);
    const [isGameDnaExpanded, setIsGameDnaExpanded] = useState(false);
    const [gameDnaMaxHeight, setGameDnaMaxHeight] = useState(0);
    const bioRef = useRef<HTMLParagraphElement>(null);
    const gameDnaContentRef = useRef<HTMLDivElement>(null);

    // Twitter-style full-size avatar/cover viewer
    const [viewerImage, setViewerImage] = useState<string | null>(null);

    const isOwnProfile = currentUser?.username?.toLowerCase() === username?.toLowerCase();

    // Fetch Profile Data
    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                const res = await api.get(`/users/${username}/`);
                setProfileUser(res.data);
                setIsFollowing(res.data.is_following || false);
                setIsRequested(res.data.is_requested || false);
                setFollowersCount(res.data.followers_count || 0);
                setIsBlocked(res.data.is_blocked || false);
                setHasRequestedMe(res.data.has_requested_me || false);
            } catch (error) {
                console.error("Failed to fetch profile:", error);
                setProfileUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (username) {
            fetchProfile();
        }
    }, [username]);

    const refreshProfileCounts = async () => {
        try {
            const res = await api.get(`/users/${username}/`);
            setProfileUser(res.data);
            setIsFollowing(res.data.is_following || false);
            setIsRequested(res.data.is_requested || false);
            setFollowersCount(res.data.followers_count || 0);
            setIsBlocked(res.data.is_blocked || false);
            setHasRequestedMe(res.data.has_requested_me || false);
        } catch (error) {
            console.error("Failed to refresh profile counts:", error);
        }
    };

    // Close block dropdown on outside click
    useEffect(() => {
        if (!isMenuOpen) return;
        const handleOutsideClick = () => setIsMenuOpen(false);
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, [isMenuOpen]);

    const handleBlockToggle = async () => {
        if (!currentUser) {
            toast.info("Please login to block users.");
            return;
        }

        const confirmTitle = isBlocked ? 'Unblock User' : 'Block User';
        const confirmMsg = isBlocked 
            ? `Are you sure you want to unblock @${username}?`
            : `Are you sure you want to block @${username}?`;

        setConfirmModalConfig({
            title: confirmTitle,
            message: confirmMsg,
            onConfirm: async () => {
                try {
                    if (isBlocked) {
                        await api.post(`/users/${username}/unblock/`);
                        setIsBlocked(false);
                    } else {
                        await api.post(`/users/${username}/block/`);
                        setIsBlocked(true);
                        setIsFollowing(false);
                        setFollowersCount(prev => prev > 0 ? prev - 1 : 0);
                    }
                    refreshProfileCounts();
                } catch (error) {
                    console.error("Failed to toggle block status:", error);
                    toast.error("Failed to update block status.");
                }
            }
        });
        setIsConfirmModalOpen(true);
    };

    // Fetch Steam Status
    useEffect(() => {
        const fetchSteamStatus = async () => {
            if (!profileUser?.steam_id) {
                setSteamStatus(null);
                return;
            }
            // Don't fetch steam status for private accounts we can't view
            const isPrivateProfile = profileUser?.settings?.privateProfile || false;
            const isOwner = currentUser?.username?.toLowerCase() === profileUser?.username?.toLowerCase();
            const canFetch = !isPrivateProfile || isOwner || profileUser?.is_following;
            if (!canFetch) {
                setSteamStatus(null);
                return;
            }
            setIsSteamStatusLoading(true);
            try {
                const res = await api.get(`/users/${profileUser.username}/steam-status/`);
                setSteamStatus(res.data);
            } catch (error) {
                console.error("Failed to fetch Steam status:", error);
                setSteamStatus(null);
            } finally {
                setIsSteamStatusLoading(false);
            }
        };

        if (profileUser) {
            fetchSteamStatus();
        }
    }, [profileUser]);

    // Sync privacy state with profileUser settings
    useEffect(() => {
        if (profileUser) {
            setIsSteamPrivate(profileUser.settings?.steamStatusPrivate || false);
        }
    }, [profileUser]);

    const toggleSteamPrivacy = async () => {
        if (!profileUser) return;
        
        setIsUpdatingPrivacy(true);
        const newPrivateState = !isSteamPrivate;
        
        // Optimistic update
        setIsSteamPrivate(newPrivateState);
        
        try {
            const updatedSettings = {
                ...(profileUser.settings || {}),
                steamStatusPrivate: newPrivateState
            };
            
            const res = await api.patch('/users/me/', { settings: updatedSettings });
            setProfileUser(res.data);
            
            // Re-fetch steam status since privacy toggled
            const statusRes = await api.get(`/users/${profileUser.username}/steam-status/`);
            setSteamStatus(statusRes.data);
        } catch (error) {
            console.error("Failed to update Steam status privacy:", error);
            // Revert on failure
            setIsSteamPrivate(!newPrivateState);
            toast.error("Failed to update privacy settings. Please try again.");
        } finally {
            setIsUpdatingPrivacy(false);
        }
    };

    // Load favorites from profile user
    useEffect(() => {
        if (profileUser && profileUser.top_favorites && profileUser.top_favorites.length > 0) {
            const loadedGames = [null, null, null, null] as (Game | null)[];
            profileUser.top_favorites.forEach((fav: any) => {
                if (fav.slot >= 0 && fav.slot < 4) {
                    loadedGames[fav.slot] = {
                        id: fav.game_id,
                        title: fav.title || "Unknown Game",
                        image: fav.cover || ""
                    };
                }
            });
            setTopGames(loadedGames);
        } else {
            setTopGames([null, null, null, null]);
        }
    }, [profileUser]);

    // Fetch User Feed (Posts + Reviews) - only when we can view the content
    useEffect(() => {
        if (!username || !profileUser) return;

        const isPrivateProfile = profileUser?.settings?.privateProfile || false;
        const isOwner = currentUser?.username?.toLowerCase() === username?.toLowerCase();
        const canFetch = !isPrivateProfile || isOwner || profileUser?.is_following;

        if (!canFetch) {
            setUserPosts([]);
            setIsPostsLoading(false);
            return;
        }

        const fetchUserFeed = async () => {
            setIsPostsLoading(true);
            try {
                const [postsRes, reviewsRes] = await Promise.all([
                    api.get(`/posts/?username=${username}`),
                    api.get(`/reviews/?username=${username}`)
                ]);

                const posts = unwrapList(postsRes.data).map((p: any) => ({ ...p, type: 'post' }));
                const reviews = unwrapList(reviewsRes.data).map((r: any) => ({ ...r, type: 'review' }));

                const combined = [...posts, ...reviews].sort((a: any, b: any) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );

                setUserPosts(combined);
            } catch (err) {
                console.error("Failed to fetch user feed:", err);
            } finally {
                setIsPostsLoading(false);
            }
        };
        fetchUserFeed();
    }, [username, profileUser]);

    // Fetch Game DNA - only when authorized to view content
    const fetchGameDNA = useCallback(() => {
        if (!username || !profileUser) return;

        const isPrivateProfile = profileUser?.settings?.privateProfile || false;
        const isOwner = currentUser?.username?.toLowerCase() === username?.toLowerCase();
        const canFetch = !isPrivateProfile || isOwner || profileUser?.is_following;

        if (!canFetch) {
            setGameDNA({ genres: [], platforms: [] });
            return;
        }

        api.get(`/users/${username}/game-dna/`)
            .then(res => setGameDNA(res.data))
            .catch(err => {
                console.error("Failed to fetch Game DNA:", err);
                setGameDNA({ genres: [], platforms: [] });
            });
    }, [username, profileUser]);

    useEffect(() => {
        fetchGameDNA();

        // Re-fetch when user returns to tab (e.g. after changing status on games page)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchGameDNA();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchGameDNA]);

    // Mobile Bio block: check whether the bio overflows 3 lines, mirrors PostCard.tsx's
    // showMore/showLess overflow-detection pattern.
    useEffect(() => {
        const checkBioOverflow = () => {
            if (bioRef.current && !isBioExpanded) {
                setShouldShowBioShowMore(bioRef.current.scrollHeight > bioRef.current.clientHeight);
            }
        };
        const timer = setTimeout(checkBioOverflow, 50);
        window.addEventListener('resize', checkBioOverflow);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkBioOverflow);
        };
    }, [profileUser?.bio, isBioExpanded]);

    // Mobile Game DNA accordion: recompute the target height whenever the panel is
    // opened/closed OR the underlying stats arrive later than the first click — this
    // avoids the "snaps open on the very first expand" bug where scrollHeight was
    // measured before gameDNA had finished loading.
    useEffect(() => {
        if (isGameDnaExpanded && gameDnaContentRef.current) {
            setGameDnaMaxHeight(gameDnaContentRef.current.scrollHeight);
        } else {
            setGameDnaMaxHeight(0);
        }
    }, [isGameDnaExpanded, gameDNA]);

    const handleSlotClick = (index: number) => {
        if (!isOwnProfile) return;
        setActiveSlotIndex(index);
        setIsModalOpen(true);
    };

    const handleSelectGame = async (game: any) => {
        if (activeSlotIndex === null) return;

        const newTopGames = [...topGames];
        const newGameEntry = {
            id: game.id,
            title: game.title,
            image: getImageUrl(game.cover_image)
        };

        newTopGames[activeSlotIndex] = newGameEntry;
        setTopGames(newTopGames); // Optimistic update
        setIsModalOpen(false);
        setActiveSlotIndex(null);

        // Save to Backend
        try {
            const favoritesPayload = newTopGames.map((g, index) => {
                if (!g) return null;
                return {
                    slot: index,
                    game_id: g.id,
                    title: g.title,
                    cover: g.image
                };
            }).filter(Boolean);

            await api.patch('/users/me/', { top_favorites: favoritesPayload });
        } catch (error) {
            console.error("Failed to save favorites:", error);
            toast.error("Failed to save changes. Please try again.");
        }
    };

    const handleClearSlot = async (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOwnProfile) return;

        const newTopGames = [...topGames];
        newTopGames[index] = null;
        setTopGames(newTopGames);

        try {
            const favoritesPayload = newTopGames.map((g, idx) => {
                if (!g) return null;
                return {
                    slot: idx,
                    game_id: g.id,
                    title: g.title,
                    cover: g.image
                };
            }).filter(Boolean);

            await api.patch('/users/me/', { top_favorites: favoritesPayload });
        } catch (error) {
            console.error("Failed to clear favorite slot:", error);
            toast.error("Failed to clear slot. Please try again.");
        }
    };

    const handleMessage = async () => {
        if (!currentUser) {
            toast.info("Please login to send messages.");
            return;
        }
        try {
            const res = await api.post('/conversations/start_chat/', { username: username });
            // Redirect to messages page with chat ID
            window.location.href = `/messages?chatId=${res.data.id}`;
        } catch (error) {
            console.error("Failed to start chat:", error);
            toast.error("Failed to start chat.");
        }
    };

    const handleFollowToggle = async () => {
        if (!currentUser) {
            toast.info("Please login to follow users.");
            return;
        }

        const isPrivateProfile = profileUser?.settings?.privateProfile || false;

        // Save previous states
        const previousIsFollowing = isFollowing;
        const previousIsRequested = isRequested;
        const previousCount = followersCount;

        // Perform Precise UI State Update
        if (isFollowing) {
            // Unfollow
            setIsFollowing(false);
            setIsRequested(false);
            setFollowersCount(prev => prev > 0 ? prev - 1 : 0);
        } else if (isRequested) {
            // Cancel request
            setIsRequested(false);
            setIsFollowing(false);
        } else {
            // Follow
            if (isPrivateProfile) {
                setIsRequested(true);
                setIsFollowing(false);
            } else {
                setIsFollowing(true);
                setIsRequested(false);
                setFollowersCount(prev => prev + 1);
            }
        }

        try {
            if (previousIsFollowing || previousIsRequested) {
                const res = await api.post(`/users/${username}/unfollow/`);
                setIsFollowing(res.data.is_following || false);
                setIsRequested(res.data.is_requested || false);
                if (res.data.is_following) {
                    setFollowersCount(previousCount + 1);
                } else {
                    setFollowersCount(previousCount);
                }
            } else {
                const res = await api.post(`/users/${username}/follow/`);
                setIsFollowing(res.data.is_following || false);
                setIsRequested(res.data.is_requested || false);
                if (res.data.is_following) {
                    setFollowersCount(previousCount + 1);
                } else {
                    setFollowersCount(previousCount);
                }
            }
        } catch (error) {
            console.error("Follow action failed:", error);
            // Revert on failure
            setIsFollowing(previousIsFollowing);
            setIsRequested(previousIsRequested);
            setFollowersCount(previousCount);
            toast.error("Failed to update follow status.");
        }
    };

    const handleAcceptIncomingRequest = async () => {
        try {
            await api.post(`/users/${username}/approve-request/`);
            setHasRequestedMe(false);
            refreshProfileCounts();
        } catch (error) {
            console.error("Failed to approve follow request:", error);
            toast.error("Failed to approve follow request.");
        }
    };

    const handleDeclineIncomingRequest = async () => {
        try {
            await api.post(`/users/${username}/reject-request/`);
            setHasRequestedMe(false);
            refreshProfileCounts();
        } catch (error) {
            console.error("Failed to reject follow request:", error);
            toast.error("Failed to reject follow request.");
        }
    };


    const handleProfileUpdate = (updatedUser: any) => {
        setProfileUser(updatedUser);
        setIsEditProfileOpen(false);
    };

    // Helper for Social Icons
    const SocialIcon = ({ platform, url }: { platform: string, url: string }) => {
        if (!url) return null;
        const safeUrl = sanitizeUrl(url);

        let Icon = LinkIcon;
        if (platform === 'twitter') Icon = Twitter;
        if (platform === 'github') Icon = Github;
        if (platform === 'linkedin') Icon = LinkIcon;
        if (platform === 'steam') Icon = Gamepad2;
        if (platform === 'facebook') Icon = LinkIcon;
        if (platform === 'instagram') Icon = LinkIcon;

        return (
            <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors">
                <Icon className="h-5 w-5" />
            </a>
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!profileUser) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">User Not Found</h2>
                    <Link href="/" className="text-emerald-500 hover:underline">Go Home</Link>
                </div>
            </div>
        );
    }

    // Prepare Display Data
    const displayUser = {
        name: profileUser.real_name || profileUser.username,
        handle: `@${profileUser.username.toLowerCase()}`,
        role: profileUser.role || "Gamer",
        avatar: getImageUrl(profileUser.avatar, profileUser.username),
        cover: profileUser.cover_image ? getImageUrl(profileUser.cover_image) : null,
        bio: profileUser.bio || t('noBioYet'),
        location: profileUser.location,
        joined: (() => {
            if (!profileUser.date_joined) return "";
            const d = new Date(profileUser.date_joined);
            const locale = language === 'Turkish' ? 'tr-TR' : 'en-US';
            return isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        })(),
        birth_date: profileUser.birth_date,
        show_birth_date: profileUser.show_birth_date,
        stats: {
            followers: 0,
            following: 0,
            gamesPlayed: 0
        },
        social_links: profileUser.social_links || {}
    };

    const isPrivateProfile = profileUser?.settings?.privateProfile || false;
    const canViewContent = !isPrivateProfile || isOwnProfile || isFollowing;

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            {/* Hero Section */}
            <div className="relative mb-4 sm:mb-14 md:mb-20">
                {/* Cover Image */}
                <div className="h-40 sm:h-56 md:h-80 w-full overflow-hidden bg-zinc-950 relative">
                    {displayUser.cover && (
                        <img
                            src={displayUser.cover}
                            alt="Cover"
                            onClick={() => setViewerImage(displayUser.cover)}
                            className="w-full h-full object-cover cursor-pointer"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent pointer-events-none" />
                </div>

                <div className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4">
                    <div className="relative -mt-10 sm:-mt-14 md:-mt-20 flex flex-col md:flex-row items-end gap-6">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="h-20 w-20 sm:h-28 sm:w-28 md:h-40 md:w-40 rounded-full border-4 border-zinc-950 overflow-hidden bg-zinc-900">
                                <img
                                    src={displayUser.avatar}
                                    alt={displayUser.name}
                                    onClick={() => setViewerImage(displayUser.avatar)}
                                    className="w-full h-full object-cover cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1 mb-2 w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="hidden lg:block">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                            {displayUser.name}
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                {profileUser.is_gamer && (
                                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 uppercase tracking-wider animate-in fade-in zoom-in-95 duration-200">
                                                        {t('roleGamer')}
                                                    </span>
                                                )}
                                                {profileUser.is_developer && (
                                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/20 uppercase tracking-wider animate-in fade-in zoom-in-95 duration-200">
                                                        {t('roleDeveloper')}
                                                    </span>
                                                )}
                                                {profileUser.is_investor && (
                                                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-lg border border-amber-500/20 uppercase tracking-wider animate-in fade-in zoom-in-95 duration-200">
                                                        {t('roleInvestor')}
                                                    </span>
                                                )}
                                            </div>
                                        </h1>
                                        {isOwnProfile ? (
                                            <button
                                                onClick={() => setIsEditProfileOpen(true)}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all text-sm font-medium"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                <span>{t('editProfile')}</span>
                                            </button>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                {!profileUser.has_blocked_me && !isBlocked && (
                                                    <>
                                                        <button
                                                            onClick={handleFollowToggle}
                                                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all text-sm font-bold shadow-lg ${isFollowing || isRequested
                                                                ? 'bg-transparent border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white'
                                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                                                                }`}
                                                        >
                                                            {isFollowing ? (
                                                                <>
                                                                    <UserX className="h-4 w-4" />
                                                                    <span>{t('unfollow')}</span>
                                                                </>
                                                            ) : isRequested ? (
                                                                <>
                                                                    <Clock className="h-4 w-4 text-zinc-400" />
                                                                    <span>{t('requested')}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <UserPlus className="h-4 w-4" />
                                                                    <span>{t('follow')}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={handleMessage}
                                                            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-all text-sm font-bold border border-zinc-700"
                                                        >
                                                            <MessageSquare className="h-4 w-4" />
                                                            <span>{t('messageBtn')}</span>
                                                        </button>
                                                    </>
                                                )}
                                                
                                                {/* 3-dot dropdown menu */}
                                                {!profileUser.has_blocked_me && (
                                                    <div className="relative block-menu-container">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsMenuOpen(!isMenuOpen);
                                                            }}
                                                            className="flex items-center justify-center p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-all border border-zinc-700 cursor-pointer"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </button>
 
                                                        {isMenuOpen && (
                                                            <div className="absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1 animate-in fade-in duration-100">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleBlockToggle();
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg font-bold transition-colors cursor-pointer"
                                                                >
                                                                    {isBlocked ? t('unblock') : t('block')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-zinc-400 font-medium mt-1">{displayUser.handle}</p>
                                </div>

                                {/* Stats */}
                                {!profileUser.has_blocked_me && !isBlocked && (
                                    <div className="hidden lg:flex items-center gap-6 md:gap-8 bg-zinc-900/50 px-6 py-3 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
                                        <button
                                            onClick={() => {
                                                if (!canViewContent) return;
                                                setFollowModalTab('followers');
                                                setIsFollowModalOpen(true);
                                            }}
                                            className={`text-center focus:outline-none group transition-all ${canViewContent ? 'hover:opacity-80' : 'cursor-default'}`}
                                        >
                                            <div className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{followersCount}</div>
                                            <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{t('followers')}</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!canViewContent) return;
                                                setFollowModalTab('following');
                                                setIsFollowModalOpen(true);
                                            }}
                                            className={`text-center focus:outline-none group transition-all ${canViewContent ? 'hover:opacity-80' : 'cursor-default'}`}
                                        >
                                            <div className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{profileUser.following_count || 0}</div>
                                            <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{t('following')}</div>
                                        </button>
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-emerald-400">{profileUser.reviews_count || 0}</div>
                                            <div className="text-xs text-zinc-550 font-bold uppercase tracking-wider">{t('reviews')}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Mobile name row: name (compact) + Edit Profile / Follow+3-dot, right-aligned */}
                                <div className="lg:hidden flex items-center justify-between gap-3">
                                    <h1 className="text-xl font-bold text-white truncate self-end leading-none">{displayUser.name}</h1>
                                    {isOwnProfile ? (
                                        <button
                                            onClick={() => setIsEditProfileOpen(true)}
                                            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all text-sm font-medium"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            <span>{t('editProfile')}</span>
                                        </button>
                                    ) : !profileUser.has_blocked_me && (
                                        <div className="flex-shrink-0 flex items-center gap-2">
                                            {/* 3-dot menu (mobile) — also carries the Message action since the
                                                row only has room for two elements (3-dot + Follow) */}
                                            <div className="relative block-menu-container">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsMenuOpen(!isMenuOpen);
                                                    }}
                                                    className="flex items-center justify-center p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-all border border-zinc-700 cursor-pointer"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                                {isMenuOpen && (
                                                    <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1 animate-in fade-in duration-100">
                                                        {!isBlocked && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); handleMessage(); }}
                                                                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2"
                                                            >
                                                                <MessageSquare className="h-3.5 w-3.5" />
                                                                {t('messageBtn')}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleBlockToggle();
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg font-bold transition-colors cursor-pointer"
                                                        >
                                                            {isBlocked ? t('unblock') : t('block')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {!isBlocked && (
                                                <button
                                                    onClick={handleFollowToggle}
                                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all text-sm font-bold shadow-lg ${isFollowing || isRequested
                                                        ? 'bg-transparent border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white'
                                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                                                        }`}
                                                >
                                                    {isFollowing ? (
                                                        <>
                                                            <UserX className="h-4 w-4" />
                                                            <span>{t('unfollow')}</span>
                                                        </>
                                                    ) : isRequested ? (
                                                        <>
                                                            <Clock className="h-4 w-4 text-zinc-400" />
                                                            <span>{t('requested')}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserPlus className="h-4 w-4" />
                                                            <span>{t('follow')}</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Mobile username + role badges row, left-aligned under the name */}
                                <div className="lg:hidden flex flex-wrap items-center gap-2 mt-0 leading-none">
                                    <p className="text-zinc-400 font-medium">{displayUser.handle}</p>
                                    {profileUser.is_gamer && (
                                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20 uppercase tracking-wider">
                                            {t('roleGamer')}
                                        </span>
                                    )}
                                    {profileUser.is_developer && (
                                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/20 uppercase tracking-wider">
                                            {t('roleDeveloper')}
                                        </span>
                                    )}
                                    {profileUser.is_investor && (
                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-lg border border-amber-500/20 uppercase tracking-wider">
                                            {t('roleInvestor')}
                                        </span>
                                    )}
                                </div>

                                {/* Mobile Bio — Twitter-style, always visible under the name/handle */}
                                {displayUser.bio && (
                                    <div className="lg:hidden mt-1 space-y-2">
                                        <p ref={bioRef} className={`text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap ${isBioExpanded ? '' : 'line-clamp-3'}`}>
                                            {displayUser.bio}
                                        </p>
                                        {shouldShowBioShowMore && (
                                            <button
                                                onClick={() => setIsBioExpanded(v => !v)}
                                                className="text-emerald-500 hover:text-emerald-400 hover:underline text-xs font-semibold -mt-2 block w-fit"
                                            >
                                                {isBioExpanded ? t('showLess') : `${t('showMore')}...`}
                                            </button>
                                        )}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
                                            {displayUser.location && displayUser.location.trim().length > 0 && (
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{displayUser.location}</span>
                                                </div>
                                            )}
                                            {displayUser.show_birth_date && displayUser.birth_date && (() => {
                                                const bDate = new Date(displayUser.birth_date);
                                                if (isNaN(bDate.getTime())) return null;
                                                const locale = language === 'Turkish' ? 'tr-TR' : 'en-US';
                                                return (
                                                    <div className="flex items-center gap-1.5">
                                                        <Cake className="h-3.5 w-3.5" />
                                                        {t('born')} {bDate.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {t('joined')} {displayUser.joined}
                                            </div>
                                        </div>
                                        {Object.keys(displayUser.social_links).length > 0 && (
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {Object.entries(displayUser.social_links).map(([platform, url]) => (
                                                    <SocialIcon key={platform} platform={platform} url={url as string} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Mobile Stats — duplicate of the desktop stats row above, shown only below lg;
                                    slightly more compact than the desktop version to match the rest of the header */}
                                {!profileUser.has_blocked_me && !isBlocked && (
                                    <div className="lg:hidden flex items-center justify-around bg-zinc-900/50 px-3 py-2 rounded-xl border border-zinc-800/50 backdrop-blur-sm mt-1 w-full">
                                        <button
                                            onClick={() => {
                                                if (!canViewContent) return;
                                                setFollowModalTab('followers');
                                                setIsFollowModalOpen(true);
                                            }}
                                            className={`text-center focus:outline-none group transition-all ${canViewContent ? 'hover:opacity-80' : 'cursor-default'}`}
                                        >
                                            <div className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">{followersCount}</div>
                                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('followers')}</div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!canViewContent) return;
                                                setFollowModalTab('following');
                                                setIsFollowModalOpen(true);
                                            }}
                                            className={`text-center focus:outline-none group transition-all ${canViewContent ? 'hover:opacity-80' : 'cursor-default'}`}
                                        >
                                            <div className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">{profileUser.following_count || 0}</div>
                                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('following')}</div>
                                        </button>
                                        <div className="text-center">
                                            <div className="text-base font-bold text-emerald-400">{profileUser.reviews_count || 0}</div>
                                            <div className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">{t('reviews')}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Mobile follow-request accept/decline — single line, right under the stats row */}
                                {hasRequestedMe && !profileUser.has_blocked_me && !isBlocked && (
                                    <div className="lg:hidden flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mt-2 w-full">
                                        <p className="text-xs text-zinc-300 truncate flex-1 min-w-0">{t('followRequestHeader')}</p>
                                        <button
                                            onClick={handleAcceptIncomingRequest}
                                            className="flex-shrink-0 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
                                        >
                                            {t('accept')}
                                        </button>
                                        <button
                                            onClick={handleDeclineIncomingRequest}
                                            className="flex-shrink-0 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg border border-zinc-700 transition-all cursor-pointer"
                                        >
                                            {t('decline')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pb-12">
                {hasRequestedMe && !profileUser.has_blocked_me && !isBlocked && (
                    <div className="hidden lg:flex mb-6 items-center justify-between gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
                                <UserPlus className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">{t('followRequestHeader')}</p>
                                <p className="text-xs text-zinc-400">{t('followRequestDesc').replace('{username}', profileUser.username)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                onClick={handleAcceptIncomingRequest}
                                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                            >
                                {t('accept')}
                            </button>
                            <button
                                onClick={handleDeclineIncomingRequest}
                                className="flex-1 sm:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl border border-zinc-700 transition-all cursor-pointer"
                            >
                                {t('decline')}
                            </button>
                        </div>
                    </div>
                )}
                {profileUser.has_blocked_me ? (
                    <div className="bg-zinc-900/50 border border-zinc-850 rounded-3xl p-12 text-center max-w-xl mx-auto my-12 backdrop-blur-sm animate-in fade-in duration-300">
                        <h2 className="text-2xl font-bold text-white mb-2">{t('userBlockedYou').replace('{username}', profileUser.username)}</h2>
                        <p className="text-zinc-400 text-sm">{t('userBlockedYouDesc').replace(/{username}/g, profileUser.username)}</p>
                    </div>
                ) : isBlocked ? (
                    <div className="bg-zinc-900/50 border border-zinc-850 rounded-3xl p-12 text-center max-w-xl mx-auto my-12 backdrop-blur-sm animate-in fade-in duration-300">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('youBlockedUser').replace('{username}', profileUser.username)}</h2>
                        <p className="text-zinc-400 text-sm mb-6">{t('youBlockedUserDesc')}</p>
                        <button
                            onClick={handleBlockToggle}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                        >
                            {t('unblock')}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Top 4 Showcase */}
                        {canViewContent && (
                            <div className="mb-8">
                                <div className="flex items-center gap-2 mb-4 text-zinc-400 text-sm font-bold uppercase tracking-wider">
                                    <Trophy className="h-4 w-4 text-amber-500" />
                                    <span>{t('allTimeFavorites')}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {topGames.map((game, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSlotClick(index)}
                                            disabled={!isOwnProfile}
                                            className={`relative group w-full aspect-[3/4] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 transition-all duration-500 ${isOwnProfile ? 'hover:border-zinc-600 hover:shadow-2xl hover:shadow-emerald-900/20 cursor-pointer' : 'cursor-default'} flex items-center justify-center ${!game ? 'border-dashed border-zinc-700' : ''}`}
                                        >
                                            {game ? (
                                                <>
                                                    <img
                                                        src={game.image}
                                                        alt={game.title}
                                                        className="w-full h-full object-cover rounded-md transition-transform duration-700 group-hover:scale-110"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                                                        <span className="text-white font-bold text-sm md:text-lg leading-tight transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                                            {game.title}
                                                        </span>
                                                    </div>
                                                    {isOwnProfile && (
                                                        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                            <div className="bg-black/60 p-1.5 rounded-full hover:bg-zinc-800 transition-colors">
                                                                <Pencil className="h-3.5 w-3.5 text-white" />
                                                            </div>
                                                            <div 
                                                                onClick={(e) => handleClearSlot(index, e)}
                                                                className="bg-black/60 p-1.5 rounded-full hover:bg-red-500/80 transition-colors"
                                                                title={t('clearSlot')}
                                                            >
                                                                <X className="h-3.5 w-3.5 text-white" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-zinc-600 group-hover:text-emerald-500 transition-colors">
                                                    {isOwnProfile ? (
                                                        <>
                                                            <Plus className="h-8 w-8" />
                                                            <span className="text-xs font-bold uppercase">{t('addGame')}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs font-bold uppercase text-zinc-700">{t('emptySlot')}</span>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mobile Currently Playing — compact chip, same height as the closed Game DNA
                            accordion below regardless of state, so the header rhythm stays consistent */}
                        {canViewContent && (
                            <div className="lg:hidden mb-3">
                                {isSteamStatusLoading ? (
                                    <div className="h-16 flex items-center gap-3 bg-zinc-900 rounded-2xl border border-zinc-800 px-4">
                                        <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
                                        <span className="text-xs text-zinc-500 font-semibold">{t('currentlyPlaying')}</span>
                                    </div>
                                ) : steamStatus && steamStatus.is_playing ? (
                                    <div className="h-16 flex items-center gap-3 bg-zinc-900 rounded-2xl border border-zinc-800 pl-4 pr-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                                        <p className="text-sm font-bold text-white truncate flex-1 min-w-0">
                                            {t('playing')} {steamStatus.game_title}
                                        </p>
                                        <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0">
                                            <img
                                                src={steamStatus.cover_image || "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop"}
                                                alt={steamStatus.game_title || "Game"}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-16 flex items-center gap-3 bg-zinc-900 rounded-2xl border border-dashed border-zinc-800 px-4 text-zinc-500">
                                        <Gamepad2 className="h-5 w-5 opacity-40 flex-shrink-0" />
                                        <span className="text-xs font-bold uppercase tracking-wider">{t('notPlaying')}</span>
                                        {isOwnProfile && !profileUser?.steam_id && (
                                            <Link href="/settings?tab=connected" className="text-[11px] text-emerald-500 hover:underline font-semibold ml-auto flex-shrink-0">
                                                {t('connectSteamAccount')}
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mobile Game DNA — collapsed accordion, single card/header (GameDNA's own
                            header is suppressed via showHeader=false so the list attaches directly
                            under this trigger instead of stacking a second "Game DNA" title) */}
                        {canViewContent && (
                            <div className="lg:hidden mb-6 bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                                <div className="w-full h-16 flex items-center justify-between px-4">
                                    <button
                                        onClick={() => setIsGameDnaExpanded(v => !v)}
                                        className="flex-1 h-full flex items-center gap-2 text-zinc-100 font-bold text-left"
                                    >
                                        <Dna className="h-5 w-5 text-emerald-500" />
                                        <span>Game DNA</span>
                                    </button>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Link
                                            href={`/${username}/games`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                            title="View Full Library"
                                        >
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                        <button
                                            onClick={() => setIsGameDnaExpanded(v => !v)}
                                            className="p-1.5"
                                        >
                                            <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isGameDnaExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                                <div
                                    style={{ maxHeight: gameDnaMaxHeight }}
                                    className="overflow-hidden transition-[max-height] duration-300 ease-out"
                                >
                                    <div ref={gameDnaContentRef} className="px-4 pb-4 pt-1 border-t border-zinc-800">
                                        <GameDNA stats={gameDNA} username={username} showHeader={false} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-12 gap-8">
                            {/* Left Column (Sticky) — desktop only; mobile gets its own compact
                                Bio/Currently-Playing/Game-DNA presentation near the header instead */}
                            <div className="hidden lg:block lg:col-span-4 space-y-6">

                                {/* Bio Card */}
                                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
                                    <p className="text-zinc-300 leading-relaxed mb-6 whitespace-pre-wrap">
                                        {displayUser.bio}
                                    </p>

                                    <div className="flex flex-col gap-3 text-sm text-zinc-400">
                                        {/* Ensure user.location exists AND is not just whitespace */}
                                        {displayUser.location && displayUser.location.trim().length > 0 && (
                                            <div className="flex items-center text-zinc-400 mt-2">
                                                <MapPin className="h-4 w-4 mr-2 shrink-0" />
                                                <span className="truncate">{displayUser.location}</span>
                                            </div>
                                        )}
                                        {displayUser.show_birth_date && displayUser.birth_date && (() => {
                                            const bDate = new Date(displayUser.birth_date);
                                            if (isNaN(bDate.getTime())) return null;
                                            const locale = language === 'Turkish' ? 'tr-TR' : 'en-US';
                                            return (
                                                <div className="flex items-center gap-3">
                                                    <Cake className="h-4 w-4 text-zinc-500" />
                                                    {t('born')} {bDate.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            );
                                        })()}
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-4 w-4 text-zinc-500" />
                                            {t('joined')} {displayUser.joined}
                                        </div>
                                    </div>

                                    {/* Social Links */}
                                    {Object.keys(displayUser.social_links).length > 0 && (
                                        <div className="flex gap-3 mt-6 pt-6 border-t border-zinc-800 flex-wrap">
                                            {Object.entries(displayUser.social_links).map(([platform, url]) => (
                                                <SocialIcon key={platform} platform={platform} url={url as string} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Currently Playing */}
                                {canViewContent && (
                                    <>
                                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2 text-zinc-100 font-bold">
                                                    <Gamepad2 className="h-5 w-5 text-emerald-500" />
                                                    <span>{t('currentlyPlaying')}</span>
                                                </div>
                                                {isOwnProfile && profileUser?.steam_id && (
                                                    <button
                                                        onClick={toggleSteamPrivacy}
                                                        disabled={isUpdatingPrivacy}
                                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all text-xs font-semibold cursor-pointer"
                                                        title={isSteamPrivate ? t('private') : t('public')}
                                                    >
                                                        {isSteamPrivate ? (
                                                            <>
                                                                <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
                                                                <span>{t('private')}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Eye className="h-3.5 w-3.5 text-emerald-500" />
                                                                <span>{t('public')}</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            {isSteamStatusLoading ? (
                                                <div className="aspect-video rounded-xl bg-zinc-950 border border-zinc-800/50 flex items-center justify-center">
                                                    <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                                </div>
                                            ) : steamStatus && steamStatus.is_playing ? (
                                                <div className="relative aspect-video rounded-xl overflow-hidden group">
                                                    <img
                                                        src={steamStatus.cover_image || "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop"}
                                                        alt={steamStatus.game_title || "Game"}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent flex flex-col justify-between p-3.5">
                                                        <div className="flex justify-end">
                                                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase tracking-wider animate-pulse">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                                                {t('inGame')}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-white text-sm md:text-base leading-snug drop-shadow-md">
                                                            {steamStatus.game_title}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="aspect-video rounded-xl bg-zinc-950 border border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-500 gap-2">
                                                    <Gamepad2 className="h-8 w-8 opacity-40 text-zinc-500" />
                                                    <span className="text-xs font-bold uppercase tracking-wider">{t('notPlaying')}</span>
                                                    {isOwnProfile && !profileUser?.steam_id && (
                                                        <Link href="/settings?tab=connected" className="text-[11px] text-emerald-500 hover:underline font-semibold mt-1">
                                                            {t('connectSteamAccount')}
                                                        </Link>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Game DNA */}
                                        <GameDNA stats={gameDNA} username={username} />
                                    </>
                                )}

                            </div>

                            {/* Right Column (Content) */}
                            <div className="col-span-12 lg:col-span-8">

                                {canViewContent ? (
                                    <>
                                        <div className="flex gap-6 border-b border-zinc-800 mb-6 overflow-x-auto no-scrollbar">
                                            {['Activity', 'Reviews', 'Replies', 'Opinions', 'Portfolio'].map((tab) => {
                                                const tabKey = `tab${tab}` as any;
                                                return (
                                                    <button
                                                        key={tab}
                                                        onClick={() => setActiveTab(tab.toLowerCase())}
                                                        className={`pb-4 text-lg font-bold transition-all relative whitespace-nowrap ${activeTab === tab.toLowerCase()
                                                            ? 'text-white'
                                                            : 'text-zinc-500 hover:text-zinc-300'
                                                            }`}
                                                    >
                                                        {t(tabKey)}
                                                        {activeTab === tab.toLowerCase() && (
                                                            <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Tab Content */}
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {activeTab === 'activity' && (
                                                isPostsLoading ? (
                                                    <div className="flex justify-center py-12">
                                                        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                                    </div>
                                                ) : (
                                                    (() => {
                                                        // Strict Activity Filter: NO parents allowed (no replies)
                                                        const activityItems = userPosts.filter((p: any) =>
                                                            !p.parent && !p.review_parent
                                                        );
                                                        return activityItems.length > 0 ? (
                                                            <Feed initialItems={activityItems} />
                                                        ) : (
                                                            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                                                                {t('noActivityYet')}
                                                            </div>
                                                        );
                                                    })()
                                                )
                                            )}

                                            {activeTab === 'reviews' && (
                                                isPostsLoading ? (
                                                    <div className="flex justify-center py-12">
                                                        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                                    </div>
                                                ) : (
                                                    (() => {
                                                        const reviews = userPosts.filter((p: any) => p.type === 'review' && !p.parent && !p.review_parent);
                                                        return reviews.length > 0 ? (
                                                            <Feed initialItems={reviews} />
                                                        ) : (
                                                            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                                                                {t('noReviewsYet')}
                                                            </div>
                                                        );
                                                    })()
                                                )
                                            )}

                                            {activeTab === 'replies' && (
                                                (() => {
                                                    // Local Context Replies (for immediate feedback)
                                                    const contextReplies = feedItems.filter(item => {
                                                        if (!('user' in item)) return false;
                                                        return item.user.username === username && ((item as any).parent || (item as any).review_parent || item.type === 'reply');
                                                    });

                                                    // In a real app, we might also want to filter `userPosts` for replies if the API returns them
                                                    // But since `userPosts` usually fetches root posts, let's assume we rely on context
                                                    // OR if we start fetching replies in userPosts, we merge:
                                                    const fetchedReplies = userPosts.filter((p: any) => p.parent || p.review_parent);

                                                    // Merege unique by ID
                                                    const allRepliesMap = new Map();
                                                    [...fetchedReplies, ...contextReplies].forEach(item => allRepliesMap.set(item.id, item));
                                                    const allReplies = Array.from(allRepliesMap.values()).sort((a: any, b: any) =>
                                                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                                                    );

                                                    return allReplies.length > 0 ? (
                                                        <Feed initialItems={allReplies} />
                                                    ) : (
                                                        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                                                            {t('noRepliesYetProfile')}
                                                        </div>
                                                    );
                                                })()
                                            )}

                                            {activeTab === 'opinions' && (
                                                (() => {
                                                    const opinions = userPosts.filter((p: any) => p.news_parent || p.news_details);
                                                    return opinions.length > 0 ? (
                                                        <Feed initialItems={opinions} />
                                                    ) : (
                                                        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                                                            {t('noOpinionsYet')}
                                                        </div>
                                                    );
                                                })()
                                            )}

                                            {activeTab !== 'activity' && activeTab !== 'reviews' && activeTab !== 'replies' && activeTab !== 'opinions' && (
                                                <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                                                    {t('contentComingSoon').replace('{tab}', activeTab.charAt(0).toUpperCase() + activeTab.slice(1))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="animate-in fade-in duration-300">
                                        {/* Integrated Private Profile Banner */}
                                        <div className="flex flex-col items-center py-16 px-8 border border-zinc-800/60 rounded-2xl bg-zinc-900/20 text-center gap-5">
                                            {/* Lock Badge */}
                                            <div className="relative">
                                                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-zinc-700/70 bg-zinc-800">
                                                    <img
                                                        src={displayUser.avatar}
                                                        alt={profileUser.username}
                                                        className="w-full h-full object-cover opacity-60"
                                                    />
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center">
                                                    <Lock className="h-3.5 w-3.5 text-zinc-400" />
                                                </div>
                                            </div>

                                            {/* Message */}
                                            <div>
                                                <h2 className="text-lg font-bold text-white mb-1.5">{t('accountPrivateHeader')}</h2>
                                                <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                                                    {isRequested
                                                        ? t('followRequestPending').replace('{username}', profileUser.username)
                                                        : t('followPrivateDesc').replace('{username}', profileUser.username)
                                                    }
                                                </p>
                                            </div>

                                            {/* Follow / Requested Button */}
                                            {!isOwnProfile && currentUser && (
                                                <button
                                                    onClick={handleFollowToggle}
                                                    className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                                                        isRequested
                                                            ? 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300'
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/30'
                                                    }`}
                                                >
                                                    {isRequested ? (
                                                        <><Clock className="h-4 w-4" /> {t('requested')}</>
                                                    ) : (
                                                        <><UserPlus className="h-4 w-4" /> {t('follow')}</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </>
                )}
            </main>

            <GameSearchModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelectGame={handleSelectGame}
            />

            <FollowersFollowingModal
                isOpen={isFollowModalOpen}
                onClose={() => setIsFollowModalOpen(false)}
                username={username}
                initialTab={followModalTab}
                onCountChange={refreshProfileCounts}
            />

            {
                profileUser && (
                    <EditProfileModal
                        isOpen={isEditProfileOpen}
                        onClose={() => setIsEditProfileOpen(false)}
                        user={profileUser as any}
                        onUpdate={handleProfileUpdate}
                    />
                )
            }
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={confirmModalConfig.onConfirm}
                title={confirmModalConfig.title}
                message={confirmModalConfig.message}
                isDanger={!isBlocked}
                confirmText={isBlocked ? 'Unblock' : 'Block'}
            />

            {/* Twitter-style full-size avatar/cover viewer */}
            <ImageModal
                isOpen={!!viewerImage}
                onClose={() => setViewerImage(null)}
                images={viewerImage ? [viewerImage] : []}
            />
        </div >
    );
}
