import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import QuotesClient from '@/components/QuotesClient';

type Props = { params: Promise<{ username: string; id: string }> };

interface PostMeta {
    id: number;
    user?: { username: string; settings?: { privateProfile?: boolean } };
}

function getPost(id: string) {
    return fetchForMetadata<PostMeta>(`/posts/${id}/`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username, id } = await params;
    const post = await getPost(id);
    if (!post) {
        return { title: 'Post not found' };
    }

    const isPrivate = !!post.user?.settings?.privateProfile;
    if (isPrivate) {
        return { title: 'Quotes', robots: { index: false, follow: false } };
    }

    const authorUsername = post.user?.username || username;

    return {
        title: `Quotes of ${authorUsername}'s post on Gamelogd`,
        alternates: { canonical: `/${username}/status/${id}/quotes` },
        robots: { index: false, follow: true },
    };
}

export default async function PostQuotesPage({ params }: Props) {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) {
        notFound();
    }

    return <QuotesClient targetType="post" targetId={id} />;
}
