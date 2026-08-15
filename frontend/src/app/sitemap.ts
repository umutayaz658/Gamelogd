import type { MetadataRoute } from 'next';
import { fetchForMetadata } from '@/lib/server-fetch';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gamelogd.net';

interface SitemapData {
    games: { id: number }[];
    users: { username: string }[];
    reviews: { id: number; username: string }[];
    posts: { id: number; username: string }[];
    projects: { id: number; updated_at: string }[];
    organisations: { slug: string; updated_at: string }[];
    news: { id: number; pub_date: string }[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticEntries: MetadataRoute.Sitemap = [
        { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
        { url: `${SITE_URL}/explore`, changeFrequency: 'hourly', priority: 0.8 },
        { url: `${SITE_URL}/news`, changeFrequency: 'hourly', priority: 0.6 },
    ];

    // fetchForMetadata never throws — a down/unreachable backend just means we fall back to
    // the static entries rather than failing the whole sitemap (and the build, if this runs
    // at build time).
    const data = await fetchForMetadata<SitemapData>('/sitemap-data/');
    if (!data) return staticEntries;

    return [
        ...staticEntries,
        ...data.games.map((g): MetadataRoute.Sitemap[number] => ({
            url: `${SITE_URL}/games/${g.id}`, changeFrequency: 'weekly', priority: 0.7,
        })),
        ...data.users.map((u): MetadataRoute.Sitemap[number] => ({
            url: `${SITE_URL}/${u.username}`, changeFrequency: 'weekly', priority: 0.5,
        })),
        ...data.reviews.map((r): MetadataRoute.Sitemap[number] => ({
            url: `${SITE_URL}/${r.username}/review/${r.id}`, changeFrequency: 'monthly', priority: 0.4,
        })),
        ...data.posts.map((p): MetadataRoute.Sitemap[number] => ({
            url: `${SITE_URL}/${p.username}/status/${p.id}`, changeFrequency: 'monthly', priority: 0.3,
        })),
        ...data.projects.map((p): MetadataRoute.Sitemap[number] => ({
            url: `${SITE_URL}/projects/${p.id}`, lastModified: p.updated_at, changeFrequency: 'weekly', priority: 0.6,
        })),
        ...data.organisations.map((o): MetadataRoute.Sitemap[number] => ({
            url: `${SITE_URL}/organisations/${o.slug}`, lastModified: o.updated_at, changeFrequency: 'monthly', priority: 0.5,
        })),
        ...data.news.map((n): MetadataRoute.Sitemap[number] => ({
            url: `${SITE_URL}/news/${n.id}`, lastModified: n.pub_date, changeFrequency: 'daily', priority: 0.4,
        })),
    ];
}
