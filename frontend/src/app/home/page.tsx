import type { Metadata } from 'next';
import HomeClient from '../HomeClient';
import { fetchInitialFeed } from '@/lib/serverFeed';

export const metadata: Metadata = {
    alternates: { canonical: '/home' },
};

// Direct, always-reachable entry point to the real feed — for both signed-in visitors
// and anonymous ones (the backend's for_you() already has an anonymous-safe branch,
// same as Explore/News/profile pages). Unlike '/', this never shows the marketing
// page: it exists specifically so a visitor who wants the feed (not the pitch) can
// get straight to it, whether that's the "Home" nav link for a logged-out visitor or
// someone sharing this exact URL.
export default async function HomePage() {
    const initialFeed = await fetchInitialFeed();
    return <HomeClient initialFeed={initialFeed} />;
}
