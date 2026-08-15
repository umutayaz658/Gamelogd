import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import ReviewDetailClient from './ReviewDetailClient';

type Props = { params: Promise<{ username: string; id: string }> };

interface ReviewMeta {
    id: number;
    content?: string;
    rating?: number;
    user?: { username: string; settings?: { privateProfile?: boolean } };
    game?: { title: string; cover_image?: string };
}

function getReview(id: string) {
    return fetchForMetadata<ReviewMeta>(`/reviews/${id}/`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username, id } = await params;
    const review = await getReview(id);
    if (!review) {
        return { title: 'Review not found' };
    }

    const isPrivate = !!review.user?.settings?.privateProfile;
    if (isPrivate) {
        return { title: 'Review', robots: { index: false, follow: false } };
    }

    const gameTitle = review.game?.title || 'a game';
    const title = `${review.user?.username || username}'s review of ${gameTitle}`;
    const description = (review.content || `Rated ${review.rating ?? '?'}/10`).slice(0, 160);
    const images = review.game?.cover_image ? [{ url: review.game.cover_image }] : undefined;

    return {
        title,
        description,
        alternates: { canonical: `/${username}/review/${id}` },
        openGraph: { title, description, images },
        twitter: { card: 'summary_large_image', title, description, images: images?.map(i => i.url) },
    };
}

export default async function ReviewDetailPage({ params }: Props) {
    const { id } = await params;
    const review = await getReview(id);
    if (!review) {
        notFound();
    }

    return <ReviewDetailClient />;
}
