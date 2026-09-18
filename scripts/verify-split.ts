/**
 * Sanity check on split output: quote-aware header/row field counts must
 * match and the last date column must carry a numeric value.
 *   npx ts-node scripts/verify-split.ts [market-key ...]
 */
import fs from 'fs';
import path from 'path';
import { parseCsvLine } from '../shared/csv';
import { DEFAULT_PATHS } from './split-csv';

const keys = process.argv.slice(2);
const targets = keys.length ? keys : ['new-york-ny', 'los-angeles-ca', 'detroit-mi', 'washington-dc'];
let failed = false;

for (const key of targets) {
  for (const type of ['zhvi', 'zori'] as const) {
    const file = path.join(DEFAULT_PATHS.outputDir, type, `${key}.csv`);
    if (!fs.existsSync(file)) { console.log(`${type}/${key}: (no file)`); continue; }
    const [h, r] = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
    const H = parseCsvLine(h), R = parseCsvLine(r);
    const ok = H.length === R.length && Number.isFinite(Number(R[R.length - 1]));
    if (!ok) failed = true;
    console.log(`${ok ? '✅' : '❌'} ${type}/${key}: ${H.length} header / ${R.length} row fields; ${H[H.length - 1]} = ${R[R.length - 1]}`);
  }
}
process.exit(failed ? 1 : 0);
