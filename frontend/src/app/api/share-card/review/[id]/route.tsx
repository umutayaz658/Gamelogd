import { ImageResponse } from 'next/og';
import { fetchForMetadata } from '@/lib/server-fetch';
import {
    CardShell,
    Glow,
    GlassFrame,
    frameSize,
    Divider,
    Footer,
    FooterText,
    FallbackCard,
    getLogoDataUri,
    CARD_WIDTH,
    CARD_HEIGHT,
    colors,
} from '@/lib/share-cards/shell';

const COVER_FRAME = frameSize(0.62, 3 / 4);

export const runtime = 'nodejs';

interface ReviewCardData {
    id: number;
    content?: string;
    rating?: number;
    user?: { username: string; settings?: { privateProfile?: boolean } };
    game?: { title: string; cover_image?: string | null };
}

function getReview(id: string) {
    return fetchForMetadata<ReviewCardData>(`/reviews/${id}/`);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [review, logoSrc] = await Promise.all([getReview(id), getLogoDataUri()]);

    const isPrivate = !!review?.user?.settings?.privateProfile;
    if (!review || isPrivate) {
        return new ImageResponse(
            <FallbackCard logoSrc={logoSrc} message="This review isn't available" />,
            { width: CARD_WIDTH, height: CARD_HEIGHT }
        );
    }

    const rating = review.rating != null ? review.rating.toFixed(1) : '—';
    const quote = (review.content || '').slice(0, 180);
    const gameTitle = review.game?.title || 'a game';

    return new ImageResponse(
        (
            <CardShell>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, position: 'relative' }}>
                    <Glow />
                    <GlassFrame width={COVER_FRAME.width} height={COVER_FRAME.height}>
                        {review.game?.cover_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={review.game.cover_image}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <div style={{ display: 'flex', width: '100%', height: '100%', background: colors.glassFill }} />
                        )}
                    </GlassFrame>

                    <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 48 }}>
                        <div style={{ display: 'flex', fontSize: 100, fontWeight: 800, color: colors.accent, letterSpacing: -2 }}>
                            {rating}
                        </div>
                        <div style={{ display: 'flex', fontSize: 36, fontWeight: 600, color: colors.muted, marginLeft: 10 }}>
                            /10
                        </div>
                    </div>

                    {quote ? (
                        <div
                            style={{
                                display: 'flex',
                                marginTop: 32,
                                fontSize: 32,
                                lineHeight: 1.5,
                                color: colors.text,
                                textAlign: 'center',
                                maxWidth: '86%',
                            }}
                        >
                            &ldquo;{quote}&rdquo;
                        </div>
                    ) : null}
                </div>

                <Divider />
                <Footer
                    logoSrc={logoSrc}
                    left={
                        <FooterText
                            primary={`@${review.user?.username ?? ''}`}
                            secondary={`Logged ${gameTitle}`}
                        />
                    }
                />
            </CardShell>
        ),
        { width: CARD_WIDTH, height: CARD_HEIGHT }
    );
}
