'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Post } from '@/types';

interface FeedContextType {
    posts: Post[];
    setPosts: (posts: Post[]) => void;
    addFeedItem: (post: Post) => void;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: ReactNode }) {
    const [posts, setPosts] = useState<Post[]>([]);

    const addFeedItem = (post: Post) => {
        setPosts((prevPosts) => [post, ...prevPosts]);
    };

    return (
        <FeedContext.Provider value={{ posts, setPosts, addFeedItem }}>
            {children}
        </FeedContext.Provider>
    );
}

export function useFeed() {
    const context = useContext(FeedContext);
    if (context === undefined) {
        throw new Error('useFeed must be used within a FeedProvider');
    }
    return context;
}
