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
}

export interface Game {
    id: number;
    title: string;
    cover_image?: string;
    release_date?: string;
    igdb_id?: number;
}

export interface Post {
    id: number;
    user: User;
    content: string;
    image?: string | null;
    media_file?: string | null;
    media_type?: 'image' | 'video' | null;
    gif_url?: string | null;
    poll_options?: string[] | null;
    timestamp: string;
    likes?: number;
    comments?: number;
    is_liked?: boolean;
}

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
