export interface Post {
    id: number;
    user: {
        username: string;
        avatar: string | null;
    };
    content: string;
    image: string | null;
    media_file: string | null;
    media_type: 'image' | 'video' | null;
    gif_url: string | null;
    poll_options?: string[];
    timestamp: string;
    likes?: number;
    comments?: number;
}
