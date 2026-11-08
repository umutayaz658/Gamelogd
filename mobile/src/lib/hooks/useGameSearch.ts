import { useEffect, useRef, useState } from 'react';

import api, { unwrapList } from '@/lib/api';
import { Game } from '@/types';

interface UseGameSearchOptions {
  debounceMs?: number;
  minLength?: number;
}

interface UseGameSearchResult {
  query: string;
  setQuery: (q: string) => void;
  results: Game[];
  isLoading: boolean;
}

// Consolidates what web independently duplicates between GameSearchModal.tsx and
// LogGameModal.tsx's own step-1 search (same 500ms debounce, same >1-char threshold,
// same GET /games/?search= call — not a deliberate difference, see Faz 2 plan decision
// 9). Guards against stale responses landing after a faster-typed later query by
// ignoring any response whose request is no longer the latest fired.
export function useGameSearch(options: UseGameSearchOptions = {}): UseGameSearchResult {
  const { debounceMs = 500, minLength = 2 } = options;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const latestRequestId = useRef(0);

  const trimmed = query.trim();
  const meetsMinLength = trimmed.length >= minLength;

  useEffect(() => {
    if (!meetsMinLength) {
      // Invalidate any in-flight request instead of calling setState here — the hook's
      // returned `results`/`isLoading` are already masked to empty/false below the
      // threshold, so there's nothing to reset.
      latestRequestId.current += 1;
      return undefined;
    }

    const requestId = ++latestRequestId.current;
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get<Game[] | { results: Game[] }>('/games/', { params: { search: trimmed } });
        if (latestRequestId.current === requestId) {
          setResults(unwrapList(data));
        }
      } catch (error) {
        console.error('Game search failed:', error);
        if (latestRequestId.current === requestId) {
          setResults([]);
        }
      } finally {
        if (latestRequestId.current === requestId) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [meetsMinLength, trimmed, debounceMs]);

  return {
    query,
    setQuery,
    results: meetsMinLength ? results : [],
    isLoading: meetsMinLength ? isLoading : false,
  };
}
