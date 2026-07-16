'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import api, { isCookieAuth, setAccessToken as setTokenCookie } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

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
    logout: () => Promise<void>;
    updateUser: (userData: User) => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const toast = useToast();

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
            toast.error('Login succeeded but failed to load profile.');
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        // Always hit the backend: it sets the httpOnly auth cookie on login in BOTH modes,
        // and JS cannot delete an httpOnly cookie itself. Skipping this in header mode left
        // `auth_token` behind, and the middleware (which accepts either cookie) kept treating
        // the browser as signed in — trapping the user on '/' with no way back to /login.
        // Awaited so the cookie deletion lands *before* we navigate; otherwise the middleware
        // still sees a token and bounces /login straight back to /.
        try {
            await api.post('/logout/');
        } catch {
            // AllowAny endpoint that only clears a cookie — tear down the client state anyway.
        }
        // Cleared after the request above, which needs it to authenticate in header mode.
        Cookies.remove('access_token');
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
