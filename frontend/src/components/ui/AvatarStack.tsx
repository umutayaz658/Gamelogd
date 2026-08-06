import { getImageUrl } from '@/lib/utils';

const PLUS_SIGN = '+';

interface AvatarStackUser {
    username: string;
    avatar?: string;
}

interface AvatarStackProps {
    users: AvatarStackUser[];
    /** Total distinct actor count — may exceed users.length, in which case a "+N" badge is shown. */
    total?: number;
    max?: number;
    size?: number;
}

// Instagram/Twitter-style overlapping avatar cluster for grouped notifications
// ("Alice, Bob and 3 others liked your post").
export default function AvatarStack({ users, total, max = 3, size = 44 }: AvatarStackProps) {
    const shown = users.slice(0, max);
    const overflow = Math.max((total ?? users.length) - shown.length, 0);

    if (shown.length <= 1 && overflow === 0) {
        const single = shown[0];
        return single ? (
            <img
                src={getImageUrl(single.avatar, single.username)}
                alt={single.username}
                style={{ width: size, height: size }}
                className="rounded-full object-cover bg-zinc-800 flex-shrink-0"
            />
        ) : null;
    }

    return (
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            {shown.map((u, i) => (
                <img
                    key={u.username}
                    src={getImageUrl(u.avatar, u.username)}
                    alt={u.username}
                    style={{
                        width: size * 0.62,
                        height: size * 0.62,
                        left: i * (size * 0.34),
                        bottom: 0,
                        zIndex: shown.length - i,
                    }}
                    className="absolute rounded-full object-cover bg-zinc-800 border-2 border-zinc-900"
                />
            ))}
            {overflow > 0 && (
                <div
                    style={{
                        width: size * 0.62,
                        height: size * 0.62,
                        left: shown.length * (size * 0.34),
                        bottom: 0,
                        zIndex: 0,
                    }}
                    className="absolute rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[9px] font-bold text-zinc-300"
                >
                    {PLUS_SIGN}{overflow}
                </div>
            )}
        </div>
    );
}
