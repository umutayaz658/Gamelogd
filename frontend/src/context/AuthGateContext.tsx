'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export type AuthGateAction =
    | 'like' | 'bookmark' | 'repost' | 'vote' | 'follow' | 'message'
    | 'reply' | 'post' | 'logGame' | 'generic';

interface AuthGateContextType {
    isOpen: boolean;
    action: AuthGateAction;
    // Returns true (and opens the modal) when the visitor is anonymous — callers should
    // `return` immediately when this is true, mirroring the `if (!user) return ...` shape
    // this replaces.
    requireAuth: (action: AuthGateAction) => boolean;
    close: () => void;
}

const AuthGateContext = createContext<AuthGateContextType | undefined>(undefined);

export function AuthGateProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [action, setAction] = useState<AuthGateAction>('generic');

    const requireAuth = (nextAction: AuthGateAction) => {
        if (user) return false;
        setAction(nextAction);
        setIsOpen(true);
        return true;
    };

    const close = () => setIsOpen(false);

    return (
        <AuthGateContext.Provider value={{ isOpen, action, requireAuth, close }}>
            {children}
        </AuthGateContext.Provider>
    );
}

export function useAuthGate() {
    const context = useContext(AuthGateContext);
    if (context === undefined) {
        throw new Error('useAuthGate must be used within an AuthGateProvider');
    }
    return context;
}
