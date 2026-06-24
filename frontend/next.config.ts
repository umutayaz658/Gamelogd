import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
              "connect-src 'self' https://gamelogd-production.up.railway.app http://localhost:8000 http://127.0.0.1:8000 https://accounts.google.com https://api.giphy.com; " +
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
