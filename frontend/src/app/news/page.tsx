import type { Metadata } from 'next';
import NewsListClient from './NewsListClient';

export const metadata: Metadata = {
    title: 'News',
    description: 'The latest gaming news, curated for gamers, developers, and investors on Gamelogd.',
    alternates: { canonical: '/news' },
    openGraph: { title: 'News | Gamelogd', description: 'The latest gaming news, curated for gamers, developers, and investors on Gamelogd.' },
};

export default function NewsListPage() {
    return <NewsListClient />;
}
