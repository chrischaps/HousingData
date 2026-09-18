#!/usr/bin/env ts-node
/**
 * Split the Zillow ZHVI and ZORI city-level CSVs into one small file per
 * market, plus a search index and a data manifest.
 *
 * Output (default: <repo>/data/markets/, gitignored):
 *   zhvi/<market-key>.csv     one header row + one data row per market
 *   zori/<market-key>.csv
 *   markets-index.json        [{ id, name, city, state, marketKey, hasRent }]
 *   manifest.json             dataVersion + per-dataset summary (see lib/manifest.ts)
 *
 * The output directory is wiped first so markets Zillow has dropped do not
 * linger as stale files. Fields are quoted per RFC 4180: Zillow's Metro and
 * CountyName columns contain commas, and an unquoted rejoin shifted every
 * date column by one for ~79% of markets (issue #27).
 *
 * Usage:
 *   npm run split-csv
 *   npm run split-csv -- --zhvi=path/to/zhvi.csv --zori=path/to/zori.csv --output=path/to/out
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { marketKeyFromParts } from '../shared/marketKey';
import { toCsvLine } from '../shared/csv';
import {
  buildManifest,
  sha256File,
  writeManifest,
  MANIFEST_FILENAME,
  type DataManifest,
  type DatasetSummary,
} from './lib/manifest';

export const REPO_ROOT = path.resolve(__dirname, '..');

export const DEFAULT_PATHS = {
  zhviSource: path.join(REPO_ROOT, 'housing-data-app', 'public', 'data', 'default-housing-data.csv'),
  zoriSource: path.join(REPO_ROOT, 'housing-data-app', 'public', 'data', 'default-rental-data.csv'),
  outputDir: path.join(REPO_ROOT, 'data', 'markets'),
} as const;

export const INDEX_FILENAME = 'markets-index.json';

export interface MarketIndexEntry {
  id: string;
  name: string;
  city: string;
  state: string;
  marketKey: string;
  /** True when a zori/<marketKey>.csv exists for this market. */
  hasRent: boolean;
}

export interface SplitOptions {
  zhviSource?: string;
  zoriSource?: string;
  outputDir?: string;
  /** Extra fields recorded in manifest.run (CI fills these in). */
  run?: DataManifest['run'];
  /** Suppress progress output. */
  quiet?: boolean;
}

export interface SplitResult {
  outputDir: string;
  indexPath: string;
  manifestPath: string;
  manifest: DataManifest;
  markets: MarketIndexEntry[];
  /** Fatal per-row problems; a non-empty list fails the run. */
  errors: string[];
  /** Non-fatal notes, e.g. duplicate place names that share one slug. */
  warnings: string[];
  durationMs: number;
}

type DatasetType = 'zhvi' | 'zori';
type Row = Record<string, string>;

interface DatasetSplit {
  summary: DatasetSummary;
  /** RegionID -> index entry (without hasRent), in source order. */
  markets: Omit<MarketIndexEntry, 'hasRent'>[];
  keys: Set<string>;
  errors: string[];
  warnings: string[];
}

const DATE_COLUMN = /^\d{4}-\d{2}-\d{2}$/;
const WRITE_CONCURRENCY = 64;

const log = (quiet: boolean | undefined, ...args: unknown[]): void => {
  if (!quiet) console.log(...args);
};

/** Bounded-concurrency async writer so 21k files do not open 21k handles. */
class WritePool {
  private pending = new Set<Promise<void>>();

  constructor(private readonly limit: number) {}

  async add(task: () => Promise<void>): Promise<void> {
    const p = task().finally(() => this.pending.delete(p));
    this.pending.add(p);
    if (this.pending.size >= this.limit) {
      await Promise.race(this.pending);
    }
  }

  async drain(): Promise<void> {
    await Promise.all(this.pending);
  }
}

async function splitDataset(
  sourcePath: string,
  outputDir: string,
  type: DatasetType,
  quiet?: boolean
): Promise<DatasetSplit> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`${type.toUpperCase()} source not found: ${sourcePath}`);
  }

  log(quiet, `\n📊 Splitting ${type.toUpperCase()}: ${sourcePath}`);

  const dir = path.join(outputDir, type);
  fs.mkdirSync(dir, { recursive: true });

  const markets: DatasetSplit['markets'] = [];
  const keys = new Set<string>();
  const errors: string[] = [];
  const warnings: string[] = [];
  let headers: string[] | null = null;
  let rows = 0;
  let files = 0;

  const pool = new WritePool(WRITE_CONCURRENCY);
  const parser = fs.createReadStream(sourcePath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true, bom: true })
  );

  for await (const record of parser as AsyncIterable<Row>) {
    rows++;
    if (!headers) headers = Object.keys(record);

    if (rows % 2000 === 0) log(quiet, `   ${rows} rows...`);

    const regionId = record.RegionID ?? '';
    const regionName = record.RegionName ?? '';
    const state = record.State ?? '';

    try {
      if (!regionName || !state) {
        throw new Error('missing RegionName or State');
      }
      const marketKey = marketKeyFromParts(regionName, state);
      if (keys.has(marketKey)) {
        // Zillow lists distinct places with the same name in one state (e.g. two
        // "Sheridan, MI" in different counties). The URL scheme can only carry
        // one, so keep the first row, which Zillow orders by SizeRank.
        warnings.push(`${type}: "${regionName}, ${state}" appears more than once; kept the first, skipped RegionID ${regionId}`);
        continue;
      }
      keys.add(marketKey);

      const values = headers.map((h) => record[h] ?? '');
      const content = `${toCsvLine(headers)}\n${toCsvLine(values)}\n`;

      await pool.add(() => fs.promises.writeFile(path.join(dir, `${marketKey}.csv`), content, 'utf-8'));
      files++;

      markets.push({
        id: regionId,
        name: `${regionName}, ${state}`,
        city: regionName,
        state,
        marketKey,
      });
    } catch (error) {
      errors.push(`${type}: RegionID ${regionId} (${regionName}): ${(error as Error).message}`);
    }
  }

  await pool.drain();

  if (!headers || rows === 0) {
    throw new Error(`${type.toUpperCase()} source has no data rows`);
  }

  const dateColumns = headers.filter((h) => DATE_COLUMN.test(h));
  if (dateColumns.length === 0) {
    throw new Error(`${type.toUpperCase()} header has no YYYY-MM-DD date columns`);
  }

  const summary: DatasetSummary = {
    lastColumn: dateColumns[dateColumns.length - 1],
    rows,
    files,
    sourceBytes: fs.statSync(sourcePath).size,
    sha256: await sha256File(sourcePath),
  };

  log(quiet, `   ✅ ${files} files written (${rows} rows, data through ${summary.lastColumn})`);

  return { summary, markets, keys, errors, warnings };
}

