'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';
import { useAuth } from './AuthContext';

interface NotificationContextType {
    unreadMessages: number;
    unreadNotifications: number;
    fetchCounts: () => Promise<void>;
    markMessagesRead: () => void;
    markNotificationsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    const fetchCounts = async () => {
        if (!user) return;
        try {
            const res = await api.get('/users/counts/');
            setUnreadMessages(res.data.messages);
            setUnreadNotifications(res.data.notifications);
        } catch (error) {
            console.error("Failed to fetch notification counts:", error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchCounts();
            const interval = setInterval(fetchCounts, 5000); // Poll every 5s
            return () => clearInterval(interval);
        } else {
            setUnreadMessages(0);
            setUnreadNotifications(0);
        }
    }, [user]);

    const markMessagesRead = () => {
        setUnreadMessages(0);
        // Backend update happens when messages are fetched in MessagesPage
    };

    const markNotificationsRead = async () => {
        setUnreadNotifications(0);
        try {
            await api.post('/notifications/mark_all_read/');
        } catch (error) {
            console.error("Failed to mark notifications as read:", error);
        }
    };

    return (
        <NotificationContext.Provider value={{
            unreadMessages,
            unreadNotifications,
            fetchCounts,
            markMessagesRead,
            markNotificationsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
