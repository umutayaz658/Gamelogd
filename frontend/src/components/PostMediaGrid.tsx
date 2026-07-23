import { X } from 'lucide-react';

export interface GridMediaItem {
    url: string;
    type?: 'image' | 'video';
}

interface PostMediaGridProps {
    items: GridMediaItem[];
    // Index into the FULL items array (not just the up-to-4 slice actually rendered).
    onItemClick?: (index: number) => void;
    // Smaller max-heights for quote-repost embeds and message-bubble previews.
    compact?: boolean;
    // Shows a remove (X) button on each cell — used by composer attachment previews.
    editable?: boolean;
    onRemove?: (index: number) => void;
    className?: string;
}

/**
 * Twitter-standard media grid: 1 image keeps its own aspect ratio (capped height,
 * centered); 2/3/4 images share one fixed-height box so cells are rectangles, not
 * independently-square tiles; 5+ reuses the 4-cell layout with a "+N" overlay on the
 * last cell. Used everywhere a post's images are shown — main feed cards, quote/repost
 * embeds, and message-bubble previews — so all of them stay visually in sync.
 */
export default function PostMediaGrid({ items, onItemClick, compact = false, editable = false, onRemove, className = '' }: PostMediaGridProps) {
    if (items.length === 0) return null;

    if (items.length === 1) {
        const item = items[0];
        const maxH = compact ? 'max-h-[380px]' : 'max-h-[512px]';
        return (
            <div className={`rounded-xl overflow-hidden border border-zinc-800 bg-black flex items-center justify-center relative ${maxH} ${className}`}>
                {item.type === 'video' ? (
                    <video
                        src={item.url}
                        controls={!editable}
                        className={`w-full ${maxH} object-cover`}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <img
                        src={item.url}
                        alt="Post media"
                        className={`w-full ${maxH} object-cover ${!editable ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}`}
                        onClick={(e) => {
                            if (editable) return;
                            e.stopPropagation();
                            onItemClick?.(0);
                        }}
                    />
                )}
                {editable && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove?.(0); }}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full z-10 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        );
    }

    const count = items.length;
    const visible = items.slice(0, 4);
    const heightClass = compact ? 'h-56 sm:h-72' : 'h-64 sm:h-80';
    const gridColsClass = 'grid-cols-2';
    const gridRowsClass = count === 2 ? '' : 'grid-rows-2';

    return (
        <div className={`grid gap-0.5 rounded-xl overflow-hidden border border-zinc-800 ${heightClass} ${gridColsClass} ${gridRowsClass} ${className}`}>
            {visible.map((item, index) => (
                <div
                    key={index}
                    className={`relative bg-black ${count === 3 && index === 0 ? 'row-span-2' : ''}`}
                >
                    {item.type === 'video' ? (
                        <video
                            src={item.url}
                            controls={!editable}
                            className="w-full h-full object-cover"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <img
                            src={item.url}
                            alt={`Post media ${index + 1}`}
                            className={`w-full h-full object-cover ${!editable ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                            onClick={(e) => {
                                if (editable) return;
                                e.stopPropagation();
                                onItemClick?.(index);
                            }}
                        />
                    )}
                    {index === 3 && count > 4 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm pointer-events-none">
                            +{count - 4}
                        </div>
                    )}
                    {editable && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove?.(index); }}
                            className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full z-10 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
