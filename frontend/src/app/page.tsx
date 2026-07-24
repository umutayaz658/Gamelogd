import { cookies } from 'next/headers';
import HomeClient from './HomeClient';
import { FeedItem } from '@/types';

// Server-side fetch of the initial for-you feed so the first paint has real content instead
// of a blank page → hydrate → spinner sequence. Fails soft: on any error (backend down, no
// cookie, network hiccup) we hand back null and HomeClient's own client-side SWR fetch takes
// over exactly as before — this must never throw and break the page render.
async function fetchInitialFeed(): Promise<FeedItem[] | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;
    // Server-side fetches run inside the Next.js server process, not the browser — in
    // docker-compose that means `localhost` resolves to the frontend container itself, not
    // the backend one. API_INTERNAL_URL (set to the backend's service DNS name in
    // docker-compose.yml) lets this reach it directly; falls back to the public URL for
    // deployments (e.g. Vercel + Railway) with no shared internal network.
    const publicApiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const apiBase = process.env.API_INTERNAL_URL || publicApiBase;

    const res = await fetch(`${apiBase}/feed/for-you/`, {
      headers: token ? { Authorization: `Token ${token}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) return null;

    // Django builds absolute media URLs (avatars, post images) from whatever Host the request
    // came in on — since this request went to the internal Docker hostname, those URLs come
    // back as e.g. http://backend:8000/media/..., which neither the browser nor next/image's
    // remotePatterns can resolve. Rewrite them to the public origin before this reaches the client.
    const internalOrigin = new URL(apiBase).origin;
    const publicOrigin = new URL(publicApiBase).origin;
    const text = await res.text();
    const rewritten = internalOrigin !== publicOrigin ? text.split(internalOrigin).join(publicOrigin) : text;
    return JSON.parse(rewritten);
  } catch {
    return null;
  }
}

export default async function Home() {
  const initialFeed = await fetchInitialFeed();
  return <HomeClient initialFeed={initialFeed} />;
}
