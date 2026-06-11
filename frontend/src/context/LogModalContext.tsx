'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LogModalContextType {
    isLogModalOpen: boolean;
    initialGame?: any;
    openLogModal: (game?: any) => void;
    closeLogModal: () => void;
}

const LogModalContext = createContext<LogModalContextType | undefined>(undefined);

export function LogModalProvider({ children }: { children: ReactNode }) {
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [initialGame, setInitialGame] = useState<any>(null);

    const openLogModal = (game?: any) => {
        const isValidGame = game && typeof game.id === 'number' && typeof game.title === 'string';
        setInitialGame(isValidGame ? game : null);
        setIsLogModalOpen(true);
    };
    const closeLogModal = () => {
        setIsLogModalOpen(false);
        setInitialGame(null);
    };

    return (
        <LogModalContext.Provider value={{ isLogModalOpen, initialGame, openLogModal, closeLogModal }}>
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
