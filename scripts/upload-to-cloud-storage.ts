#!/usr/bin/env ts-node
/**
 * Publish split market CSVs to Google Cloud Storage.
 *
 * Upload order matters and is the whole point of this script:
 *   1. rsync zhvi/   (deletes bucket objects that no longer exist locally)
 *   2. rsync zori/
 *   3. cp markets-index.json
 *   4. cp manifest.json   <- LAST, and the only short-cached object
 *
 * Clients read manifest.json (max-age=300) and append ?v=<dataVersion> to
 * every other URL, so they only ever see a version whose files are all in
 * place. Everything except the manifest stays immutable for a year.
 *
 * Safety: refuses to rsync with --delete when the local file count is below
 * 90% of what the previously published manifest recorded, so a half-failed
 * split cannot empty the bucket. Override with --force.
 *
 * Prerequisites: `npm run split-csv`, gcloud CLI authenticated with a project set.
 *
 * Usage:
 *   npm run upload-csv -- --dry-run
 *   npm run upload-csv
 *   npm run upload-csv -- --bucket=my-bucket --skip-bucket-creation --no-cdn --skip-acl
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DEFAULT_PATHS, INDEX_FILENAME } from './split-csv';
import { fetchRemoteManifest, readManifest, MANIFEST_FILENAME, type DataManifest } from './lib/manifest';

export interface UploadOptions {
  bucketName: string;
  /** Directory produced by split-csv (contains zhvi/, zori/, index, manifest). */
  baseDir: string;
  region: string;
  dryRun: boolean;
  /** Skip the bucket-exists/create step (CI service accounts lack bucket perms). */
  skipBucketCreation: boolean;
  /** Skip making the bucket public via IAM (already done once; CI skips). */
  skipAcl: boolean;
  enableCdn: boolean;
  /** Proceed even if local counts look suspiciously low vs. the published manifest. */
  force: boolean;
  immutableCacheControl: string;
  manifestCacheControl: string;
  /** Minimum local/previous file ratio before refusing to delete. */
  minFileRatio: number;
}

export interface UploadStats {
  zhviFiles: number;
  zoriFiles: number;
  dataVersion: string;
  previousVersion: string | null;
  durationMs: number;
}

export const DEFAULT_UPLOAD_OPTIONS: UploadOptions = {
  bucketName: 'housing-data-markets',
  baseDir: DEFAULT_PATHS.outputDir,
  region: 'us-central1',
  dryRun: false,
  skipBucketCreation: false,
  skipAcl: false,
  enableCdn: false,
  force: false,
  immutableCacheControl: 'public, max-age=31536000, immutable',
  manifestCacheControl: 'public, max-age=300, must-revalidate',
  minFileRatio: 0.9,
};

const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;

/* ------------------------------------------------------------------ */
/* gcloud invocation                                                    */
/* ------------------------------------------------------------------ */

/** Quote one argument for the shell so spaces/commas in headers survive. */
const shellQuote = (arg: string): string => `"${arg.replace(/(["\\$`])/g, '\\$1')}"`;

/**
 * Run gcloud with an argument array. Uses the shell (needed for gcloud.cmd on
 * Windows) but every argument is individually quoted; no user-supplied string
 * is ever interpolated raw.
 */
export function gcloud(args: string[], opts: { capture?: boolean } = {}): string {
  const command = ['gcloud', ...args.map(shellQuote)].join(' ');
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: opts.capture ? 'pipe' : 'inherit',
      maxBuffer: 64 * 1024 * 1024,
    }) ?? '';
  } catch (error) {
    const err = error as Error & { stderr?: string };
    throw new Error(`gcloud ${args[0]} ${args[1] ?? ''} failed: ${err.stderr?.trim() || err.message}`);
  }
}

function checkGcloudSetup(): { account: string; project: string } {
  gcloud(['--version'], { capture: true });
  const account = gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'], { capture: true }).trim();
  if (!account) throw new Error('gcloud is not authenticated. Run: gcloud auth login');
  const project = gcloud(['config', 'get-value', 'project'], { capture: true }).trim();
  if (!project || project === '(unset)') throw new Error('No gcloud project set. Run: gcloud config set project <id>');
  return { account, project };
}

/* ------------------------------------------------------------------ */
/* local checks                                                         */
/* ------------------------------------------------------------------ */

interface LocalData {
  zhviDir: string;
  zoriDir: string;
  indexPath: string;
  manifestPath: string;
  manifest: DataManifest;
  zhviFiles: number;
  zoriFiles: number;
}

