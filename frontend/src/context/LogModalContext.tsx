'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LogModalContextType {
    isLogModalOpen: boolean;
    initialGame?: any;
    existingReview?: any;
    openLogModal: (game?: any, review?: any) => void;
    closeLogModal: () => void;
}

const LogModalContext = createContext<LogModalContextType | undefined>(undefined);

export function LogModalProvider({ children }: { children: ReactNode }) {
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [initialGame, setInitialGame] = useState<any>(null);
    const [existingReview, setExistingReview] = useState<any>(null);

    const openLogModal = (game?: any, review?: any) => {
        setInitialGame(game || null);
        setExistingReview(review || null);
        setIsLogModalOpen(true);
    };
    const closeLogModal = () => {
        setIsLogModalOpen(false);
        setExistingReview(null);
    };

    return (
        <LogModalContext.Provider value={{ isLogModalOpen, initialGame, existingReview, openLogModal, closeLogModal }}>
            {children}
        </LogModalContext.Provider>
    );
}

export function useLogModal() {
    const context = useContext(LogModalContext);
    if (context === undefined) {
        throw new Error('useLogModal must be used within a LogModalProvider');
    }
    return context;
}
