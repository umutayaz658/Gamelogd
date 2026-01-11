'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LogModalContextType {
    isLogModalOpen: boolean;
    openLogModal: () => void;
    closeLogModal: () => void;
}

const LogModalContext = createContext<LogModalContextType | undefined>(undefined);

export function LogModalProvider({ children }: { children: ReactNode }) {
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);

    const openLogModal = () => setIsLogModalOpen(true);
    const closeLogModal = () => setIsLogModalOpen(false);

    return (
        <LogModalContext.Provider value={{ isLogModalOpen, openLogModal, closeLogModal }}>
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
