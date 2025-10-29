# Data Optimization Guide
## Eliminating the 90MB+ Dataset Download

**Problem**: Users currently download 90MB+ of CSV data (ZHVI + ZORI) but typically only need 5-10 markets.

**Goal**: Reduce initial data transfer, improve performance, and maintain user experience.

---

## Top 3 Approaches (Google Cloud Optimized)

### Approach 1: Pre-Split CSV Files + Cloud Storage (Recommended Start)

**Best for**: Quick wins, minimal backend changes, immediate cost reduction

#### Architecture
```
User Browser
    ↓
Cloud Storage (CDN-enabled)
    ├── markets/zhvi/new-york-ny.csv (50KB)
    ├── markets/zhvi/los-angeles-ca.csv (50KB)
    ├── markets/zori/new-york-ny.csv (20KB)
    └── ... (21,423 individual files)
    ↓
IndexedDB Cache (persistent)
```

#### Implementation Steps

**Step 1: Split CSV Files**
```typescript
// scripts/split-csv.ts
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface ZillowRow {
  RegionID: string;
  RegionName: string;
  State: string;
  [date: string]: string; // Dynamic date columns
}

const splitZillowCSV = async (
  inputPath: string,
  outputDir: string,
  type: 'zhvi' | 'zori'
) => {
  console.log(`Splitting ${type.toUpperCase()} file: ${inputPath}`);

  const content = fs.readFileSync(inputPath, 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });

  const markets = new Map<string, ZillowRow>();

  // Group by market
  rows.forEach((row: ZillowRow) => {
    const marketKey = `${row.RegionName}-${row.State}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    markets.set(marketKey, row);
  });

  // Write individual market files
  const dir = path.join(outputDir, type);
  fs.mkdirSync(dir, { recursive: true });

  for (const [marketKey, row] of markets) {
    const csvContent = Object.keys(row).join(',') + '\n' + Object.values(row).join(',');
    fs.writeFileSync(path.join(dir, `${marketKey}.csv`), csvContent);
  }

  console.log(`✓ Created ${markets.size} ${type} market files`);
};

// Run
splitZillowCSV(
  'public/data/default-housing-data.csv',
  'public/data/markets',
  'zhvi'
);
splitZillowCSV(
  'public/data/default-rental-data.csv',
  'public/data/markets',
  'zori'
);
```

**Step 2: Upload to Cloud Storage**
```powershell
# Create bucket with CDN
gcloud storage buckets create gs://housing-data-markets `
  --location=us-central1 `
  --public-access-prevention

# Enable CDN
gcloud compute backend-buckets create housing-data-backend `
  --gcs-bucket-name=housing-data-markets `
  --enable-cdn

# Upload split files
gcloud storage cp -r public/data/markets/* gs://housing-data-markets/

# Make files publicly readable
gcloud storage buckets add-iam-policy-binding gs://housing-data-markets `
  --member=allUsers `
  --role=roles/storage.objectViewer
```

