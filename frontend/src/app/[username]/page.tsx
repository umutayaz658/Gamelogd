import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import ProfileClient from './ProfileClient';

type Props = { params: Promise<{ username: string }> };

interface ProfileMetaUser {
    username: string;
    real_name?: string;
    avatar?: string;
    bio?: string;
    settings?: { privateProfile?: boolean };
}

function getProfileUser(username: string) {
    return fetchForMetadata<ProfileMetaUser>(`/users/${username}/`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username } = await params;
    const user = await getProfileUser(username);
    if (!user) {
        return { title: 'User not found' };
    }

    const isPrivate = !!user.settings?.privateProfile;
    if (isPrivate) {
        return {
            title: `@${user.username}`,
            description: 'This profile is private.',
            robots: { index: false, follow: false },
        };
    }

    const title = user.real_name ? `${user.real_name} (@${user.username})` : `@${user.username}`;
    const description = user.bio || `@${user.username} on Gamelogd`;
    const images = user.avatar ? [{ url: user.avatar }] : undefined;

    return {
        title,
        description,
        alternates: { canonical: `/${username}` },
        openGraph: { title, description, images },
        twitter: { card: 'summary_large_image', title, description, images: images?.map(i => i.url) },
    };
}

export default async function ProfilePage({ params }: Props) {
    const { username } = await params;
    const user = await getProfileUser(username);
    if (!user) {
        notFound();
    }

    const isPrivate = !!user.settings?.privateProfile;

    const jsonLd = isPrivate ? null : {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
            '@type': 'Person',
            name: user.real_name || user.username,
            alternateName: user.username,
            ...(user.bio ? { description: user.bio } : {}),
            ...(user.avatar ? { image: user.avatar } : {}),
        },
    };

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <ProfileClient username={username} />
        </>
    );
}
