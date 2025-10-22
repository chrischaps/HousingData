# Housing Data App - Developer Guide

**Version**: 1.0
**Last Updated**: 2025-10-21
**Target Audience**: Developers contributing to the project

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Getting Started](#getting-started)
3. [Architecture](#architecture)
4. [Provider System](#provider-system)
5. [Data Flow](#data-flow)
6. [Key Components](#key-components)
7. [Adding New Features](#adding-new-features)
8. [Code Style Guide](#code-style-guide)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## Project Overview

### Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Storage**: IndexedDB + localStorage
- **HTTP Client**: fetch API

### Project Structure

```
housing-data-poc/
├── src/
│   ├── components/           # React components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # Business logic, API clients
│   │   └── providers/       # Data provider implementations
│   ├── utils/               # Helper functions
│   ├── types/               # TypeScript type definitions
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── .env                     # Environment variables (not committed)
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.js       # Tailwind config
└── vite.config.ts           # Vite config
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd housing-data-poc

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Zillow Metrics API
VITE_ZILLOW_API_KEY=your_api_key_here
VITE_ZILLOW_BASE_URL=https://api.zillow.com/v1

# App Configuration
VITE_DEFAULT_PROVIDER=csv  # Options: mock, zillow-metrics, csv
```

### Development Commands

```bash
# Start dev server (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## Architecture

### Design Principles

1. **Separation of Concerns**: UI, business logic, and data access are separate
2. **Provider Pattern**: Abstract data sources for flexibility
3. **Component Composition**: Small, reusable components
4. **Type Safety**: Comprehensive TypeScript types

### Core Patterns

#### 1. Provider Pattern

```typescript
// Define contract
interface IHousingDataProvider {
  readonly info: ProviderInfo;
  isConfigured(): boolean;
  getMarketStats(location: string): Promise<MarketStats | null>;
}

// Implement providers
class CSVProvider implements IHousingDataProvider { }
class ZillowMetricsProvider implements IHousingDataProvider { }
class MockProvider implements IHousingDataProvider { }

// Factory for creation
export function createProvider(): IHousingDataProvider {
  const type = getProviderType();
  switch (type) {
    case 'csv': return new CSVProvider();
    case 'zillow-metrics': return new ZillowMetricsProvider();
    default: return new MockProvider();
  }
}
```

#### 2. Custom Hooks Pattern

```typescript
// Encapsulate data fetching logic
export const useMarketData = (): UseMarketDataResult => {
  const [data, setData] = useState<MarketPriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch, forceRefresh };
};
```

#### 3. Component Composition

```typescript
// Compose small, focused components
<App>
  <Header>
    <ApiStatusIndicator />
  </Header>
  <Sidebar>
    <SettingsPanel />
    <MarketSearch />
    <CSVUpload />
    <WatchlistPanel />
  </Sidebar>
  <MainContent>
    <MarketCardGrid />
    <PriceChart />
  </MainContent>
</App>
```

---

## Provider System

### Overview

The provider system abstracts data sources, allowing the app to work with multiple data providers without changing UI code.

### File Structure

```
src/services/providers/
├── types.ts              # Interfaces and types
├── base.provider.ts      # Base class with common logic
├── mock.provider.ts      # Mock data provider
├── csv.provider.ts       # CSV file provider
├── zillow-metrics.provider.ts  # Zillow API provider
├── factory.ts            # Provider factory
└── index.ts              # Public exports
```

### Creating a New Provider

**Step 1**: Define provider class

```typescript
// src/services/providers/my-new-provider.ts
import { BaseProvider } from './base.provider';
import type { MarketStats, ProviderInfo } from './types';

export class MyNewProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'my-provider',
    name: 'My Provider',
    description: 'Description here',
    icon: '🏠',
    requiresApiKey: true,
    rateLimits: {
      limit: 100,
      period: 'hour',
    },
    features: {
      marketStats: true,
      propertySearch: false,
      propertyDetails: false,
    },
  };

  isConfigured(): boolean {
    return !!import.meta.env.VITE_MY_API_KEY;
  }

  protected async fetchMarketStatsFromAPI(
    location: string
  ): Promise<MarketStats | null> {
    // Implement API call here
    const response = await fetch(`${baseURL}/${location}`);
    const data = await response.json();
    return this.transformToMarketStats(data);
  }

  private transformToMarketStats(apiData: any): MarketStats {
    // Transform API response to MarketStats format
    return {
      id: apiData.id,
      city: apiData.city,
      state: apiData.state,
      saleData: {
        medianPrice: apiData.median_price,
        // ...
      },
    };
  }
}
```

**Step 2**: Register in factory

```typescript
// src/services/providers/factory.ts
import { MyNewProvider } from './my-new-provider';

export function createProvider(): IHousingDataProvider {
  const type = getProviderType();

  switch (type) {
    case 'my-provider':
      return new MyNewProvider();
    case 'csv':
      return new CSVProvider();
    // ... other cases
  }
}
```

**Step 3**: Update environment config

```env
# .env
VITE_MY_API_KEY=your_api_key
VITE_DEFAULT_PROVIDER=my-provider
```

### Provider Interface

```typescript
interface IHousingDataProvider {
  // Metadata about the provider
  readonly info: ProviderInfo;

  // Check if provider is configured
  isConfigured(): boolean;

  // Fetch market statistics
  getMarketStats(
    location: string,
    forceRefresh?: boolean
  ): Promise<MarketStats | null>;

  // Optional: Search for properties
  searchProperties?(
    query: string,
    forceRefresh?: boolean
  ): Promise<Property[]>;
}
```

### Base Provider Features

The `BaseProvider` class provides common functionality:

- **Caching**: Automatic caching with TTL
- **Logging**: Standardized console logging
- **Error Handling**: Consistent error messages

```typescript
class BaseProvider implements IHousingDataProvider {
  // Cache with TTL
  protected cache = new Map<string, CacheEntry>();

  // Get with caching
  async getMarketStats(location: string, forceRefresh = false) {
    if (!forceRefresh && this.cache.has(location)) {
      return this.cache.get(location).data;
    }

    const data = await this.fetchMarketStatsFromAPI(location);
    this.cache.set(location, { data, timestamp: Date.now() });
    return data;
  }

  // Implement in subclass
  protected abstract fetchMarketStatsFromAPI(
    location: string
  ): Promise<MarketStats | null>;
}
```

---

## Data Flow

### Application Data Flow

```
User Action → Component → Hook → Provider → API/Storage
                ↓                    ↓
              UI Update ← Transform ← Data
```

### Example: Loading Markets

```typescript
// 1. Component mounts
<App />

// 2. Hook initializes
const { data, loading } = useMarketData();

// 3. Hook fetches data
useEffect(() => {
  const provider = createProvider();
  const markets = await provider.getAllMarkets();
  setData(markets);
}, []);

// 4. Provider loads data
class CSVProvider {
  getAllMarkets() {
    // Load from IndexedDB
    const data = await IndexedDBCache.get('csv-markets');
    return data;
  }
}

// 5. Component renders
{loading ? <Skeleton /> : <MarketCards data={data} />}
```

### CSV Upload Flow

```
User selects file
  ↓
CSVUpload component
  ↓
FileReader API reads file
  ↓
csvParser.ts validates & parses
  ↓
CSVProvider stores in IndexedDB
  ↓
useMarketData refetches
  ↓
UI updates with new markets
```

---

## Key Components

### MarketCard

**Purpose**: Display market summary

**Props**:
```typescript
interface MarketCardProps {
  market: MarketPriceData;
  onClick: () => void;
  onAddToWatchlist?: () => void;
}
```

**Usage**:
```tsx
<MarketCard
  market={marketData}
  onClick={() => handleMarketClick(marketData)}
  onAddToWatchlist={() => addToWatchlist(marketData.marketId)}
/>
```

**Location**: `src/components/MarketCard.tsx`

---

### PriceChart

**Purpose**: Render interactive line chart

**Props**:
```typescript
interface PriceChartProps {
  data: PriceDataPoint[];
  timeRange: TimeRange;
}
```

**Features**:
- Loading skeleton
- Time range filtering
- Custom tooltip
- Responsive sizing

**Location**: `src/components/PriceChart.tsx`

---

### CSVUpload

**Purpose**: Handle CSV file uploads

**Features**:
- Drag-and-drop support
- Format validation
- Progress indicator
- Error messages
- Template download

**Location**: `src/components/CSVUpload.tsx`

---

### useMarketData Hook

**Purpose**: Fetch and manage market data

**Returns**:
```typescript
interface UseMarketDataResult {
  data: MarketPriceData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  forceRefresh: () => void;
}
```

**Usage**:
```typescript
const { data, loading, error, forceRefresh } = useMarketData();
```

**Location**: `src/hooks/useMarketData.ts`

---

## Adding New Features

### Adding a New Component

**Step 1**: Create component file

```typescript
// src/components/MyComponent.tsx
import React from 'react';

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export const MyComponent = ({ title, onAction }: MyComponentProps) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold">{title}</h3>
      <button onClick={onAction}>Action</button>
    </div>
  );
};
```

**Step 2**: Add to parent component

```typescript
// src/App.tsx
import { MyComponent } from './components/MyComponent';

function App() {
  return (
    <div>
      <MyComponent title="Test" onAction={() => console.log('clicked')} />
    </div>
  );
}
```

### Adding a New Hook

```typescript
// src/hooks/useMyHook.ts
import { useState, useEffect } from 'react';

export const useMyHook = (param: string) => {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch or compute data
    setData(`Processed: ${param}`);
    setLoading(false);
  }, [param]);

  return { data, loading };
};
```

### Adding a New Utility Function

```typescript
// src/utils/myUtils.ts