function inspectLocal(baseDir: string): LocalData {
  const zhviDir = path.join(baseDir, 'zhvi');
  const zoriDir = path.join(baseDir, 'zori');
  const indexPath = path.join(baseDir, INDEX_FILENAME);
  const manifestPath = path.join(baseDir, MANIFEST_FILENAME);

  for (const p of [zhviDir, zoriDir, indexPath, manifestPath]) {
    if (!fs.existsSync(p)) {
      throw new Error(`Missing ${p}\n   Run: npm run split-csv`);
    }
  }

  const manifest = readManifest(manifestPath);
  if (!manifest) throw new Error(`Unreadable manifest at ${manifestPath}`);

  const count = (dir: string) => fs.readdirSync(dir).filter((f) => f.endsWith('.csv')).length;
  return {
    zhviDir,
    zoriDir,
    indexPath,
    manifestPath,
    manifest,
    zhviFiles: count(zhviDir),
    zoriFiles: count(zoriDir),
  };
}

function assertSafeToDelete(local: LocalData, previous: DataManifest | null, options: UploadOptions): void {
  if (!previous) return;
  const checks: Array<[string, number, number]> = [
    ['zhvi', local.zhviFiles, previous.zhvi.files],
    ['zori', local.zoriFiles, previous.zori.files],
  ];
  for (const [name, localCount, prevCount] of checks) {
    if (prevCount > 0 && localCount < prevCount * options.minFileRatio) {
      const msg =
        `${name}: local has ${localCount} files but the published manifest has ${prevCount}. ` +
        `Refusing to rsync --delete (ratio < ${options.minFileRatio}).`;
      if (!options.force) throw new Error(`${msg} Pass --force to override.`);
      console.warn(`⚠️  ${msg} Continuing because --force was given.`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* bucket operations                                                    */
/* ------------------------------------------------------------------ */

function ensureBucket(options: UploadOptions): void {
  const uri = `gs://${options.bucketName}`;
  try {
    gcloud(['storage', 'buckets', 'describe', uri], { capture: true });
    console.log(`✅ Bucket exists: ${uri}`);
    return;
  } catch {
    /* fall through to create */
  }
  if (options.dryRun) {
    console.log(`[DRY RUN] Would create bucket ${uri} in ${options.region}`);
    return;
  }
  console.log(`📦 Creating bucket ${uri} in ${options.region}`);
  gcloud(['storage', 'buckets', 'create', uri, `--location=${options.region}`, '--no-public-access-prevention']);
}

function makeBucketPublic(options: UploadOptions): void {
  const uri = `gs://${options.bucketName}`;
  if (options.dryRun) {
    console.log(`[DRY RUN] Would grant allUsers roles/storage.objectViewer on ${uri}`);
    return;
  }
  // Bucket-level IAM is sufficient; per-object ACLs are deliberately not set.
  gcloud(['storage', 'buckets', 'update', uri, '--no-public-access-prevention'], { capture: true });
  gcloud(['storage', 'buckets', 'add-iam-policy-binding', uri, '--member=allUsers', '--role=roles/storage.objectViewer'], {
    capture: true,
  });
  console.log(`✅ ${uri} is publicly readable (bucket IAM)`);
}

function rsyncDir(localDir: string, prefix: string, options: UploadOptions): void {
  const dest = `gs://${options.bucketName}/${prefix}`;
  console.log(`\n📤 rsync ${prefix}/ -> ${dest}${options.dryRun ? '  [DRY RUN]' : ''}`);
  const args = [
    'storage',
    'rsync',
    localDir,
    dest,
    '--recursive',
    '--delete-unmatched-destination-objects',
    '--content-type=text/csv',
    `--cache-control=${options.immutableCacheControl}`,
  ];
  if (options.dryRun) args.push('--dry-run');
  gcloud(args);
}

function copyObject(localPath: string, objectName: string, cacheControl: string, contentType: string, options: UploadOptions): void {
  const dest = `gs://${options.bucketName}/${objectName}`;
  if (options.dryRun) {
    console.log(`[DRY RUN] Would copy ${path.basename(localPath)} -> ${dest} (${cacheControl})`);
    return;
  }
  console.log(`📤 ${objectName} -> ${dest}`);
  gcloud(['storage', 'cp', localPath, dest, `--cache-control=${cacheControl}`, `--content-type=${contentType}`], {
    capture: true,
  });
}

function setupCdn(options: UploadOptions): void {
  const backendName = `${options.bucketName}-backend`;
  if (options.dryRun) {
    console.log(`[DRY RUN] Would ensure CDN backend bucket ${backendName}`);
    return;
  }
  try {
    gcloud(['compute', 'backend-buckets', 'describe', backendName], { capture: true });
    console.log(`✅ CDN backend exists: ${backendName}`);
  } catch {
    gcloud(['compute', 'backend-buckets', 'create', backendName, `--gcs-bucket-name=${options.bucketName}`, '--enable-cdn']);
    console.log(`✅ CDN backend created: ${backendName} (a load balancer is still needed; see scripts/README.md)`);
  }
}

/* ------------------------------------------------------------------ */
/* main                                                                 */
/* ------------------------------------------------------------------ */

export async function uploadSplitData(overrides: Partial<UploadOptions> = {}): Promise<UploadStats> {
  const options: UploadOptions = { ...DEFAULT_UPLOAD_OPTIONS, ...overrides };
  const started = Date.now();

  if (!BUCKET_NAME_PATTERN.test(options.bucketName)) {
    throw new Error(`Invalid bucket name: ${options.bucketName}`);
  }

  console.log('🚀 Upload split market data to Cloud Storage');
  console.log(`   Bucket:    gs://${options.bucketName}`);
  console.log(`   Source:    ${options.baseDir}`);
  console.log(`   Dry run:   ${options.dryRun}`);

  const { account, project } = checkGcloudSetup();
  console.log(`   gcloud:    ${account} @ ${project}`);

  const local = inspectLocal(options.baseDir);
  console.log(`   Local:     ${local.zhviFiles} zhvi, ${local.zoriFiles} zori, version ${local.manifest.dataVersion}`);

  const previous = await fetchRemoteManifest(options.bucketName);
  console.log(`   Published: ${previous ? previous.dataVersion : '(none yet)'}`);

  if (previous && previous.dataVersion === local.manifest.dataVersion && !options.force) {
    console.log('\n✅ Bucket already has this data version. Nothing to do (use --force to re-upload).');
    return {
      zhviFiles: local.zhviFiles,
      zoriFiles: local.zoriFiles,
      dataVersion: local.manifest.dataVersion,
      previousVersion: previous.dataVersion,
      durationMs: Date.now() - started,
    };
  }

  assertSafeToDelete(local, previous, options);

  if (!options.skipBucketCreation) ensureBucket(options);

  rsyncDir(local.zhviDir, 'zhvi', options);
  rsyncDir(local.zoriDir, 'zori', options);
  copyObject(local.indexPath, INDEX_FILENAME, options.immutableCacheControl, 'application/json', options);
  copyObject(local.manifestPath, MANIFEST_FILENAME, options.manifestCacheControl, 'application/json', options);

  if (!options.skipAcl) makeBucketPublic(options);
  if (options.enableCdn) setupCdn(options);

  const stats: UploadStats = {
    zhviFiles: local.zhviFiles,
    zoriFiles: local.zoriFiles,
    dataVersion: local.manifest.dataVersion,
    previousVersion: previous?.dataVersion ?? null,
    durationMs: Date.now() - started,
  };

  console.log('\n═══════════════════════════════════════');
  console.log(options.dryRun ? '✅ Dry run complete (no changes made)' : '✅ Upload complete');
  console.log('═══════════════════════════════════════');
  console.log(`Version:  ${stats.previousVersion ?? '(none)'} -> ${stats.dataVersion}`);
  console.log(`Files:    ${stats.zhviFiles} zhvi + ${stats.zoriFiles} zori`);
  console.log(`Duration: ${(stats.durationMs / 1000).toFixed(1)}s`);
  console.log(`Manifest: https://storage.googleapis.com/${options.bucketName}/${MANIFEST_FILENAME}`);

  return stats;
}

function parseArgs(argv: string[]): Partial<UploadOptions> {
  const opts: Partial<UploadOptions> = {};
  for (const arg of argv) {
    const [flag, value] = arg.split('=', 2);
    switch (flag) {
      case '--dry-run': opts.dryRun = true; break;
      case '--force': opts.force = true; break;
      case '--skip-bucket-creation': opts.skipBucketCreation = true; break;
      case '--skip-acl': opts.skipAcl = true; break;
      case '--cdn': opts.enableCdn = true; break;
      case '--no-cdn': opts.enableCdn = false; break;
      case '--bucket': opts.bucketName = value; break;
      case '--region': opts.region = value; break;
      case '--source': opts.baseDir = path.resolve(value); break;
      case '--cache-control': opts.immutableCacheControl = value; break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

if (require.main === module) {
  uploadSplitData(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error('\n❌ Upload failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
