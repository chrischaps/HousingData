# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Task Tracking and Issue Management

**IMPORTANT**: This project uses GitHub Issues for task tracking and project management.

**Before starting any new feature or bugfix:**
1. **Check for existing issue**: Use `gh issue list` to see if an issue already exists
2. **Create a new issue**: If no issue exists, create one with `gh issue create`
   - Provide clear title and description
   - Include expected vs. current behavior for bugs
   - Suggest implementation approach when applicable
   - Add appropriate labels (`bug`, `enhancement`, etc.)
3. **Reference issue in commits**: Include issue number in commit messages (e.g., "fixes #3" or "closes #5")
4. **Link PRs to issues**: When creating pull requests, reference the related issue

**Creating Issues:**
```bash
# Create a bug report
gh issue create --title "fix: Brief description" --body "Detailed description" --label "bug"

# Create a feature request
gh issue create --title "feat: Brief description" --body "Detailed description" --label "enhancement"

# List all open issues
gh issue list

# View a specific issue
gh issue view 3
```

**Commit Message Format:**
- Use conventional commits format: `type: description`
- Reference issues: `fix: Resolve chart padding issue (fixes #7)`
- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`

## Development Environment

**Shell Environment**: The Bash tool runs `/usr/bin/bash` (Unix shell), NOT PowerShell
- ⚠️ **IMPORTANT**: Do NOT use PowerShell-specific cmdlets like `Get-Content`, `Select-String`, `Select-Object`, `Out-File`, `Add-Content`
- Use standard Unix commands: `cat`, `grep`, `head`, `tail`, `sed`, `awk`, `echo`, `printf`
- **However**: For file operations, prefer specialized tools over Bash commands:
  - Use `Read` tool instead of `cat`
  - Use `Grep` tool instead of `grep` or `rg`
  - Use `Write` tool instead of `echo >` or `cat <<EOF`
  - Use `Edit` tool instead of `sed` or `awk`
  - Use `Glob` tool instead of `find` or `ls`

**User's Local Environment**: PowerShell (Windows)
- Command examples in this document use PowerShell syntax for the user's reference
- User runs commands locally in PowerShell
- Use backtick (`` ` ``) for line continuation in examples, not backslash (`\`)

### Common Command Reference

When the user asks for commands to run locally (PowerShell):

| Task | PowerShell Command | Description |
|------|-------------------|-------------|
| List files | `Get-ChildItem` or `ls` | List directory contents |
| Read file | `Get-Content file.txt` or `cat file.txt` | Display file contents |
| Search in file | `Select-String -Pattern "pattern" -Path file` | Search for pattern |
| Find files | `Get-ChildItem -Recurse -Filter "*.js"` | Find files recursively |
| Append to file | `"text" \| Add-Content file` | Append text to file |
| Write file | `"text" \| Out-File file` | Write to file (overwrite) |
| Delete file | `Remove-Item file` or `rm file` | Remove file |
| Create directory | `New-Item -ItemType Directory dir` or `mkdir dir` | Create directory |
| Create file | `New-Item file` | Create empty file |
| Current directory | `Get-Location` or `pwd` | Print working directory |

When using the Bash tool for command execution:

| Task | Bash Command | Notes |
|------|--------------|-------|
| List files | `ls -la` | Standard Unix ls |
| Read file | Use `Read` tool | Prefer tool over `cat` |
| Search in file | Use `Grep` tool | Prefer tool over `grep` |
| Find files | Use `Glob` tool | Prefer tool over `find` |
| Test curl/HTTP | `curl -I URL` | For testing endpoints |
| Git operations | `git status`, `git add`, etc. | Standard git commands |
| gcloud operations | `gcloud storage ls`, etc. | Standard gcloud commands |
| Package managers | `npm install`, `pip install`, etc. | Standard package managers |

## Project Overview

This is a housing market data visualization web application modeled after Google Finance, designed to display customizable graphs and analytics for various housing markets (single-family homes, apartments, rentals, etc.) across different cities and regions.

**Current Status**: Production app with Firebase authentication, Firestore favorites, market comparison, and split CSV optimization
- **POC (housing-data-poc)**: Complete proof of concept with CSV data loading, charts, Cloud Run deployment (v0.3.0)
- **Production App (housing-data-app)**: Feature-complete MVP (v0.7.0) with real-time favorites, comparison, and on-demand data loading via split CSV from Cloud Storage (99.5% reduction in initial page load: 85.6 MB → ~420 KB)

## Repository Structure

```
HousingData/
├── housing-data-poc/          # POC application (submodule)
│   ├── src/                   # POC source code
│   ├── public/data/           # Default CSV data
│   ├── Dockerfile             # Cloud Run deployment
│   └── README.md              # POC documentation
│
├── housing-data-app/          # Production application (ACTIVE)
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── FavoritesPanel.tsx    # Real-time favorites ⭐
│   │   │   ├── MarketCard.tsx        # With star buttons
│   │   │   ├── PriceChart.tsx        # Multi-market overlay
│   │   │   └── MarketSearch.tsx      # 21k+ market search
│   │   ├── contexts/          # React contexts (AuthContext)
│   │   ├── services/          # Firebase, API clients
│   │   │   ├── favorites.ts          # Firestore CRUD ⭐
│   │   │   └── providers/            # Data sources
│   │   ├── hooks/             # Custom hooks
│   │   │   └── useFavorites.ts       # Real-time hook ⭐
│   │   ├── types/             # TypeScript definitions
│   │   └── utils/             # Formatters, CSV parser, cache
│   ├── .env.example           # Firebase config template
│   ├── firestore.rules        # Security rules ⭐
│   ├── package.json           # v0.7.0
│   └── README.md              # Production app docs
│
├── scripts/                       # Build and deployment scripts
│   ├── split-csv.ts              # Split 85MB CSV into 25k+ individual files
│   ├── upload-to-cloud-storage.ts # Upload split files to GCS with CDN
│   └── README.md                 # Complete workflow documentation
│
├── SERVERLESS_TRANSITION_PLAN.md  # Firebase transition roadmap
├── PRODUCTION_TRANSITION_PLAN.md  # Traditional backend options
├── SECURITY_AUDIT_REPORT.md       # Comprehensive security audit ⭐
├── DATA_OPTIMIZATION_GUIDE.md     # Data loading strategies (split CSV, API, database)
├── SPLIT_CSV_README.md            # Split CSV implementation details
└── CLAUDE.md                       # This file
```

**Active Development**: `housing-data-app/` (production)

## Git Workflow

**Branch Strategy**: Create a new feature branch for each feature request or task.

```powershell
# Create and switch to a new feature branch
git checkout -b feature/feature-name

# Examples:
git checkout -b feature/market-search
git checkout -b feature/price-chart
git checkout -b feature/watchlist

# Work on the feature, commit changes
git add .
git commit -m "Add market search functionality"

# Push feature branch to remote
git push -u origin feature/feature-name

# After feature is complete and tested, merge to main
git checkout master
git merge feature/feature-name
git push origin master
```

**Branch Naming Convention**:
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Version Management

**IMPORTANT**: Update the version number in `housing-data-app/package.json` before merging to prod for any user-facing changes.

**Semantic Versioning (semver)**:
- **MAJOR** (x.0.0): Breaking changes, major features
- **MINOR** (0.x.0): New features, non-breaking changes (e.g., split CSV optimization, rental data overlay)
- **PATCH** (0.0.x): Bug fixes, documentation updates

**Workflow Before Merging to Prod**:

1. **Determine version bump type**:
   - New feature? → MINOR version (0.6.0 → 0.7.0)
   - Bug fix? → PATCH version (0.6.0 → 0.6.1)
   - Breaking change? → MAJOR version (0.6.0 → 1.0.0)

2. **Update version in package.json**:
   ```powershell
   # Open housing-data-app/package.json
   # Change "version": "0.6.0" to "0.7.0"
   ```

3. **Commit version bump**:
   ```powershell
   git add housing-data-app/package.json
   git commit -m "chore: Bump version to 0.7.0"
   ```

4. **Then merge to prod**:
   ```powershell
   git checkout prod
   git merge master
   git push origin prod
   ```

**Examples of Recent Features and Their Version Bumps**:
- Split CSV optimization (85MB → 420KB) → v0.6.0 → v0.7.0 (MINOR)
- Rental data overlay with dual-axis charts → v0.5.0 → v0.6.0 (MINOR)
- Fix CORS configuration → v0.6.0 → v0.6.1 (PATCH)
- Documentation updates only → No version bump needed (unless releasing docs as a version)

### Common Git Issues and Solutions

**Issue: Push rejected - remote has changes**
```
! [rejected]        master -> master (fetch first)
error: failed to push some refs
```

**Solution**: Pull remote changes first, then push:
```powershell
git pull origin master
# Review any merge conflicts if they occur
git push origin master
```

**Issue: Submodule in "modified content" state**
This occurs when the submodule has uncommitted changes.

**Solution**: Commit changes in the submodule first:
```powershell
# Navigate to submodule
cd housing-data-poc

# Commit submodule changes
git add .
git commit -m "Your commit message"
git push origin master

# Return to main repo and commit submodule reference
cd ..
git add housing-data-poc
git commit -m "Update submodule reference"
```

**Issue: Temporary files being staged**
Files like `.env~`, `*.un~` (vim backup files) should not be committed.

**Solution**: Add them to `.gitignore`:
```powershell
# In the appropriate .gitignore file
"*.un~" | Add-Content .gitignore
"*~" | Add-Content .gitignore
git add .gitignore
```

## Development Commands

### Production App (housing-data-app) - ACTIVE
```powershell
# Navigate to production app
cd housing-data-app

# Install dependencies
npm install

# Set up Firebase environment variables
Copy-Item .env.example .env
# Edit .env and add your Firebase config from console.firebase.google.com

# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Build for production (ALWAYS run before committing!)
npm run preview          # Preview production build

# Deployment - Automated CI/CD
# Push to prod branch → Cloud Build automatically deploys to Cloud Run
git checkout prod && git merge master && git push origin prod
```

**Important**: The production app requires Firebase configuration. See `housing-data-app/README.md` for setup instructions.

### POC Development (housing-data-poc) - REFERENCE ONLY
```powershell
# Initialize POC project
npm create vite@latest housing-data-poc -- --template react-ts
cd housing-data-poc
npm install

# Install dependencies
npm install recharts axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Development
npm run dev              # Start dev server (default: http://localhost:5173)
npm run build           # Build for production
npm run preview         # Preview production build

# Deployment
vercel                  # Deploy to Vercel
vercel --prod          # Deploy to production
```

### Build Verification (IMPORTANT)

**⚠️ ALWAYS run a build after making code changes to catch TypeScript errors early:**

```powershell
cd housing-data-poc
npm run build
```

- Run this command before committing changes
- Address any TypeScript compilation errors immediately
- Common errors to watch for:
  - Unused imports or variables (prefix with `_` if intentionally unused)
  - Type mismatches (ensure all required interface properties are provided)
  - Incorrect method names or properties
- The build must complete successfully before deploying or creating pull requests

## Architecture

### POC Architecture (Frontend-Only)
The proof of concept is deliberately simplified to validate core functionality quickly:

**Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Recharts (charts)
- Axios (HTTP)
- localStorage (watchlist persistence)

**Project Structure:**
```
src/
├── components/          # UI components
│   ├── MarketCard.tsx
│   ├── PriceChart.tsx
│   ├── MarketSearch.tsx
│   ├── TimeRangeSelector.tsx
│   └── WatchlistPanel.tsx
├── services/
│   └── api.ts          # RentCast API client
├── hooks/
│   ├── useMarketData.ts
│   └── useWatchlist.ts
├── types/
│   └── index.ts        # TypeScript interfaces
├── utils/
│   ├── formatters.ts
│   └── constants.ts
├── App.tsx
└── main.tsx
```

**Key Design Decisions:**
- No backend for POC - direct API calls from frontend
- localStorage for watchlist (no database)
- Single data source (RentCast API)
- Environment variables for API keys (`.env` with `VITE_` prefix)

### Production App Architecture (v0.6.0 - CURRENT)

The production app implements a serverless architecture with Firebase:

**Tech Stack:**
- React 19 + TypeScript
- Vite 7 (build tool)
- Tailwind CSS 4 (styling)
- Recharts 3 (charts)
- Firebase Auth 12 (authentication)
- Firestore (real-time database)
- IndexedDB (client-side caching)

**Project Structure:**
```
src/
├── components/              # UI components
│   ├── FavoritesPanel.tsx   # Real-time favorites list
│   ├── MarketCard.tsx       # With star button
│   ├── PriceChart.tsx       # Multi-market charts
│   ├── MarketSearch.tsx     # 21k+ market search
│   ├── TimeRangeSelector.tsx
│   ├── SettingsPanel.tsx    # Cache management
│   └── LoginPage.tsx        # Auth UI
├── services/
│   ├── firebase.ts          # Firebase config
│   ├── favorites.ts         # Firestore CRUD ops
│   ├── api.ts              # RentCast API client
│   └── providers/          # Data source pattern
│       ├── csv.provider.ts
│       ├── mock.provider.ts
│       └── factory.ts
├── hooks/
│   ├── useFavorites.ts     # Real-time hook
│   ├── useMarketData.ts
│   └── useMarketSearch.ts
├── contexts/
│   └── AuthContext.tsx     # Auth state management
├── types/
│   └── index.ts            # TypeScript interfaces
├── utils/
│   ├── formatters.ts
│   ├── csvParser.ts        # Zillow ZHVI parser
│   ├── indexedDBCache.ts   # Client cache
│   └── dataTransform.ts
├── App.tsx
└── main.tsx
```

**Key Features:**
- ✅ Firebase Authentication (Google Sign-In)
- ✅ Firestore real-time favorites (with Security Rules)
- ✅ Market comparison (up to 5 markets)
- ✅ 21,423 Zillow ZHVI markets with full historical data
- ✅ IndexedDB caching for performance
- ✅ Provider pattern for multiple data sources
- ✅ Responsive design with animations

### Full Implementation Architecture (Future)
When transitioning from POC to production (see HOUSING_APP_PLAN.md):

**Layered Architecture:**
- Frontend: React SPA with React Router
- Backend: Node.js + Express (TypeScript)
- Database: PostgreSQL with TimescaleDB extension (time-series optimization)
- Caching: Redis
- Authentication: NextAuth.js or Auth0

**Database Schema:**
- `markets` - Market metadata (city, ZIP, state, etc.)
- `price_data` - Time-series price data (TimescaleDB hypertable)
- `market_statistics` - Inventory, days on market, etc.
- `users` - User accounts
- `watchlists` - User watchlists
- `watchlist_items` - Markets in watchlists

## Data Model

### Core TypeScript Interfaces

```typescript
interface Market {
  id: string;
  name: string;        // "Detroit, MI" or "Anaheim, CA"
  city: string;
  state: string;
  zipCode?: string;
}

interface PriceDataPoint {
  date: string;        // ISO date string
  price: number;
  propertyType: 'single_family' | 'condo' | 'apartment';
}

interface MarketPriceData {
  marketId: string;
  marketName: string;
  currentPrice: number;
  priceChange: number;  // percentage
  changeDirection: 'up' | 'down' | 'neutral';
  historicalData: PriceDataPoint[];
  lastUpdated: string;
}

// Favorites types (Firestore-backed) - PRODUCTION
interface FavoriteMarket {
  id: string;             // Firestore document ID
  userId: string;         // Firebase Auth UID
  marketId: string;       // Market identifier
  marketName: string;     // Display name
  notes?: string;         // Optional user notes
  addedAt: string;        // ISO date string
}

// Legacy watchlist (localStorage) - POC ONLY
interface WatchlistItem {
  marketId: string;
  marketName: string;
  addedAt: string;
}
```

## Data Sources

### Default Data (CSV Provider)
**The POC now includes default housing data out of the box!**

- **Default Dataset**: Zillow ZHVI (Home Value Index) data for 20+ U.S. cities
- **Location**: `public/data/default-housing-data.csv`
- **Auto-loaded**: Fetched automatically on first app load
- **Time Series**: Historical price data from 2000-2025
- **Coverage**: Major U.S. cities (New York, LA, Houston, Chicago, Phoenix, etc.)
- **Format**: Zillow ZHVI time-series CSV format

**User Experience:**
1. App loads → Default data loads automatically from `/data/default-housing-data.csv`
2. Users see markets immediately (no upload required)
3. Users can upload custom CSV to override default data
4. "Reset to Default" button available after custom upload

**Data Source Indicator:**
- Settings panel shows: "📊 Default Zillow ZHVI data" or "✓ [filename] (Custom upload)"

### API Providers (Optional)
The POC supports multiple data providers selectable from Settings:

#### RentCast API
- **Free Tier**: 50 API calls/month
- **Base URL**: `https://api.rentcast.io/v1`
- **Authentication**: API key in header (`X-Api-Key`)
- **Key Endpoints**:
  - `GET /v1/properties` - Search properties by location
  - `GET /v1/markets` - Get market statistics
  - `GET /v1/value-estimate` - Get property value estimates

#### API Key Configuration
```bash
# Create .env file (never commit this)
VITE_RENTCAST_API_KEY=your_api_key_here
```

Access in code:
```typescript
const API_KEY = import.meta.env.VITE_RENTCAST_API_KEY;
```

### Fallback Data
Mock data for 6 markets (New York, LA, Austin, Columbus, Houston, San Antonio) is available as final fallback when both CSV and API providers fail.

## Component Patterns

### Chart Time Range Filtering
Time ranges supported: `1M`, `6M`, `1Y`, `5Y`, `MAX`

Filter implementation:
```typescript
const filterByTimeRange = (data: PriceDataPoint[], range: string) => {
  const now = new Date();
  const cutoffDate = new Date(now);

  switch (range) {
    case '1M': cutoffDate.setMonth(now.getMonth() - 1); break;
    case '6M': cutoffDate.setMonth(now.getMonth() - 6); break;
    case '1Y': cutoffDate.setFullYear(now.getFullYear() - 1); break;
    case '5Y': cutoffDate.setFullYear(now.getFullYear() - 5); break;
    default: return data;
  }

  return data.filter(point => new Date(point.date) >= cutoffDate);
};
```

### Watchlist localStorage Pattern
```typescript
const STORAGE_KEY = 'housing-watchlist';

// Load
const watchlist: WatchlistItem[] = JSON.parse(
  localStorage.getItem(STORAGE_KEY) || '[]'
);

// Save
localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
```

## Design System

### Color Palette
- **Primary**: `#1E40AF` (blue) - Trust, stability
- **Positive/Up**: `#10B981` (green) - Price increases
- **Negative/Down**: `#EF4444` (red) - Price decreases
- **Background (Light)**: `#FFFFFF`
- **Background (Dark)**: `#0F172A`
- **Gray Scale**: `#F3F4F6` to `#111827`

### Typography
- **Primary Font**: Inter or SF Pro Display
- **Monospace**: JetBrains Mono (for numbers, data)
- **Sizes**: 12px (small), 14px (body), 16px (subheading), 20px (heading), 32px (display)

### Chart Styling
- Line weight: 2px
- Smooth animations: 300ms ease-in-out
- Tooltips: Card-style with shadow
- Format prices: `$${(price / 1000).toFixed(0)}K` for Y-axis
- Format dates: `MMM YYYY` (e.g., "Jan 2023")

## Implementation Priorities

### POC Must-Haves (in order)
1. Market search by city/ZIP code
2. Interactive price charts with time range selection
3. Market cards showing current prices and trends
4. Simple watchlist with localStorage
5. Pre-loaded market data for 5 cities

### POC Nice-to-Haves
- Compare two markets side-by-side
- Dark/light theme toggle
- Export chart as image
- Market statistics (inventory, days on market)

### POC Explicitly Out of Scope
- User authentication
- Database persistence
- Multiple data sources
- Advanced analytics/AI features
- Production monitoring
- Comprehensive error handling

## Performance Targets

- Page load: < 3 seconds
- Chart render: < 500ms
- API response (for POC): < 2 seconds
- Mobile responsive: Works on devices < 768px width

## Testing Checklist

See POC_PLAN.md section "Testing the POC" for comprehensive manual testing checklist covering:
- Functionality (search, charts, watchlist)
- UI/UX (responsive, loading states)
- Edge cases (API failures, empty states)

## Deployment

### Vercel (Recommended for Quick Deployment)

POC deployment to Vercel:
1. Ensure `.env` is in `.gitignore`
2. Ensure `public/data/default-housing-data.csv` is committed to repository
3. Build project: `npm run build`
4. Deploy: `vercel` or connect GitHub repo to Vercel dashboard
5. Add environment variable `VITE_RENTCAST_API_KEY` in Vercel dashboard (optional)
6. Redeploy if environment variables were added after initial deploy

**Note:** The default CSV file in `public/data/` will be automatically included in the Vercel deployment and served as a static asset, so users will see data immediately without any configuration.

### Google Cloud Run (Serverless)

The default CSV file is **86MB**, which can cause issues with serverless deployments. See `housing-data-poc/CLOUD_RUN_DEPLOYMENT.md` for detailed solutions.

**Quick Solution - Use Cloud Storage:**

1. Upload CSV to Google Cloud Storage:
   ```powershell
   gsutil mb gs://your-housing-data-assets
   gsutil iam ch allUsers:objectViewer gs://your-housing-data-assets
   gsutil cp housing-data-poc/public/data/default-housing-data.csv `
     gs://your-housing-data-assets/default-housing-data.csv
   ```

2. Deploy to Cloud Run from source:
   ```powershell
   cd housing-data-poc
   gcloud run deploy housing-data-poc `
     --source . `
     --region us-central1 `
     --platform managed `
     --allow-unauthenticated `
     --port 8080 `
     --set-env-vars VITE_DEFAULT_CSV_URL=https://storage.googleapis.com/your-bucket-name/default-housing-data.csv
   ```

**Benefits:** Smaller container (~15MB vs ~100MB), faster cold starts, easy to update CSV without redeploying.

**Note:** The `--source .` flag builds and deploys directly from source code. Cloud Run will automatically detect the Node.js app and build it.

See `housing-data-poc/CLOUD_RUN_DEPLOYMENT.md` for complete deployment guide with multiple options.

### Production App (housing-data-app) - Google Cloud Run with CI/CD

The production app uses **automated CI/CD** with GitHub and Cloud Run:

**Quick Deploy:**
```powershell
# Push to prod branch triggers automatic deployment
git checkout prod
git merge master
git push origin prod
# That's it! Cloud Build watches the prod branch and deploys automatically.
# No need to run 'gcloud builds submit' manually.
```

**Key Features:**
- ✅ Automated builds on push to `prod` branch (via Cloud Build triggers)
- ✅ Firebase secrets stored in Secret Manager
- ✅ Environment variables embedded at build time
- ✅ Dockerfile + nginx for production serving
- ✅ Zero-downtime deployments

**⚠️ Important:** Do NOT run `gcloud builds submit` manually after pushing to prod. Cloud Build has a trigger configured to automatically watch the `prod` branch and deploy on every push.

**📖 Complete Guide:** See `housing-data-app/DEPLOYMENT.md` for:
- Firebase setup (Authentication, Firestore, Security Rules)
- Google Cloud setup (Cloud Run, Secret Manager, Cloud Build)
- CI/CD configuration with GitHub triggers
- Troubleshooting deployment issues
- Post-deployment verification

**Architecture:**
```
GitHub (prod branch)
    ↓ (webhook trigger)
Cloud Build
    ↓ (reads cloudbuild.yaml)
Secret Manager → Docker Build (with Firebase env vars)
    ↓
Artifact Registry
    ↓
Cloud Run (deployed)
```

### Split CSV Optimization & Cloud Storage Setup

The production app uses split CSV files stored in Google Cloud Storage for on-demand loading:

**Overview:**
- Split 85.6 MB ZHVI + 4 MB ZORI CSV files into 25,467 individual market files
- Upload to GCS bucket with CDN caching and public access
- Load markets on-demand (99.5% reduction: 85.6 MB → ~420 KB for 6 featured markets)

**Scripts:**
```powershell
# Split CSV files (run from project root)
npm run split-csv

# Upload to Cloud Storage
npm run upload-csv
npm run upload-csv -- --dry-run  # Preview first
npm run upload-csv -- --bucket=my-bucket --region=us-east1  # Custom options
```

**Initial Setup Requirements:**

1. **Create and configure GCS bucket** (done via upload script):
   ```powershell
   # Bucket is created automatically with:
   # - Public access enabled
   # - CORS configured
   # - Cache headers set (max-age=31536000)
   ```

2. **Create Secret Manager secrets** for deployment:
   ```powershell
   # CRITICAL: Use printf (not echo) to avoid trailing newlines/carriage returns
   printf "true" | gcloud secrets create VITE_USE_SPLIT_CSV --data-file=-
   printf "https://storage.googleapis.com/housing-data-markets" | gcloud secrets create VITE_MARKET_DATA_URL --data-file=-

   # Grant Cloud Build service account access
   gcloud secrets add-iam-policy-binding VITE_USE_SPLIT_CSV \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"

   gcloud secrets add-iam-policy-binding VITE_MARKET_DATA_URL \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. **Configure CORS on GCS bucket**:
   ```powershell
   # Create cors.json with:
   # [{
   #   "origin": ["*"],
   #   "method": ["GET", "HEAD"],
   #   "responseHeader": ["Content-Type", "Cache-Control"],
   #   "maxAgeSeconds": 3600
   # }]

   gcloud storage buckets update gs://housing-data-markets --cors-file=cors.json
   ```

**Important Deployment Learnings:**

1. **Secret Manager string values:**
   - ⚠️ Use `printf` (NOT `echo`) when creating secrets to avoid trailing newlines
   - `echo "true"` creates `"true\r\r"` which fails comparison `=== 'true'`
   - `printf "true"` creates clean `"true"` string
   - Verify with: `gcloud secrets versions access latest --secret=NAME | cat -A`

2. **Environment variable propagation:**
   - Vite embeds env vars at build time (not runtime)
   - Changes to `.env` require dev server restart
   - Changes to Secret Manager require new Cloud Build deployment
   - Verify embedded values by checking build logs or console output

3. **CORS configuration:**
   - CORS must be set on GCS bucket, not individual objects
   - Browser caches failed CORS responses - use hard refresh or incognito
   - Verify CORS headers: `curl -I -H "Origin: https://your-app.com" https://storage.googleapis.com/bucket/file.csv`
   - Look for `Access-Control-Allow-Origin: *` in response headers

4. **IAM permissions:**
   - Cloud Build service account needs `secretmanager.secretAccessor` role for each secret
   - GCS bucket needs `allUsers` with `roles/storage.objectViewer` for public read
   - Objects uploaded with `--predefined-acl=publicRead` are immediately accessible

**Data Refresh (automated):**

`.github/workflows/refresh-data.yml` runs `npm run refresh-data` weekly: downloads the public Zillow city CSVs, validates, splits to `data/markets/` (gitignored), publishes to `gs://housing-data-markets` via rsync, verifies, and commits `scripts/data/manifest.json`. Exits early when Zillow has no newer month. Manual equivalents (repo root):
- `npm run refresh-data -- --dry-run` / `npm run refresh-data` / `npm run refresh-data -- --force`
- `npm run fetch-data` downloads just the source CSVs (they are not tracked in git)
- No deployment needed after a refresh: the app reads `manifest.json` (5-minute cache) and appends `?v=<dataVersion>` to every CSV URL. See `scripts/README.md`.

**Cost Estimates:**
- Storage: ~$0.03/month for 1.3GB (25k files)
- Network egress: ~$0.30/month for 10k users
- Total: **$0.30-0.35/month**

## Reference Documentation

**Planning Documents:**
- `HOUSING_APP_PLAN.md` - Full 12-week implementation plan with complete architecture
- `POC_PLAN.md` - 1-2 week proof of concept with day-by-day guide

**External Resources:**
- RentCast API: https://developers.rentcast.io/
- Recharts: https://recharts.org/en-US/
- Tailwind CSS: https://tailwindcss.com/docs
- Vite: https://vitejs.dev/guide/

## Migration Path: POC → Production

When transitioning from POC to full implementation:

1. **Add Backend** (Week 1-2 of full plan)
   - Set up Express.js API
   - Move API calls from frontend to backend
   - Implement proper error handling and logging

2. **Add Database** (Week 2 of full plan)
   - PostgreSQL with TimescaleDB
   - Migrate localStorage watchlists to database
   - Implement data caching strategy

3. **Add Authentication** (Week 6 of full plan)
   - User accounts (email + OAuth)
   - Secure watchlist persistence
   - User preferences

4. **Scale Data** (Week 7+ of full plan)
   - Multiple property types
   - Additional data sources
   - Scheduled data updates

See HOUSING_APP_PLAN.md for complete phase breakdown.
