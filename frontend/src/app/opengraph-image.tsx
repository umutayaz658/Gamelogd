import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Gamelogd';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
    const logoData = await readFile(join(process.cwd(), 'public/branding/logo-mark.png'));
    const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} width={220} height={220} style={{ borderRadius: 48 }} />
                <div
                    style={{
                        marginTop: 40,
                        fontSize: 72,
                        fontWeight: 700,
                        color: '#f4f4f5',
                        letterSpacing: -1,
                    }}
                >
                    Gamelogd
                </div>
                <div
                    style={{
                        marginTop: 16,
                        fontSize: 30,
                        color: '#a1a1aa',
                    }}
                >
                    For those who play the game, and those who make the game
                </div>
            </div>
        ),
        { ...size }
    );
}
