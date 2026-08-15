import type { Metadata } from 'next';
import ExploreClient from './ExploreClient';

export const metadata: Metadata = {
    title: 'Explore',
    description: 'Discover trending posts, reviews, and hashtags from gamers and developers on Gamelogd.',
    alternates: { canonical: '/explore' },
    openGraph: { title: 'Explore | Gamelogd', description: 'Discover trending posts, reviews, and hashtags from gamers and developers on Gamelogd.' },
};

export default function ExplorePage() {
    return <ExploreClient />;
}
