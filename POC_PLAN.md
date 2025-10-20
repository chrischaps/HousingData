# Housing Data App - Proof of Concept Plan

## Overview

This document outlines a streamlined approach to building a proof of concept (POC) for the housing data web application. The goal is to validate core functionality and demonstrate value within **1-2 weeks** with minimal infrastructure complexity.

---

## POC Goals

### Primary Objectives
1. **Validate Data Access**: Confirm we can successfully fetch and display real housing market data
2. **Demonstrate Core Value**: Show interactive charts with meaningful housing price trends
3. **Prove Technical Feasibility**: Validate the chosen tech stack works for our use case
4. **Gather User Feedback**: Get early input on UI/UX and feature priorities

### Success Criteria
- Display housing price data for at least 5 different markets
- Interactive chart with time range selection (1M, 6M, 1Y, 5Y)
- Search functionality to find and display markets
- Responsive design that works on desktop and mobile
- Page loads in under 3 seconds

### Out of Scope for POC
- User authentication and accounts
- Watchlist persistence (can use localStorage only)
- Multiple data sources (use one API only)
- Advanced analytics or AI features
- Production deployment and monitoring
- Comprehensive error handling

---

## Minimal Feature Set

### Must-Have Features

**1. Market Search**
- Simple search input for city/ZIP code
- Display search results with basic info
- Click to view market details

**2. Market Data Display**
- Show current median home price
- Display price trend (up/down with percentage)
- Mini chart preview

**3. Interactive Chart**
- Line chart showing price history
- Time range selector (1M, 6M, 1Y, 5Y, MAX)
- Tooltip showing exact values on hover
- Single property type (median single-family home price)

**4. Basic Market List**
- Display 5-10 pre-selected markets (e.g., Detroit, Anaheim, Austin, Miami, Seattle)
- Quick stats for each market
- Click to view detailed chart

**5. Simple Watchlist**
- Add/remove markets to a list (localStorage only)
- Display watchlist items on page
- No persistence across devices

### Nice-to-Have (if time permits)
- Compare two markets side-by-side
- Dark/light theme toggle
- Export chart as image
- Market statistics (inventory, days on market)

---

## Simplified Tech Stack

### Frontend Only (No Backend Required for POC)

**Core Stack**
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite (fastest setup)
- **Styling**: Tailwind CSS (rapid styling)
- **Charts**: Recharts (easy React integration)
- **State**: React Context + useState (no complex state management)
- **HTTP Client**: Axios or fetch
- **Storage**: localStorage for watchlist

**Why No Backend?**
- Faster development (no API layer to build)
- Free hosting (Vercel, Netlify)
- Direct API calls from frontend (acceptable for POC)
- API keys can be environment variables

**Key Dependencies**
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.0",
    "axios": "^1.7.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

### Data Source

**RentCast API (Free Tier)**
- 50 free API calls per month
- Access to property data and market statistics
- Historical price trends
- No credit card required for free tier

**API Endpoints to Use**
```
GET /v1/properties - Search properties by location
GET /v1/markets - Get market statistics
GET /v1/value-estimate - Get property value estimates
```

**Alternative**: If RentCast doesn't meet needs, use Redfin downloadable data (CSV files) and load them directly

---

## Minimal Data Model

### In-Memory Data Structures (No Database)

**Market Interface**
```typescript
interface Market {
  id: string;
  name: string; // "Detroit, MI" or "Anaheim, CA"
  city: string;
  state: string;
  zipCode?: string;
}
```

**Price Data Interface**
```typescript
interface PriceDataPoint {
  date: string; // ISO date string
  price: number;
  propertyType: 'single_family' | 'condo' | 'apartment';
}

interface MarketPriceData {
  marketId: string;
  marketName: string;
  currentPrice: number;
  priceChange: number; // percentage
  changeDirection: 'up' | 'down' | 'neutral';
  historicalData: PriceDataPoint[];
  lastUpdated: string;
}
```

**Watchlist Storage (localStorage)**
```typescript
interface WatchlistItem {
  marketId: string;
  marketName: string;
  addedAt: string;
}

// Stored as JSON in localStorage
const watchlist: WatchlistItem[] = JSON.parse(
  localStorage.getItem('housing-watchlist') || '[]'
);
```

---

## Project Structure

