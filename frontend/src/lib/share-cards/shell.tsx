import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Shared "Neon Glass" chrome for all 5 share-card types (frontend/src/app/api/share-card/*).
// Every element here must stick to CSS Satori (the renderer behind next/og's ImageResponse)
// actually supports: flexbox only (no CSS grid), gradients/borders/boxShadow are fine, but
// `filter` (blur, drop-shadow) and `text-shadow` are NOT reliably supported — "glow" effects
// are faked with a softly-radial-gradiented div or a heavy-blur `boxShadow`, never `filter`.

export const CARD_WIDTH = 1080;
// 2:3, not the original 9:16 (Instagram Story full-bleed) — the taller canvas left far too
// much empty space around every card's (comparatively short) content.
export const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.5);
export const CARD_PADDING_X = 56;
// Width actually available inside CardShell's horizontal padding — GlassFrame sizes are
// computed against this, not CARD_WIDTH directly.
export const CONTENT_WIDTH = CARD_WIDTH - CARD_PADDING_X * 2;

export const colors = {
    groundA: '#101014',
    groundB: '#000000',
    // glow1 is the ONLY accent color used for glows/dividers — kept as a single hue
    // deliberately (an earlier emerald+indigo blend read as a muddy two-tone smear at the
    // small sizes/low opacities these effects render at; a single strong color reads clean).
    glow1: '#10b981',
    glassBorder: 'rgba(255,255,255,0.09)',
    glassFill: 'rgba(255,255,255,0.05)',
    accent: '#34d399',
    text: '#e4e4e7',
    muted: '#797984',
};

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gamelogd.net';

let logoDataUriPromise: Promise<string> | null = null;

// Cached within the server process — the file only needs to be read once, not once per request.
export function getLogoDataUri(): Promise<string> {
    if (!logoDataUriPromise) {
        logoDataUriPromise = readFile(join(process.cwd(), 'public/branding/logo-mark.png')).then(
            (buf) => `data:image/png;base64,${buf.toString('base64')}`
        );
    }
    return logoDataUriPromise;
}

type CardFont = { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: 'normal' };

let cardFontsPromise: Promise<CardFont[]> | null = null;

// Satori (next/og's renderer) ships a single default font with no real weight variants — every
// fontWeight short of that default rendered visually identical ("thin") until real weighted
// TTFs were embedded here and threaded into every ImageResponse call via its `fonts` option.
export function getCardFonts(): Promise<CardFont[]> {
    if (!cardFontsPromise) {
        const dir = join(process.cwd(), 'public/fonts');
        const weights: { file: string; weight: 400 | 600 | 700 | 800 }[] = [
            { file: 'Inter-Regular.ttf', weight: 400 },
            { file: 'Inter-SemiBold.ttf', weight: 600 },
            { file: 'Inter-Bold.ttf', weight: 700 },
            { file: 'Inter-ExtraBold.ttf', weight: 800 },
        ];
        cardFontsPromise = Promise.all(
            weights.map(async ({ file, weight }) => ({
                name: 'Inter',
                data: await readFile(join(dir, file)),
                weight,
                style: 'normal' as const,
            }))
        );
    }
    return cardFontsPromise;
}

export function CardShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                background: `linear-gradient(160deg, ${colors.groundA} 0%, ${colors.groundB} 78%)`,
                color: colors.text,
                fontFamily: 'Inter',
                position: 'relative',
                padding: '64px 56px 56px',
            }}
        >
            {children}
        </div>
    );
}

// Soft radial glow sitting behind the hero area. `boxShadow`'s blur radius (not `filter`) is
// what actually diffuses it — Satori supports box-shadow, not CSS filters.
// Renders relative to its own nearest positioned ancestor, centered on that ancestor's
// midpoint — callers must wrap it together with the hero content in a `position: 'relative'`
// container so the glow tracks the hero instead of a fixed offset from the card's top edge
// (which breaks the moment the hero is vertically centered rather than pinned to the top).
//
// `size` is the base circle's diameter — the shadow layers scale with it. Pass a `size`
// noticeably LARGER than whatever frame/hero sits on top, or the frame's own opaque
// background simply covers the glow's whole footprint and nothing is visible at all (this
// happened for real once the Project/Organisation frames were enlarged to ~90% of card
// width — a 420px glow was smaller than the frame it was supposed to peek out from behind).
//
// `color` defaults to the shared glow1 accent but can be overridden per-card — the Review
// card passes the rating's own color so the glow reads as an extension of the score. Must be
// a 6-digit hex string (not a named color/rgb()) since the alpha suffixes below are appended
// directly onto it.
export function Glow({ size = 420, color = colors.glow1 }: { size?: number; color?: string } = {}) {
    const blurOuter = Math.round(size * 0.52);
    const spreadOuter = Math.round(size * 0.33);
    const blurInner = Math.round(size * 0.29);
    const spreadInner = Math.round(size * 0.14);
    return (
        <div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                display: 'flex',
                borderRadius: 999,
                background: color,
                opacity: 0.35,
                // Two shadow layers of the SAME color at different blur/spread give a soft
                // falloff without the two-tone ring an emerald+indigo blend used to produce.
                boxShadow: `0 0 ${blurOuter}px ${spreadOuter}px ${color}55, 0 0 ${blurInner}px ${spreadInner}px ${color}77`,
            }}
        />
    );
}

// Game DNA-only variant of Glow: a soft light that reads as falling from the card's top edge,
// not a shape sitting behind the hero number. Two earlier approaches failed for concrete
// reasons — a centered box-shadow-on-a-circle (Glow's own trick) left a visible hard-edged
// oval silhouette at this size, and a `linear-gradient(..., transparent)` fill rendered as a
// flat block with a hard cutoff (Satori/resvg doesn't interpolate color-to-transparent
// gradients smoothly). What works: the actual light comes entirely from a blurred box-shadow,
// and the box casting it sits fully off-canvas (bottom edge above y=0) so its own shape and
// fill (which rendered as opaque black regardless of 'transparent' vs 'rgba(0,0,0,0)') are
// never on-screen — only the shadow's blur, which isn't clipped to the box's bounds, bleeds
// down into the visible card.
export function TopGlow() {
    return (
        <div
            style={{
                position: 'absolute',
                top: -400,
                left: 0,
                width: '100%',
                height: 320,
                display: 'flex',
                background: 'rgba(0,0,0,0)',
                boxShadow: `0 0 260px 40px ${colors.glow1}55, 0 0 140px 20px ${colors.glow1}77`,
            }}
        />
    );
}

// `width`/`height` are explicit pixel numbers, not a CSS `aspect-ratio` shorthand — Satori's
// style parser mishandles `aspectRatio` (it appends "px" to the ratio value internally and
// throws), so frame sizing is computed by the caller instead. See `frameSize()` below.
export function GlassFrame({
    children,
    width,
    height,
    borderRadius = 34,
}: {
    children: React.ReactNode;
    width: number;
    height: number;
    borderRadius?: number;
}) {
    return (
        <div
            style={{
                position: 'relative',
                display: 'flex',
                width,
                height,
                borderRadius,
                padding: 10,
                background: colors.glassFill,
                border: `3px solid ${colors.glassBorder}`,
                boxShadow: '0 30px 70px -30px rgba(0,0,0,0.85)',
            }}
        >
            <div style={{ display: 'flex', width: '100%', height: '100%', borderRadius: borderRadius - 8, overflow: 'hidden' }}>
                {children}
            </div>
        </div>
    );
}

// Computes a GlassFrame's pixel width/height from a fraction of CONTENT_WIDTH and a target
// aspect ratio (width / height) — the safe replacement for CSS `aspect-ratio` (see above).
export function frameSize(widthFraction: number, aspectRatio: number): { width: number; height: number } {
    const width = Math.round(CONTENT_WIDTH * widthFraction);
    const height = Math.round(width / aspectRatio);
    return { width, height };
}

export function Divider() {
    return (
        <div
            style={{
                display: 'flex',
                height: 3,
                width: '100%',
                marginTop: 28,
                marginBottom: 24,
                background: `linear-gradient(90deg, transparent, ${colors.glow1}, transparent)`,
                boxShadow: `0 0 20px 2px ${colors.glow1}66`,
                opacity: 0.8,
            }}
        />
    );
}

// Always a two-sided row: arbitrary `left` content (identity block or plain text) and the
// Gamelogd mark + "gamelogd.net" pinned to the right. Never centered — keeps every card's
// footer consistent.
export function Footer({ left, logoSrc }: { left: React.ReactNode; logoSrc: string }) {
    return (
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>{left}</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} width={80} height={80} alt="" style={{ borderRadius: 22, opacity: 0.95 }} />
                <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: colors.muted }}>
                    gamelogd.net
                </div>
            </div>
        </div>
    );
}

// Small logo + stacked (primary bold / secondary muted) text — used by Devlog (project
// identity), Project (owner/org identity), Review, and Game DNA footers.
//
// `logoSrc` is optional — a missing user avatar should read as "no photo", not as the
// Gamelogd brand mark standing in for one (that read as if it were the user's actual
// profile picture). When it's absent this renders a plain initial-letter tile instead.
//
// `secondary` is optional — when omitted (Project's footer has nothing to put there), the
// text column collapses to just the primary line; the row's own `alignItems: 'center'`
// already re-centers that single line against the logo without any extra styling.
export function FooterIdentity({
    logoSrc,
    primary,
    secondary,
}: {
    logoSrc?: string | null;
    primary: string;
    secondary?: string;
}) {
    const initial = primary.replace(/^@/, '').trim().charAt(0).toUpperCase() || '?';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} width={80} height={80} alt="" style={{ borderRadius: 22, objectFit: 'cover' }} />
            ) : (
                <div
                    style={{
                        display: 'flex',
                        width: 80,
                        height: 80,
                        borderRadius: 22,
                        background: colors.glassFill,
                        border: `1px solid ${colors.glassBorder}`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 32,
                        fontWeight: 700,
                        color: colors.muted,
                    }}
                >
                    {initial}
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 38, fontWeight: 700, color: colors.text }}>{primary}</div>
                {secondary ? <div style={{ fontSize: 28, color: colors.muted, marginTop: 4 }}>{secondary}</div> : null}
            </div>
        </div>
    );
}

// Plain stacked (primary/secondary) text with no leading logo — Organisation's single-line
// footer ("Organisation in Gamelogd") is the only current user, always muted rather than the
// bold `colors.text` default — it's a category label, not an identity name.
export function FooterText({
    primary,
    secondary,
    color = colors.text,
}: {
    primary: string;
    secondary?: string;
    color?: string;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 38, fontWeight: 700, color }}>{primary}</div>
            {secondary ? <div style={{ fontSize: 28, color: colors.muted, marginTop: 4 }}>{secondary}</div> : null}
        </div>
    );
}

// Used when the entity is missing or private — never render real data in this branch, just a
// generic branded card, so a route never has to choose between a raw broken-image response
// and accidentally leaking private content into a "preview" image.
export function FallbackCard({ logoSrc, message }: { logoSrc: string; message: string }) {
    return (
        <CardShell>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} width={96} height={96} alt="" style={{ borderRadius: 28, opacity: 0.8 }} />
                <div style={{ display: 'flex', marginTop: 32, fontSize: 32, fontWeight: 700, color: colors.muted, textAlign: 'center' }}>
                    {message}
                </div>
            </div>
        </CardShell>
    );
}
