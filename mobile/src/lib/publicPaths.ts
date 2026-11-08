/**
 * Mirrors the shape/philosophy of frontend/src/lib/publicPaths.ts (default-deny content,
 * explicit allow-list via RESERVED_TOP_LEVEL_SEGMENTS + PUBLIC_USERNAME_SUFFIXES) but
 * scoped to the routes that actually exist in this phase. Mobile has no /home vs / split
 * (see Faz 1 plan decision 2: '/' is the one entry point, anon or authed). Extend
 * RESERVED_TOP_LEVEL_SEGMENTS/PUBLIC_CONTENT_PREFIXES/PUBLIC_USERNAME_SUFFIXES as later
 * phases ship more screens whose content should be anonymous-browsable (e.g. once
 * messages/notifications/settings gain dynamic sub-paths that could collide with a
 * [username]-shaped first segment).
 */

export const AUTH_ONLY_PATHS = ['/login', '/register', '/verify-email'];

// Top-level static route segments that are NOT the [username] dynamic profile route.
const RESERVED_TOP_LEVEL_SEGMENTS = ['login', 'register', 'verify-email', 'explore', 'news', 'games'];

const PUBLIC_CONTENT_PREFIXES = ['/explore', '/news', '/games'];

// Shapes under the [username] catch-most segment that are public/indexable this phase.
// Not ported from web yet: /review/[id], /status/[id] (post/review detail — Faz 3).
const PUBLIC_USERNAME_SUFFIXES = [/^$/, /^\/games$/];

export function isAuthOnlyPath(pathname: string): boolean {
    return AUTH_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicContentPath(pathname: string): boolean {
    if (pathname === '/') return true;

    if (PUBLIC_CONTENT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        return true;
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
