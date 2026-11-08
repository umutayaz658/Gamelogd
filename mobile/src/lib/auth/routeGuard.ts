import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { isAuthOnlyPath, isPublicBrowsablePath } from '@/lib/publicPaths';

/**
 * Client-side equivalent of frontend/src/middleware.ts — Expo Router has no edge
 * middleware, so this runs as a hook instead, re-checked on every navigation (the
 * `pathname` dependency). Presence-only, not validity — real enforcement stays
 * server-side via 401s (see lib/api.ts's response interceptor).
 *
 * Called once from the root layout (rather than once per route group, as the written
 * plan described) — same effect, one fewer place to keep in sync.
 */
export function useRouteGuard(): void {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (user && isAuthOnlyPath(pathname)) {
      router.replace('/');
      return;
    }

    if (!user && !isPublicBrowsablePath(pathname)) {
      router.replace('/login');
    }
  }, [user, isLoading, pathname]);
}
