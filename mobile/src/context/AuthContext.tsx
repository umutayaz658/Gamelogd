import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { router } from 'expo-router';

import api from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/secureStore';
import { useToast } from '@/context/ToastContext';
import { User } from '@/types';

interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (user: User) => void;
    // Whether an anonymous visitor tapped "Continue without logging in" on the cover
    // page (Faz 1 plan decision 2, reversed 2026-11-01) — in-memory only, reset on
    // logout (a deliberate action should land back on the cover page, not silently
    // drop the visitor into the guest feed) and on app restart.
    hasContinuedAsGuest: boolean;
    continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Mirrors frontend/src/context/AuthContext.tsx's shape (login/logout/updateUser,
// mount-time token check) — mobile is always header-mode, so the cookie-mode branch and
// the workspace-cache localStorage purge on logout (Devs-feature leftover, not in scope)
// are dropped rather than ported.
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasContinuedAsGuest, setHasContinuedAsGuest] = useState(false);
    const toast = useToast();

    useEffect(() => {
        (async () => {
            const token = await getToken();
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                const { data } = await api.get<User>('/users/me/');
                setUser(data);
            } catch {
                await clearToken();
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const login = async (token: string) => {
        await setToken(token);
        try {
            const { data } = await api.get<User>('/users/me/');
            setUser(data);
            // '/' is the single entry point for Phase 1 — there is no separate '/home' to
            // navigate to (and no cover page to show once a real session exists).
            router.replace('/');
        } catch (error) {
            // Mirrors frontend/src/context/AuthContext.tsx's login(): the token was already
            // valid (setToken succeeded) when this fetch failed, so letting the error
            // propagate to the caller (LoginScreen/RegisterScreen/VerifyEmailScreen) would
            // make a successful login/verification show a false "Invalid credentials" /
            // "Verification failed" message.
            console.error('Login failed during user fetch:', error);
            toast.error('Login succeeded but failed to load profile.');
        }
    };

    const logout = async () => {
        try {
            await api.post('/logout/', {}, { __isLogout: true } as never);
        } catch {
            // Best effort — still fall through to the client-side teardown below.
        }
        await clearToken();
        setUser(null);
        setHasContinuedAsGuest(false);
        router.replace('/');
    };

    const updateUser = (updated: User) => setUser(updated);

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                login,
                logout,
                updateUser,
                hasContinuedAsGuest,
                continueAsGuest: () => setHasContinuedAsGuest(true),
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}
