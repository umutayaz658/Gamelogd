// Hand-ported from frontend/src/types/index.ts + frontend/src/context/AuthContext.tsx's
// User interface (merged into one — see the master plan's note on type/token
// duplication: no shared package exists between frontend/ and mobile/, so this needs to
// be kept in sync by hand if the backend serializer ever changes shape). Only the fields
// actually used by Phase 1 screens are included; extend as later phases need more.
export interface User {
    id: number;
    username: string;
    email?: string;
    avatar?: string | null;
    bio?: string;
    role?: string;
    is_gamer?: boolean;
    is_developer?: boolean;
    is_investor?: boolean;
    interests?: string[];
    top_favorites?: TopFavoriteSlot[];
    real_name?: string;
    location?: string;
    birth_date?: string;
    show_birth_date?: boolean;
    cover_image?: string;
    social_links?: Record<string, string>;
    date_joined?: string;
    gender?: string;
    steam_id?: string;
    xbox_gamertag?: string | null;
    dnd_mode?: boolean;
    settings?: { privateProfile?: boolean; steamStatusPrivate?: boolean };
    phone_number?: string;
    followers_count?: number;
    following_count?: number;
    reviews_count?: number;
    is_following?: boolean;
    is_requested?: boolean;
    has_requested_me?: boolean;
    is_blocked?: boolean;
    has_blocked_me?: boolean;
    is_muted?: boolean;
}

export interface TopFavoriteSlot {
    slot: number;
    game_id: number;
    title: string;
    cover: string;
}

export interface Game {
    id: number;
    title: string;
    cover_image?: string;
    release_date?: string;
    genres?: string[];
}

export interface GameDetail extends Game {
    summary?: string;
    description?: string;
    developer?: string;
    publisher?: string;
    screenshots?: string[];
    platforms?: string[];
    igdb_url?: string;
    average_rating?: number;
    review_count?: number;
    log_count?: number;
    metacritic_score?: number | null;
    hltb_main?: number | null;
    hltb_main_extra?: number | null;
    hltb_completionist?: number | null;
}

export interface LibraryEntry {
    id: number;
    game: Game;
    playtime_forever: number;
    playtime_hours: number;
    platform: string;
    status: string;
    added_at: string;
}

export interface AuthorDetails {
    type: 'user' | 'organisation' | 'project';
    name: string;
    slug: string | number;
    avatar: string | null;
    is_verified?: boolean;
}

export interface PostMedia {
    id: number;
    file: string;
    media_type: 'image' | 'video';
    order: number;
}

export interface Post {
    id: number;
    user: User;
    title?: string;
    content: string;
    image?: string | null;
    media_file?: string | null;
    media_type?: 'image' | 'video' | null;
    gif_url?: string | null;
    poll_options?: string[] | null;
    poll_expires_at?: string | null;
    poll_results?: {
        counts: number[];
        total_votes: number;
        user_choice: number | null;
        is_closed: boolean;
        expires_at: string | null;
    } | null;
    timestamp: string;
    author_identity?: 'user' | 'organisation' | 'project';
    author_details?: AuthorDetails;
    likes_count?: number;
    replies_count?: number;
    parent?: number | null;
    review_parent?: number | null;
    news_parent?: number | null;
    project_parent?: number | null;
    news_details?: {
        id: number;
        title: string;
        image_url: string | null;
        source_name: string;
        source_icon: string | null;
    };
    reply_to_username?: string | null;
    is_liked?: boolean;
    is_bookmarked?: boolean;
    bookmarks_count?: number;
    type?: 'post' | 'reply' | 'news';
    media?: PostMedia[];
    repost_parent?: number | null;
    repost_details?: Post | null;
    repost_parent_review?: number | null;
    repost_review_details?: Review | null;
    reposts_count?: number;
    is_reposted?: boolean;
    category?: string;
}

export interface Review {
    id: number;
    user: User;
    game: Game;
    rating: number;
    content: string;
    is_liked: boolean;
    likes_count?: number;
    is_bookmarked?: boolean;
    bookmarks_count?: number;
    is_completed: boolean;
    contains_spoilers: boolean;
    playthrough_number?: number;
    platforms?: string[];
    playtime_hours?: number | null;
    timestamp: string;
    type?: 'review';
    replies_count?: number;
    reposts_count?: number;
}

export interface News {
    id: number;
    title: string;
    link: string;
    image_url: string | null;
    description: string;
    pub_date: string;
    category: string;
    source_name: string;
    source_icon: string | null;
    type?: 'news';
}

export type FeedItem = Post | Review | News;
