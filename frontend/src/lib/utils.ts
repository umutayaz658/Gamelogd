import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Returns the backend base URL (without /api suffix).
 * Uses NEXT_PUBLIC_API_URL env, stripping /api if present.
 */
export function getApiBase(): string {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
    return apiUrl.replace(/\/api\/?$/, '');
}

/**
 * Resolves any media URL (cover images, avatars, screenshots) to a full absolute URL.
 * Handles: full URLs, relative paths, localhost→production replacement.
 */
export function getMediaUrl(path: string | null | undefined): string | null {
    if (!path) return null;

    // Already a full URL
    if (path.startsWith('http')) {
        let url = path;
        // Force HTTPS for Cloudinary
        if (url.startsWith('http://res.cloudinary.com')) {
            url = url.replace('http://', 'https://');
        }
        // Replace hardcoded localhost with actual backend base
        if (url.includes('localhost:8000') || url.includes('127.0.0.1:8000')) {
            const apiBase = getApiBase();
            url = url.replace(/https?:\/\/(localhost|127\.0\.0\.1):8000/g, apiBase);
        }
        return url;
    }

    // Filesystem path (should never happen but defensive)
    if (path.includes('\\')) {
        console.error('Detected filesystem path:', path);
        return null;
    }

    // Relative path — prepend backend base
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${getApiBase()}${cleanPath}`;
}

export const getImageUrl = (path: string | null | undefined, name?: string) => {
    const resolved = getMediaUrl(path);
    if (resolved) return resolved;

    // Fallback: Use Name for Avatar
    if (name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
    }

    // Final Fallback: Generic Placeholder
    return "https://placehold.co/400x600?text=No+Image";
};

/**
 * Returns a relative time string (e.g., "5m", "2h", "1d").
 */
export function getRelativeTime(timestamp: string | Date, lang: string = 'en'): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
        return lang === 'tr' ? `${diffInSeconds}s` : `${diffInSeconds}s`;
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return lang === 'tr' ? `${diffInMinutes}dk` : `${diffInMinutes}m`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return lang === 'tr' ? `${diffInHours}s` : `${diffInHours}h`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return lang === 'tr' ? `${diffInDays}g` : `${diffInDays}d`;
    }
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return lang === 'tr' ? `${diffInWeeks}h` : `${diffInWeeks}w`;
    }
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
        return lang === 'tr' ? `${diffInMonths}a` : `${diffInMonths}mo`;
    }
    const diffInYears = Math.floor(diffInDays / 365);
    return lang === 'tr' ? `${diffInYears}y` : `${diffInYears}y`;
}
