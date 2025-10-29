# Cloud Storage Setup Guide for Split CSV Files

This guide walks you through uploading the split CSV files to Google Cloud Storage with CDN enabled for optimal performance.

## Prerequisites

- Google Cloud Project with billing enabled
- `gcloud` CLI installed and authenticated
- Split CSV files generated (`npm run split-csv`)

## Step 1: Create Cloud Storage Bucket

```powershell
# Create bucket in us-central1 (or your preferred region)
gcloud storage buckets create gs://housing-data-markets `
  --location=us-central1 `
  --public-access-prevention

# Alternative: Create with uniform bucket-level access
gsutil mb -l us-central1 gs://housing-data-markets
```

## Step 2: Upload Split CSV Files

```powershell
# Upload all split files (this will take 5-10 minutes for 25k+ files)
gcloud storage cp -r housing-data-app/public/data/markets/* gs://housing-data-markets/

# Alternative using gsutil (if gcloud storage isn't available)
gsutil -m cp -r housing-data-app/public/data/markets/* gs://housing-data-markets/

# Verify upload
gcloud storage ls gs://housing-data-markets/
# Should show:
# gs://housing-data-markets/zhvi/
# gs://housing-data-markets/zori/
```

## Step 3: Make Files Publicly Readable

```powershell
# Grant allUsers read access
gcloud storage buckets add-iam-policy-binding gs://housing-data-markets `
  --member=allUsers `
  --role=roles/storage.objectViewer

# Alternative using gsutil
gsutil iam ch allUsers:objectViewer gs://housing-data-markets
```

## Step 4: Enable CDN (Optional but Recommended)

### Option A: Cloud Storage CDN via Load Balancer

```powershell
# Create backend bucket
gcloud compute backend-buckets create housing-data-backend `
  --gcs-bucket-name=housing-data-markets `
  --enable-cdn

# Create URL map
gcloud compute url-maps create housing-data-url-map `
  --default-backend-bucket=housing-data-backend

# Create HTTP proxy
gcloud compute target-http-proxies create housing-data-http-proxy `
  --url-map=housing-data-url-map

# Reserve IP address
gcloud compute addresses create housing-data-ip `
  --global

# Get the IP address
gcloud compute addresses describe housing-data-ip --global --format="get(address)"

# Create forwarding rule
gcloud compute forwarding-rules create housing-data-forwarding-rule `
  --global `
  --target-http-proxy=housing-data-http-proxy `
  --address=housing-data-ip `
  --ports=80
```

### Option B: Simple Public Access (No CDN)

If you don't need CDN, you can access files directly via:
```
https://storage.googleapis.com/housing-data-markets/zhvi/new-york-ny.csv
```

## Step 5: Update Environment Variables

### For Local Development

Update `housing-data-app/.env`:

```bash
# Enable split CSV mode
VITE_USE_SPLIT_CSV=true

# Point to Cloud Storage
VITE_MARKET_DATA_URL=https://storage.googleapis.com/housing-data-markets

# Or if using CDN with custom domain:
# VITE_MARKET_DATA_URL=https://data.yourdomain.com
```

### For Production (Cloud Run)

Update Cloud Build environment variables or Secret Manager:

```powershell
# Option 1: Update via Cloud Build substitution variables
# Edit cloudbuild.yaml and add to substitutions:
# _VITE_USE_SPLIT_CSV: "true"
# _VITE_MARKET_DATA_URL: "https://storage.googleapis.com/housing-data-markets"

# Option 2: Update via Cloud Run environment variables
gcloud run services update housing-data-app `
  --region us-central1 `
  --set-env-vars VITE_USE_SPLIT_CSV=true,VITE_MARKET_DATA_URL=https://storage.googleapis.com/housing-data-markets
```

## Step 6: Test the Setup

### Test Individual File Access

```powershell
# Test ZHVI file
curl https://storage.googleapis.com/housing-data-markets/zhvi/new-york-ny.csv

