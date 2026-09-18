/**
 * Data manifest: the small, short-cached file that tells the app which
 * version of the market data is current.
 *
 * Every CSV in the bucket is served with a one-year immutable cache header
 * under a stable name (zhvi/new-york-ny.csv). Browsers will therefore hold a
 * copy for a year. The app reads manifest.json (max-age=300) once per
 * session and appends `?v=<dataVersion>` to every CSV URL, so a refresh is
 * seen by returning users within five minutes instead of never.
 */

import crypto from 'crypto';
import fs from 'fs';

export const MANIFEST_SCHEMA_VERSION = 1;
export const MANIFEST_FILENAME = 'manifest.json';

export interface DatasetSummary {
  /** Last date column in the source CSV header, e.g. "2026-08-31". */
  lastColumn: string;
  /** Data rows in the source CSV. */
  rows: number;
  /** Split files written. */
  files: number;
  /** Byte size of the source CSV. */
  sourceBytes: number;
  /** SHA-256 of the source CSV bytes. */
  sha256: string;
}

export interface DataManifest {
  schemaVersion: number;
  /** `<zhvi lastColumn>.<8 hex of sha256(zhvi bytes + zori bytes)>` */
  dataVersion: string;
  generatedAt: string;
  zhvi: DatasetSummary;
  zori: DatasetSummary;
  source: { zhvi: string; zori: string };
  run?: { gitSha?: string; runUrl?: string };
}

export const ZILLOW_SOURCES = {
  zhvi: 'https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  zori: 'https://files.zillowstatic.com/research/public_csvs/zori/City_zori_uc_sfrcondomfr_sm_sa_month.csv',
} as const;

/** Stream a file through SHA-256 without loading it into memory. */
export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve())
      .on('error', reject);
  });
  return hash.digest('hex');
}

/** Combine the two source hashes into the short, human-readable version tag. */
export function computeDataVersion(lastColumn: string, zhviSha256: string, zoriSha256: string): string {
  const combined = crypto.createHash('sha256').update(zhviSha256).update(zoriSha256).digest('hex');
  return `${lastColumn}.${combined.slice(0, 8)}`;
}

export function buildManifest(input: {
  zhvi: DatasetSummary;
  zori: DatasetSummary;
  run?: DataManifest['run'];
}): DataManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    dataVersion: computeDataVersion(input.zhvi.lastColumn, input.zhvi.sha256, input.zori.sha256),
    generatedAt: new Date().toISOString(),
    zhvi: input.zhvi,
    zori: input.zori,
    source: { ...ZILLOW_SOURCES },
    ...(input.run ? { run: input.run } : {}),
  };
}

export function writeManifest(filePath: string, manifest: DataManifest): void {
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

export function readManifest(filePath: string): DataManifest | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DataManifest;
}

/**
 * Fetch the manifest currently published in the bucket. Returns null when the
 * bucket has none yet (first run) so callers can treat that as "no previous".
 */
export async function fetchRemoteManifest(bucketName: string): Promise<DataManifest | null> {
  const url = `https://storage.googleapis.com/${bucketName}/${MANIFEST_FILENAME}?t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Fetching remote manifest failed: HTTP ${res.status}`);
  return (await res.json()) as DataManifest;
}
