import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const getImageUrl = (path: string | null | undefined, name?: string) => {
    // 1. If path exists and is valid
    if (path) {
        // Check if it's already a full web URL
        if (path.startsWith("http")) return path;

        // CRITICAL: Fix double slashes or filesystem paths if any
        if (path.includes("\\")) {
            console.error("Detected filesystem path! This is wrong:", path);
            // Fall through to fallback instead of returning error image immediately?
            // Or stick to error image if path was explicitly provided but wrong.
            // Let's stick to error image for explicit wrong paths to help debugging.
            return "https://placehold.co/400x600?text=Path+Error";
        }

        // Ensure path starts with / if appending
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        return `http://localhost:8000${cleanPath}`;
    }

    // 2. Fallback: Use Name for Avatar
    if (name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
    }

    // 3. Final Fallback: Generic Placeholder
    return "https://placehold.co/400x600?text=No+Image";
};
