import { User } from '@/types';

/** Mirrors frontend/src/lib/url.ts's sanitizeUrl — blocks javascript:/data:/vbscript:
 * schemes in user-supplied URLs (social links, etc.) before they're opened, and adds a
 * https:// prefix to a bare domain so Linking.openURL doesn't silently fail on it. */
export function sanitizeUrl(urlStr: string | null | undefined): string {
    if (!urlStr) return '#';
    const trimmed = urlStr.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
        return '#';
    }
    if (!/^[a-z0-9+.-]+:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return trimmed;
}

/** Backend base URL (no /api suffix), derived from EXPO_PUBLIC_API_URL. */
export function getApiBase(): string {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
    return apiUrl.replace(/\/api\/?$/, '');
}

/** Mirrors frontend/src/lib/utils.ts's getMediaUrl — resolves any media path to an
 * absolute URL, rewriting a hardcoded localhost/127.0.0.1:8000 (e.g. from a stale
 * serializer value) to the configured API base. */
export function getMediaUrl(path: string | null | undefined): string | null {
    if (!path) return null;

    if (path.startsWith('http')) {
        let url = path;
        if (url.startsWith('http://res.cloudinary.com')) {
            url = url.replace('http://', 'https://');
        }
        if (url.includes('localhost:8000') || url.includes('127.0.0.1:8000')) {
            url = url.replace(/https?:\/\/(localhost|127\.0\.0\.1):8000/g, getApiBase());
        }
        return url;
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${getApiBase()}${cleanPath}`;
}

export function getImageUrl(path: string | null | undefined, name?: string): string {
    const resolved = getMediaUrl(path);
    if (resolved) return resolved;
    if (name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
    }
    return 'https://placehold.co/400x600?text=No+Image';
}

// English-only (Phase 1 has no multi-language support — see lib/strings.ts).
export function getRelativeTime(timestamp: string | Date): string {
    const diffInSeconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}mo`;
    return `${Math.floor(diffInDays / 365)}y`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// English-only port of getAbsoluteDateTime (frontend/src/lib/utils.ts) — Twitter-style
// "17:54 · Sep 5, 2026".
export function getAbsoluteDateTime(timestamp: string | Date): string {
    const date = new Date(timestamp);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm} · ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatCount(count: number): string {
    if (count < 1000) return String(count);
    if (count < 1_000_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function formatHandle(username: string): string {
    return `@${username}`;
}

/** 0-10 rating -> Tailwind-style color scale, mirrors frontend's getRatingTextClass. */
export function getRatingColor(value: number): string {
    if (value < 5.0) return '#ef4444';
    if (value < 8.0) return '#eab308';
    return '#10b981';
}

/** 0-100 Metacritic scale — intentionally separate from getRatingColor's 0-10 review
 * scale (Faz 2 plan decision 11), mirrors GameDetailClient.tsx's inline thresholds. */
export function getMetacriticColor(score: number): string {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#eab308';
    return '#ef4444';
}

export interface AuthorDisplay {
    type: 'user' | 'organisation' | 'project';
    name: string;
    slug: string | number;
    avatar: string | null;
    is_verified?: boolean;
}

// Ported from frontend/src/lib/utils.ts's resolveAuthorDisplay.
export function resolveAuthorDisplay(item: {
    author_details?: AuthorDisplay | null;
    user: Pick<User, 'real_name' | 'username' | 'avatar'>;
}): AuthorDisplay {
    return (
        item.author_details || {
            type: 'user',
            name: item.user.real_name || item.user.username,
            slug: item.user.username,
            avatar: item.user.avatar ?? null,
            is_verified: false,
        }
    );
}
