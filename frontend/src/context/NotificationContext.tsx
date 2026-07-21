'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';
import { useAuth } from './AuthContext';
import Cookies from 'js-cookie';

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
        if (!user) {
            setUnreadMessages(0);
            setUnreadNotifications(0);
            return;
        }

        fetchCounts();

        let socket: WebSocket | null = null;
        let reconnectTimeout: any = null;
        let isClosedIntentionally = false;

        const connectWS = () => {
            const token = Cookies.get('access_token');
            if (!token) return;

            const apiUrlStr = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            let wsUrl = '';
            
            try {
                if (apiUrlStr.startsWith('http')) {
                    const urlObj = new URL(apiUrlStr);
                    const wsProto = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
                    wsUrl = `${wsProto}//${urlObj.host}/ws/updates/?token=${token}`;
                } else {
                    // Fallback to current browser location or localhost:8000
                    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    wsUrl = `${wsProto}//localhost:8000/ws/updates/?token=${token}`;
                }
            } catch (e) {
                console.error('[WebSocket] Failed to resolve URL, falling back to localhost:8000', e);
                wsUrl = `ws://localhost:8000/ws/updates/?token=${token}`;
            }

            console.log(`[WebSocket] Connecting to ${wsUrl}`);
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log('[WebSocket] Connected successfully');
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'counts') {
                        setUnreadMessages(data.messages);
                        setUnreadNotifications(data.notifications);
                    }
                } catch (err) {
                    console.error('[WebSocket] Error parsing message:', err);
                }
            };

            socket.onclose = (event) => {
                console.log(`[WebSocket] Disconnected: code=${event.code}, reason=${event.reason}`);
                if (!isClosedIntentionally) {
                    reconnectTimeout = setTimeout(() => {
                        console.log('[WebSocket] Attempting to reconnect...');
                        connectWS();
                    }, 5000);
                }
            };

            socket.onerror = (err) => {
                console.error('[WebSocket] Connection error:', err);
                socket?.close();
            };
        };

        connectWS();

        // 30s polling fallback in case WebSockets are blocked/fails
        const interval = setInterval(fetchCounts, 30000);

        return () => {
            isClosedIntentionally = true;
            if (socket) {
                socket.close();
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            clearInterval(interval);
        };
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