```
housing-data-poc/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── MarketCard.tsx          # Market summary card
│   │   ├── PriceChart.tsx          # Interactive chart component
│   │   ├── MarketSearch.tsx        # Search input and results
│   │   ├── TimeRangeSelector.tsx   # Chart time range buttons
│   │   └── WatchlistPanel.tsx      # Watchlist sidebar
│   ├── services/
│   │   └── api.ts                  # RentCast API client
│   ├── hooks/
│   │   ├── useMarketData.ts        # Fetch market data
│   │   └── useWatchlist.ts         # Manage watchlist
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   ├── utils/
│   │   ├── formatters.ts           # Price, date formatting
│   │   └── constants.ts            # API keys, config
│   ├── App.tsx                     # Main app component
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Tailwind imports
├── .env                            # API keys (not committed)
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## Step-by-Step Implementation Guide

### Day 1: Project Setup & Basic UI

**Step 1: Initialize Project (30 minutes)**
```bash
# Create Vite project with React + TypeScript
npm create vite@latest housing-data-poc -- --template react-ts
cd housing-data-poc
npm install

# Install dependencies
npm install recharts axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Step 2: Configure Tailwind CSS (15 minutes)**
Update `tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Update `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 3: Create TypeScript Types (30 minutes)**
Create `src/types/index.ts` with all interfaces (see "Minimal Data Model" section above)

**Step 4: Build Basic Layout (2 hours)**
- Create `App.tsx` with header and main content area
- Add placeholder components for search, market list, and chart
- Implement responsive grid layout with Tailwind
- Add basic styling (colors, fonts, spacing)

**Deliverable**: Static UI mockup with placeholder data

---

### Day 2: API Integration

**Step 5: Set Up RentCast API (30 minutes)**
```bash
# Sign up at https://www.rentcast.io/api
# Get API key

# Create .env file
echo "VITE_RENTCAST_API_KEY=your_api_key_here" > .env
```

Create `src/services/api.ts`:
```typescript
import axios from 'axios';

const API_KEY = import.meta.env.VITE_RENTCAST_API_KEY;
const BASE_URL = 'https://api.rentcast.io/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-Api-Key': API_KEY,
  },
});

export const searchMarkets = async (query: string) => {
  const response = await apiClient.get('/markets', {
    params: { city: query },
  });
  return response.data;
};

export const getMarketPrices = async (zipCode: string) => {
  const response = await apiClient.get('/properties', {
    params: { zipCode, limit: 100 },
  });
  return response.data;
};

export default apiClient;
```

**Step 6: Create Data Hooks (1.5 hours)**

`src/hooks/useMarketData.ts`:
```typescript
import { useState, useEffect } from 'react';
import { getMarketPrices } from '../services/api';
import type { MarketPriceData } from '../types';

export const useMarketData = (zipCode: string) => {
  const [data, setData] = useState<MarketPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await getMarketPrices(zipCode);
        // Transform API response to MarketPriceData format
        setData(transformData(result));
        setError(null);
      } catch (err) {
        setError('Failed to fetch market data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [zipCode]);

  return { data, loading, error };
};

// Helper function to transform API response
const transformData = (apiData: any): MarketPriceData => {
  // Implementation depends on actual API response format
  // Parse and format the data appropriately
};
```

**Step 7: Test API Connection (30 minutes)**
- Make test API calls from browser console
- Verify data structure matches our interfaces
- Handle API errors gracefully

**Deliverable**: Working API integration with real data

---

### Day 3: Chart Implementation

**Step 8: Build PriceChart Component (3 hours)**

`src/components/PriceChart.tsx`:
```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { PriceDataPoint } from '../types';

interface PriceChartProps {
  data: PriceDataPoint[];
  timeRange: '1M' | '6M' | '1Y' | '5Y' | 'MAX';
}

export const PriceChart = ({ data, timeRange }: PriceChartProps) => {
  const filteredData = filterByTimeRange(data, timeRange);

  return (
    <div className="w-full h-96 bg-white rounded-lg shadow p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filteredData}>
          <XAxis
            dataKey="date"
            tickFormatter={(date) => formatDate(date)}
          />
          <YAxis
            tickFormatter={(price) => `$${(price / 1000).toFixed(0)}K`}
          />
          <Tooltip
            formatter={(value: number) => `$${value.toLocaleString()}`}
            labelFormatter={(date) => formatDate(date)}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#1E40AF"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};
```

