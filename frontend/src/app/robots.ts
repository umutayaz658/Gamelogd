import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gamelogd.net';

// Keep this list in sync with the gated routes in frontend/src/middleware.ts — that file is
// the actual access gate, this is just what well-behaved crawlers are told not to bother with.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/settings',
                '/messages',
                '/notifications',
                '/bookmarks',
                '/devs',
                '/collabs',
                '/invest',
                '/login',
                '/register',
                '/verify-email',
                '/*/recommended',
                '/organisations/*/dashboard',
                '/projects/*/dashboard',
            ],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
