import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import type { GameDetail } from '@/types';
import GameDetailClient from './GameDetailClient';

type Props = { params: Promise<{ id: string }> };

function getGame(id: string) {
    return fetchForMetadata<GameDetail>(`/games/${id}/details/`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const game = await getGame(id);
    if (!game) {
        return { title: 'Game not found' };
    }

    const description = (game.summary || game.description || '').slice(0, 160);
    const images = game.cover_image ? [{ url: game.cover_image }] : undefined;

    return {
        title: game.title,
        description,
        alternates: { canonical: `/games/${id}` },
        openGraph: { title: game.title, description, images },
        twitter: { card: 'summary_large_image', title: game.title, description, images: images?.map(i => i.url) },
    };
}

export default async function GameDetailPage({ params }: Props) {
    const { id } = await params;
    const game = await getGame(id);
    if (!game) {
        notFound();
    }

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: game.title,
        ...(game.cover_image ? { image: game.cover_image } : {}),
        ...(game.summary || game.description ? { description: game.summary || game.description } : {}),
        ...(game.release_date ? { datePublished: game.release_date } : {}),
        ...(game.genres && game.genres.length > 0 ? { genre: game.genres } : {}),
        ...(game.review_count && game.review_count > 0 ? {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: game.average_rating,
                ratingCount: game.review_count,
                bestRating: 10,
                worstRating: 0,
            },
        } : {}),
    };

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <GameDetailClient />
        </>
    );
}
