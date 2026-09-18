import { useState, useCallback, useEffect, useRef } from 'react';
import type { Market } from '../types';
import { createProvider, getProviderType, CSVProvider } from '../services/providers';
import { loadMarketsIndex, filterMarkets } from '../services/marketsIndex';
import { MOCK_MARKETS } from '../utils/constants';

interface UseMarketSearchResult {
  results: Market[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  search: (query: string) => void;
  clearResults: () => void;
}

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 100;
const MIN_QUERY_LENGTH = 2;

const searchMockData = (query: string): Market[] => {
  const q = query.toLowerCase();
  return MOCK_MARKETS.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.city.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q) ||
      m.zipCode?.includes(query)
  );
};

/**
 * Debounced market search.
 *
 * With the CSV provider the 21k-entry index is loaded once per session
 * (see services/marketsIndex.ts) and filtered in memory on each keystroke.
 * Falls back to the small mock list when no CSV provider is available or
 * the index cannot be loaded.
 */
export const useMarketSearch = (): UseMarketSearchResult => {
  const [results, setResults] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const debounceTimerRef = useRef<number | null>(null);
  // Only the most recent search may update state; older ones are discarded.
  const requestIdRef = useRef(0);

  const searchCSVData = useCallback(async (query: string): Promise<{ results: Market[]; total: number }> => {
    const provider = createProvider();

    if (getProviderType() === 'csv' && provider instanceof CSVProvider) {
      await provider.waitForDataLoad();
      const index = await loadMarketsIndex();
      const matches = filterMarkets(index, query);
      return { results: matches.slice(0, MAX_RESULTS), total: matches.length };
    }

    const mock = searchMockData(query);
    return { results: mock, total: mock.length };
  }, []);

  const performSearch = useCallback(
    async (query: string) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const { results: found, total } = await searchCSVData(query);
        if (requestId !== requestIdRef.current) return;
        setResults(found);
        setTotalCount(total);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error('[useMarketSearch] Search failed:', err);
        setError('Search failed. Showing available markets.');
        const mock = searchMockData(query);
        setResults(mock);
        setTotalCount(mock.length);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [searchCSVData]
  );

  const search = useCallback(
    (query: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      if (!query || query.length < MIN_QUERY_LENGTH) {
        requestIdRef.current++;
        setResults([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      debounceTimerRef.current = window.setTimeout(() => performSearch(query), DEBOUNCE_MS);
    },
    [performSearch]
  );

  const clearResults = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    requestIdRef.current++;
    setResults([]);
    setTotalCount(0);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timers = debounceTimerRef;
    return () => {
      if (timers.current) clearTimeout(timers.current);
    };
  }, []);

  return { results, loading, error, totalCount, search, clearResults };
};
