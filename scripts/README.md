# Housing Data Scripts

Scripts for managing and deploying housing market data.

## Scripts

### 1. split-csv.ts

Splits the large Zillow ZHVI and ZORI CSV files into individual market files for on-demand loading.

**Usage:**
```powershell
npm run split-csv
```

**Output:**
- `housing-data-app/public/data/markets/zhvi/` - 21,450 home value files
- `housing-data-app/public/data/markets/zori/` - 4,017 rental files

**Duration:** ~30 seconds

### 2. upload-to-cloud-storage.ts

Uploads split CSV files to Google Cloud Storage with CDN configuration.

**Prerequisites:**
```powershell
# Install and authenticate with gcloud CLI
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Generate split files first
npm run split-csv
```

**Basic Usage:**
```powershell
# Upload to default bucket (housing-data-markets)
npm run upload-csv

# Dry run (preview what would be uploaded)
npm run upload-csv -- --dry-run

# Upload to specific bucket
npm run upload-csv -- --bucket=my-custom-bucket

# Upload to different region
npm run upload-csv -- --region=us-east1

# Upload without CDN setup
npm run upload-csv -- --no-cdn

# Upload as private (not publicly readable)
npm run upload-csv -- --private
```

**Advanced Options:**
```powershell
# Custom cache control headers
npm run upload-csv -- --cache-control="public, max-age=86400"

# Skip bucket creation (if bucket already exists)
npm run upload-csv -- --skip-bucket-creation

# Combine options
npm run upload-csv -- --bucket=my-bucket --region=europe-west1 --no-cdn
```

**What it does:**
1. ✅ Checks gcloud CLI setup and authentication
2. ✅ Verifies split CSV files exist
3. ✅ Creates Cloud Storage bucket (if needed)
4. ✅ Uploads ZHVI and ZORI files with caching headers
5. ✅ Makes bucket publicly readable
6. ✅ Sets up CDN backend (optional)
7. ✅ Prints access URLs and next steps

**Output:**
```
🚀 Upload Split CSV Files to Cloud Storage
═══════════════════════════════════════

📋 Configuration:
   Bucket: gs://housing-data-markets
   Region: us-central1
   Cache-Control: public, max-age=31536000
   Public: true
   CDN: true
   Dry Run: false

✅ Authenticated as: user@example.com
✅ Project: my-project

✅ Found 21450 ZHVI files
✅ Found 4017 ZORI files

📤 Uploading split CSV files to Cloud Storage...
✅ Uploaded 21450 ZHVI files
✅ Uploaded 4017 ZORI files

═══════════════════════════════════════
✅ Upload Complete!
═══════════════════════════════════════
Bucket: gs://housing-data-markets
ZHVI files: 21450
ZORI files: 4017
Total files: 25467
Duration: 127.45 seconds

📝 Next Steps:
   1. Update environment variables:
      VITE_USE_SPLIT_CSV=true
      VITE_MARKET_DATA_URL=https://storage.googleapis.com/housing-data-markets
   2. Deploy to Cloud Run:
      git push origin prod
   3. Test the deployment
```

## Workflow: Updating Housing Data

When new Zillow data is released (monthly), follow these steps:

### Step 1: Update Source CSVs

Download new ZHVI and ZORI files from Zillow and replace:
- `housing-data-app/public/data/default-housing-data.csv` (ZHVI)
- `housing-data-app/public/data/default-rental-data.csv` (ZORI)

### Step 2: Split CSVs

```powershell
npm run split-csv
```

This generates 25,467 individual market files.

### Step 3: Upload to Cloud Storage

```powershell
# Dry run first to preview
npm run upload-csv -- --dry-run

# Actually upload
npm run upload-csv
```

### Step 4: Invalidate CDN Cache (if using CDN)

```powershell
gcloud compute url-maps invalidate-cdn-cache housing-data-url-map --path "/*"
```

### Step 5: Verify

Test that new data is showing:
```powershell
# Check a specific market
curl https://storage.googleapis.com/housing-data-markets/zhvi/new-york-ny.csv
```

Visit your app and verify the latest month is showing in the charts.

## Cost Estimates

### Cloud Storage Costs

**Storage:**
- 25,467 files × 50KB average = ~1.3GB
- Cost: $0.026/GB/month × 1.3GB = **$0.034/month**

**Network Egress** (10,000 users × 5 markets × 70KB):
- 3.5GB/month transfer
- First 1GB free, then $0.12/GB
- Cost: $0.12 × 2.5GB = **$0.30/month**

**CDN** (optional, 90% cache hit rate):
- Reduces origin egress by 90%
- CDN egress: $0.08/GB × 3.5GB = **$0.28/month**
- Origin egress: $0.12/GB × 0.35GB = **$0.04/month**
- Total with CDN: **$0.32/month**

**Total Cost:** $0.30-0.35/month

## Troubleshooting

### "gcloud: command not found"

Install the gcloud CLI:
- **Windows**: https://cloud.google.com/sdk/docs/install#windows
- **Mac**: `brew install google-cloud-sdk`
- **Linux**: https://cloud.google.com/sdk/docs/install#linux

### "Not authenticated"

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### "Bucket already exists"

Use `--skip-bucket-creation` flag:
```powershell
npm run upload-csv -- --skip-bucket-creation
```

### "Permission denied"

Ensure you have these IAM roles:
- `roles/storage.admin` (to create buckets and upload files)
- `roles/compute.networkAdmin` (to create CDN backend)

```powershell
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/storage.admin"
```

### Upload is slow

The initial upload of 25k+ files takes 2-5 minutes depending on your internet connection. Subsequent uploads are faster since gcloud skips unchanged files.

To speed up:
- Use `--no-cdn` to skip CDN setup
- Upload from a machine with faster internet
- Use `gcloud storage` instead of `gsutil` (already used in script)

### Files not showing as public

Manually make bucket public:
```powershell
gcloud storage buckets add-iam-policy-binding gs://housing-data-markets \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

## See Also

- [CLOUD_STORAGE_SETUP.md](../CLOUD_STORAGE_SETUP.md) - Detailed Cloud Storage setup guide
- [SPLIT_CSV_README.md](../SPLIT_CSV_README.md) - Split CSV feature overview
- [DATA_OPTIMIZATION_GUIDE.md](../DATA_OPTIMIZATION_GUIDE.md) - Comprehensive optimization strategies