/**
 * Run the full split: wipe output, split both datasets, write index + manifest.
 */
export async function runSplitter(options: SplitOptions = {}): Promise<SplitResult> {
  const zhviSource = options.zhviSource ?? DEFAULT_PATHS.zhviSource;
  const zoriSource = options.zoriSource ?? DEFAULT_PATHS.zoriSource;
  const outputDir = options.outputDir ?? DEFAULT_PATHS.outputDir;
  const { quiet } = options;
  const started = Date.now();

  log(quiet, '🚀 CSV Splitter');
  log(quiet, `   Output: ${outputDir}`);

  // Wipe, so markets that vanished from Zillow's file vanish from ours too.
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const zhvi = await splitDataset(zhviSource, outputDir, 'zhvi', quiet);
  const zori = await splitDataset(zoriSource, outputDir, 'zori', quiet);

  const markets: MarketIndexEntry[] = zhvi.markets.map((m) => ({
    ...m,
    hasRent: zori.keys.has(m.marketKey),
  }));

  const indexPath = path.join(outputDir, INDEX_FILENAME);
  fs.writeFileSync(indexPath, JSON.stringify(markets, null, 2) + '\n', 'utf-8');

  const manifest = buildManifest({ zhvi: zhvi.summary, zori: zori.summary, run: options.run });
  const manifestPath = path.join(outputDir, MANIFEST_FILENAME);
  writeManifest(manifestPath, manifest);

  const errors = [...zhvi.errors, ...zori.errors];
  const warnings = [...zhvi.warnings, ...zori.warnings];
  const durationMs = Date.now() - started;

  log(quiet, `\n📋 Index: ${markets.length} markets (${markets.filter((m) => m.hasRent).length} with rentals)`);
  log(quiet, `🏷️  Data version: ${manifest.dataVersion}`);
  log(quiet, `⏱️  ${(durationMs / 1000).toFixed(1)}s, ${errors.length} error(s), ${warnings.length} warning(s)`);

  return { outputDir, indexPath, manifestPath, manifest, markets, errors, warnings, durationMs };
}

/** Read GitHub Actions env so the manifest records where it came from. */
export function runInfoFromEnv(): DataManifest['run'] | undefined {
  const { GITHUB_SHA, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (!GITHUB_SHA) return undefined;
  const runUrl =
    GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
      ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
      : undefined;
  return { gitSha: GITHUB_SHA, ...(runUrl ? { runUrl } : {}) };
}

function parseArgs(argv: string[]): SplitOptions {
  const opts: SplitOptions = {};
  for (const arg of argv) {
    const [flag, value] = arg.split('=', 2);
    switch (flag) {
      case '--zhvi':
        opts.zhviSource = path.resolve(value);
        break;
      case '--zori':
        opts.zoriSource = path.resolve(value);
        break;
      case '--output':
        opts.outputDir = path.resolve(value);
        break;
      case '--quiet':
        opts.quiet = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

if (require.main === module) {
  runSplitter({ ...parseArgs(process.argv.slice(2)), run: runInfoFromEnv() })
    .then((result) => {
      if (result.warnings.length > 0) {
        console.log(`\nℹ️  ${result.warnings.length} warning(s):`);
        result.warnings.slice(0, 10).forEach((w) => console.log(`   - ${w}`));
        if (result.warnings.length > 10) console.log(`   ... and ${result.warnings.length - 10} more`);
      }
      if (result.errors.length > 0) {
        console.error(`\n⚠️  ${result.errors.length} error(s):`);
        result.errors.slice(0, 20).forEach((e) => console.error(`   - ${e}`));
        if (result.errors.length > 20) console.error(`   ... and ${result.errors.length - 20} more`);
        process.exit(1);
      }
      console.log('\n💡 Next: npm run upload-csv -- --dry-run');
    })
    .catch((error) => {
      console.error('\n❌ Split failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
