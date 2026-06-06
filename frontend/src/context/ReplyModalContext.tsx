'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FeedItem } from '@/types';

interface ReplyModalContextType {
    isOpen: boolean;
    activeItem: FeedItem | null;
    mode: 'reply' | 'quote';
    openReplyModal: (item: FeedItem) => void;
    openQuoteModal: (item: FeedItem) => void;
    closeReplyModal: () => void;
}

const ReplyModalContext = createContext<ReplyModalContextType | undefined>(undefined);

export function ReplyModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeItem, setActiveItem] = useState<FeedItem | null>(null);
    const [mode, setMode] = useState<'reply' | 'quote'>('reply');

    const openReplyModal = (item: FeedItem) => {
        setMode('reply');
        setActiveItem(item);
        setIsOpen(true);
    };

    const openQuoteModal = (item: FeedItem) => {
        setMode('quote');
        setActiveItem(item);
        setIsOpen(true);
    };

    const closeReplyModal = () => {
        setIsOpen(false);
        setActiveItem(null);
    };

    return (
        <ReplyModalContext.Provider value={{ isOpen, activeItem, mode, openReplyModal, openQuoteModal, closeReplyModal }}>
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
