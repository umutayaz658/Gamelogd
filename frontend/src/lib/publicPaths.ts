/**
 * Single source of truth for "which routes are reachable with no auth token" — shared by
 * `middleware.ts` (Edge runtime) and `lib/api.ts`'s 401 interceptor (browser runtime). Pure
 * function, no Node-specific APIs, so it works in both.
 */

// Top-level static route segments that are NOT the [username] dynamic profile route.
const RESERVED_TOP_LEVEL_SEGMENTS = [
    'login', 'register', 'verify-email', 'settings', 'messages', 'notifications',
    'bookmarks', 'devs', 'collabs', 'invest', 'games', 'developer', 'news',
    'organisations', 'projects', 'explore', 'home',
];

// Fixed prefixes that are public/indexable content, EXCEPT their `/dashboard` subroute
// (member-only management UI under organisations/[slug] and projects/[id]).
const PUBLIC_CONTENT_PREFIXES = ['/games', '/developer', '/news', '/organisations', '/projects', '/explore', '/home'];

// Shapes under the [username] catch-most segment that are public/indexable. Anything else
// under an unreserved first segment (e.g. /{username}/recommended) falls through to
// default-deny (still gated).
const PUBLIC_USERNAME_SUFFIXES = [/^$/, /^\/games$/, /^\/review\/[^/]+$/, /^\/status\/[^/]+$/];

// Auth-flow pages reachable with no token (and a logged-in visitor is bounced away from
// these back to '/' — see middleware.ts).
export const AUTH_ONLY_PATHS = ['/login', '/register', '/verify-email'];

function isAuthOnlyPath(pathname: string): boolean {
    return AUTH_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicContentPath(pathname: string): boolean {
    if (pathname === '/') return true;

    if (PUBLIC_CONTENT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        return !pathname.endsWith('/dashboard');
    }

    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0];
    if (firstSegment && !RESERVED_TOP_LEVEL_SEGMENTS.includes(firstSegment)) {
        const rest = `/${segments.slice(1).join('/')}`.replace(/\/$/, '');
        return PUBLIC_USERNAME_SUFFIXES.some((re) => re.test(rest));
    }

    return false;
}

/** True if this path is reachable (renders content, no login redirect) with no auth token. */
export function isPublicBrowsablePath(pathname: string): boolean {
    return isAuthOnlyPath(pathname) || isPublicContentPath(pathname);
}

// Pages where the mobile tab bar / login-register banner should stay hidden: the auth-flow
// pages (for everyone, though middleware already keeps a signed-in visitor off these), plus
// '/' but ONLY for an anonymous visitor — '/' is the marketing/cover page when signed out
// (see app/page.tsx), not a content page, so it gets the same clean, chrome-free treatment
// as /login and /register. A signed-in visitor still sees their feed (and its chrome) at
// '/', unaffected — hence the `isAnonymous` flag rather than baking that check in here.
export function isChromeHiddenPath(pathname: string, isAnonymous: boolean): boolean {
    if (isAuthOnlyPath(pathname)) return true;
    return isAnonymous && pathname === '/';
}
