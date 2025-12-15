"use client";

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Post } from '@/types';
import PostCard from '@/components/PostCard';
import PostComposer from '@/components/PostComposer';

interface FeedProps {
    initialPosts?: Post[];
}

export default function Feed({ initialPosts = [] }: FeedProps) {
    const [posts, setPosts] = useState<Post[]>(initialPosts);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Posts - Fixed useEffect
    useEffect(() => {
        let isMounted = true;

        const fetchPosts = async () => {
            // If initialPosts are provided, we might not need to fetch immediately, 
            // but usually a feed refreshes on mount. 
            // If we want to rely ONLY on initialPosts if present:
            if (initialPosts.length > 0) {
                setPosts(initialPosts);
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const response = await api.get('/posts/');
                if (isMounted) {
                    setPosts(response.data);
                }
            } catch (err) {
                console.error('Failed to fetch posts:', err);
                if (isMounted) {
                    setError('Failed to load posts.');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchPosts();

        return () => {
            isMounted = false;
        };
    }, []); // Empty dependency array to run once

    const handlePostCreated = (newPost: Post) => {
        setPosts([newPost, ...posts]);
    };

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Create Post Section */}
            <PostComposer onPostCreated={handlePostCreated} />

            {/* Feed List */}
            {isLoading && posts.length === 0 ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                </div>
            ) : error ? (
                <div className="text-center py-10 text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
                    {error}
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">
                    No posts yet. Be the first to share something!
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))}
                </div>
            )}
        </div>
    );
}
