'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Post, FeedItem } from '@/types';

interface FeedContextType {
    items: FeedItem[];
    setItems: (items: FeedItem[]) => void;
    addFeedItem: (item: FeedItem) => void;
    removeFeedItem: (id: number) => void;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<FeedItem[]>([]);

    const addFeedItem = useCallback((item: FeedItem) => {
        setItems((prevItems) => [item, ...prevItems]);
    }, []);

    const removeFeedItem = useCallback((id: number) => {
        setItems((prevItems) => prevItems.filter(item => item.id !== id));
    }, []);

    return (
        <FeedContext.Provider value={{ items, setItems, addFeedItem, removeFeedItem }}>
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

