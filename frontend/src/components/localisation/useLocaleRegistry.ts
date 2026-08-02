'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { LocaleSummary } from '@/types';

interface LocaleRegistry {
    source_default: LocaleSummary;
    locales: LocaleSummary[];
}

// Module-level cache: the full locale registry is immutable per deploy (it's a code-defined
// constant on the backend, not a DB table), so every consumer shares one fetch instead of
// re-requesting it per mount. Only the Devs language-settings multi-select uses this — every
// other localisation surface reads a PROJECT's already-resolved language list off
// /projects/{id}/translation-keys/ instead.
let cache: Promise<LocaleRegistry> | null = null;

function fetchRegistry(): Promise<LocaleRegistry> {
    if (!cache) {
        cache = api.get('/localisation/locales/').then((res) => res.data).catch((err) => {
            cache = null; // allow a retry on the next mount if this fetch failed
            throw err;
        });
    }
    return cache;
}

export function useLocaleRegistry() {
    const [registry, setRegistry] = useState<LocaleRegistry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        fetchRegistry()
            .then((data) => { if (active) setRegistry(data); })
            .catch(() => { if (active) setRegistry(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    return { registry, loading };
}
