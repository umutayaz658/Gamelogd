import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPublicBrowsablePath, AUTH_ONLY_PATHS } from '@/lib/publicPaths';

// Keep the public-route set (in ../lib/publicPaths.ts) in sync with the `disallow` list in
// frontend/src/app/robots.ts — that file mirrors these same gated routes for crawlers that
// do respect robots.txt.
function isAuthOnlyPath(pathname: string): boolean {
    return AUTH_ONLY_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))
        || pathname === '/favicon.ico';
}

export function middleware(request: NextRequest) {
    // Header mode stores 'access_token' (JS cookie); cookie mode uses the backend's
    // httpOnly 'auth_token'. Accept either so this presence-gate works in both modes.
    // Note: this only checks *presence* — an expired/revoked token is caught by the API
    // 401 interceptor, which is the real validity guard.
    const token = request.cookies.get('access_token')?.value
        || request.cookies.get('auth_token')?.value;
    const { pathname } = request.nextUrl;

    // Paths reachable with NO token: the auth-only pages plus every public/indexable
    // content route (games, profiles, reviews, orgs, projects, news, developer, explore) —
    // search engines and social-share crawlers never carry a session cookie, so anything
    // meant to be indexed or link-unfurled has to resolve here without one.
    const isNoAuthRequiredPath = pathname === '/favicon.ico' || isPublicBrowsablePath(pathname);

    // Paths a LOGGED-IN visitor gets bounced away from, back to '/'. Public content routes
    // are NOT in here — a logged-in user must still be able to browse games/profiles/etc.,
    // only /login-style auth pages redirect them away.
    const isAuthRedirectPath = isAuthOnlyPath(pathname);

    // Also allow Next.js internal paths and API routes (handled by backend)
    if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static')) {
        return NextResponse.next();
    }

    // If no token and trying to access a protected route, redirect to login
    if (!token && !isNoAuthRequiredPath) {
        const loginUrl = new URL('/login', request.url);
        // Optional: Add redirect param to return after login
        // loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // If token exists and trying to access login/register, redirect to home
    if (token && isAuthRedirectPath) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
