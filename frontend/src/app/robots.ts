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
                // '/login' is deliberately crawlable (unlike /register, /verify-email): it's a
                // real, distinct route here (root '/' is a separate marketing page, unlike e.g.
                // Twitter/X where the root domain doubles as the login screen), so indexing it
                // is what makes a "Log In" sitelink possible at all — see Reddit's own search
                // result for a working example of this exact pattern.
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
