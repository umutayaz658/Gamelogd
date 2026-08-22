import { ImageResponse } from 'next/og';
import { fetchForImageGeneration } from '@/lib/server-fetch';
import {
    CardShell,
    Glow,
    GlassFrame,
    frameSize,
    Divider,
    Footer,
    FooterIdentity,
    FallbackCard,
    getLogoDataUri,
    getCardFonts,
    CARD_WIDTH,
    CARD_HEIGHT,
    colors,
} from '@/lib/share-cards/shell';

// Square, not portrait: Project.logo has no upload path in the current UI, so cover_image
// (a wide banner in practice — 3:4/16:9 per the create-project hint, displayed full-width
// elsewhere) is what actually renders here. A square frame crops far less of a wide banner
// than a portrait one would, and keeps this card's silhouette matching Organisation's below.
// Sized large (0.92 of content width) so the image dominates the card instead of leaving the
// huge dead space a smaller frame left above/below it.
const COVER_FRAME = frameSize(0.92, 1);

export const runtime = 'nodejs';

interface ProjectCardData {
    id: number;
    title: string;
    cover_image: string | null;
    logo: string | null;
    owner: { username: string; avatar?: string | null };
    organisation_details?: { name: string; logo: string | null } | null;
}

function getProject(id: string) {
    return fetchForImageGeneration<ProjectCardData>(`/projects/${id}/`);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [project, logoSrc, fonts] = await Promise.all([getProject(id), getLogoDataUri(), getCardFonts()]);

    if (!project) {
        return new ImageResponse(
            <FallbackCard logoSrc={logoSrc} message="This project isn't available" />,
            { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
        );
    }

    const coverImage = project.cover_image || project.logo;
    const identityName = project.organisation_details?.name || project.owner.username;
    const identityLogo = project.organisation_details?.logo || project.owner.avatar || logoSrc;

    return new ImageResponse(
        (
            <CardShell>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, position: 'relative' }}>
                    {/* position:relative scopes Glow to just this frame — not the whole content
                        column — so it can't bleed past the frame onto the title below it. */}
                    <div style={{ display: 'flex', position: 'relative' }}>
                        <Glow size={650} />
                        <GlassFrame width={COVER_FRAME.width} height={COVER_FRAME.height}>
                            {coverImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={coverImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ display: 'flex', width: '100%', height: '100%', background: colors.glassFill }} />
                            )}
                        </GlassFrame>
                    </div>

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
                        {project.title}
                    </div>
                </div>

                <Divider />
                <Footer
                    logoSrc={logoSrc}
                    left={<FooterIdentity logoSrc={identityLogo} primary={identityName} />}
                />
            </CardShell>
        ),
        { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
    );
}
