'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LogModalContextType {
    isLogModalOpen: boolean;
    initialGame?: any;
    existingReview?: any;
    isReplay?: boolean;
    openLogModal: (game?: any, review?: any, replay?: boolean) => void;
    closeLogModal: () => void;
}

const LogModalContext = createContext<LogModalContextType | undefined>(undefined);

export function LogModalProvider({ children }: { children: ReactNode }) {
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [initialGame, setInitialGame] = useState<any>(null);
    const [existingReview, setExistingReview] = useState<any>(null);
    const [isReplay, setIsReplay] = useState(false);


        const openLogModal = (game?: any, review?: any, replay?: boolean) => {
        const isValidGame = game && typeof game.id === 'number' && typeof game.title === 'string';
        setInitialGame(isValidGame ? game : null);
        setExistingReview(replay ? null : (review || null));
        setIsReplay(replay || false);
        setIsLogModalOpen(true);
    };
    const closeLogModal = () => {
        setIsLogModalOpen(false);
        setExistingReview(null);
        setInitialGame(null);
        setIsReplay(false);
    };

    return (
        <LogModalContext.Provider value={{ isLogModalOpen, initialGame, existingReview, isReplay, openLogModal, closeLogModal }}>
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
