# Housing Data Pipeline

Scripts that turn Zillow's two city-level CSVs into the per-market files the app fetches from Cloud Storage. Run them from the repo root.

| Script | Command | What it does |
|---|---|---|
| `split-csv.ts` | `npm run split-csv` | Splits ZHVI + ZORI into one small CSV per market, writes `markets-index.json` and `manifest.json` |
| `verify-split.ts` | `npm run verify-split` | Checks a few split files parse cleanly (header/row field counts match, last value numeric) |
| `upload-to-cloud-storage.ts` | `npm run upload-csv` | Publishes the split output to the `housing-data-markets` bucket |

Shared code lives in `../shared/` (`marketKey.ts`, `csv.ts`) and is imported by both the scripts and the app so file names and CSV quoting can never drift apart.

## How the data reaches users

```
Zillow CSVs ──split-csv──▶ data/markets/            ──upload-csv──▶ gs://housing-data-markets/
                            ├── zhvi/<key>.csv          rsync, 1-year immutable cache
                            ├── zori/<key>.csv          rsync, 1-year immutable cache
                            ├── markets-index.json      cp,    1-year immutable cache
                            └── manifest.json           cp,    5-minute cache  ◀── uploaded last
```

Every CSV is served with `Cache-Control: public, max-age=31536000, immutable` under a stable name, so browsers keep it for a year. The app reads `manifest.json` (five-minute cache) once per session and appends `?v=<dataVersion>` to every other URL. A refresh therefore reaches returning users within five minutes, and clients only ever see a version whose files are all in place because the manifest goes up last.

`dataVersion` is `<last ZHVI date column>.<8 hex of sha256(zhvi + zori bytes)>`, e.g. `2026-08-31.848271e6`. It changes whenever the source bytes change, so a re-published month still busts the cache.

## Monthly refresh

1. **Download** the two Zillow city files and replace the local copies:
   - ZHVI: https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv → `housing-data-app/public/data/default-housing-data.csv`
   - ZORI: https://files.zillowstatic.com/research/public_csvs/zori/City_zori_uc_sfrcondomfr_sm_sa_month.csv → `housing-data-app/public/data/default-rental-data.csv`

   Both are public. In PowerShell:
   ```powershell
   curl.exe -sSL -o housing-data-app/public/data/default-housing-data.csv "https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv"
   curl.exe -sSL -o housing-data-app/public/data/default-rental-data.csv  "https://files.zillowstatic.com/research/public_csvs/zori/City_zori_uc_sfrcondomfr_sm_sa_month.csv"
   ```

2. **Split and verify** (about 40 seconds):
   ```powershell
   npm run split-csv
   npm run verify-split
   ```
   The output directory `data/markets/` (gitignored) is wiped first, so markets Zillow has dropped do not linger.

3. **Publish** (about 3–5 minutes for a full refresh; unchanged files are skipped):
   ```powershell
   npm run upload-csv -- --dry-run --skip-bucket-creation --skip-acl
   npm run upload-csv --           --skip-bucket-creation --skip-acl
   ```
   If the bucket already holds this exact `dataVersion` the script exits without doing anything. No app deployment is needed.

4. **Check**:
   ```powershell
   curl.exe -sI https://storage.googleapis.com/housing-data-markets/manifest.json | Select-String cache-control
   curl.exe -s  https://storage.googleapis.com/housing-data-markets/manifest.json
   ```
   Then open the app, hard-refresh once, and confirm a chart reaches the new month.

## split-csv options

```
npm run split-csv -- --zhvi=<path> --zori=<path> --output=<dir> --quiet
```

Notes:
- Fields are quoted per RFC 4180. Zillow's `Metro` and `CountyName` columns contain commas; before this was fixed, ~79% of markets had every date column shifted by one (issue #27).
- About 26 Zillow rows are distinct places sharing a name within a state (two "Sheridan, MI"). Only one file can carry that name, so the first row (Zillow's SizeRank order) is kept and the rest are reported as warnings.
- `markets-index.json` entries carry `hasRent: true|false` so the app can tell "no rental data" from "failed to load".
- Exit code is non-zero if any row fails to write.

## upload-csv options

```
--dry-run                 Show rsync's planned copies/deletes; touch nothing
--force                   Re-upload even if the bucket already has this dataVersion,
                          and override the safety guard below
--skip-bucket-creation    Don't describe/create the bucket (CI service accounts lack the permission)
--skip-acl                Don't (re)apply the allUsers objectViewer IAM binding
--cdn                     Also ensure a Cloud CDN backend bucket exists (off by default)
--bucket=<name>  --region=<region>  --source=<dir>  --cache-control=<value>
```

**Safety guard.** `rsync --delete-unmatched-destination-objects` will remove bucket objects that don't exist locally. If the local file count is below 90% of what the published manifest recorded, the script refuses to proceed. This is what stops a half-failed split from emptying the bucket. Don't remove it.

Public access is bucket-level IAM (`allUsers` → `roles/storage.objectViewer`), set once. Per-object ACLs are no longer used.

## One-time bucket setup

```powershell
gcloud storage buckets create gs://housing-data-markets --location=us-central1 --no-public-access-prevention
gcloud storage buckets add-iam-policy-binding gs://housing-data-markets --member=allUsers --role=roles/storage.objectViewer
gcloud storage buckets update gs://housing-data-markets --cors-file=cors.json   # see CLAUDE.md for cors.json
```

Or simply run `npm run upload-csv` once without `--skip-bucket-creation --skip-acl`.

## Cost

Roughly 26,000 objects at ~50 KB each is about 1.3 GB, or a few cents a month in storage. Egress for ~10k users viewing a handful of markets each is around $0.30/month. The Cloud Run container is separate and near-free at zero minimum instances.

## Troubleshooting

- **`gcloud is not authenticated`** or `invalid_grant` errors: credentials expire silently. Run `gcloud auth login`.
- **Refusing to rsync --delete**: the split produced far fewer files than last time. Check the source download completed (ZHVI should be 60–200 MB) before using `--force`.
- **Windows warnings from gcloud about invalid characters**: cosmetic, they concern gcloud's own temp-file names.
- **Old numbers still showing in the browser**: the deployed app must include the manifest/`?v=` support (v0.10.0+). Until then, hard-refresh.
