'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import useSWR from 'swr';
import api, { fetcher } from '@/lib/api';
import { useAuth } from './AuthContext';
import Cookies from 'js-cookie';

interface Counts {
    messages: number;
    notifications: number;
}

interface NotificationContextType {
    unreadMessages: number;
    unreadNotifications: number;
    fetchCounts: () => Promise<void>;
    markMessagesRead: () => void;
    markNotificationsRead: () => void;
    // Set by the messages page when a chat thread is open fullscreen on mobile, so the
    // global Navbar/MobileTabBar singletons know to hide themselves.
    isChatFullscreen: boolean;
    setChatFullscreen: (value: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [isChatFullscreen, setChatFullscreen] = useState(false);

    // Single source of truth for badge counts — the websocket below pushes updates
    // straight into this same SWR cache entry via mutate() instead of separate useState.
    const { data, mutate } = useSWR<Counts>(
        user ? '/users/counts/' : null,
        fetcher,
        { refreshInterval: 30000, revalidateOnFocus: false }
    );

    const unreadMessages = data?.messages ?? 0;
    const unreadNotifications = data?.notifications ?? 0;

    const fetchCounts = async () => {
        await mutate();
    };

    useEffect(() => {
        if (!user) return;

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

            socket = new WebSocket(wsUrl);

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    if (payload.type === 'counts') {
                        mutate({ messages: payload.messages, notifications: payload.notifications }, { revalidate: false });
                    }
                } catch (err) {
                    console.error('[WebSocket] Error parsing message:', err);
                }
            };

            socket.onclose = () => {
                if (!isClosedIntentionally) {
                    reconnectTimeout = setTimeout(() => {
                        connectWS();
                    }, 5000);
                }
            };

            socket.onerror = (err) => {
                // In dev, React StrictMode mounts this effect twice (mount -> cleanup ->
                // mount): the first socket gets closed by cleanup while still CONNECTING,
                // which browsers always surface as an error event with no useful detail
                // ({}). That's expected teardown noise, not a real connection failure —
                // only log when the close wasn't ours.
                if (!isClosedIntentionally) {
                    console.error('[WebSocket] Connection error:', err);
                }
                socket?.close();
            };
        };

        connectWS();

        return () => {
            isClosedIntentionally = true;
            if (socket) {
                socket.close();
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const markMessagesRead = () => {
        mutate({ messages: 0, notifications: unreadNotifications }, { revalidate: false });
        // Backend update happens when messages are fetched in MessagesPage
    };

    const markNotificationsRead = async () => {
        mutate({ messages: unreadMessages, notifications: 0 }, { revalidate: false });
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
            markNotificationsRead,
            isChatFullscreen,
            setChatFullscreen
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
