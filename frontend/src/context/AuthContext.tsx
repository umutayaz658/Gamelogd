'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import api, { isCookieAuth } from '@/lib/api';

// Store the JS token cookie with the strongest flags the current protocol allows.
// (Only used in header mode — cookie mode never exposes the token to JS.)
const setTokenCookie = (token: string) => {
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    Cookies.set('access_token', token, { expires: 7, secure, sameSite: 'strict' });
};

// Define User Interface based on backend response
interface User {
    id: number;
    username: string;
    email: string;
    avatar: string | null;
    bio: string;
    role: string;
    is_gamer: boolean;
    is_developer: boolean;
    is_investor: boolean;
    interests?: string[]; // Optional array of interest names
    top_favorites?: any[]; // Array of favorite games
    real_name?: string;
    location?: string;
    birth_date?: string;
    show_birth_date?: boolean;
    cover_image?: string;
    social_links?: Record<string, string>;
    date_joined?: string;
    gender?: string;
    steam_id?: string;
    dnd_mode?: boolean;
    settings?: any;
    phone_number?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => void;
    updateUser: (userData: User) => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    // Check for token and fetch user on mount
    useEffect(() => {
        const checkAuth = async () => {
            // Cookie mode: we can't read the httpOnly cookie, so just ask the API who we
            // are — a 401 (handled below) means logged out. Header mode: only bother if a
            // token cookie is present.
            const shouldCheck = isCookieAuth || !!Cookies.get('access_token');
            if (shouldCheck) {
                try {
                    const response = await api.get('/users/me/');
                    setUser(response.data);
                } catch (error) {
                    if (!isCookieAuth) {
                        Cookies.remove('access_token');
                    }
                    setUser(null);
                }
            }

            setIsLoading(false);
        };

        checkAuth();
    }, []);

    const login = async (token: string) => {
        setIsLoading(true);
        // In cookie mode the backend already set the httpOnly auth cookie on the login
        // response; never mirror the token into JS. In header mode, store it (hardened).
        if (!isCookieAuth) {
            setTokenCookie(token);
        }

        try {
            // Fetch user data (also primes the CSRF cookie in cookie mode).
            const response = await api.get('/users/me/');
            setUser(response.data);
            router.push('/');
            router.refresh();
        } catch (error) {
            console.error('Login failed during user fetch:', error);
            alert('Login succeeded but failed to load profile.');
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        if (isCookieAuth) {
            // Ask the backend to clear the httpOnly cookie; ignore failures.
            api.post('/logout/').catch(() => {});
        } else {
            Cookies.remove('access_token');
        }
        setUser(null);
        router.push('/login');
        router.refresh();
    };

    const updateUser = (userData: User) => {
        setUser(userData);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            login,
            logout,
            updateUser,
            isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
