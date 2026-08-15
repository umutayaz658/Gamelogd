import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import StatusDetailClient from './StatusDetailClient';

type Props = { params: Promise<{ username: string; id: string }> };

interface PostMeta {
    id: number;
    content?: string;
    image?: string | null;
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
        return { title: 'Post', robots: { index: false, follow: false } };
    }

    const authorUsername = post.user?.username || username;
    const title = `${authorUsername} on Gamelogd`;
    const description = (post.content || '').slice(0, 160);
    const images = post.image ? [{ url: post.image }] : undefined;

    return {
        title,
        description,
        alternates: { canonical: `/${username}/status/${id}` },
        openGraph: { title, description, images },
        twitter: { card: 'summary_large_image', title, description, images: images?.map(i => i.url) },
    };
}

export default async function StatusDetailPage({ params }: Props) {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) {
        notFound();
    }

    return <StatusDetailClient />;
}
