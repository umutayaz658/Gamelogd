import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import GameLibraryClient from './GameLibraryClient';

type Props = { params: Promise<{ username: string }> };

interface ProfileMetaUser {
    username: string;
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

    if (user.settings?.privateProfile) {
        return {
            title: `@${user.username}'s game library`,
            description: 'This profile is private.',
            robots: { index: false, follow: false },
        };
    }

    const title = `@${user.username}'s game library`;
    const description = `Games @${user.username} has played, logged, and rated on Gamelogd.`;

    return {
        title,
        description,
        alternates: { canonical: `/${username}/games` },
        openGraph: { title, description },
        twitter: { card: 'summary_large_image', title, description },
    };
}

export default async function GameLibraryPage({ params }: Props) {
    const { username } = await params;
    const user = await getProfileUser(username);
    if (!user) {
        notFound();
    }

    return <GameLibraryClient username={username} />;
}
