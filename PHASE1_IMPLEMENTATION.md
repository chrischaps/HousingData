# POC Phase 1 Implementation Plan
## Project Setup & Basic UI

**Timeline**: Day 1 of POC (approximately 4 hours)
**Goal**: Create project foundation with basic UI layout and placeholder components

---

## Overview

Phase 1 establishes the foundational structure of the housing data POC. By the end of this phase, you'll have a working React + TypeScript application with Tailwind CSS styling and a complete component skeleton ready for data integration.

**Success Criteria**:
- ✅ Vite project initialized with React + TypeScript
- ✅ Tailwind CSS configured and working
- ✅ TypeScript interfaces defined for all data models
- ✅ Basic responsive layout implemented
- ✅ Placeholder components created with mock data
- ✅ Application renders without errors
- ✅ Git branch created for Phase 1 work

---

## Prerequisites

Before starting Phase 1:
- Node.js 18+ installed
- Git configured
- Code editor (VS Code recommended)
- GitHub repository access

---

## Step-by-Step Implementation

### Step 1: Create Feature Branch (5 minutes)

Following the project's Git workflow, create a new branch for Phase 1 work.

```bash
# Ensure you're on master and up to date
git checkout master
git pull origin master

# Create and switch to Phase 1 feature branch
git checkout -b feature/poc-phase1-setup

# Verify you're on the correct branch
git branch
```

**Verification**: `git branch` should show `* feature/poc-phase1-setup`

---

### Step 2: Initialize Vite Project (15 minutes)

Create the React + TypeScript project using Vite.

```bash
# Create Vite project with React + TypeScript template
npm create vite@latest housing-data-poc -- --template react-ts

# Navigate into project directory
cd housing-data-poc

# Install base dependencies
npm install

# Test that the project runs
npm run dev
```

**Verification**:
- Open browser to `http://localhost:5173`
- You should see the default Vite + React welcome page
- Press `Ctrl+C` to stop the dev server

**Expected Output**:
```
  VITE v5.4.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

### Step 3: Install Project Dependencies (10 minutes)

Install all required packages for the POC.

```bash
# Install main dependencies
npm install recharts axios

# Install development dependencies
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind CSS
npx tailwindcss init -p
```

**What each dependency does**:
- `recharts` - Chart library for data visualization
- `axios` - HTTP client for API calls
- `tailwindcss` - Utility-first CSS framework
- `postcss` - CSS transformation tool (required by Tailwind)
- `autoprefixer` - Adds vendor prefixes to CSS (required by Tailwind)

**Verification**: Check that `package.json` contains all dependencies:
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

### Step 4: Configure Tailwind CSS (10 minutes)

Set up Tailwind to scan your React components for class names.

**4.1: Update `tailwind.config.js`**

Replace the contents of `tailwind.config.js` with:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        'price-up': '#10B981',
        'price-down': '#EF4444',
      },
    },
  },
  plugins: [],
}
```

**4.2: Update `src/index.css`**

Replace the contents of `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom base styles */
body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: 'JetBrains Mono', source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
```

**Verification**: Start dev server (`npm run dev`) and check that Tailwind styles are applied.

---

### Step 5: Create Project Structure (10 minutes)

Set up the directory structure for organized code.

```bash
# From the housing-data-poc directory, create all necessary folders
mkdir -p src/components
mkdir -p src/services
mkdir -p src/hooks
mkdir -p src/types
mkdir -p src/utils
```

**Expected structure**:
```
housing-data-poc/
├── src/
│   ├── components/    # UI components
│   ├── services/      # API client
│   ├── hooks/         # Custom React hooks
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Helper functions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

**Verification**: Run `ls -R src/` to see the directory tree

---

### Step 6: Define TypeScript Interfaces (20 minutes)

Create type definitions for all data models.

**Create `src/types/index.ts`**:

```typescript
// Market types
export interface Market {
  id: string;
  name: string;          // "Detroit, MI" or "Anaheim, CA"
  city: string;
  state: string;
  zipCode?: string;
}

// Price data types
export interface PriceDataPoint {
  date: string;          // ISO date string
  price: number;
  propertyType: 'single_family' | 'condo' | 'apartment';
}

export interface MarketPriceData {
  marketId: string;
  marketName: string;
  currentPrice: number;
  priceChange: number;   // percentage
  changeDirection: 'up' | 'down' | 'neutral';
  historicalData: PriceDataPoint[];
  lastUpdated: string;
}

// Watchlist types
export interface WatchlistItem {
  marketId: string;
  marketName: string;
  addedAt: string;       // ISO date string
}

// Component prop types
export interface MarketCardProps {
  market: MarketPriceData;
  onClick: () => void;
  onAddToWatchlist?: () => void;
}

export interface PriceChartProps {
  data: PriceDataPoint[];
  timeRange: '1M' | '6M' | '1Y' | '5Y' | 'MAX';
}

