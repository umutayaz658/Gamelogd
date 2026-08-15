import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import NewsDetailClient from './NewsDetailClient';

type Props = { params: Promise<{ id: string }> };

interface NewsMeta {
    id: number;
    title: string;
    description?: string;
    image_url?: string | null;
    pub_date?: string;
}

function getNews(id: string) {
    return fetchForMetadata<NewsMeta>(`/news/${id}/`);
}

// RSS-sourced image_url isn't guaranteed https — an http:// og:image gets silently
// rejected/mixed-content-blocked by most unfurlers, so only use it when it parses as https.
function safeImageUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    try {
        return new URL(url).protocol === 'https:' ? url : undefined;
    } catch {
        return undefined;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const news = await getNews(id);
    if (!news) {
        return { title: 'News not found' };
    }

    const description = (news.description || '').slice(0, 160);
    const imageUrl = safeImageUrl(news.image_url);
    const images = imageUrl ? [{ url: imageUrl }] : undefined;

    return {
        title: news.title,
        description,
        alternates: { canonical: `/news/${id}` },
        openGraph: { title: news.title, description, images, type: 'article' },
        twitter: { card: 'summary_large_image', title: news.title, description, images: images?.map(i => i.url) },
    };
}

export default async function NewsDetailPage({ params }: Props) {
    const { id } = await params;
    const news = await getNews(id);
    if (!news) {
        notFound();
    }

    const imageUrl = safeImageUrl(news.image_url);
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: news.title,
        ...(imageUrl ? { image: imageUrl } : {}),
        ...(news.pub_date ? { datePublished: news.pub_date } : {}),
        ...(news.description ? { description: news.description } : {}),
    };

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <NewsDetailClient />
        </>
    );
}
