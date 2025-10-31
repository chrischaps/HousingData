import { useState, useCallback, useEffect, useRef } from 'react';
import type { Market } from '../types';
import { createProvider, getProviderType, CSVProvider } from '../services/providers';
import { MOCK_MARKETS } from '../utils/constants';

interface UseMarketSearchResult {
  results: Market[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  search: (query: string) => void;
  clearResults: () => void;
}

/**
 * Custom hook for searching markets with debouncing
 * Searches through CSV data if available, falls back to mock data
 */
export const useMarketSearch = (): UseMarketSearchResult => {
  const [results, setResults] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce timer reference
  const debounceTimerRef = useRef<number | null>(null);

  // Abort controller for canceling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Search using CSV data (primary method)
   */
  const searchCSVData = useCallback(async (query: string): Promise<{ results: Market[], total: number }> => {
    const provider = createProvider();
    const providerType = getProviderType();

    console.log('[useMarketSearch] Searching with provider:', providerType);

    // If using CSV provider, search through markets index
    if (providerType === 'csv' && provider instanceof CSVProvider) {
      await provider.waitForDataLoad();

      // Load markets index
      const indexUrl = import.meta.env.VITE_USE_SPLIT_CSV === 'true'
        ? `${import.meta.env.VITE_MARKET_DATA_URL || '/data/markets'}/markets-index.json`
        : '/data/markets/markets-index.json';

      console.log('[useMarketSearch] Loading markets index from:', indexUrl);

      const response = await fetch(indexUrl);
      if (!response.ok) {
        throw new Error(`Failed to load markets index: ${response.statusText}`);
      }

      const marketsIndex: Market[] = await response.json();
      console.log('[useMarketSearch] CSV markets available:', marketsIndex.length);

      const lowerQuery = query.toLowerCase();

      // Search through all markets
      const allMatches = marketsIndex.filter(market => {
        const cityMatch = market.city.toLowerCase().includes(lowerQuery);
        const stateMatch = market.state.toLowerCase().includes(lowerQuery);
        const zipMatch = market.zipCode?.includes(query);
        const fullNameMatch = market.name.toLowerCase().includes(lowerQuery);

        return cityMatch || stateMatch || zipMatch || fullNameMatch;
      });

      const totalMatches = allMatches.length;

      // Limit displayed results to 100
      const limitedResults = allMatches.slice(0, 100);

      console.log('[useMarketSearch] Found matches:', { total: totalMatches, displayed: limitedResults.length });
      return { results: limitedResults, total: totalMatches };
    }

    // Fallback to mock data if CSV not available
    const mockResults = searchMockData(query);
    return { results: mockResults, total: mockResults.length };
  }, []);

  /**
   * Search using mock data (fallback when CSV is not available)
   */
  const searchMockData = useCallback((query: string): Market[] => {
    const lowerQuery = query.toLowerCase();
    return MOCK_MARKETS.filter(
      (market) =>
        market.name.toLowerCase().includes(lowerQuery) ||
        market.city.toLowerCase().includes(lowerQuery) ||
        market.state.toLowerCase().includes(lowerQuery) ||
        market.zipCode?.includes(query)
    );
  }, []);

  /**
   * Perform the actual search
   */
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      abortControllerRef.current = new AbortController();

      // Search through CSV data or fall back to mock data
      const { results: searchResults, total } = await searchCSVData(query);

      setResults(searchResults);
      setTotalCount(total);
      setError(null);
    } catch (err) {
      // If request was aborted, don't update state
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      console.error('Search error:', err);
      setError('Search failed. Showing available markets.');

      // Fall back to mock data on error
      const mockResults = searchMockData(query);
      setResults(mockResults);
      setTotalCount(mockResults.length);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [searchCSVData, searchMockData]);

  /**
   * Debounced search function
   */
  const search = useCallback(
    (query: string) => {
      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // If query is empty, clear results immediately
      if (!query || query.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Set loading state immediately for better UX
      setLoading(true);

      // Set new timer (300ms debounce)
      debounceTimerRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    },
    [performSearch]
  );

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setResults([]);
    setTotalCount(0);
    setError(null);
    setLoading(false);

    // Cancel any pending search
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    results,
    loading,
    error,
    totalCount,
    search,
    clearResults,
  };
};
