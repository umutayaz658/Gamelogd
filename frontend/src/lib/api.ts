import axios from 'axios';

import Cookies from 'js-cookie';

// Auth mode:
// - 'header' (default): the token is kept in a JS-readable cookie and sent via the
//   Authorization header. Used while the frontend and API are on different sites
//   (e.g. Vercel + Railway) and a first-party httpOnly cookie can't be shared.
// - 'cookie': the backend sets an httpOnly auth cookie and the browser sends it
//   automatically (withCredentials). Activate this AFTER the API is served from a
//   same-site subdomain (e.g. api.gamelogd.net) by setting NEXT_PUBLIC_AUTH_MODE=cookie.
export const isCookieAuth = process.env.NEXT_PUBLIC_AUTH_MODE === 'cookie';

// NEXT_PUBLIC_* is inlined at build time, so a missing API URL in a production build
// silently ships a localhost baseURL and every request fails for real users. Warn loudly.
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!configuredApiUrl && process.env.NODE_ENV === 'production') {
    console.error(
        'NEXT_PUBLIC_API_URL is not set for this production build — API calls will point at ' +
        'localhost and fail. Set it in the deployment environment.'
    );
}

const api = axios.create({
    baseURL: configuredApiUrl || 'http://127.0.0.1:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
    // Send/receive the httpOnly auth cookie (cookie mode) and let the browser attach it.
    // Harmless in header mode: a SameSite cookie simply isn't sent cross-site.
    withCredentials: true,
    // Don't let a stalled backend hang requests (and their loading spinners) forever.
    timeout: 20000,
});

const UNSAFE_METHODS = ['post', 'put', 'patch', 'delete'];

// Request interceptor
api.interceptors.request.use(
    (config) => {
        if (isCookieAuth) {
            // The httpOnly cookie carries auth; we only need to defend against CSRF by
            // echoing the (JS-readable) csrftoken cookie on state-changing requests.
            const method = (config.method || 'get').toLowerCase();
            if (UNSAFE_METHODS.includes(method)) {
                const csrfToken = Cookies.get('csrftoken');
                if (csrfToken) {
                    config.headers['X-CSRFToken'] = csrfToken;
                }
            }
        } else {
            const token = Cookies.get('access_token');
            if (token && token !== 'undefined' && token !== 'null') {
                config.headers.Authorization = `Token ${token}`;
            } else {
                delete config.headers.Authorization;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor: an expired/revoked token must not leave the UI in a fake
// "logged in" state. On 401, clear any client-side token and bounce to /login.
const PUBLIC_PATHS = ['/login', '/register', '/', '/verify-email'];

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Skip the logout call's own failures so this can never recurse.
        if (
            error.response?.status === 401 &&
            typeof window !== 'undefined' &&
            !error.config?.__isLogout
        ) {
            const hadClientToken = !isCookieAuth && !!Cookies.get('access_token');
            Cookies.remove('access_token');

            // The backend sets an httpOnly auth cookie that JS cannot delete, and the
            // Next.js middleware gates routes purely on that cookie's presence. A revoked
            // or expired token would therefore leave the browser "signed in" to the
            // middleware but rejected by the API — stranding the user on '/' with no way to
            // reach /login. Clearing it server-side is what makes that state recoverable.
            // /logout/ is auth-exempt, so this cannot itself 401.
            try {
                await api.post('/logout/', {}, { __isLogout: true } as never);
            } catch {
                // Best effort — still fall through to the client-side teardown below.
            }

            const path = window.location.pathname;
            const onPublicPath = PUBLIC_PATHS.includes(path);
            // In header mode only redirect if we thought we were logged in (avoid
            // disrupting guests). In cookie mode we can't read the httpOnly cookie, so
            // rely on the public-path guard.
            if (!onPublicPath && (isCookieAuth || hadClientToken)) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
