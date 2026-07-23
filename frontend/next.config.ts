import type { NextConfig } from 'next';
import path from 'path';

// Derive the API origin (scheme://host[:port]) from NEXT_PUBLIC_API_URL so the CSP
// connect-src always matches whatever backend the frontend is actually configured to
// call (e.g. https://api.gamelogd.net). Without this the browser blocks every API
// request when the backend host changes. Falls back to nothing if the env is unset/invalid.
function apiOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
  try {
    // NEXT_PUBLIC_API_URL may be a bare host or a full URL with an /api path — normalise both.
    const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

const API_ORIGIN = apiOrigin();

// Known API hosts across environments. The env-derived origin is added first so the
// live backend is always allowed; the rest keep local dev and the legacy Railway host working.
const CONNECT_SRC = [
  "'self'",
  API_ORIGIN,
  'https://api.gamelogd.net',
  'https://gamelogd-production.up.railway.app',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'https://accounts.google.com',
  'https://api.giphy.com',
]
  .filter((v, i, arr) => v && arr.indexOf(v) === i)
  .join(' ');

const nextConfig: NextConfig = {
  // @ts-ignore
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      // IGDB screenshots & covers
      {
        protocol: 'https',
        hostname: 'images.igdb.com',
        pathname: '/**',
      },
      // Steam CDN covers
      {
        protocol: 'https',
        hostname: 'cdn.akamai.steamstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net',
        pathname: '/**',
      },
      // Cloudinary (user avatars, uploaded media)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      // Railway backend media (production)
      {
        protocol: 'https',
        hostname: 'gamelogd-production.up.railway.app',
        pathname: '/**',
      },
      // Local dev backend
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
      // UI Avatars fallback
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        pathname: '/**',
      },
      // Placeholder fallback
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
    ],
  },
  // @ts-ignore
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://gsi.gstatic.com; " +
              "style-src 'self' 'unsafe-inline' https://accounts.google.com https://gsi.gstatic.com https://fonts.googleapis.com; " +
              "img-src * data: blob:; " +
              `connect-src ${CONNECT_SRC}; ` +
              "frame-src 'self' https://accounts.google.com; " +
              "font-src 'self' data: https://fonts.gstatic.com; " +
              "frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
