/**
 * Market data configuration, read once from Vite env.
 *
 * Every module that needs to know where market data lives imports from here
 * instead of reading import.meta.env itself, so there is one place to look
 * and one place to typo.
 */

/** When true, fetch one small CSV per market from MARKET_DATA_BASE_URL. */
export const USE_SPLIT_CSV = import.meta.env.VITE_USE_SPLIT_CSV === 'true';

/** Base URL for split files, index and manifest (no trailing slash). */
export const MARKET_DATA_BASE_URL = (import.meta.env.VITE_MARKET_DATA_URL || '/data/markets').replace(/\/+$/, '');

/** Full-CSV mode sources (used only when USE_SPLIT_CSV is false). */
export const DEFAULT_ZHVI_PATH = import.meta.env.VITE_DEFAULT_CSV_URL || '/data/default-housing-data.csv';
export const DEFAULT_ZORI_PATH = import.meta.env.VITE_DEFAULT_ZORI_URL || '/data/default-rental-data.csv';

export const MANIFEST_URL = `${MARKET_DATA_BASE_URL}/manifest.json`;
export const MARKETS_INDEX_URL = `${MARKET_DATA_BASE_URL}/markets-index.json`;
