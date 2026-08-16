import { ImageResponse } from 'next/og';
import { fetchForMetadata } from '@/lib/server-fetch';
import {
    CardShell,
    Glow,
    GlassFrame,
    CONTENT_WIDTH,
    Divider,
    Footer,
    FooterIdentity,
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

const GRID_HEIGHT = 640;

interface DevlogCardData {
    id: number;
    title?: string | null;
    content?: string;
    user?: { username: string; settings?: { privateProfile?: boolean } };
    project_details?: { id: number; title: string; cover_image: string | null } | null;
    media?: { id: number; file: string; media_type: 'image' | 'video'; order: number }[];
    image?: string | null;
}

function getDevlog(id: string) {
    return fetchForMetadata<DevlogCardData>(`/posts/${id}/`);
}

// Mirrors PostMediaGrid.tsx's 1/2/3/4+ split (Twitter-standard grid), rebuilt with nested
// flexbox instead of CSS grid — Satori (the renderer behind ImageResponse) only supports
// flexbox layout, not `display: grid`.
function DevlogGrid({ images }: { images: string[] }) {
    const cellStyle: React.CSSProperties = { display: 'flex', width: '100%', height: '100%' };
    const imgStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };

    if (images.length === 0) {
        return <div style={{ display: 'flex', width: '100%', height: GRID_HEIGHT, background: colors.glassFill }} />;
    }

    if (images.length === 1) {
        return (
            <div style={{ display: 'flex', width: '100%', height: GRID_HEIGHT }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[0]} style={imgStyle} />
            </div>
        );
    }

    if (images.length === 2) {
        return (
            <div style={{ display: 'flex', width: '100%', height: GRID_HEIGHT, gap: 6 }}>
                <div style={{ ...cellStyle, width: '50%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={images[0]} style={imgStyle} />
                </div>
                <div style={{ ...cellStyle, width: '50%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={images[1]} style={imgStyle} />
                </div>
            </div>
        );
    }

    if (images.length === 3) {
        return (
            <div style={{ display: 'flex', width: '100%', height: GRID_HEIGHT, gap: 6 }}>
                <div style={{ ...cellStyle, width: '50%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={images[0]} style={imgStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', width: '50%', height: '100%', gap: 6 }}>
                    <div style={{ ...cellStyle, height: '50%' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={images[1]} style={imgStyle} />
                    </div>
                    <div style={{ ...cellStyle, height: '50%' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={images[2]} style={imgStyle} />
                    </div>
                </div>
            </div>
        );
    }

    // 4+: first 4 images, 2x2.
    const visible = images.slice(0, 4);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: GRID_HEIGHT, gap: 6 }}>
            <div style={{ display: 'flex', width: '100%', height: '50%', gap: 6 }}>
                <div style={{ ...cellStyle, width: '50%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={visible[0]} style={imgStyle} />
                </div>
                <div style={{ ...cellStyle, width: '50%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={visible[1]} style={imgStyle} />
                </div>
            </div>
            <div style={{ display: 'flex', width: '100%', height: '50%', gap: 6 }}>
                <div style={{ ...cellStyle, width: '50%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={visible[2]} style={imgStyle} />
                </div>
                <div style={{ ...cellStyle, width: '50%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={visible[3]} style={imgStyle} />
                </div>
            </div>
        </div>
    );
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [post, logoSrc, fonts] = await Promise.all([getDevlog(id), getLogoDataUri(), getCardFonts()]);

    const isPrivate = !!post?.user?.settings?.privateProfile;
    if (!post || isPrivate || !post.project_details) {
        return new ImageResponse(
            <FallbackCard logoSrc={logoSrc} message="This devlog isn't available" />,
            { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
        );
    }

    const images = (post.media && post.media.length > 0)
        ? post.media.filter((m) => m.media_type === 'image').sort((a, b) => a.order - b.order).map((m) => m.file)
        : (post.image ? [post.image] : []);

    const title = post.title || 'Devlog update';
    const text = (post.content || '').slice(0, 200);
    const username = post.user?.username ?? '';
    const qrSrc = await getQrDataUri(`${SITE_URL}/${username}/status/${id}`);

    return new ImageResponse(
        (
            <CardShell>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
                    {/* position:relative scopes Glow to just this frame — not the whole content
                        column — so it can't bleed onto the title/text below it. */}
                    <div style={{ display: 'flex', position: 'relative', marginBottom: 40 }}>
                        <Glow size={550} />
                        <GlassFrame width={CONTENT_WIDTH} height={GRID_HEIGHT} borderRadius={28}>
                            <DevlogGrid images={images} />
                        </GlassFrame>
                    </div>

                    <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, letterSpacing: -1, color: colors.text }}>
                        {title}
                    </div>
                    {text ? (
                        <div style={{ display: 'flex', marginTop: 16, fontSize: 30, lineHeight: 1.5, color: colors.text, opacity: 0.85 }}>
                            {text}
                        </div>
                    ) : null}
                </div>

                <Divider />
                <Footer
                    logoSrc={logoSrc}
                    qrSrc={qrSrc}
                    left={
                        <FooterIdentity
                            logoSrc={post.project_details.cover_image || logoSrc}
                            primary={post.project_details.title}
                            secondary="Devlog"
                        />
                    }
                />
            </CardShell>
        ),
        { width: CARD_WIDTH, height: CARD_HEIGHT, fonts }
    );
}
