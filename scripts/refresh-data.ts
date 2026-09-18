#!/usr/bin/env ts-node
/**
 * End-to-end Zillow data refresh: download -> validate -> split -> publish -> verify.
 *
 * Designed to run unattended (GitHub Actions, weekly) and to be safe to run
 * any time: if Zillow has not published a newer month than the bucket
 * already holds, it exits 0 having changed nothing.
 *
 * Usage (repo root):
 *   npm run refresh-data                      # full refresh if newer data exists
 *   npm run refresh-data -- --dry-run         # download, validate, split, rsync --dry-run; publish nothing
 *   npm run refresh-data -- --force           # refresh even if the month is unchanged (re-publish)
 *   npm run fetch-data                        # = --download-only: just refresh the local source CSVs
 *   npm run refresh-data -- --skip-download   # use the source CSVs already on disk
 *   npm run refresh-data -- --bucket=<name>
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { runSplitter, runInfoFromEnv, DEFAULT_PATHS, REPO_ROOT } from './split-csv';
import { uploadSplitData, DEFAULT_UPLOAD_OPTIONS } from './upload-to-cloud-storage';
import { fetchRemoteManifest, ZILLOW_SOURCES, MANIFEST_FILENAME, type DataManifest } from './lib/manifest';
import { parseCsvLine } from '../shared/csv';

interface RefreshOptions {
  dryRun: boolean;
  force: boolean;
  downloadOnly: boolean;
  skipDownload: boolean;
  bucketName: string;
}

interface SourceInspection {
  path: string;
  bytes: number;
  headers: string[];
  lastColumn: string;
  rows: number;
  /** Rows whose last column holds a finite number. */
  filledLast: number;
}

/** Committed copy of the last published manifest; the git log becomes the changelog. */
const COMMITTED_MANIFEST = path.join(REPO_ROOT, 'scripts', 'data', MANIFEST_FILENAME);

const DATE_COLUMN = /^\d{4}-\d{2}-\d{2}$/;
const MB = 1024 * 1024;
const LIMITS = {
  zhvi: { minRows: 15_000, minBytes: 60 * MB, maxBytes: 200 * MB },
  zori: { minRows: 3_000, minBytes: 2 * MB, maxBytes: 20 * MB },
  rowDrift: 0.15,
  minFillRate: 0.8,
  retries: 3,
} as const;

const summaryLines: string[] = [];
const note = (line: string): void => {
  console.log(line);
  summaryLines.push(line);
};

/* ------------------------------------------------------------------ */
/* download                                                             */
/* ------------------------------------------------------------------ */