**Step 9: Build TimeRangeSelector Component (1 hour)**
```typescript
interface TimeRangeSelectorProps {
  selected: string;
  onChange: (range: string) => void;
}

export const TimeRangeSelector = ({ selected, onChange }: TimeRangeSelectorProps) => {
  const ranges = ['1M', '6M', '1Y', '5Y', 'MAX'];

  return (
    <div className="flex gap-2">
      {ranges.map(range => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`px-3 py-1 rounded ${
            selected === range
              ? 'bg-blue-600 text-white'
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

**Deliverable**: Interactive chart with time range selection

---

### Day 4: Market Display & Search

**Step 10: Build MarketCard Component (2 hours)**
```typescript
interface MarketCardProps {
  market: MarketPriceData;
  onClick: () => void;
  onAddToWatchlist?: () => void;
}

export const MarketCard = ({ market, onClick, onAddToWatchlist }: MarketCardProps) => {
  const isPositive = market.changeDirection === 'up';

  return (
    <div
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-lg">{market.marketName}</h3>
          <p className="text-sm text-gray-500">Single Family Home</p>
        </div>
        {onAddToWatchlist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToWatchlist();
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            + Add
          </button>
        )}
      </div>

      <div className="mb-2">
        <p className="text-2xl font-bold">
          ${market.currentPrice.toLocaleString()}
        </p>
        <p className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(market.priceChange).toFixed(2)}%
        </p>
      </div>

      {/* Mini sparkline chart could go here */}
    </div>
  );
};
```

**Step 11: Build MarketSearch Component (2 hours)**
```typescript
import { useState } from 'react';
import { searchMarkets } from '../services/api';

export const MarketSearch = ({ onSelectMarket }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await searchMarkets(searchQuery);
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by city or ZIP code..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading && <div className="absolute top-12 left-0 right-0 p-2">Loading...</div>}

      {results.length > 0 && (
        <div className="absolute top-12 left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((market) => (
            <div
              key={market.id}
              onClick={() => onSelectMarket(market)}
              className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
            >
              <p className="font-medium">{market.name}</p>
              <p className="text-sm text-gray-500">{market.city}, {market.state}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Deliverable**: Searchable market list with cards

---

### Day 5: Watchlist & Polish

**Step 12: Build Watchlist Functionality (2 hours)**

`src/hooks/useWatchlist.ts`:
```typescript
import { useState, useEffect } from 'react';
import type { WatchlistItem } from '../types';

const STORAGE_KEY = 'housing-watchlist';

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setWatchlist(JSON.parse(stored));
    }
  }, []);

  const addToWatchlist = (marketId: string, marketName: string) => {
    const newItem: WatchlistItem = {
      marketId,
      marketName,
      addedAt: new Date().toISOString(),
    };

    const updated = [...watchlist, newItem];
    setWatchlist(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const removeFromWatchlist = (marketId: string) => {
    const updated = watchlist.filter(item => item.marketId !== marketId);
    setWatchlist(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const isInWatchlist = (marketId: string) => {
    return watchlist.some(item => item.marketId === marketId);
  };

  return { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist };
};
```

`src/components/WatchlistPanel.tsx`:
```typescript
import { useWatchlist } from '../hooks/useWatchlist';

export const WatchlistPanel = ({ onSelectMarket }) => {
  const { watchlist, removeFromWatchlist } = useWatchlist();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold mb-4">My Watchlist</h2>

      {watchlist.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No markets in watchlist. Search and add markets to track them.
        </p>
      ) : (
        <div className="space-y-2">
          {watchlist.map(item => (
            <div
              key={item.marketId}
              className="flex justify-between items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
              onClick={() => onSelectMarket(item.marketId)}
            >
              <span className="font-medium text-sm">{item.marketName}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromWatchlist(item.marketId);
                }}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Step 13: Polish & Responsive Design (2 hours)**
- Add loading states (skeleton screens)
- Improve error handling with user-friendly messages
- Test on mobile devices and adjust layout
- Add transitions and animations
- Optimize performance (memoization, lazy loading)

**Step 14: Add Mock/Fallback Data (1 hour)**
- Create mock data for 5 markets (Detroit, Anaheim, Austin, Miami, Seattle)
- Use as fallback when API calls fail or for quick demos
- Ensure app is functional even without API

**Deliverable**: Fully functional POC

---

## Testing the POC

### Manual Testing Checklist

**Functionality**
- [ ] Can search for markets by city name
- [ ] Can search for markets by ZIP code
- [ ] Clicking a market displays detailed chart
- [ ] Time range buttons filter chart data correctly
- [ ] Can add markets to watchlist
- [ ] Can remove markets from watchlist
- [ ] Watchlist persists on page refresh
- [ ] Chart tooltip shows accurate data

**UI/UX**
- [ ] Page loads in under 3 seconds
- [ ] Layout is responsive on mobile (< 768px)
- [ ] All text is readable
- [ ] Interactive elements have hover states
- [ ] No console errors
- [ ] Charts render correctly

**Edge Cases**
- [ ] Handles invalid search queries gracefully
- [ ] Shows loading states during API calls
- [ ] Displays error messages when API fails
- [ ] Works with empty watchlist
- [ ] Handles markets with limited historical data

---

## Deployment

### Quick Deployment to Vercel (15 minutes)

**Step 1: Prepare for Deployment**
```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore

# Build project to test
npm run build
```

**Step 2: Deploy to Vercel**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set project name
# - Add environment variable: VITE_RENTCAST_API_KEY
```

**Step 3: Configure Environment Variables**
- Go to Vercel dashboard
- Project Settings → Environment Variables
- Add `VITE_RENTCAST_API_KEY` with your API key
- Redeploy

**Alternative: GitHub Integration**
1. Push code to GitHub
2. Import project in Vercel dashboard
3. Add environment variables
4. Vercel auto-deploys on push

---

## Demo Script

### 5-Minute Demo Flow

**Introduction (30 seconds)**
"This is a proof of concept for a housing market data visualization tool, similar to Google Finance but for real estate."

**Feature 1: Pre-loaded Markets (1 minute)**
- Show the main page with 5-10 markets displayed
- Highlight current prices and trends
- Point out percentage changes and visual indicators

**Feature 2: Interactive Charts (1.5 minutes)**
- Click on a market (e.g., Detroit)
- Show the detailed chart view
- Demonstrate time range selection (1M → 1Y → 5Y)
- Hover over chart to show tooltip with exact values

**Feature 3: Market Search (1 minute)**
- Search for a new city (e.g., "Los Angeles")
- Show search results
- Click on a result to view its chart

**Feature 4: Watchlist (1 minute)**
- Add a market to watchlist
- Show watchlist panel
- Remove a market
- Refresh page to show persistence

**Wrap-up (30 seconds)**
"This POC demonstrates we can successfully fetch real housing data, display it in interactive charts, and provide a Google Finance-like experience for the housing market."

---

## Next Steps After POC

### If POC is Successful

**Immediate**
1. Gather feedback from 5-10 potential users
2. Identify which features resonated most
3. Document pain points and limitations

**Short-term (Week 3-4)**
1. Expand to full feature set (see main HOUSING_APP_PLAN.md)
2. Add backend for better data management
3. Implement user authentication
4. Add multiple data sources for redundancy

**Medium-term (Month 2-3)**
1. Build advanced analytics features
2. Add comparison tools
3. Implement market recommendations
4. Polish UI/UX based on feedback

### If POC Needs Iteration

**Questions to Answer**
- Is the data quality sufficient?
- Are the charts intuitive enough?
- What features are users most excited about?
- What's confusing or unclear?
- Is the value proposition clear?

**Potential Pivots**
- Focus on rental market instead of sales
- Target specific user segment (investors, first-time buyers)
- Add neighborhood-level granularity
- Emphasize comparison and analysis tools

---

## Budget & Resources

### Time Investment
- **Development**: 5 days (40 hours)
- **Testing**: 0.5 days (4 hours)
- **Deployment**: 0.25 days (2 hours)
- **Total**: ~1.5 weeks

### Costs
- **Development**: $0 (self-built)
- **RentCast API**: $0 (free tier, 50 calls/month)
- **Hosting (Vercel)**: $0 (free tier)
- **Domain** (optional): $10-15/year
- **Total for POC**: $0-15

### Required Skills
- React fundamentals
- TypeScript basics
- REST API integration
- Basic CSS/Tailwind
- Git/GitHub

---

## Risk Mitigation

### Technical Risks

**Risk: API Rate Limits**
- Mitigation: Use mock data as fallback, cache responses in localStorage
- Contingency: Switch to Redfin CSV data if needed

**Risk: Insufficient Historical Data**
- Mitigation: Start with markets known to have good data coverage
- Contingency: Use synthetic data generation for demo purposes

**Risk: Poor Chart Performance**
- Mitigation: Limit data points, downsample for large ranges
- Contingency: Switch to canvas-based chart library if needed

### Product Risks

**Risk: Unclear Value Proposition**
- Mitigation: Have clear demo script showing benefits
- Contingency: Pivot based on user feedback

**Risk: Data Not Interesting Enough**
- Mitigation: Choose diverse markets with varying trends
- Contingency: Add more context (news, demographics)

---

## Appendix: Quick Reference

### Essential Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Vercel
vercel --prod
```

### Useful Resources
- Recharts Documentation: https://recharts.org/en-US/
- RentCast API Docs: https://developers.rentcast.io/
- Tailwind CSS Docs: https://tailwindcss.com/docs
- Vite Guide: https://vitejs.dev/guide/

### Sample Data for Testing
```typescript
const MOCK_MARKETS = [
  { id: '1', name: 'Detroit, MI', zipCode: '48201' },
  { id: '2', name: 'Anaheim, CA', zipCode: '92805' },
  { id: '3', name: 'Austin, TX', zipCode: '78701' },
  { id: '4', name: 'Miami, FL', zipCode: '33101' },
  { id: '5', name: 'Seattle, WA', zipCode: '98101' },
];
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-19
**Estimated Completion**: 1-2 weeks
**Target Launch Date**: TBD based on feedback
