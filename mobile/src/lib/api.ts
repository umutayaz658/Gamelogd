import axios from 'axios';
import { router } from 'expo-router';

import { clearToken, getToken } from './secureStore';

// Mobile only ever uses header-mode auth (Authorization: Token <token>, via SecureStore
// instead of a cookie) — the backend's CookieTokenAuthentication already treats this as
// the intended path for "mobile/legacy/server-to-server clients" (see backend/api/authentication.py),
// so there is no cookie-mode/CSRF branch to port here (mirrors frontend/src/lib/api.ts
// minus everything that only exists for the browser-cookie path).

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!configuredApiUrl) {
    console.error(
        'EXPO_PUBLIC_API_URL is not set — API calls will fail. Set it in mobile/.env ' +
        '(see mobile/.env.example; use your dev machine\'s LAN IP, not localhost).'
    );
}

const api = axios.create({
    baseURL: configuredApiUrl || 'http://127.0.0.1:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 20000,
});

// Request interceptor — async because SecureStore's API is promise-based (unlike the
// synchronous js-cookie read on web).
api.interceptors.request.use(
    async (config) => {
        const token = await getToken();
        if (token) {
            config.headers.Authorization = `Token ${token}`;
        } else {
            delete config.headers.Authorization;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: an expired/revoked token must not leave the UI in a fake
// "logged in" state. On 401, clear the token and bounce to /login — mirrors web's
// behavior, just via expo-router's router singleton instead of window.location.
//
// Mobile is always header-mode, so (unlike web, which has to fall back to a path-based
// guess in cookie-mode) we can check token presence directly: only force a redirect if we
// actually thought we were logged in. A 401 on an anonymous request to an auth-required
// endpoint (e.g. from a stub screen) should not yank an anonymous visitor to /login.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401 && !error.config?.__isLogout) {
            const hadToken = !!(await getToken());

            // POST /logout/ BEFORE clearing the token (matching AuthContext.logout()'s
            // order) — the backend endpoint is currently auth-exempt either way, but
            // keeping both call sites in the same order avoids this one silently going
            // out unauthenticated if that ever changes.
            try {
                await api.post('/logout/', {}, { __isLogout: true } as never);
            } catch {
                // Best effort — still fall through to the client-side teardown below.
            }
            await clearToken();

            if (hadToken) {
                router.replace('/login');
            }
        }
        return Promise.reject(error);
    }
);

export default api;

// A handful of list endpoints (posts/reviews/news) gained DRF pagination — this unwraps
// either shape so callers don't care whether the backend returned a bare array or
// {count, next, previous, results}.
export function unwrapList<T>(
    data: T[] | { results: T[]; count?: number; next?: string | null; previous?: string | null } | null | undefined
): T[] {
    if (!data) return [];
    return Array.isArray(data) ? data : data.results;
}

// Shared SWR fetcher — every useSWR() call in the app should pass this so requests keep
// going through the shared axios instance (auth header, base URL, etc.) instead of a
// bare fetch().
export const fetcher = (url: string) => api.get(url).then((res) => res.data);
