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
}

export interface Game {
    id: number;
    title: string;
    cover_image?: string;
    release_date?: string;
    igdb_id?: number;
}

export interface Review {
    id: number;
    user: User;
    game: Game;
    rating: number;
    content: string;
    is_liked: boolean;
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
    created_at: string;
}

export interface JobPosting {
    id: number;
    recruiter: User;
    project: Project | null;
    title: string;
    description: string;
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
    type?: 'post' | 'reply' | 'news';
    media?: {
        id: number;
        file: string;
        media_type: 'image' | 'video';
        order: number;
    }[];
}

export interface Reply extends Post {
    type: 'reply';
    parentId: number;
    replyToUsername: string;
}

export type FeedItem = Post | Review | Reply;

export interface Notification {
    id: number;
    actor: User;
    verb: string;
    target_type?: string;
    target_id?: number;
    is_read: boolean;
    created_at: string;
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
}

export interface Message {
    id: number;
    conversation: number;
    sender: User;
    content: string;
    is_read: boolean;
    created_at: string;
    is_me: boolean;
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
