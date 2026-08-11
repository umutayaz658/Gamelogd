export interface CoverImage {
    id: number;
    title: string;
    cover_image: string;
}

// Curated, hand-picked list of widely-recognized, visually distinct games — used purely
// as decoration on the logged-out landing page. Deliberately NOT sourced from the
// trending/hidden-gems endpoints: those reflect this specific deployment's own (often
// sparse) library-entry/review data, which meant the wall showed the same handful of
// obscure titles repeated many times over. A fixed, well-known set looks intentional
// and identical on every environment regardless of how much real usage data exists.
// Steam's "library_600x900" capsule art is used since it's already the same CDN
// pattern this codebase's Steam sync service produces for real game covers.
const CURATED_COVERS: CoverImage[] = [
    { id: 271590, title: 'Grand Theft Auto V', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/271590/library_600x900.jpg' },
    { id: 1245620, title: 'Elden Ring', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900.jpg' },
    { id: 1086940, title: "Baldur's Gate 3", cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1086940/library_600x900.jpg' },
    { id: 1817070, title: "Marvel's Spider-Man Remastered", cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1817070/library_600x900.jpg' },
    { id: 489830, title: 'The Elder Scrolls V: Skyrim', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/489830/library_600x900.jpg' },
    { id: 289070, title: 'Sid Meier\'s Civilization VI', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/289070/library_600x900.jpg' },
    { id: 1174180, title: 'Red Dead Redemption 2', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1174180/library_600x900.jpg' },
    { id: 292030, title: 'The Witcher 3: Wild Hunt', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/library_600x900.jpg' },
    { id: 1091500, title: 'Cyberpunk 2077', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg' },
    { id: 1593500, title: 'God of War', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1593500/library_600x900.jpg' },
    { id: 990080, title: 'Hogwarts Legacy', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/990080/library_600x900.jpg' },
    { id: 208650, title: 'Batman: Arkham Knight', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/208650/library_600x900.jpg' },
    { id: 1659420, title: 'Uncharted: Legacy of Thieves Collection', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1659420/library_600x900.jpg' },
    { id: 367520, title: 'Hollow Knight', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900.jpg' },
    { id: 413150, title: 'Stardew Valley', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/413150/library_600x900.jpg' },
    { id: 620, title: 'Portal 2', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/620/library_600x900.jpg' },
    { id: 546560, title: 'Half-Life: Alyx', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/546560/library_600x900.jpg' },
    { id: 374320, title: 'Dark Souls III', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/374320/library_600x900.jpg' },
    { id: 814380, title: 'Sekiro: Shadows Die Twice', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/814380/library_600x900.jpg' },
    { id: 2050650, title: 'Resident Evil 4', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/2050650/library_600x900.jpg' },
    { id: 1151640, title: 'Horizon Zero Dawn', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1151640/library_600x900.jpg' },
    { id: 1190460, title: 'Death Stranding', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1190460/library_600x900.jpg' },
    { id: 782330, title: 'Doom Eternal', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/782330/library_600x900.jpg' },
    { id: 1551360, title: 'Forza Horizon 5', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1551360/library_600x900.jpg' },
    { id: 1426210, title: 'It Takes Two', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1426210/library_600x900.jpg' },
    { id: 435150, title: "Divinity: Original Sin 2", cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/435150/library_600x900.jpg' },
    { id: 730, title: 'Counter-Strike 2', cover_image: 'https://cdn.akamai.steamstatic.com/steam/apps/730/library_600x900.jpg' },
];

// 18 columns * (112px tile + 12px gap) = ~2232px, wide enough to span the full width
// of the page (including the area behind the auth card, where the gradient fades it
// out) on anything up to a large desktop monitor; overflow-hidden clips the rest on
// narrower viewports instead of leaving a bare gap.
const COLUMN_COUNT = 18;
const TILES_PER_COLUMN = 10;
// Golden-ratio conjugate stride: spreads each column's starting offset around the
// pool so that consecutive columns never sample near-identical, one-shifted windows
// of the (small, 27-title) curated list — a fixed/proportional stride left visibly
// adjacent columns showing almost the same game at almost the same row.
const GOLDEN_RATIO_CONJUGATE = 0.6180339887;

// Columns revealed progressively at wider breakpoints so the wall thins out
// gracefully on mobile instead of cramming 18 blurred columns into a narrow viewport.
function columnVisibility(i: number): string {
    if (i < 4) return '';
    if (i < 10) return 'hidden sm:flex';
    return 'hidden lg:flex';
}

function buildColumn(offset: number): CoverImage[] {
    const n = CURATED_COVERS.length;
    const start = offset % n;
    const rotated = [...CURATED_COVERS.slice(start), ...CURATED_COVERS.slice(0, start)];
    const list: CoverImage[] = [];
    while (list.length < TILES_PER_COLUMN) {
        list.push(...rotated);
    }
    list.length = TILES_PER_COLUMN;
    // Duplicated once so a -50% translateY loop is seamless (see marquee-vertical keyframe).
    return [...list, ...list];
}

export default function GameCoverWall() {
    return (
        <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 flex justify-start gap-3 p-4 blur-[2px]">
                {Array.from({ length: COLUMN_COUNT }).map((_, i) => {
                    const offset = Math.floor(i * CURATED_COVERS.length * GOLDEN_RATIO_CONJUGATE);
                    const tiles = buildColumn(offset);
                    return (
                        <div
                            key={i}
                            className={`cover-wall-column ${columnVisibility(i)} flex-col gap-3 w-28 flex-shrink-0`}
                            style={{
                                animationName: 'marquee-vertical',
                                animationDuration: `${40 + i * 8}s`,
                                animationDirection: i % 2 === 0 ? 'normal' : 'reverse',
                                animationTimingFunction: 'linear',
                                animationIterationCount: 'infinite',
                            }}
                        >
                            {tiles.map((cover, idx) => (
                                <img
                                    key={`${cover.id}-${idx}`}
                                    src={cover.cover_image}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="w-28 h-40 object-cover rounded-md"
                                />
                            ))}
                        </div>
                    );
                })}
            </div>

            <div className="absolute inset-0 bg-zinc-950/45" />
            <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-zinc-950" />
            <div className="flex lg:hidden absolute inset-0 bg-zinc-950/60" />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-transparent to-zinc-950/70" />
        </div>
    );
}