export interface TimeRangeSelectorProps {
  selected: string;
  onChange: (range: string) => void;
}

export interface MarketSearchProps {
  onSelectMarket: (market: Market) => void;
}

export interface WatchlistPanelProps {
  onSelectMarket: (marketId: string) => void;
}

// Time range type
export type TimeRange = '1M' | '6M' | '1Y' | '5Y' | 'MAX';
```

**Verification**: TypeScript should compile without errors. You can check with:
```bash
npx tsc --noEmit
```

---

### Step 7: Create Utility Functions (15 minutes)

Set up helper functions for formatting and mock data.

**7.1: Create `src/utils/formatters.ts`**:

```typescript
/**
 * Format a price number as currency
 * @param price - The price to format
 * @returns Formatted price string (e.g., "$450,000")
 */
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

/**
 * Format a price for chart Y-axis (abbreviated)
 * @param price - The price to format
 * @returns Abbreviated price string (e.g., "$450K")
 */
export const formatPriceShort = (price: number): string => {
  if (price >= 1_000_000) {
    return `$${(price / 1_000_000).toFixed(1)}M`;
  }
  return `$${(price / 1_000).toFixed(0)}K`;
};

/**
 * Format a date string for display
 * @param dateString - ISO date string
 * @returns Formatted date (e.g., "Jan 2023")
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Format a percentage change
 * @param change - The percentage change
 * @returns Formatted percentage (e.g., "+5.2%" or "-3.1%")
 */
export const formatPercentage = (change: number): string => {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
};

/**
 * Calculate percentage change between two values
 * @param oldValue - Original value
 * @param newValue - New value
 * @returns Percentage change
 */
export const calculatePercentageChange = (
  oldValue: number,
  newValue: number
): number => {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
};
```

**7.2: Create `src/utils/constants.ts`**:

```typescript
// API Configuration
export const API_BASE_URL = 'https://api.rentcast.io/v1';
export const API_KEY = import.meta.env.VITE_RENTCAST_API_KEY || '';

// localStorage keys
export const WATCHLIST_STORAGE_KEY = 'housing-watchlist';

// Time ranges
export const TIME_RANGES = ['1M', '6M', '1Y', '5Y', 'MAX'] as const;

// Mock markets for initial display
export const MOCK_MARKETS = [
  { id: '1', name: 'Detroit, MI', city: 'Detroit', state: 'MI', zipCode: '48201' },
  { id: '2', name: 'Anaheim, CA', city: 'Anaheim', state: 'CA', zipCode: '92805' },
  { id: '3', name: 'Austin, TX', city: 'Austin', state: 'TX', zipCode: '78701' },
  { id: '4', name: 'Miami, FL', city: 'Miami', state: 'FL', zipCode: '33101' },
  { id: '5', name: 'Seattle, WA', city: 'Seattle', state: 'WA', zipCode: '98101' },
];

// Design system colors (matching Tailwind config)
export const COLORS = {
  primary: '#1E40AF',
  priceUp: '#10B981',
  priceDown: '#EF4444',
  neutral: '#6B7280',
} as const;
```

**Verification**: Import these utilities in `App.tsx` to check for TypeScript errors:
```typescript
import { formatPrice, formatDate } from './utils/formatters';
import { MOCK_MARKETS } from './utils/constants';
```

---

### Step 8: Create Placeholder Components (45 minutes)

Build basic component shells with placeholder content.

**8.1: Create `src/components/MarketCard.tsx`**:

```typescript
import { MarketCardProps } from '../types';
import { formatPrice, formatPercentage } from '../utils/formatters';

export const MarketCard = ({ market, onClick, onAddToWatchlist }: MarketCardProps) => {
  const isPositive = market.changeDirection === 'up';
  const changeColor = isPositive ? 'text-price-up' : 'text-price-down';
  const arrow = isPositive ? '↑' : '↓';

  return (
    <div
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-900">{market.marketName}</h3>
          <p className="text-sm text-gray-500">Single Family Home</p>
        </div>
        {onAddToWatchlist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToWatchlist();
            }}
            className="text-primary hover:text-blue-800 font-medium text-sm transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-gray-900 mb-1">
          {formatPrice(market.currentPrice)}
        </p>
        <p className={`text-sm font-medium ${changeColor}`}>
          {arrow} {formatPercentage(Math.abs(market.priceChange))}
        </p>
      </div>
    </div>
  );
};
```

**8.2: Create `src/components/TimeRangeSelector.tsx`**:

```typescript
import { TimeRangeSelectorProps } from '../types';
import { TIME_RANGES } from '../utils/constants';

