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

export function getRelativeTime(timestamp: string | Date, lang: string = 'English'): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    const l = lang.toLowerCase();
    const isTurkish = l === 'turkish' || l === 'tr';
    const isSpanish = l === 'spanish' || l === 'es';
    const isFrench = l === 'french' || l === 'fr';
    const isGerman = l === 'german' || l === 'de';

    if (diffInSeconds < 60) {
        if (isTurkish) return `${diffInSeconds}sn`;
        if (isSpanish) return `${diffInSeconds}s`;
        if (isFrench) return `${diffInSeconds}s`;
        if (isGerman) return `${diffInSeconds}s`;
        return `${diffInSeconds}s`;
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        if (isTurkish) return `${diffInMinutes}dk`;
        if (isSpanish) return `${diffInMinutes}m`;
        if (isFrench) return `${diffInMinutes}m`;
        if (isGerman) return `${diffInMinutes}m`;
        return `${diffInMinutes}m`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        if (isTurkish) return `${diffInHours}sa`;
        if (isSpanish) return `${diffInHours}h`;
        if (isFrench) return `${diffInHours}h`;
        if (isGerman) return `${diffInHours}std`;
        return `${diffInHours}h`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        if (isTurkish) return `${diffInDays}g`;
        if (isSpanish) return `${diffInDays}d`;
        if (isFrench) return `${diffInDays}j`;
        if (isGerman) return `${diffInDays}t`;
        return `${diffInDays}d`;
    }
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        if (isTurkish) return `${diffInWeeks}hf`;
        if (isSpanish) return `${diffInWeeks}sem`;
        if (isFrench) return `${diffInWeeks}sem`;
        if (isGerman) return `${diffInWeeks}w`;
        return `${diffInWeeks}w`;
    }
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
        if (isTurkish) return `${diffInMonths}ay`;
        if (isSpanish) return `${diffInMonths}mes`;
        if (isFrench) return `${diffInMonths}mois`;
        if (isGerman) return `${diffInMonths}mon`;
        return `${diffInMonths}mo`;
    }
    const diffInYears = Math.floor(diffInDays / 365);
    if (isTurkish) return `${diffInYears}y`;
    if (isSpanish) return `${diffInYears}a`;
    if (isFrench) return `${diffInYears}an`;
    if (isGerman) return `${diffInYears}j`;
    return `${diffInYears}y`;
}

/**
 * Compacts large counts the way Twitter does (1234 -> "1.2K", 2500000 -> "2.5M").
 * Numbers under 1000 are shown as-is.
 */
export function formatCount(count: number): string {
    if (count < 1000) return String(count);
    if (count < 1_000_000) {
        return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    }
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
