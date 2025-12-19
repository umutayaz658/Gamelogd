'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FeedItem } from '@/types';

interface ReplyModalContextType {
    isOpen: boolean;
    activeItem: FeedItem | null;
    openReplyModal: (item: FeedItem) => void;
    closeReplyModal: () => void;
}

const ReplyModalContext = createContext<ReplyModalContextType | undefined>(undefined);

export function ReplyModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeItem, setActiveItem] = useState<FeedItem | null>(null);

    const openReplyModal = (item: FeedItem) => {
        setActiveItem(item);
        setIsOpen(true);
    };

    const closeReplyModal = () => {
        setIsOpen(false);
        setActiveItem(null);
    };

    return (
        <ReplyModalContext.Provider value={{ isOpen, activeItem, openReplyModal, closeReplyModal }}>
            {children}
        </ReplyModalContext.Provider>
    );
}

export function useReplyModal() {
    const context = useContext(ReplyModalContext);
    if (context === undefined) {
        throw new Error('useReplyModal must be used within a ReplyModalProvider');
    }
    return context;
}