/**
 * Description of what this does
 * @param input - Description
 * @returns Description
 */
export function myUtilityFunction(input: string): string {
  return input.toUpperCase();
}
```

---

## Code Style Guide

### TypeScript

**Use explicit types for function parameters and returns**:

```typescript
// Good
function calculatePrice(base: number, tax: number): number {
  return base + (base * tax);
}

// Avoid
function calculatePrice(base, tax) {
  return base + (base * tax);
}
```

**Use interfaces for object shapes**:

```typescript
// Good
interface Market {
  id: string;
  name: string;
  price: number;
}

// Avoid inline types
function getMarket(): { id: string; name: string; price: number } { }
```

### React Components

**Use functional components with hooks**:

```typescript
// Good
export const MyComponent = ({ title }: Props) => {
  const [state, setState] = useState();
  return <div>{title}</div>;
};

// Avoid class components for new code
class MyComponent extends React.Component { }
```

**Extract complex logic to custom hooks**:

```typescript
// Good
const { data, loading } = useMarketData();

// Avoid putting complex logic in components
useEffect(() => {
  // 50 lines of data fetching logic...
}, []);
```

### CSS/Tailwind

**Use Tailwind utility classes**:

```tsx
// Good
<div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow">

// Avoid custom CSS files
<div className="my-custom-card">
```

**Use responsive modifiers**:

```tsx
<div className="text-sm sm:text-base md:text-lg">
```

### File Naming

- **Components**: PascalCase (e.g., `MarketCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useMarketData.ts`)
- **Utils**: camelCase (e.g., `csvParser.ts`)
- **Types**: camelCase (e.g., `index.ts` in `types/` folder)

---

## Testing

### Test Structure (Future)

```
src/
├── components/
│   ├── MarketCard.tsx
│   └── MarketCard.test.tsx
├── hooks/
│   ├── useMarketData.ts
│   └── useMarketData.test.ts
```

### Unit Test Example

```typescript
// src/utils/formatters.test.ts
import { formatPrice } from './formatters';

