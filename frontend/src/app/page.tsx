import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import HomeClient from './HomeClient';
import LandingPage from './LandingPage';
import { fetchInitialFeed } from '@/lib/serverFeed';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function Home() {
  const cookieStore = await cookies();
  // Mirrors middleware's own session check (both cookie names) so this branch can
  // never disagree with what the middleware already let through.
  const hasSession = !!(
    cookieStore.get('access_token')?.value || cookieStore.get('auth_token')?.value
  );

  // The root domain is the marketing/cover page for anonymous visitors (matches
  // classic Twitter: '/' is the pitch, while already-public content pages — Explore,
  // News, profiles, and now /home — are directly reachable without going through it).
  // Signed-in visitors still land on their real feed here, unchanged.
  if (!hasSession) {
    return <LandingPage />;
  }

  const initialFeed = await fetchInitialFeed();
  return <HomeClient initialFeed={initialFeed} />;
}
