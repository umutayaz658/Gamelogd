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
    getCardFonts,
    getQrDataUri,
    SITE_URL,
    CARD_WIDTH,
    CARD_HEIGHT,
    colors,
} from '@/lib/share-cards/shell';

// Square, matching Organisation.logo's actual shape (the create-organisation upload UI
// explicitly asks for "1:1 square" and every other display of this field treats it as one).
// Sized large (0.92 of content width), matching Project's frame — see that route for why.
const LOGO_FRAME = frameSize(0.92, 1);

export const runtime = 'nodejs';

interface OrganisationCardData {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
    banner: string | null;
}

function getOrganisation(slug: string) {
    return fetchForMetadata<OrganisationCardData>(`/organisations/${slug}/`);
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const [org, logoSrc, fonts] = await Promise.all([getOrganisation(slug), getLogoDataUri(), getCardFonts()]);

    if (!org) {
        return new ImageResponse(
            <FallbackCard logoSrc={logoSrc} message="This organisation isn't available" />,
            { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
        );
    }

    const qrSrc = await getQrDataUri(`${SITE_URL}/organisations/${slug}`);

    return new ImageResponse(
        (
            <CardShell>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, position: 'relative' }}>
                    <Glow size={650} />
                    {/* Same square glass frame as the Project card — deliberately not circular,
                        so Project and Organisation read as siblings in the same family. */}
                    <GlassFrame width={LOGO_FRAME.width} height={LOGO_FRAME.height}>
                        {org.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={org.logo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ display: 'flex', width: '100%', height: '100%', background: colors.glassFill }} />
                        )}
                    </GlassFrame>

                    <div
                        style={{
                            display: 'flex',
                            marginTop: 48,
                            fontSize: 68,
                            fontWeight: 700,
                            letterSpacing: -1,
                            color: colors.text,
                            textAlign: 'center',
                            maxWidth: '88%',
                        }}
                    >
                        {org.name}
                    </div>
                </div>

                <Divider />
                <Footer logoSrc={logoSrc} qrSrc={qrSrc} left={<FooterText primary="Organisation in Gamelogd" />} />
            </CardShell>
        ),
        { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
    );
}
