'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PostModalContextType {
    isOpen: boolean;
    openPostModal: () => void;
    closePostModal: () => void;
}

const PostModalContext = createContext<PostModalContextType | undefined>(undefined);

export function PostModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    const openPostModal = () => setIsOpen(true);
    const closePostModal = () => setIsOpen(false);

    return (
        <PostModalContext.Provider value={{ isOpen, openPostModal, closePostModal }}>
            {children}
        </PostModalContext.Provider>
    );
}

export function usePostModal() {
    const context = useContext(PostModalContext);
    if (context === undefined) {
        throw new Error('usePostModal must be used within a PostModalProvider');
    }
    return context;
}
