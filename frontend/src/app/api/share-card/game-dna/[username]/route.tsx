import { ImageResponse } from 'next/og';
import { fetchForMetadata } from '@/lib/server-fetch';
import {
    CardShell,
    Glow,
    Divider,
    Footer,
    FooterText,
    FallbackCard,
    getLogoDataUri,
    getCardFonts,
    getQrDataUri,
    SITE_URL,
    CARD_WIDTH,
    CARD_HEIGHT,
    colors,
} from '@/lib/share-cards/shell';

export const runtime = 'nodejs';

interface GameDnaGenre {
    name: string;
    percentage: number;
    color: string;
    total_hours: number;
    game_count: number;
}

interface GameDnaData {
    genres: GameDnaGenre[];
}

function getGameDna(username: string) {
    // Returns null on any non-2xx — this endpoint already 403s for private profiles when
    // called without auth (our server-side fetch never carries one), so the private case
    // and the "user doesn't exist" case both collapse into the same fallback card below.
    return fetchForMetadata<GameDnaData>(`/users/${username}/game-dna/`);
}

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
    const { username } = await params;
    const [dna, logoSrc, fonts] = await Promise.all([getGameDna(username), getLogoDataUri(), getCardFonts()]);

    const genres = dna?.genres?.slice(0, 5) ?? [];
    if (!dna || genres.length === 0) {
        return new ImageResponse(
            <FallbackCard logoSrc={logoSrc} message="No Game DNA yet" />,
            { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
        );
    }

    const totalHours = Math.round(dna.genres.reduce((sum, g) => sum + (g.total_hours || 0), 0));
    const qrSrc = await getQrDataUri(`${SITE_URL}/${username}`);

    return new ImageResponse(
        (
            <CardShell>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
                    {/* Glow scoped to just the hero-number block (its own positioning
                        context), not the whole card — otherwise it bleeds across the bar
                        list beneath it once the whole group is vertically centered. */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 56, position: 'relative' }}>
                        <Glow />
                        <div style={{ display: 'flex', fontSize: 116, fontWeight: 800, letterSpacing: -2, color: colors.accent }}>
                            {totalHours.toLocaleString('en-US')}
                        </div>
                        <div style={{ display: 'flex', marginTop: 10, fontSize: 26, fontWeight: 700, letterSpacing: 4, color: colors.muted }}>
                            HOURS PLAYED
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
                        {genres.map((genre) => (
                            <div key={genre.name} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', fontSize: 38, fontWeight: 600, color: colors.text }}>{genre.name}</div>
                                    <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: genre.color }}>{genre.percentage}%</div>
                                </div>
                                <div style={{ display: 'flex', width: '100%', height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            width: `${genre.percentage}%`,
                                            height: '100%',
                                            borderRadius: 999,
                                            background: genre.color,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <Divider />
                <Footer logoSrc={logoSrc} qrSrc={qrSrc} left={<FooterText primary={`@${username}`} secondary="Game DNA" />} />
            </CardShell>
        ),
        { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
    );
}
