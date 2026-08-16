import { ImageResponse } from 'next/og';
import { fetchForMetadata } from '@/lib/server-fetch';
import { getRatingColor } from '@/lib/utils';
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
    getCardFonts,
    CARD_WIDTH,
    CARD_HEIGHT,
    colors,
} from '@/lib/share-cards/shell';

// Narrower than other cards' cover frames — the 2:3 canvas has less vertical room left over
// once the rating and quote sit below it, and this is the tallest (3:4 portrait) frame of
// the five cards.
const COVER_FRAME = frameSize(0.70, 3 / 4);

export const runtime = 'nodejs';

interface ReviewCardData {
    id: number;
    content?: string;
    rating?: number | string;
    user?: { username: string; settings?: { privateProfile?: boolean } };
    game?: { title: string; cover_image?: string | null };
}

function getReview(id: string) {
    return fetchForMetadata<ReviewCardData>(`/reviews/${id}/`);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [review, logoSrc, fonts] = await Promise.all([getReview(id), getLogoDataUri(), getCardFonts()]);

    const isPrivate = !!review?.user?.settings?.privateProfile;
    if (!review || isPrivate) {
        return new ImageResponse(
            <FallbackCard logoSrc={logoSrc} message="This review isn't available" />,
            { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
        );
    }

    // DRF serializes DecimalField as a string ("8.5"), not a number — Number() first or
    // .toFixed() throws (this was crashing the route entirely before the fix).
    const ratingNum = review.rating != null ? Number(review.rating) : null;
    const rating = ratingNum != null ? ratingNum.toFixed(1) : '—';
    const ratingColor = ratingNum != null ? getRatingColor(ratingNum) : colors.muted;
    const quote = (review.content || '').slice(0, 180);
    const gameTitle = review.game?.title || 'a game';
    const username = review.user?.username ?? '';

    return new ImageResponse(
        (
            <CardShell>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, position: 'relative' }}>
                    <Glow size={560} />
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

                    <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 48 }}>
                        <div style={{ display: 'flex', fontSize: 124, fontWeight: 800, color: ratingColor, letterSpacing: -2 }}>
                            {rating}
                        </div>
                        <div style={{ display: 'flex', fontSize: 40, fontWeight: 600, color: colors.muted, marginLeft: 10, marginBottom: 12 }}>
                            /10
                        </div>
                    </div>

                    {quote ? (
                        <div
                            style={{
                                display: 'flex',
                                marginTop: 32,
                                fontSize: 38,
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
                            primary={`@${username}`}
                            secondary={`Logged ${gameTitle}`}
                        />
                    }
                />
            </CardShell>
        ),
        { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
    );
}
