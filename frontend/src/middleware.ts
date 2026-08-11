import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Header mode stores 'access_token' (JS cookie); cookie mode uses the backend's
    // httpOnly 'auth_token'. Accept either so this presence-gate works in both modes.
    // Note: this only checks *presence* — an expired/revoked token is caught by the API
    // 401 interceptor, which is the real validity guard.
    const token = request.cookies.get('access_token')?.value
        || request.cookies.get('auth_token')?.value;
    const { pathname } = request.nextUrl;

    // Paths reachable with NO token. '/' renders the logged-out landing page (via
    // page.tsx's own branching on session presence) instead of the feed, so it no
    // longer needs to bounce anonymous visitors to /login.
    const noAuthRequiredPaths = ['/login', '/register', '/verify-email', '/favicon.ico', '/'];
    const isNoAuthRequiredPath = noAuthRequiredPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));

    // Paths a LOGGED-IN visitor gets bounced away from, back to '/'. Deliberately
    // separate from noAuthRequiredPaths and does NOT include '/' — a logged-in user
    // must keep landing on their normal feed at '/', never get redirected away from it.
    const authRedirectPaths = ['/login', '/register', '/verify-email', '/favicon.ico'];
    const isAuthRedirectPath = authRedirectPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));

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
