import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import QuotesClient from '@/components/QuotesClient';

type Props = { params: Promise<{ username: string; id: string }> };

interface ReviewMeta {
    id: number;
    user?: { username: string; settings?: { privateProfile?: boolean } };
    game?: { title: string };
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
        return { title: 'Quotes', robots: { index: false, follow: false } };
    }

    const authorUsername = review.user?.username || username;
    const gameTitle = review.game?.title || 'a game';

    return {
        title: `Quotes of ${authorUsername}'s review of ${gameTitle} on Gamelogd`,
        alternates: { canonical: `/${username}/review/${id}/quotes` },
        robots: { index: false, follow: true },
    };
}

export default async function ReviewQuotesPage({ params }: Props) {
    const { id } = await params;
    const review = await getReview(id);
    if (!review) {
        notFound();
    }

    return <QuotesClient targetType="review" targetId={id} />;
}
