# Housing Data App - Deployment Guide

Complete deployment instructions for the production housing-data-app to Google Cloud Run.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [Google Cloud Setup](#google-cloud-setup)
4. [CI/CD Deployment](#cicd-deployment)
5. [Manual Deployment](#manual-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Post-Deployment](#post-deployment)

## Prerequisites

- Google Cloud Platform account
- Firebase project
- GitHub repository
- `gcloud` CLI installed and authenticated
- Node.js 18+ (for local testing)

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Name your project (e.g., `housing-data`)
4. Follow the setup wizard

### 2. Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click **Get Started**
3. Go to **Sign-in method** tab
4. Enable **Google** provider
5. Click **Save**

### 3. Set Up Firestore Database

1. Go to **Firestore Database**
2. Click **Create database**
3. Choose **Production mode**
4. Select a location (e.g., `us-central`)

### 4. Deploy Firestore Security Rules

1. Go to **Firestore Database** > **Rules** tab
2. Copy the following rules from `housing-data-app/firestore.rules`:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Favorites collection rules
    match /favorites/{favoriteId} {
      allow read: if request.auth != null
        && request.auth.uid == resource.data.userId;

      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;

      allow update: if request.auth != null
        && request.auth.uid == resource.data.userId
        && request.auth.uid == request.resource.data.userId;

      allow delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }

    match /favorites/{document=**} {
      allow list: if request.auth != null
        && request.query.limit <= 100;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **Publish**

### 5. Get Firebase Configuration

1. Go to **Project Settings** (⚙️ icon)
2. Scroll to **Your apps** section
3. Click the web app icon (`</>`) or select your existing web app
4. Copy the `firebaseConfig` object - you'll need these values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

## Google Cloud Setup

### 1. Create/Select GCP Project

```powershell
# Set your project ID
$PROJECT_ID = "your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 2. Store Firebase Config in Secret Manager

Create secrets for each Firebase configuration value:

```powershell
# Replace with your actual values from Firebase
echo -n "your_api_key" | gcloud secrets create VITE_FIREBASE_API_KEY --data-file=-
echo -n "your_project.firebaseapp.com" | gcloud secrets create VITE_FIREBASE_AUTH_DOMAIN --data-file=-
echo -n "your_project_id" | gcloud secrets create VITE_FIREBASE_PROJECT_ID --data-file=-
echo -n "your_project.appspot.com" | gcloud secrets create VITE_FIREBASE_STORAGE_BUCKET --data-file=-
echo -n "your_sender_id" | gcloud secrets create VITE_FIREBASE_MESSAGING_SENDER_ID --data-file=-
echo -n "your_app_id" | gcloud secrets create VITE_FIREBASE_APP_ID --data-file=-
```

### 3. Grant Secret Access to Cloud Build

```powershell
# Get your project number
$PROJECT_NUMBER = (gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant both service accounts access to secrets
$secrets = @(
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID"
)

foreach ($secret in $secrets) {
    # Cloud Build service account
    gcloud secrets add-iam-policy-binding $secret `
        --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" `
        --role="roles/secretmanager.secretAccessor"

    # Compute Engine service account (used by Cloud Run triggers)
    gcloud secrets add-iam-policy-binding $secret `
        --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" `
        --role="roles/secretmanager.secretAccessor"
}
```

## CI/CD Deployment

### 1. Set Up GitHub Repository

Ensure your repository has:
- `Dockerfile` at the root
- `nginx.conf` at the root
- `cloudbuild.yaml` at the root
- `.dockerignore` at the root

All these files should already be in the repository.

### 2. Connect Cloud Build to GitHub

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **Connect Repository**
3. Select **GitHub** and authorize
4. Select your repository: `chrischaps/HousingData`
5. Click **Connect**

### 3. Create Cloud Build Trigger

1. Click **Create Trigger**
2. Configure:
   - **Name**: `housing-data-app-deploy`
   - **Event**: Push to a branch
   - **Source**:
     - Branch: `^prod$` (regex for prod branch)
   - **Configuration**:
     - Type: **Cloud Build configuration file (yaml or json)**
     - Location: `cloudbuild.yaml`
3. Click **Create**

### 4. Deploy from GitHub

Any push to the `prod` branch will automatically trigger a build and deployment:

```powershell
# Switch to prod branch
git checkout prod

# Merge changes from master
git merge master

# Push to trigger deployment
git push origin prod
```

**Or manually trigger:**

```powershell
gcloud builds triggers run housing-data-app-deploy --branch=prod
```

### 5. Monitor Build Progress

```powershell
# List recent builds
gcloud builds list --limit=5

# Get build logs (replace BUILD_ID)
gcloud builds log BUILD_ID

# Watch build in console
# https://console.cloud.google.com/cloud-build/builds
```

## Manual Deployment

If you need to deploy manually without CI/CD:

```powershell
# Navigate to project root
cd C:\Users\chris\dev\HousingData

# Build and deploy
gcloud builds submit --config=cloudbuild.yaml --region=us-central1
```

**Note**: Manual builds require providing `--substitutions=SHORT_SHA=<commit-sha>` or the build will use the current git SHA.

## Troubleshooting

### Build Fails: "Permission Denied" for Secrets

**Error**: `Permission 'secretmanager.versions.access' denied`

**Fix**: Grant service account access to secrets (see [Grant Secret Access](#3-grant-secret-access-to-cloud-build))

### Firebase Error: "auth/invalid-api-key"

**Causes**:
1. Secrets not properly passed to Docker build
2. Environment variables not embedded at build time

**Fix**: Ensure `cloudbuild.yaml` uses bash to expand variables:

```yaml
- name: 'gcr.io/cloud-builders/docker'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      docker build \
        --build-arg "VITE_FIREBASE_API_KEY=$$VITE_FIREBASE_API_KEY" \
        ...
```

### Firebase Error: "auth/api-key-not-valid"

**Cause**: Firebase received literal string like `$VITE_FIREBASE_API_KEY` instead of actual value

**Fix**: Use bash with proper variable expansion (see above)

### Firebase Error: "Domain not authorized"

**Error**: `The current domain is not authorized for OAuth operations`

**Fix**: Add Cloud Run domain to Firebase authorized domains:

1. Go to Firebase Console > **Authentication** > **Settings**
2. Scroll to **Authorized domains**
3. Click **Add domain**
4. Add your Cloud Run URL (without `https://`):
   ```
   your-service-name-<hash>.us-central1.run.app
   ```
5. Click **Add**

### Build Succeeds but App Shows Old Version

**Cause**: Browser caching or incorrect revision deployed

**Fix**:
1. Check deployed revision:
   ```powershell
   gcloud run services describe housingdata --region us-central1 --format="value(status.latestReadyRevisionName)"
   ```

2. Hard refresh browser (Ctrl+Shift+R)

3. Check if traffic is routed to latest:
   ```powershell
   gcloud run services describe housingdata --region us-central1 --format="value(status.traffic)"
   ```

## Post-Deployment

### 1. Verify Deployment

```powershell
# Get service URL
gcloud run services describe housingdata --region us-central1 --format="value(status.url)"
```

Visit the URL and verify:
- ✅ App loads without errors
- ✅ Firebase authentication works
- ✅ Can sign in with Google
- ✅ Favorites sync to Firestore
- ✅ Market search and charts work

### 2. Check Browser Console

Open DevTools > Console and verify:
- ✅ No Firebase configuration errors
- ✅ No CORS errors
- ✅ Firebase initializes successfully

### 3. Test Authentication Flow

1. Click **Sign in with Google**
2. Authorize the app
3. Verify you're signed in (see user email/photo in header)
4. Add a favorite market (click ☆)
5. Open app in another browser/incognito - verify favorites sync

### 4. Monitor Costs

**Cloud Run**:
- Free tier: 2 million requests/month
- After free tier: $0.40 per million requests

**Firestore**:
- Free tier: 50,000 reads/day, 20,000 writes/day
- After free tier: $0.06 per 100,000 reads

**Secret Manager**:
- Free tier: 6 active secret versions
- $0.06 per active secret version/month

**Monitor usage**:
```powershell
# Cloud Run metrics
gcloud run services describe housingdata --region us-central1 --format="value(status.traffic)"

# Or visit Cloud Console
# https://console.cloud.google.com/run
```

### 5. Set Up Monitoring (Optional)

Create alerts for:
- Error rate > threshold
- Response time > threshold
- Firestore quota exceeded

Go to: https://console.cloud.google.com/monitoring

## Updating Secrets

If you need to update Firebase configuration:

```powershell
# Update a secret
echo -n "new_value" | gcloud secrets versions add VITE_FIREBASE_API_KEY --data-file=-

# Trigger rebuild to use new secret
gcloud builds triggers run housing-data-app-deploy --branch=prod
```

## Rolling Back

If a deployment has issues:

```powershell
# List revisions
gcloud run revisions list --service=housingdata --region=us-central1

# Route traffic to previous revision
gcloud run services update-traffic housingdata `
    --region=us-central1 `
    --to-revisions=PREVIOUS_REVISION_NAME=100
```

## Environment Comparison

| Environment | Branch | URL | Firebase Project | Auto-Deploy |
|-------------|--------|-----|------------------|-------------|
| Production  | `prod` | Cloud Run URL | Live Firebase | ✅ Yes |
| Development | `master` | localhost:5173 | Live Firebase | ❌ No |

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## Support

For issues or questions:
- Check build logs: `gcloud builds list`
- Check Cloud Run logs: https://console.cloud.google.com/run
- Review this guide's troubleshooting section
