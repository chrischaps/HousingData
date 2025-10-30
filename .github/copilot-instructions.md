# GitHub Copilot Instructions for HousingData

This file provides guidance to GitHub Copilot when working with code in this repository.

## Project Overview

This is a **housing market data visualization web application** modeled after Google Finance, designed to display customizable graphs and analytics for various housing markets (single-family homes, apartments, rentals, etc.) across different cities and regions.

**Current Status**: Production app with Firebase authentication, Firestore favorites, market comparison, and split CSV optimization (v0.7.0)

## Repository Structure

```
HousingData/
├── housing-data-poc/          # POC application (submodule) - REFERENCE ONLY
│   └── README.md              # POC documentation
│
├── housing-data-app/          # Production application - ACTIVE DEVELOPMENT
│   ├── src/
│   │   ├── components/        # React UI components
│   │   ├── contexts/          # React contexts (AuthContext)
│   │   ├── services/          # Firebase, API clients, data providers
│   │   ├── hooks/             # Custom React hooks
│   │   ├── types/             # TypeScript type definitions
│   │   └── utils/             # Helper functions, formatters, cache
│   ├── public/                # Static assets
│   ├── .env.example           # Firebase config template
│   ├── firestore.rules        # Firestore security rules
│   ├── package.json           # v0.7.0
│   └── README.md              # Production app documentation
│
├── scripts/                   # Build and deployment scripts
│   ├── split-csv.ts           # Split CSV into individual market files
│   ├── upload-to-cloud-storage.ts  # Upload to Google Cloud Storage
│   └── README.md              # Script documentation
│
├── CLAUDE.md                  # Comprehensive development guide
├── DEVELOPER_GUIDE.md         # Developer onboarding
└── [Various planning/docs]    # Architecture and implementation plans
```

**Active Development**: Focus on `housing-data-app/` directory

## Tech Stack

### Production App (housing-data-app)
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts 3
- **Authentication**: Firebase Auth 12
- **Database**: Firestore (serverless)
- **Caching**: IndexedDB (client-side)
- **Deployment**: Google Cloud Run with CI/CD

### Core Dependencies
- React 19, React DOM 19
- TypeScript 5.9
- Firebase 12 (Auth + Firestore)
- Recharts 3 (data visualization)
- Axios 1.12 (HTTP client)
- Tailwind CSS 4 (styling)

## Development Workflow

### Setting Up the Development Environment

```bash
# Navigate to production app
cd housing-data-app

# Install dependencies
npm install

# Set up Firebase environment variables
cp .env.example .env
# Edit .env and add Firebase config from console.firebase.google.com

# Start development server
npm run dev              # Runs on http://localhost:5173

# Build for production (ALWAYS run before committing!)
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Git Workflow

**Branch Naming Convention**:
- `feature/description` - New features
- `fix/description` - Bug fixes  
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

**Version Management**:
- Update version in `housing-data-app/package.json` before merging to prod
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- New feature → MINOR version bump (0.6.0 → 0.7.0)
- Bug fix → PATCH version bump (0.6.0 → 0.6.1)
- Breaking change → MAJOR version bump (0.6.0 → 1.0.0)

### Build Verification (CRITICAL)

**⚠️ ALWAYS run a build after making code changes to catch TypeScript errors:**

```bash
cd housing-data-app
npm run build
```

Common errors to watch for:
- Unused imports or variables (prefix with `_` if intentionally unused)
- Type mismatches (ensure all required interface properties are provided)
- Incorrect method names or properties

## Architecture

### Data Model

**Core TypeScript Interfaces**:

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

// Firestore-backed favorites
interface FavoriteMarket {
  id: string;             // Firestore document ID
  userId: string;         // Firebase Auth UID
  marketId: string;       // Market identifier
  marketName: string;     // Display name
  notes?: string;         // Optional user notes
  addedAt: string;        // ISO date string
}
```

### Provider Pattern

The app uses a provider pattern for data sources:

```typescript
// services/providers/
├── csv.provider.ts      // CSV file data (default)
├── mock.provider.ts     // Mock data for testing
└── factory.ts           // Provider factory
```

### Firebase Integration

**Authentication**:
- Google Sign-In (Firebase Auth)
- Session persistence
- Protected routes via AuthContext

**Firestore**:
- Real-time favorites syncing
- Security rules in `firestore.rules`
- CRUD operations in `services/favorites.ts`