describe('formatPrice', () => {
  it('formats whole numbers correctly', () => {
    expect(formatPrice(1000000)).toBe('$1,000,000');
  });

  it('formats with cents', () => {
    expect(formatPrice(1234.56)).toBe('$1,234.56');
  });
});
```

### Component Test Example

```typescript
// src/components/MarketCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketCard } from './MarketCard';

describe('MarketCard', () => {
  it('displays market name', () => {
    const market = { marketName: 'Detroit, MI', /* ... */ };
    render(<MarketCard market={market} onClick={() => {}} />);

    expect(screen.getByText('Detroit, MI')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<MarketCard market={mockMarket} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

---

## Deployment

### Build for Production

```bash
# Build optimized bundle
npm run build

# Output: dist/ folder
```

### Environment Variables

For production, set environment variables in your hosting platform:

**Vercel**:
1. Project Settings → Environment Variables
2. Add: `VITE_ZILLOW_API_KEY`, `VITE_DEFAULT_PROVIDER`, etc.
3. Redeploy

**Netlify**:
1. Site Settings → Build & Deploy → Environment
2. Add variables
3. Trigger deploy

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Performance Checklist

- [ ] Bundle size < 500KB (gzipped)
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Images optimized
- [ ] Code splitting enabled

---

## Troubleshooting

### Common Issues

**Issue**: "Module not found" errors

**Solution**: Clear node_modules and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

**Issue**: TypeScript errors after pulling changes

**Solution**: Restart TypeScript server in your IDE

**Issue**: Vite HMR not working

**Solution**: Check `.env` file exists and restart dev server

---

## Contributing

### Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Test locally
4. Commit: `git commit -m "feat: add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create pull request

### Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance

---

## Resources

### Documentation

- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Recharts](https://recharts.org/en-US/)
- [Vite](https://vitejs.dev/)

### Project Documents

- `POC_PLAN_UPDATED.md` - Project status and goals
- `PROJECT_LEARNINGS.md` - Technical insights
- `USER_GUIDE.md` - End-user documentation
- `NEXT_PHASE_PLAN.md` - Future roadmap

---

**Document Version**: 1.0
**Last Updated**: 2025-10-21
**Maintained by**: Development Team
