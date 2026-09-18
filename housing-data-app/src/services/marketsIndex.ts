/**
 * Markets index: the searchable list of every market with a split file.
 *
 * Loaded once per page session (it is ~21k entries) and keyed to the current
 * data version so a refresh is picked up on the next load.
 */

import type { Market } from '../types';
import { MARKETS_INDEX_URL } from './providers/config';
import { withVersion } from './dataVersion';

export interface IndexedMarket extends Market {
  /** Slug that names this market's split files. */
  marketKey: string;
  /** Whether a rental (ZORI) file exists for this market. */
  hasRent?: boolean;
}

let indexPromise: Promise<IndexedMarket[]> | null = null;

export function loadMarketsIndex(): Promise<IndexedMarket[]> {
  if (indexPromise) return indexPromise;

  indexPromise = (async () => {
    const url = await withVersion(MARKETS_INDEX_URL);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load markets index: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as IndexedMarket[];
    if (!Array.isArray(data)) throw new Error('Markets index is not an array');
    return data;
  })().catch((error: unknown) => {
    // Let the next caller retry instead of pinning a failure for the session.
    indexPromise = null;
    throw error;
  });

  return indexPromise;
}

/** Case-insensitive substring match on city, state, name, or ZIP. */
export function filterMarkets(markets: readonly IndexedMarket[], query: string): IndexedMarket[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return markets.filter(
    (m) =>
      m.city.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      (m.zipCode?.includes(query) ?? false)
  );
}