**Step 3: Update CSV Provider**
```typescript
// src/services/providers/csv.provider.ts

export class CSVProvider implements IDataProvider {
  private static MARKET_BASE_URL = import.meta.env.VITE_MARKET_DATA_URL ||
    'https://storage.googleapis.com/housing-data-markets';

  private cache = new Map<string, MarketStats>();
  private loadedMarkets = new Set<string>();

  async getMarketStats(
    location: string,
    forceRefresh: boolean = false
  ): Promise<MarketStats | null> {
    const marketKey = this.normalizeLocation(location);

    // Check cache first
    if (!forceRefresh && this.cache.has(marketKey)) {
      return this.cache.get(marketKey)!;
    }

    try {
      // Fetch both ZHVI and ZORI for this specific market
      const [zhviData, zoriData] = await Promise.all([
        this.fetchMarketFile(marketKey, 'zhvi'),
        this.fetchMarketFile(marketKey, 'zori')
      ]);

      if (!zhviData) return null;

      const stats = this.parseMarketData(zhviData, zoriData);
      this.cache.set(marketKey, stats);
      this.loadedMarkets.add(marketKey);

      return stats;
    } catch (error) {
      console.error(`Failed to load market ${marketKey}:`, error);
      return null;
    }
  }

  private async fetchMarketFile(
    marketKey: string,
    type: 'zhvi' | 'zori'
  ): Promise<string | null> {
    const url = `${CSVProvider.MARKET_BASE_URL}/${type}/${marketKey}.csv`;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.text();
    } catch (error) {
      console.error(`Failed to fetch ${type} for ${marketKey}:`, error);
      return null;
    }
  }

  private normalizeLocation(location: string): string {
    return location
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');
  }

  private parseMarketData(zhviCsv: string, zoriCsv: string | null): MarketStats {
    // Parse ZHVI (home values)
    const zhviLines = zhviCsv.trim().split('\n');
    const zhviHeaders = zhviLines[0].split(',');
    const zhviValues = zhviLines[1].split(',');

    const historicalPrices: Array<{ date: string; price: number }> = [];

    for (let i = 5; i < zhviHeaders.length; i++) {
      const date = zhviHeaders[i];
      const price = parseFloat(zhviValues[i]);
      if (!isNaN(price)) {
        historicalPrices.push({ date, price });
      }
    }

    const stats: MarketStats = {
      city: zhviValues[1],
      state: zhviValues[2],
      id: zhviValues[0],
      saleData: {
        medianPrice: historicalPrices[historicalPrices.length - 1]?.price || 0,
        minPrice: Math.min(...historicalPrices.map(h => h.price)),
        maxPrice: Math.max(...historicalPrices.map(h => h.price)),
        lastUpdatedDate: new Date().toISOString()
      },
      historicalPrices
    };

    // Parse ZORI (rentals) if available
    if (zoriCsv) {
      const zoriLines = zoriCsv.trim().split('\n');
      const zoriHeaders = zoriLines[0].split(',');
      const zoriValues = zoriLines[1].split(',');

      const historicalRentals: Array<{ date: string; rent: number }> = [];

      for (let i = 5; i < zoriHeaders.length; i++) {
        const date = zoriHeaders[i];
        const rent = parseFloat(zoriValues[i]);
        if (!isNaN(rent)) {
          historicalRentals.push({ date, rent });
        }
      }

      stats.rentalData = {
        medianRent: historicalRentals[historicalRentals.length - 1]?.rent || 0
      };
      stats.historicalRentals = historicalRentals;
    }

    return stats;
  }

  getAllMarkets(): MarketStats[] {
    return Array.from(this.cache.values());
  }
}
```

**Step 4: Update Environment Variables**
```bash
# .env
VITE_MARKET_DATA_URL=https://storage.googleapis.com/housing-data-markets
```

#### Cost Analysis
- **Cloud Storage**: $0.026/GB/month × 0.5GB = $0.013/month
- **Network Egress**: $0.12/GB × 10GB/month = $1.20/month
- **CDN Cache Hits**: ~90% hit rate after first week
- **Total**: ~$1-3/month

#### Pros
- ✅ Minimal code changes
- ✅ Instant deployment
- ✅ 99.9% reduction in initial load (90MB → 100KB for 2 markets)
- ✅ Leverages existing CSV parsing logic
- ✅ Cloud Storage CDN provides global edge caching

