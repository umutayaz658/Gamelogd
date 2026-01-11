'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

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
            const token = Cookies.get('access_token');

            if (token) {
                try {
                    // Token exists, fetch user data
                    const response = await api.get('/users/me/');
                    setUser(response.data);
                } catch (error) {
                    console.error('Failed to fetch user:', error);
                    // If fetch fails (e.g. invalid token), clear auth
                    Cookies.remove('access_token');
                    setUser(null);
                }
            }

            setIsLoading(false);
        };

        checkAuth();
    }, []);

    const login = async (token: string) => {
        setIsLoading(true);
        // 1. Set Cookie
        Cookies.set('access_token', token, { expires: 7 });

        try {
            // 2. Fetch User Data
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