# Test ZORI file
curl https://storage.googleapis.com/housing-data-markets/zori/new-york-ny.csv
```

### Test in Application

1. Start dev server with split CSV enabled:
   ```powershell
   cd housing-data-app
   npm run dev
   ```

2. Open browser console and look for:
   ```
   [CSV Provider] Using split CSV mode
   [CSV Provider] Fetching split market files
   [CSV Provider] ✓ Loaded split market files
   ```

3. Verify network tab shows individual CSV file requests (~50KB each) instead of full 90MB download

## Performance Comparison

| Metric | Full CSV | Split CSV (Local) | Split CSV (Cloud Storage + CDN) |
|--------|----------|-------------------|--------------------------------|
| Initial Load | 90MB | 0MB | 0MB |
| Per Market | 0KB | ~50KB | ~50KB |
| First Market Load | Instant (cached) | 200ms | 100ms (CDN) |
| 5 Markets | 90MB | 250KB | 250KB |
| Cold Start | 5-10s | <1s | <500ms |

## Cost Estimate

**Monthly costs for 10,000 users viewing 5 markets each:**

- **Storage**: $0.026/GB × 0.5GB = $0.013/month
- **Network Egress** (Americas):
  - 10,000 users × 5 markets × 50KB = 2.5GB
  - First 1GB free, then $0.12/GB
  - Cost: $0.12 × 1.5GB = $0.18/month
- **CDN (optional)**:
  - Cache hit ratio: ~90%
  - Egress: 2.5GB × 10% = 0.25GB from origin
  - Cache egress: $0.08/GB × 2.25GB = $0.18/month
- **Total**: ~$0.40/month (with CDN) or ~$0.20/month (without CDN)

## Troubleshooting

### Files Not Found (404)

1. Check bucket permissions:
   ```powershell
   gcloud storage buckets get-iam-policy gs://housing-data-markets
   ```

2. Verify files exist:
   ```powershell
   gcloud storage ls gs://housing-data-markets/zhvi/ | head -n 10
   ```

3. Check file naming matches normalization:
   - Spaces → hyphens
   - Special characters → hyphens
   - All lowercase
   - Example: "New York, NY" → "new-york-ny"

### CORS Errors

If accessing from a different domain, add CORS configuration:

```powershell
# Create cors.json
echo '[
  {
    "origin": ["*"],
    "method": ["GET"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]' | Out-File -Encoding utf8 cors.json

# Apply CORS
gcloud storage buckets update gs://housing-data-markets --cors-file=cors.json

# Or with gsutil
gsutil cors set cors.json gs://housing-data-markets
```

### Slow Performance

1. Enable CDN (see Step 4)
2. Set cache headers on objects:
   ```powershell
   gcloud storage objects update gs://housing-data-markets/** `
     --cache-control="public, max-age=31536000"
   ```

3. Use Cloud Storage signed URLs for private buckets
4. Consider using Cloud CDN with custom domain

## Updating Data

When you need to update the housing data (new monthly Zillow data):

1. Download new ZHVI and ZORI files
2. Run splitter: `npm run split-csv`
3. Upload to Cloud Storage:
   ```powershell
   gcloud storage cp -r housing-data-app/public/data/markets/* gs://housing-data-markets/
   ```
4. Clear CDN cache (if using):
   ```powershell
   gcloud compute url-maps invalidate-cdn-cache housing-data-url-map `
     --path "/*"
   ```

## Rollback Plan

If split CSV mode causes issues, you can instantly rollback:

1. **Disable split mode**:
   ```bash
   # Update .env
   VITE_USE_SPLIT_CSV=false
   ```

2. **Rebuild and deploy**:
   ```powershell
   npm run build
   gcloud run deploy housing-data-app --source .
   ```

The app will revert to loading the full CSV files bundled with the deployment.

## Next Steps

- See `DATA_OPTIMIZATION_GUIDE.md` for other optimization approaches
- See `MIGRATION_PLAN.md` for migrating to PostgreSQL database
- Monitor Cloud Storage costs in Google Cloud Console

## Cleanup

To remove the Cloud Storage setup:

```powershell
# Delete forwarding rule (if using CDN)
gcloud compute forwarding-rules delete housing-data-forwarding-rule --global

# Delete HTTP proxy
gcloud compute target-http-proxies delete housing-data-http-proxy

# Delete URL map
gcloud compute url-maps delete housing-data-url-map

# Delete backend bucket
gcloud compute backend-buckets delete housing-data-backend

# Release IP address
gcloud compute addresses delete housing-data-ip --global

# Delete bucket and all files
gcloud storage rm -r gs://housing-data-markets
```
