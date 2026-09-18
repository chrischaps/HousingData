/**
 * Data version: which publication of the market data this session is on.
 *
 * Every split CSV in the bucket is served under a stable name with a one-year
 * immutable cache header. Browsers will keep a copy for a year, so overwriting
 * the object does nothing for returning visitors. Instead the pipeline writes
 * a small manifest.json (cached five minutes) carrying a `dataVersion`, and we
 * append `?v=<dataVersion>` to every data URL. New version, new URL, fresh
 * bytes. Old version, old URL, cached bytes. Either way, correct.
 *
 * Failure mode is graceful: if the manifest can't be read, URLs go out bare,
 * which is exactly what the app did before versioning existed.
 */

import { MANIFEST_URL, USE_SPLIT_CSV } from './providers/config';

export interface DatasetSummary {
  lastColumn: string;
  rows: number;
  files: number;
  sourceBytes: number;
  sha256: string;
}

export interface DataManifest {
  schemaVersion: number;
  dataVersion: string;
  generatedAt: string;
  zhvi: DatasetSummary;
  zori: DatasetSummary;
  source: { zhvi: string; zori: string };
  run?: { gitSha?: string; runUrl?: string };
}

const STORAGE_KEY = 'market-data-version';

let manifestPromise: Promise<DataManifest | null> | null = null;
let resolvedVersion: string | null = null;

/**
 * Fetch and memoize the manifest for this page session.
 * `cache: 'no-cache'` forces revalidation; GCS answers 304 when unchanged.
 */
export function getDataManifest(): Promise<DataManifest | null> {
  if (!USE_SPLIT_CSV) return Promise.resolve(null);
  if (manifestPromise) return manifestPromise;

  manifestPromise = fetch(MANIFEST_URL, { cache: 'no-cache' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = (await res.json()) as DataManifest;
      if (typeof manifest.dataVersion !== 'string' || !manifest.dataVersion) {
        throw new Error('manifest has no dataVersion');
      }
      rememberVersion(manifest.dataVersion);
      return manifest;
    })
    .catch((error: unknown) => {
      console.warn('[dataVersion] Manifest unavailable; using unversioned URLs', error);
      resolvedVersion = '';
      return null;
    });

  return manifestPromise;
}

/** The current version string, or '' when unknown / not in split mode. */
export async function getDataVersion(): Promise<string> {
  const manifest = await getDataManifest();
  return manifest?.dataVersion ?? '';
}

/**
 * Synchronous best-effort read for UI: the version resolved this session,
 * else the one remembered from a previous visit, else ''.
 */
export function getDataVersionSync(): string {
  if (resolvedVersion !== null) return resolvedVersion;
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Append `?v=<version>` to a data URL. No-op when the version is unknown. */
export async function withVersion(url: string): Promise<string> {
  const v = await getDataVersion();
  if (!v) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}`;
}

/** "Aug 2026" from a manifest lastColumn like "2026-08-31". */
export function formatDataThrough(lastColumn: string | undefined): string {
  if (!lastColumn) return '';
  const [y, m] = lastColumn.split('-').map(Number);
  if (!y || !m) return lastColumn;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function rememberVersion(version: string): void {
  resolvedVersion = version;
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* storage may be unavailable (private mode); the session copy is enough */
  }
}