**Security Rules** (firestore.rules):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/favorites/{favoriteId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Data Optimization

**Split CSV Architecture**:
- 21,423 Zillow ZHVI markets split into individual files
- Stored in Google Cloud Storage with CDN caching
- On-demand loading (99.5% reduction: 85.6 MB → ~420 KB initial load)
- Scripts: `npm run split-csv` and `npm run upload-csv`

## Key Features

### Implemented ✅
- Firebase Authentication (Google Sign-In)
- Firestore real-time favorites with security rules
- Market comparison (up to 5 markets on one chart)
- 21,000+ markets from Zillow ZHVI dataset
- Interactive charts with time ranges (1M, 6M, 1Y, 5Y, MAX)
- IndexedDB caching for performance
- Responsive design with animations
- Split CSV optimization for efficient data loading

## Coding Standards

### TypeScript

- Use **strict mode** (enabled in tsconfig.json)
- Always define types for function parameters and return values
- Prefer interfaces over types for object shapes
- Use TypeScript utility types when appropriate (Pick, Omit, Partial, etc.)

### React

- Use **functional components** with hooks (no class components)
- Follow hooks rules (only call at top level, only in React functions)
- Use `useMemo` and `useCallback` for expensive computations
- Implement proper cleanup in `useEffect` hooks
- Use TypeScript for component props

### File Organization

- One component per file
- Group related files in feature directories
- Co-locate tests with components (if tests exist)
- Use barrel exports (index.ts) sparingly

### Naming Conventions

- **Components**: PascalCase (e.g., `MarketCard.tsx`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useFavorites.ts`)
- **Utilities**: camelCase (e.g., `formatters.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_MARKET_ID`)
- **Types/Interfaces**: PascalCase (e.g., `Market`, `PriceDataPoint`)

### Styling

- Use **Tailwind CSS** utility classes
- Follow mobile-first responsive design
- Use consistent spacing scale (from Tailwind)
- Avoid inline styles unless absolutely necessary

### Color System

- **Primary**: `#1E40AF` (blue-700) - Trust, stability
- **Success/Up**: `#10B981` (green-500) - Price increases
- **Error/Down**: `#EF4444` (red-500) - Price decreases
- **Background (Light)**: `#FFFFFF` (white)
- **Background (Dark)**: `#0F172A` (slate-900)

## Common Patterns

### Chart Time Range Filtering

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

### Firebase Context Usage

```typescript
// Get auth state
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <button onClick={signInWithGoogle}>Sign In</button>;
  
  return <div>Welcome {user.displayName}</div>;
}
```

### Firestore Real-time Favorites

```typescript
import { useFavorites } from './hooks/useFavorites';

function MyComponent() {
  const { favorites, addFavorite, removeFavorite, loading } = useFavorites();
  
  const handleToggle = (marketId: string, marketName: string) => {
    const isFavorite = favorites.some(f => f.marketId === marketId);
    if (isFavorite) {
      removeFavorite(marketId);
    } else {
      addFavorite(marketId, marketName);
    }
  };
  
  return (
    <div>
      {favorites.map(fav => (
        <div key={fav.id}>{fav.marketName}</div>
      ))}
    </div>
  );
}
```

## Testing

**Current State**: No automated tests yet. Follow these guidelines when adding tests:

- Use **Vitest** (Vite's test framework)
- Write unit tests for utility functions
- Write integration tests for key user flows
- Mock Firebase services in tests
- Test error handling and edge cases

## Deployment

### Production Deployment (Automated CI/CD)

The production app uses **automated CI/CD** with GitHub and Cloud Run:

```bash
# Push to prod branch triggers automatic deployment
git checkout prod
git merge master
git push origin prod
# Cloud Build automatically deploys to Cloud Run
```

**Architecture**:
```
GitHub (prod branch)
    ↓ (webhook trigger)
Cloud Build (reads cloudbuild.yaml)
    ↓
Secret Manager → Docker Build (with Firebase env vars)
    ↓
Artifact Registry
    ↓
Cloud Run (deployed)
```

**⚠️ Important**: Do NOT run `gcloud builds submit` manually. Cloud Build watches the `prod` branch automatically.

### Data Updates (Monthly)

```bash
# 1. Download new ZHVI/ZORI from Zillow
# 2. Replace housing-data-app/public/data/default-housing-data.csv
# 3. Split and upload
npm run split-csv
npm run upload-csv
# Data is immediately available (no deployment needed due to CDN caching)
```

## Performance Guidelines

- **Page load**: < 3 seconds
- **Chart render**: < 500ms
- **API response**: < 2 seconds
- Implement loading states for async operations
- Use IndexedDB for caching large datasets
- Lazy load components when possible

## Error Handling

- Always handle async errors with try/catch
- Provide user-friendly error messages
- Log errors to console in development
- Implement error boundaries for component errors
- Never expose sensitive data in error messages

## Security Best Practices

- **Never commit** `.env` files (they're in `.gitignore`)
- Store sensitive config in Google Secret Manager (for production)
- Follow Firestore security rules (users can only access their own data)
- Validate user input
- Sanitize data before rendering
- Use HTTPS for all API calls

## Common Tasks

### Adding a New Component

1. Create component file in `src/components/`
2. Define TypeScript interface for props
3. Implement component with hooks
4. Add Tailwind classes for styling
5. Export component
6. Import and use in parent component

### Adding a New Data Provider

1. Create provider file in `src/services/providers/`
2. Implement `DataProvider` interface
3. Add provider to factory
4. Update settings to allow selection
5. Test with real data

### Adding a New Feature

1. Create feature branch: `git checkout -b feature/feature-name`
2. Implement feature with minimal changes
3. Run build: `npm run build`
4. Test locally: `npm run dev`
5. Commit changes with descriptive message
6. Push and create pull request

## Documentation

- **CLAUDE.md**: Comprehensive guide for Claude Code
- **DEVELOPER_GUIDE.md**: Developer onboarding
- **housing-data-app/README.md**: Production app features
- **housing-data-app/DEPLOYMENT.md**: Deployment guide
- **SECURITY_AUDIT_REPORT.md**: Security analysis
- **DATA_OPTIMIZATION_GUIDE.md**: Data loading strategies
- **scripts/README.md**: Script usage and workflows

## External Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Recharts Documentation](https://recharts.org/en-US/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)

## Getting Help

- Review existing documentation in repository root
- Check `housing-data-app/README.md` for production app specifics
- Review CLAUDE.md for detailed development workflows
- Check commit history for implementation examples
- Refer to planning documents for architectural decisions

---

**Last Updated**: 2025-10-30
**Version**: 1.0