async function download(url: string, dest: string): Promise<number> {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= LIMITS.retries; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body as WebReadableStream), fs.createWriteStream(tmp));
      fs.renameSync(tmp, dest);
      return fs.statSync(dest).size;
    } catch (error) {
      lastError = error;
      fs.rmSync(tmp, { force: true });
      if (attempt < LIMITS.retries) {
        const wait = 2 ** attempt * 1000;
        console.warn(`   download attempt ${attempt} failed (${(error as Error).message}); retrying in ${wait / 1000}s`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw new Error(`Download failed after ${LIMITS.retries} attempts: ${url}\n${(lastError as Error)?.message ?? ''}`);
}

/* ------------------------------------------------------------------ */
/* inspect + validate                                                   */
/* ------------------------------------------------------------------ */

async function inspectSource(filePath: string): Promise<SourceInspection> {
  if (!fs.existsSync(filePath)) throw new Error(`Source file missing: ${filePath}`);
  const bytes = fs.statSync(filePath).size;

  let headers: string[] | null = null;
  let rows = 0;
  let filledLast = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.replace(/^﻿/, '');
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    rows++;
    const fields = parseCsvLine(line);
    if (Number.isFinite(Number(fields[fields.length - 1])) && fields[fields.length - 1] !== '') filledLast++;
  }

  if (!headers) throw new Error(`No header row in ${filePath}`);
  const dateColumns = headers.filter((h) => DATE_COLUMN.test(h));
  if (dateColumns.length === 0) throw new Error(`No YYYY-MM-DD columns in ${filePath}`);

  return { path: filePath, bytes, headers, lastColumn: dateColumns[dateColumns.length - 1], rows, filledLast };
}

function validate(
  kind: 'zhvi' | 'zori',
  src: SourceInspection,
  previous: DataManifest | null
): void {
  const lim = LIMITS[kind];
  const label = kind.toUpperCase();
  const fail = (msg: string): never => {
    throw new Error(`${label} validation failed: ${msg}`);
  };

  if (src.bytes < lim.minBytes || src.bytes > lim.maxBytes) {
    fail(`size ${(src.bytes / MB).toFixed(1)} MB outside ${lim.minBytes / MB}-${lim.maxBytes / MB} MB`);
  }
  if (src.rows < lim.minRows) fail(`only ${src.rows} rows (min ${lim.minRows})`);

  const prevRows = previous?.[kind]?.rows;
  if (prevRows && Math.abs(src.rows - prevRows) / prevRows > LIMITS.rowDrift) {
    fail(`row count ${src.rows} differs from previous ${prevRows} by more than ${LIMITS.rowDrift * 100}%`);
  }

  const fillRate = src.rows ? src.filledLast / src.rows : 0;
  if (fillRate < LIMITS.minFillRate) {
    fail(`only ${(fillRate * 100).toFixed(1)}% of rows have a value in ${src.lastColumn} (min ${LIMITS.minFillRate * 100}%)`);
  }
}

/* ------------------------------------------------------------------ */
/* post-publish verification                                           */
/* ------------------------------------------------------------------ */

async function postVerify(bucketName: string, manifest: DataManifest): Promise<void> {
  const base = `https://storage.googleapis.com/${bucketName}`;

  const remote = await fetchRemoteManifest(bucketName);
  if (!remote || remote.dataVersion !== manifest.dataVersion) {
    throw new Error(`Post-verify: bucket manifest is ${remote?.dataVersion ?? 'missing'}, expected ${manifest.dataVersion}`);
  }

  const sample = `${base}/zhvi/new-york-ny.csv?v=${encodeURIComponent(manifest.dataVersion)}`;
  const res = await fetch(sample);
  if (!res.ok) throw new Error(`Post-verify: ${sample} -> HTTP ${res.status}`);
  const cache = res.headers.get('cache-control') ?? '';
  if (!/immutable/.test(cache)) throw new Error(`Post-verify: unexpected Cache-Control on sample CSV: "${cache}"`);

  const [h, r] = (await res.text()).split(/\r?\n/);
  const H = parseCsvLine(h);
  const R = parseCsvLine(r);
  if (H.length !== R.length) throw new Error(`Post-verify: sample header has ${H.length} fields, row has ${R.length}`);
  if (H[H.length - 1] !== manifest.zhvi.lastColumn) {
    throw new Error(`Post-verify: sample last column ${H[H.length - 1]} != manifest ${manifest.zhvi.lastColumn}`);
  }
  note(`✅ Post-verify OK: manifest ${manifest.dataVersion}, sample NYC ${H[H.length - 1]} = ${R[R.length - 1]}`);
}

/* ------------------------------------------------------------------ */
/* main                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv: string[]): RefreshOptions {
  const opts: RefreshOptions = {
    dryRun: false,
    force: false,
    downloadOnly: false,
    skipDownload: false,
    bucketName: DEFAULT_UPLOAD_OPTIONS.bucketName,
  };
  for (const arg of argv) {
    const [flag, value] = arg.split('=', 2);
    switch (flag) {
      case '--dry-run': opts.dryRun = true; break;
      case '--force': opts.force = true; break;
      case '--download-only': opts.downloadOnly = true; break;
      case '--skip-download': opts.skipDownload = true; break;
      case '--bucket': opts.bucketName = value; break;
      case '': break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function writeStepSummary(title: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  fs.appendFileSync(file, `## ${title}\n\n${summaryLines.map((l) => `- ${l}`).join('\n')}\n`, 'utf-8');
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const started = Date.now();

  console.log('🔄 Zillow data refresh');
  console.log(`   bucket=${opts.bucketName} dryRun=${opts.dryRun} force=${opts.force} skipDownload=${opts.skipDownload}`);

  const previous = await fetchRemoteManifest(opts.bucketName);
  note(`Published: ${previous ? `${previous.dataVersion} (through ${previous.zhvi.lastColumn})` : 'none'}`);

  if (!opts.skipDownload) {
    console.log('\n⬇️  Downloading Zillow sources');
    const zBytes = await download(ZILLOW_SOURCES.zhvi, DEFAULT_PATHS.zhviSource);
    note(`Downloaded ZHVI ${(zBytes / MB).toFixed(1)} MB`);
    const rBytes = await download(ZILLOW_SOURCES.zori, DEFAULT_PATHS.zoriSource);
    note(`Downloaded ZORI ${(rBytes / MB).toFixed(1)} MB`);
  }

  if (opts.downloadOnly) {
    note('Download only; done.');
    writeStepSummary('Data refresh: download only');
    return;
  }

  console.log('\n🔎 Validating sources');
  const zhvi = await inspectSource(DEFAULT_PATHS.zhviSource);
  const zori = await inspectSource(DEFAULT_PATHS.zoriSource);
  validate('zhvi', zhvi, previous);
  validate('zori', zori, previous);
  note(`ZHVI: ${zhvi.rows} rows through ${zhvi.lastColumn}; ZORI: ${zori.rows} rows through ${zori.lastColumn}`);

  if (zori.lastColumn !== zhvi.lastColumn) {
    const [zy, zm] = zhvi.lastColumn.split('-').map(Number);
    const [ry, rm] = zori.lastColumn.split('-').map(Number);
    const monthsBehind = (zy - ry) * 12 + (zm - rm);
    if (monthsBehind === 1) {
      note(`⚠️  ZORI lags ZHVI by one month (${zori.lastColumn} vs ${zhvi.lastColumn}); continuing`);
    } else {
      throw new Error(`ZORI last column ${zori.lastColumn} does not line up with ZHVI ${zhvi.lastColumn}`);
    }
  }

  const isNewer = !previous || zhvi.lastColumn > previous.zhvi.lastColumn;
  if (!isNewer && !opts.force) {
    note(`No newer data: Zillow's latest month ${zhvi.lastColumn} is already published. Nothing to do.`);
    writeStepSummary('Data refresh: no new data');
    return;
  }

  console.log('\n✂️  Splitting');
  const split = await runSplitter({ run: runInfoFromEnv(), quiet: true });
  if (split.errors.length > 0) {
    split.errors.slice(0, 20).forEach((e) => console.error(`   - ${e}`));
    throw new Error(`Split produced ${split.errors.length} error(s)`);
  }
  note(`Split: ${split.manifest.zhvi.files} zhvi + ${split.manifest.zori.files} zori files, version ${split.manifest.dataVersion}`);
  if (split.warnings.length) note(`Split warnings: ${split.warnings.length} (duplicate place names, first kept)`);

  if (previous && previous.dataVersion === split.manifest.dataVersion && !opts.force) {
    note('Source bytes identical to what is published; nothing to upload.');
    writeStepSummary('Data refresh: unchanged');
    return;
  }

  console.log('\n☁️  Publishing');
  await uploadSplitData({
    bucketName: opts.bucketName,
    dryRun: opts.dryRun,
    force: opts.force,
    skipBucketCreation: true,
    skipAcl: true,
    enableCdn: false,
  });

  if (opts.dryRun) {
    note('Dry run: nothing was published.');
    writeStepSummary('Data refresh: dry run');
    return;
  }

  await postVerify(opts.bucketName, split.manifest);

  fs.mkdirSync(path.dirname(COMMITTED_MANIFEST), { recursive: true });
  fs.copyFileSync(split.manifestPath, COMMITTED_MANIFEST);
  note(`Wrote ${path.relative(REPO_ROOT, COMMITTED_MANIFEST)} for commit`);

  note(`Refreshed ${previous?.dataVersion ?? '(none)'} -> ${split.manifest.dataVersion} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  writeStepSummary(`Data refresh: ${split.manifest.dataVersion}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Refresh failed:', error instanceof Error ? error.message : error);
    summaryLines.push(`❌ ${error instanceof Error ? error.message : String(error)}`);
    writeStepSummary('Data refresh: FAILED');
    process.exit(1);
  });
}