#### Cons
- ⚠️ 21,423 individual files to manage
- ⚠️ Market search still requires a separate index file
- ⚠️ Limited query capabilities (can't filter by price range, etc.)

---

### Approach 2: Cloud SQL PostgreSQL + TimescaleDB (Recommended Growth Path)

**Best for**: Long-term scalability, complex queries, real-time updates

#### Architecture
```
User Browser
    ↓
Cloud Run (Express API)
    ↓
Cloud SQL PostgreSQL + TimescaleDB
    ├── markets table (21k rows)
    ├── price_data hypertable (26M rows, time-series optimized)
    └── rental_data hypertable (5M rows)
    ↓
IndexedDB Cache (7-day TTL)
```

#### Implementation Steps

**Step 1: Set Up Cloud SQL PostgreSQL**
```powershell
# Create Cloud SQL instance
gcloud sql instances create housing-data-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --storage-type=SSD `
  --storage-size=10GB

# Create database
gcloud sql databases create housing_data --instance=housing-data-db

# Connect and install TimescaleDB
gcloud sql connect housing-data-db --user=postgres

# In psql:
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

**Step 2: Create Database Schema**
```sql
-- markets.sql
CREATE TABLE markets (
  id VARCHAR(50) PRIMARY KEY,
  region_name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  metro VARCHAR(255),
  county VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_markets_city_state ON markets(city, state);
CREATE INDEX idx_markets_search ON markets USING gin(to_tsvector('english', region_name || ' ' || city || ' ' || state));

-- price_data.sql
CREATE TABLE price_data (
  market_id VARCHAR(50) NOT NULL REFERENCES markets(id),
  date DATE NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  property_type VARCHAR(50) DEFAULT 'single_family',
  PRIMARY KEY (market_id, date)
);

SELECT create_hypertable('price_data', 'date');

CREATE INDEX idx_price_data_market ON price_data(market_id, date DESC);

-- rental_data.sql
CREATE TABLE rental_data (
  market_id VARCHAR(50) NOT NULL REFERENCES markets(id),
  date DATE NOT NULL,
  rent DECIMAL(10, 2) NOT NULL,
  property_type VARCHAR(50) DEFAULT 'single_family',
  PRIMARY KEY (market_id, date)
);

SELECT create_hypertable('rental_data', 'date');

CREATE INDEX idx_rental_data_market ON rental_data(market_id, date DESC);

-- Materialized view for latest prices
CREATE MATERIALIZED VIEW market_stats AS
SELECT
  m.id,
  m.region_name,
  m.city,
  m.state,
  p.current_price,
  p.price_change,
  r.current_rent,
  r.rent_change
FROM markets m
LEFT JOIN LATERAL (
  SELECT
    price as current_price,
    ROUND(((price - LAG(price) OVER (ORDER BY date)) / LAG(price) OVER (ORDER BY date) * 100)::numeric, 2) as price_change
  FROM price_data
  WHERE market_id = m.id
  ORDER BY date DESC
  LIMIT 1
) p ON true
LEFT JOIN LATERAL (
  SELECT
    rent as current_rent,
    ROUND(((rent - LAG(rent) OVER (ORDER BY date)) / LAG(rent) OVER (ORDER BY date) * 100)::numeric, 2) as rent_change
  FROM rental_data
  WHERE market_id = m.id
  ORDER BY date DESC
  LIMIT 1
) r ON true;

CREATE UNIQUE INDEX ON market_stats(id);
REFRESH MATERIALIZED VIEW CONCURRENTLY market_stats;
```

**Step 3: Data Migration Script**
```typescript
// scripts/migrate-to-postgres.ts
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: 'housing_data',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

const migrateZHVI = async (filePath: string) => {
  console.log('Migrating ZHVI data...');

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parse(content, { columns: true });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const marketId = row.RegionID;
      const regionName = row.RegionName;
      const city = row.RegionName.split(',')[0].trim();
      const state = row.State;

      // Insert market
      await client.query(
        `INSERT INTO markets (id, region_name, city, state)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [marketId, regionName, city, state]
      );

      // Insert price data
      const dateColumns = Object.keys(row).filter(k => k.match(/^\d{4}-\d{2}-\d{2}$/));

      for (const date of dateColumns) {
        const price = parseFloat(row[date]);
        if (!isNaN(price)) {
          await client.query(
            `INSERT INTO price_data (market_id, date, price)
             VALUES ($1, $2, $3)
             ON CONFLICT (market_id, date) DO NOTHING`,
            [marketId, date, price]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✓ Migrated ${rows.length} markets with price data`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const migrateZORI = async (filePath: string) => {
  console.log('Migrating ZORI data...');

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parse(content, { columns: true });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const marketId = row.RegionID;
      const dateColumns = Object.keys(row).filter(k => k.match(/^\d{4}-\d{2}-\d{2}$/));

      for (const date of dateColumns) {
        const rent = parseFloat(row[date]);
        if (!isNaN(rent)) {
          await client.query(
            `INSERT INTO rental_data (market_id, date, rent)
             VALUES ($1, $2, $3)
             ON CONFLICT (market_id, date) DO NOTHING`,
            [marketId, date, rent]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✓ Migrated ${rows.length} markets with rental data`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Run migration
(async () => {
  await migrateZHVI('public/data/default-housing-data.csv');
  await migrateZORI('public/data/default-rental-data.csv');

  // Refresh materialized view
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY market_stats');

  await pool.end();
  console.log('✓ Migration complete!');
})();
```

**Step 4: Express API Backend**
```typescript
// api/src/routes/markets.ts
import express from 'express';
import { pool } from '../db';

const router = express.Router();

// Search markets
router.get('/search', async (req, res) => {
  const { q, limit = 10 } = req.query;

  const result = await pool.query(
    `SELECT id, region_name, city, state
     FROM markets
     WHERE to_tsvector('english', region_name || ' ' || city || ' ' || state)
           @@ plainto_tsquery('english', $1)
     LIMIT $2`,
    [q, limit]
  );

  res.json(result.rows);
});

// Get market stats
router.get('/:marketId/stats', async (req, res) => {
  const { marketId } = req.params;

  const result = await pool.query(
    `SELECT * FROM market_stats WHERE id = $1`,
    [marketId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Market not found' });
  }

  res.json(result.rows[0]);
});

// Get historical price data
router.get('/:marketId/prices', async (req, res) => {
  const { marketId } = req.params;
  const { range = '1Y' } = req.query;

  const rangeMap: Record<string, string> = {
    '1M': '1 month',
    '6M': '6 months',
    '1Y': '1 year',
    '5Y': '5 years',
    'MAX': '100 years'
  };

  const result = await pool.query(
    `SELECT date, price
     FROM price_data
     WHERE market_id = $1
       AND date >= NOW() - INTERVAL '${rangeMap[range as string]}'
     ORDER BY date ASC`,
    [marketId]
  );

  res.json(result.rows);
});

// Get historical rental data
router.get('/:marketId/rentals', async (req, res) => {
  const { marketId } = req.params;
  const { range = '1Y' } = req.query;

  const rangeMap: Record<string, string> = {
    '1M': '1 month',
    '6M': '6 months',
    '1Y': '1 year',
    '5Y': '5 years',
    'MAX': '100 years'
  };

  const result = await pool.query(
    `SELECT date, rent
     FROM rental_data
     WHERE market_id = $1
       AND date >= NOW() - INTERVAL '${rangeMap[range as string]}'
     ORDER BY date ASC`,
    [marketId]
  );

  res.json(result.rows);
});

export default router;
```

**Step 5: Update Frontend Data Provider**
```typescript
// src/services/providers/api.provider.ts
export class APIProvider implements IDataProvider {
  private static BASE_URL = import.meta.env.VITE_API_URL || 'https://housing-data-api-xxx.run.app';

  async searchMarkets(query: string, limit: number = 10): Promise<Market[]> {
    const response = await fetch(
      `${APIProvider.BASE_URL}/markets/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) throw new Error('Failed to search markets');

    return response.json();
  }

  async getMarketStats(
    marketId: string,
    forceRefresh: boolean = false
  ): Promise<MarketStats | null> {
    // Check IndexedDB cache first
    if (!forceRefresh) {
      const cached = await indexedDBCache.get(`market:${marketId}`);
      if (cached) return cached;
    }

    const response = await fetch(
      `${APIProvider.BASE_URL}/markets/${marketId}/stats`
    );

    if (!response.ok) return null;

    const stats = await response.json();

    // Cache for 7 days
    await indexedDBCache.set(`market:${marketId}`, stats, 7 * 24 * 60 * 60 * 1000);

    return stats;
  }

  async getHistoricalPrices(
    marketId: string,
    range: string = '1Y'
  ): Promise<Array<{ date: string; price: number }>> {
    const response = await fetch(
      `${APIProvider.BASE_URL}/markets/${marketId}/prices?range=${range}`
    );

    if (!response.ok) throw new Error('Failed to fetch prices');

    return response.json();
  }

  async getHistoricalRentals(
    marketId: string,
    range: string = '1Y'
  ): Promise<Array<{ date: string; rent: number }>> {
    const response = await fetch(
      `${APIProvider.BASE_URL}/markets/${marketId}/rentals?range=${range}`
    );

    if (!response.ok) throw new Error('Failed to fetch rentals');

    return response.json();
  }
}
```

#### Cost Analysis
- **Cloud SQL (db-f1-micro)**: $7.67/month
- **Storage (10GB SSD)**: $1.70/month
- **Network Egress**: $0.12/GB × 5GB = $0.60/month
- **Cloud Run API**: ~$1-2/month (mostly free tier)
- **Total**: ~$10-12/month

#### Pros
- ✅ Optimized for time-series data (TimescaleDB)
- ✅ Complex queries (filter by price, date range, etc.)
- ✅ Real-time data updates
- ✅ Excellent scalability
- ✅ Full-text search built-in
- ✅ Automatic data compression for old data

#### Cons
- ⚠️ Requires backend API development (2-3 weeks)
- ⚠️ Higher operational complexity
- ⚠️ Requires database management skills
- ⚠️ Migration effort for existing CSV data

---

### Approach 3: Cloud Functions + Cloud Storage (Hybrid)

**Best for**: Serverless simplicity with on-demand data loading

#### Architecture
```
User Browser
    ↓
Cloud Functions (HTTP)
    ↓
Cloud Storage (Full CSV files)
    ├── default-housing-data.csv (86MB)
    └── default-rental-data.csv (4MB)
    ↓
Parse on-demand + cache results
    ↓
Return specific market data (50KB)
```

#### Implementation Steps

**Step 1: Create Cloud Function**
```typescript
// functions/src/getMarketData.ts
import { HttpFunction } from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';
import { parse } from 'csv-parse/sync';

const storage = new Storage();
const BUCKET_NAME = 'housing-data-assets';

// In-memory cache (survives across function invocations)
const cache = new Map<string, any>();

export const getMarketData: HttpFunction = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');

  const { marketId, dataType = 'zhvi' } = req.query;

  if (!marketId) {
    return res.status(400).json({ error: 'marketId required' });
  }

  const cacheKey = `${marketId}:${dataType}`;

  // Check cache
  if (cache.has(cacheKey)) {
    console.log(`Cache hit: ${cacheKey}`);
    return res.json(cache.get(cacheKey));
  }

  try {
    // Download CSV from Cloud Storage
    const fileName = dataType === 'zhvi'
      ? 'default-housing-data.csv'
      : 'default-rental-data.csv';

    const file = storage.bucket(BUCKET_NAME).file(fileName);
    const [content] = await file.download();

    // Parse CSV
    const rows = parse(content.toString(), { columns: true });

    // Find market
    const market = rows.find((r: any) => r.RegionID === marketId);

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    // Extract time-series data
    const dateColumns = Object.keys(market).filter(k => k.match(/^\d{4}-\d{2}-\d{2}$/));
    const historicalData = dateColumns
      .map(date => ({
        date,
        value: parseFloat(market[date])
      }))
      .filter(d => !isNaN(d.value));

    const result = {
      marketId: market.RegionID,
      marketName: market.RegionName,
      city: market.RegionName.split(',')[0].trim(),
      state: market.State,
      currentValue: historicalData[historicalData.length - 1]?.value || 0,
      historicalData
    };

    // Cache result
    cache.set(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
};
```

**Step 2: Deploy Cloud Function**
```powershell
# Deploy function
gcloud functions deploy getMarketData `
  --gen2 `
  --runtime=nodejs20 `
  --region=us-central1 `
  --source=./functions `
  --entry-point=getMarketData `
  --trigger-http `
  --allow-unauthenticated `
  --memory=512MB `
  --timeout=60s

# Get function URL
gcloud functions describe getMarketData `
  --gen2 `
  --region=us-central1 `
  --format="value(serviceConfig.uri)"
```

**Step 3: Update Frontend**
```typescript
// src/services/providers/cloudfunction.provider.ts
export class CloudFunctionProvider implements IDataProvider {
  private static FUNCTION_URL = import.meta.env.VITE_FUNCTION_URL;
  private cache = new Map<string, MarketStats>();

  async getMarketStats(
    location: string,
    forceRefresh: boolean = false
  ): Promise<MarketStats | null> {
    const marketId = this.getMarketId(location);

    if (!forceRefresh && this.cache.has(marketId)) {
      return this.cache.get(marketId)!;
    }

    try {
      const [zhviResponse, zoriResponse] = await Promise.all([
        fetch(`${CloudFunctionProvider.FUNCTION_URL}?marketId=${marketId}&dataType=zhvi`),
        fetch(`${CloudFunctionProvider.FUNCTION_URL}?marketId=${marketId}&dataType=zori`)
      ]);

      const zhviData = await zhviResponse.json();
      const zoriData = zoriResponse.ok ? await zoriResponse.json() : null;

      const stats: MarketStats = {
        id: zhviData.marketId,
        city: zhviData.city,
        state: zhviData.state,
        saleData: {
          medianPrice: zhviData.currentValue,
          lastUpdatedDate: new Date().toISOString()
        },
        historicalPrices: zhviData.historicalData.map((d: any) => ({
          date: d.date,
          price: d.value
        }))
      };

      if (zoriData) {
        stats.rentalData = {
          medianRent: zoriData.currentValue
        };
        stats.historicalRentals = zoriData.historicalData.map((d: any) => ({
          date: d.date,
          rent: d.value
        }));
      }

      this.cache.set(marketId, stats);
      return stats;
    } catch (error) {
      console.error(`Failed to fetch market ${marketId}:`, error);
      return null;
    }
  }

  private getMarketId(location: string): string {
    // This would need a lookup table or search function
    // For now, assume location is already a market ID
    return location;
  }
}
```

#### Cost Analysis
- **Cloud Functions**: $0.40/million invocations + $0.0025/GB-sec
- **Estimated**: 10k invocations/month = $0.004 + compute = ~$0.50/month
- **Cloud Storage**: $0.026/GB × 0.1GB = $0.003/month
- **Network Egress**: $0.12/GB × 5GB = $0.60/month
- **Total**: ~$1-2/month

#### Pros
- ✅ Serverless (no infrastructure management)
- ✅ Pay-per-use pricing
- ✅ Automatic scaling
- ✅ In-memory caching across invocations
- ✅ Easy to deploy and update

#### Cons
- ⚠️ Cold start latency (500ms-2s)
- ⚠️ Still requires parsing 86MB CSV on each cold start
- ⚠️ Limited to simple queries
- ⚠️ Function memory limits (max 8GB)
- ⚠️ Needs separate search endpoint or index file

---

## Recommendation for Google Cloud

**Phase 1 (Immediate - Week 1)**: Start with **Approach 1 (Pre-Split CSV)**
- Quickest to implement
- Immediate 99% reduction in data transfer
- Lowest risk
- Can be done in parallel with other work

**Phase 2 (Growth - Weeks 4-6)**: Migrate to **Approach 2 (PostgreSQL + TimescaleDB)**
- Best long-term solution for housing market data
- Enables advanced features (price alerts, market comparisons, trends)
- Scales to millions of users
- TimescaleDB is specifically designed for time-series data like this

**Skip Approach 3**: Cloud Functions + Cloud Storage
- Not worth the cold start latency
- Parsing 86MB on every cold start is inefficient
- Better to go straight from CSV to database

---

## Summary Comparison

| Criteria | Pre-Split CSV | PostgreSQL + TimescaleDB | Cloud Functions |
|----------|--------------|------------------------|-----------------|
| **Setup Time** | 1-2 days | 2-3 weeks | 1 week |
| **Monthly Cost** | $1-3 | $10-12 | $1-2 |
| **Data Transfer** | 50KB per market | 10KB per market | 50KB per market |
| **Query Flexibility** | None | Excellent | Limited |
| **Scalability** | Good | Excellent | Good |
| **Cold Start** | N/A | N/A | 500ms-2s |
| **Maintenance** | Low | Medium | Low |
| **Google Cloud Native** | ✅ | ✅ | ✅ |

---

**Next**: See MIGRATION_PLAN.md for step-by-step transition guide from pre-split CSV to PostgreSQL.
