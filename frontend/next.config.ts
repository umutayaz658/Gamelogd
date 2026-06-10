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
};

export default nextConfig;
