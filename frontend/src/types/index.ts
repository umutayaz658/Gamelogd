export interface User {
    id: number;
    username: string;
    email?: string;
    avatar?: string;
    cover_image?: string;
    bio?: string;
    real_name?: string;
    location?: string;
    role?: 'gamer' | 'dev' | 'investor';
    is_following?: boolean;
    followers_count?: number;
    following_count?: number;
    date_joined?: string;
    birth_date?: string;
    show_birth_date?: boolean;
    dnd_mode?: boolean;
    steam_id?: string;
    settings?: any;
    phone_number?: string;
    gender?: string;
    is_gamer?: boolean;
    is_developer?: boolean;
    is_investor?: boolean;
}

export interface Game {
    id: number;
    title: string;
    cover_image?: string;
    release_date?: string;
    igdb_id?: number;
    steam_appid?: number;
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
}

export interface Review {
    id: number;
    user: User;
    game: Game;
    rating: number;
    content: string;
    is_liked: boolean;
    is_liked_by_user?: boolean;
    likes_count?: number;
    is_bookmarked?: boolean;
    bookmarks_count?: number;
    is_completed: boolean;
    contains_spoilers: boolean;
    timestamp: string;
    type?: 'review';
}

export interface Project {
    id: number;
    owner: User;
    title: string;
    description: string;
    cover_image: string | null;
    tech_stack: string[];
    status: 'in_dev' | 'alpha' | 'beta' | 'released';
    members?: ProjectMember[];
    followers_count?: number;
    is_following?: boolean;
    created_at: string;
}

export interface ProjectMember {
    id: number;
    user: User;
    role: 'participant' | 'editor' | 'admin';
    status: 'pending' | 'active';
    created_at: string;
}

export interface JobPosting {
    id: number;
    recruiter: User;
    project: Project | null;
    title: string;
    description: string;
    post_type: 'job' | 'talent';
    tech_stack: string[];
    job_type: 'full_time' | 'part_time' | 'contract' | 'rev_share' | 'hobby';
    location_type: 'remote' | 'on_site' | 'hybrid';
    experience_level: 'junior' | 'mid' | 'senior' | 'lead';
    is_active: boolean;
    created_at: string;
}

export interface Post {
    id: number;
    user: User;
    title?: string; // For devlogs
    content: string;
    image?: string | null;
    media_file?: string | null;
    media_type?: 'image' | 'video' | null;
    gif_url?: string | null;
    poll_options?: string[] | null;
    timestamp: string;
    likes?: number;
    likes_count?: number;
    comments?: number;
    replies_count?: number;
    parent?: number | null;
    review_parent?: number | null;
    news_parent?: number | null;
    project_parent?: number | null;
    parent_details?: Post | Review;
    news_details?: {
        id: number;
        title: string;
        image_url: string | null;
        source_name: string;
        source_icon: string | null;
    };
    project_details?: {
        id: number;
        title: string;
        cover_image: string | null;
    };
    reply_to_username?: string | null;
    is_liked?: boolean;
    is_bookmarked?: boolean;
    bookmarks_count?: number;
    type?: 'post' | 'reply' | 'news';
    media?: {
        id: number;
        file: string;
        media_type: 'image' | 'video';
        order: number;
    }[];
    repost_parent?: number | null;
    repost_details?: Post | null;
    reposts_count?: number;
    is_reposted?: boolean;
}

export interface Reply extends Post {
    type: 'reply';
    parentId: number;
    replyToUsername: string;
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

export type FeedItem = Post | Review | Reply | News;

export interface Notification {
    id: number;
    actor: User;
    verb: string;
    target_type?: string;
    target_id?: number;
    is_read: boolean;
    created_at: string;
}

export interface ConversationMember {
    id: number;
    user: User;
    is_admin: boolean;
    is_muted: boolean;
    joined_at: string;
}

export interface Conversation {
    id: number;
    participants: number[];
    other_user?: User;
    last_message?: {
        content: string;
        created_at: string;
        sender_username: string;
    };
    unread_count: number;
    updated_at: string;
    is_group: boolean;
    name?: string | null;
    avatar?: string | null;
    memberships?: ConversationMember[];
}

export interface Message {
    id: number;
    conversation: number;
    sender: User;
    content: string;
    is_read: boolean;
    created_at: string;
    is_me: boolean;
    image?: string | null;
    gif_url?: string | null;
    shared_post?: number | null;
    shared_review?: number | null;
    shared_news?: number | null;
    shared_post_details?: Post | null;
    shared_review_details?: Review | null;
    shared_news_details?: {
        id: number;
        title: string;
        image_url: string | null;
        source_name: string;
        source_icon: string | null;
    } | null;
}

export interface Pitch {
    id: number;
    user: User;
    title: string;
    description: string;
    genre: 'rpg' | 'fps' | 'strategy' | 'simulation' | 'adventure' | 'platformer' | 'puzzle' | 'other';
    platform: 'pc' | 'console' | 'mobile' | 'vr_ar' | 'web' | 'multi';
    funding_goal: string;
    stage: 'concept' | 'prototype' | 'vertical_slice' | 'production' | 'alpha' | 'beta' | 'early_access';
    image?: string | null;
    pitch_deck_url?: string;
    created_at: string;
}

export interface InvestorCall {
    id: number;
    user: User;
    organization_name: string;
    investor_type: 'vc' | 'publisher' | 'angel' | 'grant' | 'accelerator';
    looking_for: string;
    ticket_size: string;
    deadline?: string;
    is_active: boolean;
    created_at: string;
}
