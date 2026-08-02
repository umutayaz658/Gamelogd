'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import type { TranslationKeyCatalog } from '@/types';

/**
 * Public, read-only fetch of a project's Devs-managed translation key catalogue (key/namespace/
 * base text + supported languages). Used by the public project page's Localisation tab, which
 * has no WorkspaceContext of its own to read this from directly (unlike the Devs Localisation
 * Manager, which already has the same data locally via useWorkspace().data.translationKeys).
 */
export function useCatalog(projectId: number | null) {
    const [catalog, setCatalog] = useState<TranslationKeyCatalog | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetchToken, setFetchToken] = useState(0);
    const refetch = useCallback(() => setFetchToken((n) => n + 1), []);

    // Flipping "loading" on (or clearing a stale catalog when there's no project) is a pure
    // state update, so it happens synchronously during render — keyed on projectId+fetchToken —
    // rather than as the first statement of the effect below. The effect itself only performs
    // the actual request and its async callbacks. See https://react.dev/learn/you-might-not-need-an-effect
    const fetchKey = `${projectId ?? ''}:${fetchToken}`;
    const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);
    if (fetchKey !== prevFetchKey) {
        setPrevFetchKey(fetchKey);
        if (projectId) setLoading(true);
        else setCatalog(null);
    }

    useEffect(() => {
        if (!projectId) return;
        api.get(`/projects/${projectId}/translation-keys/`)
            .then((res) => setCatalog(res.data))
            .catch(() => setCatalog(null))
            .finally(() => setLoading(false));
    }, [projectId, fetchToken]);

    return { catalog, loading, refetch };
}