export const TimeRangeSelector = ({ selected, onChange }: TimeRangeSelectorProps) => {
  return (
    <div className="flex gap-2">
      {TIME_RANGES.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            selected === range
              ? 'bg-primary text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
};
```

**8.3: Create `src/components/PriceChart.tsx`** (placeholder):

```typescript
import { PriceChartProps } from '../types';

export const PriceChart = ({ data, timeRange }: PriceChartProps) => {
  return (
    <div className="w-full h-96 bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Chart Component</p>
          <p className="text-gray-400 text-sm mt-2">
            Time Range: {timeRange} | Data Points: {data.length}
          </p>
          <p className="text-gray-400 text-xs mt-4">
            Will be implemented in Phase 3
          </p>
        </div>
      </div>
    </div>
  );
};
```

**8.4: Create `src/components/MarketSearch.tsx`** (placeholder):

```typescript
import { MarketSearchProps } from '../types';

export const MarketSearch = ({ onSelectMarket }: MarketSearchProps) => {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search by city or ZIP code..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        disabled
      />
      <p className="text-xs text-gray-400 mt-1">
        Search functionality coming in Phase 4
      </p>
    </div>
  );
};
```

**8.5: Create `src/components/WatchlistPanel.tsx`** (placeholder):

```typescript
import { WatchlistPanelProps } from '../types';

export const WatchlistPanel = ({ onSelectMarket }: WatchlistPanelProps) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-900">My Watchlist</h2>
      <p className="text-gray-500 text-sm">
        No markets in watchlist yet.
      </p>
      <p className="text-xs text-gray-400 mt-2">
        Watchlist functionality coming in Phase 5
      </p>
    </div>
  );
};
```

**Verification**: All components should compile without TypeScript errors.

---

### Step 9: Build Main App Layout (30 minutes)

Create the responsive application layout with header and main content area.

**Update `src/App.tsx`**:

```typescript
import { useState } from 'react';
import { MarketCard } from './components/MarketCard';
import { PriceChart } from './components/PriceChart';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { MarketSearch } from './components/MarketSearch';
import { WatchlistPanel } from './components/WatchlistPanel';
import { MarketPriceData, TimeRange, Market } from './types';

// Mock data for initial display
const mockMarketData: MarketPriceData[] = [
  {
    marketId: '1',
    marketName: 'Detroit, MI',
    currentPrice: 225000,
    priceChange: 5.2,
    changeDirection: 'up',
    historicalData: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    marketId: '2',
    marketName: 'Anaheim, CA',
    currentPrice: 875000,
    priceChange: -2.1,
    changeDirection: 'down',
    historicalData: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    marketId: '3',
    marketName: 'Austin, TX',
    currentPrice: 550000,
    priceChange: 8.7,
    changeDirection: 'up',
    historicalData: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    marketId: '4',
    marketName: 'Miami, FL',
    currentPrice: 625000,
    priceChange: 3.4,
    changeDirection: 'up',
    historicalData: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    marketId: '5',
    marketName: 'Seattle, WA',
    currentPrice: 825000,
    priceChange: -1.8,
    changeDirection: 'down',
    historicalData: [],
    lastUpdated: new Date().toISOString(),
  },
];

