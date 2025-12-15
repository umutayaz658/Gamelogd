'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Navbar from "@/components/Navbar";
import GameDNA from "@/components/Profile/GameDNA";
import Feed from "@/components/Feed";
import GameSearchModal from "@/components/GameSearchModal";
import { getImageUrl } from "@/lib/utils";
import api from "@/lib/api";
import { MapPin, Link as LinkIcon, Calendar, Gamepad2, Twitter, Github, Pencil, UserPlus, Trophy, Plus, Loader2, Cake } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";

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
}

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = use(params);
    const { user: currentUser } = useAuth();
    const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('activity');

    // Top 4 State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
    const [topGames, setTopGames] = useState<(Game | null)[]>([null, null, null, null]);
    const [userPosts, setUserPosts] = useState([]);
    const [isPostsLoading, setIsPostsLoading] = useState(true);

    const isOwnProfile = currentUser?.username === username;

    // Fetch Profile Data
    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                const res = await api.get(`/users/${username}/`);
                setProfileUser(res.data);
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

    // Fetch User Posts
    useEffect(() => {
        if (username) {
            const fetchUserPosts = async () => {
                setIsPostsLoading(true);
                try {
                    const res = await api.get(`/posts/?username=${username}`);
                    setUserPosts(res.data);
                } catch (err) {
                    console.error("Failed to fetch user posts:", err);
                } finally {
                    setIsPostsLoading(false);
                }
            };
            fetchUserPosts();
        }
    }, [username]);

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
            alert("Failed to save changes. Please try again.");
        }
    };

    // Helper for Social Icons
    const SocialIcon = ({ platform, url }: { platform: string, url: string }) => {
        if (!url) return null;

        let Icon = LinkIcon;
        if (platform === 'twitter') Icon = Twitter;
        if (platform === 'github') Icon = Github;
        if (platform === 'linkedin') Icon = LinkIcon;
        if (platform === 'steam') Icon = Gamepad2;
        if (platform === 'facebook') Icon = LinkIcon;
        if (platform === 'instagram') Icon = LinkIcon;

        return (
            <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors">
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
        cover: profileUser.cover_image || "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop",
        bio: profileUser.bio || "No bio yet.",
        location: profileUser.location || "Unknown Location",
        joined: profileUser.date_joined ? new Date(profileUser.date_joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "Recently",
        birth_date: profileUser.birth_date,
        show_birth_date: profileUser.show_birth_date,
        stats: {
            followers: 0,
            following: 0,
            gamesPlayed: 0
        },
        social_links: profileUser.social_links || {}
    };

    // Game DNA Logic
    let gameDNA = [
        { genre: "RPG", percentage: 60, color: "bg-emerald-500" },
        { genre: "Platformer", percentage: 25, color: "bg-blue-500" },
        { genre: "Strategy", percentage: 15, color: "bg-purple-500" }
    ];

    if (profileUser.interests && profileUser.interests.length > 0) {
        const share = Math.floor(100 / profileUser.interests.length);
        const colors = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-rose-500"];

        gameDNA = profileUser.interests.map((interest: string, index: number) => ({
            genre: interest,
            percentage: share,
            color: colors[index % colors.length]
        }));
    }

    // Mock Currently Playing
    const currentlyPlaying = {
        title: "Baldur's Gate 3",
        image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=2070&auto=format&fit=crop",
        progress: 45
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            {/* Hero Section */}
            <div className="relative mb-20">
                {/* Cover Image */}
                <div className="h-60 md:h-80 w-full overflow-hidden">
                    <img
                        src={displayUser.cover}
                        alt="Cover"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                </div>

                <div className="container mx-auto px-4">
                    <div className="relative -mt-20 flex flex-col md:flex-row items-end gap-6">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-zinc-950 overflow-hidden bg-zinc-900">
                                <img
                                    src={displayUser.avatar}
                                    alt={displayUser.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="absolute bottom-2 right-2 h-6 w-6 bg-emerald-500 rounded-full border-4 border-zinc-950" />
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1 mb-2 w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-4">
                                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                            {displayUser.name}
                                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-lg border border-emerald-500/20 uppercase tracking-wide">
                                                {displayUser.role}
                                            </span>
                                        </h1>
                                        {isOwnProfile ? (
                                            <Link
                                                href="/profile/edit"
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all text-sm font-medium"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                <span>Edit Profile</span>
                                            </Link>
                                        ) : (
                                            <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all text-sm font-bold shadow-lg shadow-emerald-900/20">
                                                <UserPlus className="h-4 w-4" />
                                                <span>Follow</span>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-zinc-400 font-medium mt-1">{displayUser.handle}</p>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-6 md:gap-8 bg-zinc-900/50 px-6 py-3 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
                                    <div className="text-center">
                                        <div className="text-xl font-bold text-white">{displayUser.stats.followers}</div>
                                        <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Followers</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xl font-bold text-white">{displayUser.stats.following}</div>
                                        <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Following</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xl font-bold text-emerald-400">{displayUser.stats.gamesPlayed}</div>
                                        <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Games</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 pb-12">

                {/* Top 4 Showcase */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4 text-zinc-400 text-sm font-bold uppercase tracking-wider">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <span>All-Time Favorites</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
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
                                            <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Pencil className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-zinc-600 group-hover:text-emerald-500 transition-colors">
                                        {isOwnProfile ? (
                                            <>
                                                <Plus className="h-8 w-8" />
                                                <span className="text-xs font-bold uppercase">Add Game</span>
                                            </>
                                        ) : (
                                            <span className="text-xs font-bold uppercase text-zinc-700">Empty Slot</span>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-8">
                    {/* Left Column (Sticky) */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">

                        {/* Bio Card */}
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
                            <p className="text-zinc-300 leading-relaxed mb-6 whitespace-pre-wrap">
                                {displayUser.bio}
                            </p>

                            <div className="flex flex-col gap-3 text-sm text-zinc-400">
                                {displayUser.location && (
                                    <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-zinc-500" />
                                        {displayUser.location}
                                    </div>
                                )}
                                {displayUser.show_birth_date && displayUser.birth_date && (
                                    <div className="flex items-center gap-3">
                                        <Cake className="h-4 w-4 text-zinc-500" />
                                        Born {new Date(displayUser.birth_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-zinc-500" />
                                    Joined {displayUser.joined}
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
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
                            <div className="flex items-center gap-2 mb-4 text-zinc-100 font-bold">
                                <Gamepad2 className="h-5 w-5 text-emerald-500" />
                                <span>Currently Playing</span>
                            </div>

                            {currentlyPlaying ? (
                                <>
                                    <div className="relative aspect-video rounded-xl overflow-hidden mb-3 group cursor-pointer">
                                        <img
                                            src={getImageUrl(currentlyPlaying.image)}
                                            alt={currentlyPlaying.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                                            <span className="font-bold text-white">{currentlyPlaying.title}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs font-bold text-zinc-400">
                                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-[45%] rounded-full" style={{ width: `${currentlyPlaying.progress}%` }} />
                                        </div>
                                        <span>{currentlyPlaying.progress}%</span>
                                    </div>
                                </>
                            ) : (
                                <div className="aspect-video rounded-xl bg-zinc-950 border border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600 gap-2">
                                    <Gamepad2 className="h-8 w-8 opacity-50" />
                                    <span className="text-xs font-bold uppercase">Not Playing</span>
                                </div>
                            )}
                        </div>

                        {/* Game DNA */}
                        <GameDNA stats={gameDNA} />

                    </div>

                    {/* Right Column (Content) */}
                    <div className="col-span-12 lg:col-span-8">

                        {/* Tabs */}
                        <div className="flex gap-6 border-b border-zinc-800 mb-6 overflow-x-auto">
                            {['Activity', 'Reviews', 'Diary', 'Portfolio'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab.toLowerCase())}
                                    className={`pb-4 text-lg font-bold transition-all relative whitespace-nowrap ${activeTab === tab.toLowerCase()
                                        ? 'text-white'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    {tab}
                                    {activeTab === tab.toLowerCase() && (
                                        <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'activity' && (
                                isPostsLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                    </div>
                                ) : userPosts.length > 0 ? (
                                    <Feed initialPosts={userPosts} />
                                ) : (
                                    <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                                        No activity yet.
                                    </div>
                                )
                            )}
                            {activeTab !== 'activity' && (
                                <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                                    <span className="capitalize">{activeTab}</span> content coming soon...
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            <GameSearchModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelectGame={handleSelectGame}
            />
        </div>
    );
}
