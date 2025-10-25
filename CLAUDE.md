# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a housing market data visualization web application modeled after Google Finance, designed to display customizable graphs and analytics for various housing markets (single-family homes, apartments, rentals, etc.) across different cities and regions.

**Current Status**: Planning phase with two implementation tracks defined:
- **POC Track**: 1-2 week proof of concept (see POC_PLAN.md)
- **Full Implementation**: 12-week comprehensive build (see HOUSING_APP_PLAN.md)

## Git Workflow

**Branch Strategy**: Create a new feature branch for each feature request or task.

```bash
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

## Development Commands

### POC Development (when implemented)
```bash
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

### Full Implementation Architecture (When Built)
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

interface WatchlistItem {
  marketId: string;
  marketName: string;
  addedAt: string;
}
```

## Data Sources

### Primary API: RentCast
- **Free Tier**: 50 API calls/month
- **Base URL**: `https://api.rentcast.io/v1`
- **Authentication**: API key in header (`X-Api-Key`)
- **Key Endpoints**:
  - `GET /v1/properties` - Search properties by location
  - `GET /v1/markets` - Get market statistics
  - `GET /v1/value-estimate` - Get property value estimates

### API Key Configuration
```bash
# Create .env file (never commit this)
VITE_RENTCAST_API_KEY=your_api_key_here
```

Access in code:
```typescript
const API_KEY = import.meta.env.VITE_RENTCAST_API_KEY;
```

### Fallback Data
Mock data for 5 markets (Detroit, Anaheim, Austin, Miami, Seattle) should be available as fallback when API calls fail or for demos without consuming API quota.

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

POC deployment to Vercel:
1. Ensure `.env` is in `.gitignore`
2. Build project: `npm run build`
3. Deploy: `vercel` or connect GitHub repo to Vercel dashboard
4. Add environment variable `VITE_RENTCAST_API_KEY` in Vercel dashboard
5. Redeploy if environment variables were added after initial deploy

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