function App() {
  const [selectedMarket, setSelectedMarket] = useState<MarketPriceData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');

  const handleMarketClick = (market: MarketPriceData) => {
    setSelectedMarket(market);
  };

  const handleSelectMarket = (market: Market) => {
    console.log('Selected market:', market);
  };

  const handleAddToWatchlist = () => {
    console.log('Add to watchlist clicked');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Housing Market Data
            </h1>
            <div className="text-sm text-gray-500">
              POC Phase 1
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="space-y-6">
              <MarketSearch onSelectMarket={handleSelectMarket} />
              <WatchlistPanel onSelectMarket={(id) => console.log('Watchlist select:', id)} />
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Market Cards Grid */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Featured Markets
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockMarketData.map((market) => (
                  <MarketCard
                    key={market.marketId}
                    market={market}
                    onClick={() => handleMarketClick(market)}
                    onAddToWatchlist={handleAddToWatchlist}
                  />
                ))}
              </div>
            </section>

            {/* Chart Section */}
            {selectedMarket && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedMarket.marketName}
                  </h2>
                  <TimeRangeSelector
                    selected={timeRange}
                    onChange={(range) => setTimeRange(range as TimeRange)}
                  />
                </div>
                <PriceChart
                  data={selectedMarket.historicalData}
                  timeRange={timeRange}
                />
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Housing Data POC - Phase 1 Complete
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
```

**Verification**:
- Run `npm run dev`
- Open `http://localhost:5173`
- You should see:
  - Header with "Housing Market Data" title
  - Sidebar with search (disabled) and empty watchlist
  - 5 market cards with prices and trends
  - Clicking a card shows chart placeholder
  - Time range selector updates when clicked

---

### Step 10: Clean Up Vite Defaults (5 minutes)

Remove default Vite files and styling we don't need.

```bash
# Remove default Vite assets
rm src/assets/react.svg
rm public/vite.svg

# Remove default App.css if it exists
rm src/App.css 2>/dev/null || true
```

**Update `src/main.tsx`** to remove any references to removed files:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**Verification**: App should still run without errors after cleanup.

---

### Step 11: Create Environment File Template (5 minutes)

Set up environment variable configuration.

**Create `.env.example`**:

```bash
# RentCast API Key
# Get your free API key at: https://www.rentcast.io/api
VITE_RENTCAST_API_KEY=your_api_key_here
```

**Update `.gitignore`** to ensure `.env` is not committed:

```bash
# Add to .gitignore if not already present
echo "" >> .gitignore
echo "# Environment variables" >> .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

**Verification**: Check that `.env` is listed in `.gitignore`

---

### Step 12: Test and Commit (15 minutes)

Final testing and commit Phase 1 work.

**12.1: Run Final Tests**

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Run dev server
npm run dev

# Test production build
npm run build
npm run preview
```

**12.2: Commit Changes**

```bash
# Stop dev server (Ctrl+C)

# Stage all changes
git add .

# Create commit
git commit -m "$(cat <<'EOF'
feat: Complete POC Phase 1 - Project setup and basic UI

- Initialize Vite project with React + TypeScript
- Configure Tailwind CSS with custom theme colors
- Create project structure (components, services, hooks, types, utils)
- Define TypeScript interfaces for all data models
- Implement utility functions for formatting
- Create placeholder components:
  - MarketCard with price display and trend indicators
  - TimeRangeSelector with 5 time range options
  - PriceChart placeholder
  - MarketSearch placeholder
  - WatchlistPanel placeholder
- Build responsive main app layout with header, sidebar, and content area
- Add mock market data for 5 cities
- Set up environment variable template

Deliverable: Static UI mockup with placeholder components and mock data

Next: Phase 2 - API Integration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Push to remote
git push -u origin feature/poc-phase1-setup
```

**Verification**:
- Check GitHub to see the new branch pushed
- Verify commit message is properly formatted
- Confirm all files are tracked

---

## Deliverables Checklist

After completing Phase 1, verify all deliverables:

- [ ] Vite project initialized with React 18 + TypeScript
- [ ] Tailwind CSS configured with custom theme
- [ ] All dependencies installed (recharts, axios, tailwind)
- [ ] Project folder structure created
- [ ] TypeScript interfaces defined in `src/types/index.ts`
- [ ] Utility functions created (`formatters.ts`, `constants.ts`)
- [ ] MarketCard component renders with mock data
- [ ] TimeRangeSelector component functions correctly
- [ ] PriceChart placeholder displays
- [ ] MarketSearch placeholder displays
- [ ] WatchlistPanel placeholder displays
- [ ] Main App layout is responsive
- [ ] Application runs without errors (`npm run dev`)
- [ ] Production build succeeds (`npm run build`)
- [ ] `.env.example` file created
- [ ] `.env` is in `.gitignore`
- [ ] Changes committed to feature branch
- [ ] Feature branch pushed to GitHub

---

## Troubleshooting

### Common Issues

**Issue**: `npm create vite` fails with "command not found"
- **Solution**: Ensure Node.js 18+ is installed: `node --version`

**Issue**: Tailwind classes not applying
- **Solution**:
  1. Check `tailwind.config.js` content paths
  2. Ensure `@tailwind` directives are in `index.css`
  3. Restart dev server after config changes

**Issue**: TypeScript errors in components
- **Solution**:
  1. Run `npx tsc --noEmit` to see detailed errors
  2. Check that all types are imported from `./types`
  3. Ensure `tsconfig.json` is properly configured

**Issue**: Port 5173 already in use
- **Solution**: Kill existing process or use different port:
  ```bash
  npm run dev -- --port 3000
  ```

---

## Next Steps

After completing Phase 1:

1. **Review the UI**: Open the app and interact with all placeholder components
2. **Prepare for Phase 2**: Sign up for RentCast API key at https://www.rentcast.io/api
3. **Read Phase 2 docs**: Familiarize yourself with API integration requirements
4. **Create Phase 2 branch**: When ready, create `feature/poc-phase2-api`

**Time Estimate for Phase 2**: 4-5 hours
**Phase 2 Focus**: API integration and real data fetching

---

## Additional Resources

- **Vite Documentation**: https://vitejs.dev/guide/
- **React TypeScript Cheatsheet**: https://react-typescript-cheatsheet.netlify.app/
- **Tailwind CSS Docs**: https://tailwindcss.com/docs
- **POC_PLAN.md**: Full POC implementation guide

---

**Document Version**: 1.0
**Last Updated**: 2025-10-19
**Phase**: 1 of 5
**Estimated Time**: 4 hours
**Status**: Ready for implementation
