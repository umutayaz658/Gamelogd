// Server-side (Server Component / generateMetadata) fetch helper for public, unauthenticated
// entity reads used to build per-page metadata. Mirrors the API_INTERNAL_URL vs
// NEXT_PUBLIC_API_URL split and Docker-internal-hostname media URL rewrite that
// frontend/src/lib/serverFeed.ts's fetchInitialFeed already established for the home feed —
// same reasoning applies here: this runs inside the Next.js server process, which in
// docker-compose resolves `localhost` to the frontend container itself, not the backend
// one, and Django builds absolute media URLs from whatever Host the request came in on.
const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const INTERNAL_API_BASE = process.env.API_INTERNAL_URL || PUBLIC_API_BASE;

// Fetches a public entity endpoint for metadata generation. Never throws — callers (mostly
// generateMetadata and notFound() checks) must be able to fall back to generic metadata or a
// real 404 without a backend hiccup breaking the page render. `path` must include the leading
// slash, e.g. `/games/1/details/`.
export async function fetchForMetadata<T>(path: string): Promise<T | null> {
    try {
        const res = await fetch(`${INTERNAL_API_BASE}${path}`, { cache: 'no-store' });
        if (!res.ok) return null;

        const internalOrigin = new URL(INTERNAL_API_BASE).origin;
        const publicOrigin = new URL(PUBLIC_API_BASE).origin;
        const text = await res.text();
        const rewritten = internalOrigin !== publicOrigin ? text.split(internalOrigin).join(publicOrigin) : text;
        return JSON.parse(rewritten) as T;
    } catch {
        return null;
    }
}

// Like fetchForMetadata, but deliberately does NOT rewrite media URLs to the public origin.
// The consumer here (next/og's ImageResponse, i.e. Satori) fetches image URLs itself,
// server-side, from inside the same process/Docker network as the backend — not a browser.
// Rewriting to the public origin (as fetchForMetadata correctly does for browser-facing
// metadata) makes Docker-local media URLs unreachable from inside the frontend container
// (`localhost:8000` there is the frontend container itself, not the backend one), which was
// silently breaking every share card whose entity has a locally-stored (non-Cloudinary)
// image: Project/Organisation covers and logos, and Devlog media. In production, where
// API_INTERNAL_URL is unset and all media is on Cloudinary, internal === public and this
// behaves identically to fetchForMetadata.
export async function fetchForImageGeneration<T>(path: string): Promise<T | null> {
    try {
        const res = await fetch(`${INTERNAL_API_BASE}${path}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}
