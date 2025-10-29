# Migration Plan: Pre-Split CSV → PostgreSQL + TimescaleDB

**Goal**: Transition from pre-split CSV files (Approach 1) to PostgreSQL + TimescaleDB (Approach 2) with zero downtime and minimal risk.

**Timeline**: 3-4 weeks

**Risk Level**: Medium (database migration always carries some risk)

---

## Overview

This migration follows a **parallel deployment strategy** where both systems run side-by-side before cutover.

```
Current State (Pre-Split CSV)
    ↓
Phase 1: Set up PostgreSQL in parallel
    ↓
Phase 2: Migrate data and test
    ↓
Phase 3: Deploy API and feature flag
    ↓
Phase 4: Gradual rollout
    ↓
Phase 5: Cutover and cleanup
    ↓
Future State (PostgreSQL + TimescaleDB)
```

---

## Phase 1: Infrastructure Setup (Week 1)

### Day 1-2: Provision Cloud SQL

**Create PostgreSQL Instance**:
```powershell
# Create Cloud SQL instance
gcloud sql instances create housing-data-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --storage-type=SSD `
  --storage-size=10GB `
  --storage-auto-increase `
  --maintenance-window-day=SUN `
  --maintenance-window-hour=3 `
  --backup-start-time=02:00

# Set root password
gcloud sql users set-password postgres `
  --instance=housing-data-db `
  --password=[STRONG-PASSWORD]

# Create application database
gcloud sql databases create housing_data --instance=housing-data-db

# Create read-only user for API
gcloud sql users create api_user `
  --instance=housing-data-db `
  --password=[API-PASSWORD]
```

**Store Credentials in Secret Manager**:
```powershell
# Store database credentials
echo -n "postgresql://api_user:[API-PASSWORD]@/housing_data?host=/cloudsql/[PROJECT-ID]:us-central1:housing-data-db" | `
  gcloud secrets create db-connection-string --data-file=-

# Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding db-connection-string `
  --member="serviceAccount:[PROJECT-ID]@appspot.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

### Day 3: Install TimescaleDB and Create Schema

**Connect to Database**:
```powershell
gcloud sql connect housing-data-db --user=postgres
```

**In psql Session**:
```sql
-- Install TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create markets table
CREATE TABLE markets (
  id VARCHAR(50) PRIMARY KEY,
  region_name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  metro VARCHAR(255),
  county VARCHAR(100),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for search and filtering
CREATE INDEX idx_markets_city_state ON markets(city, state);
CREATE INDEX idx_markets_state ON markets(state);
CREATE INDEX idx_markets_search ON markets
  USING gin(to_tsvector('english', region_name || ' ' || city || ' ' || state));

-- Create price_data hypertable
CREATE TABLE price_data (
  market_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  property_type VARCHAR(50) DEFAULT 'single_family',
  PRIMARY KEY (market_id, date)
);

-- Convert to TimescaleDB hypertable (partitioned by time)
SELECT create_hypertable('price_data', 'date');

-- Indexes
CREATE INDEX idx_price_data_market ON price_data(market_id, date DESC);
CREATE INDEX idx_price_data_date ON price_data(date DESC);

-- Create rental_data hypertable
CREATE TABLE rental_data (
  market_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  rent DECIMAL(10, 2) NOT NULL,
  property_type VARCHAR(50) DEFAULT 'single_family',
  PRIMARY KEY (market_id, date)
);

-- Convert to hypertable
SELECT create_hypertable('rental_data', 'date');

-- Indexes
CREATE INDEX idx_rental_data_market ON rental_data(market_id, date DESC);
CREATE INDEX idx_rental_data_date ON rental_data(date DESC);

-- Materialized view for current market stats (for fast queries)
CREATE MATERIALIZED VIEW market_stats AS
SELECT
  m.id,
  m.region_name,
  m.city,
  m.state,
  m.metro,
  m.county,
  p.current_price,
  p.price_1m_ago,
  p.price_12m_ago,
  ROUND(((p.current_price - p.price_12m_ago) / p.price_12m_ago * 100)::numeric, 2) as price_change_12m,
  r.current_rent,
  r.rent_12m_ago,
  ROUND(((r.current_rent - r.rent_12m_ago) / r.rent_12m_ago * 100)::numeric, 2) as rent_change_12m,
  p.last_updated as price_last_updated,
  r.last_updated as rent_last_updated
FROM markets m
LEFT JOIN LATERAL (
  SELECT
    (SELECT price FROM price_data WHERE market_id = m.id ORDER BY date DESC LIMIT 1) as current_price,
    (SELECT price FROM price_data WHERE market_id = m.id AND date <= NOW() - INTERVAL '1 month' ORDER BY date DESC LIMIT 1) as price_1m_ago,
    (SELECT price FROM price_data WHERE market_id = m.id AND date <= NOW() - INTERVAL '12 months' ORDER BY date DESC LIMIT 1) as price_12m_ago,
    (SELECT MAX(date) FROM price_data WHERE market_id = m.id) as last_updated
) p ON true
LEFT JOIN LATERAL (
  SELECT
    (SELECT rent FROM rental_data WHERE market_id = m.id ORDER BY date DESC LIMIT 1) as current_rent,
    (SELECT rent FROM rental_data WHERE market_id = m.id AND date <= NOW() - INTERVAL '12 months' ORDER BY date DESC LIMIT 1) as rent_12m_ago,
    (SELECT MAX(date) FROM rental_data WHERE market_id = m.id) as last_updated
) r ON true;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX ON market_stats(id);

-- Grant permissions to API user
GRANT SELECT ON ALL TABLES IN SCHEMA public TO api_user;
GRANT SELECT ON market_stats TO api_user;

-- Set up automatic refresh of materialized view (daily at 3 AM)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('refresh-market-stats', '0 3 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY market_stats;');
```

### Day 4-5: Create Migration Scripts

**File: scripts/migrate-to-postgres.ts**
```typescript
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false // Cloud SQL requires SSL
  }
});

interface MigrationStats {
  marketsCreated: number;
  priceDataPoints: number;
  rentalDataPoints: number;
  errors: string[];
}

const stats: MigrationStats = {
  marketsCreated: 0,
  priceDataPoints: 0,
  rentalDataPoints: 0,
  errors: []
};

/**
 * Migrate ZHVI (home value) data
 */
const migrateZHVI = async (filePath: string): Promise<void> => {
  console.log(`\n📊 Migrating ZHVI data from: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  console.log(`   Found ${rows.length} markets to migrate`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (i % 100 === 0) {
        console.log(`   Progress: ${i}/${rows.length} markets (${((i/rows.length)*100).toFixed(1)}%)`);
      }

      try {
        const marketId = row.RegionID;
        const regionName = row.RegionName;
        const city = regionName.split(',')[0].trim();
        const state = row.State;
        const metro = row.Metro || null;
        const county = row.CountyName || null;

        // Insert market
        await client.query(
          `INSERT INTO markets (id, region_name, city, state, metro, county)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             region_name = EXCLUDED.region_name,
             metro = EXCLUDED.metro,
             county = EXCLUDED.county,
             updated_at = NOW()`,
          [marketId, regionName, city, state, metro, county]
        );

        stats.marketsCreated++;

        // Insert price data (all date columns)
        const dateColumns = Object.keys(row).filter(k => k.match(/^\d{4}-\d{2}-\d{2}$/));

        const priceValues = dateColumns
          .map(date => {
            const price = parseFloat(row[date]);
            return !isNaN(price) ? { date, price } : null;
          })
          .filter(v => v !== null);

        if (priceValues.length > 0) {
          const insertQuery = `
            INSERT INTO price_data (market_id, date, price)
            VALUES ${priceValues.map((_, idx) => `($1, $${idx * 2 + 2}, $${idx * 2 + 3})`).join(', ')}
            ON CONFLICT (market_id, date) DO UPDATE SET price = EXCLUDED.price
          `;

          const insertParams = [
            marketId,
            ...priceValues.flatMap(v => [v!.date, v!.price])
          ];

          await client.query(insertQuery, insertParams);
          stats.priceDataPoints += priceValues.length;
        }
      } catch (error) {
        const err = error as Error;
        stats.errors.push(`Market ${row.RegionID}: ${err.message}`);
      }
    }

    await client.query('COMMIT');
    console.log(`   ✅ ZHVI migration complete!`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('   ❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Migrate ZORI (rental) data
 */
const migrateZORI = async (filePath: string): Promise<void> => {
  console.log(`\n🏠 Migrating ZORI data from: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  console.log(`   Found ${rows.length} markets to migrate`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (i % 100 === 0) {
        console.log(`   Progress: ${i}/${rows.length} markets (${((i/rows.length)*100).toFixed(1)}%)`);
      }

      try {
        const marketId = row.RegionID;

        // Get date columns
        const dateColumns = Object.keys(row).filter(k => k.match(/^\d{4}-\d{2}-\d{2}$/));

        const rentalValues = dateColumns
          .map(date => {
            const rent = parseFloat(row[date]);
            return !isNaN(rent) ? { date, rent } : null;
          })
          .filter(v => v !== null);

        if (rentalValues.length > 0) {
          const insertQuery = `
            INSERT INTO rental_data (market_id, date, rent)
            VALUES ${rentalValues.map((_, idx) => `($1, $${idx * 2 + 2}, $${idx * 2 + 3})`).join(', ')}
            ON CONFLICT (market_id, date) DO UPDATE SET rent = EXCLUDED.rent
          `;

          const insertParams = [
            marketId,
            ...rentalValues.flatMap(v => [v!.date, v!.rent])
          ];

          await client.query(insertQuery, insertParams);
          stats.rentalDataPoints += rentalValues.length;
        }
      } catch (error) {
        const err = error as Error;
        stats.errors.push(`Rental market ${row.RegionID}: ${err.message}`);
      }
    }

    await client.query('COMMIT');
    console.log(`   ✅ ZORI migration complete!`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('   ❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Main migration runner
 */
const runMigration = async () => {
  console.log('🚀 Starting Housing Data Migration');
  console.log('=====================================\n');

  const startTime = Date.now();

  try {
    // Migrate ZHVI
    await migrateZHVI(
      path.join(__dirname, '../public/data/default-housing-data.csv')
    );

    // Migrate ZORI
    await migrateZORI(
      path.join(__dirname, '../public/data/default-rental-data.csv')
    );

    // Refresh materialized view
    console.log('\n📈 Refreshing market statistics...');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY market_stats');
    console.log('   ✅ Statistics refreshed!');

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('\n=====================================');
    console.log('✅ Migration Complete!');
    console.log('=====================================');
    console.log(`Duration: ${duration} minutes`);
    console.log(`Markets created: ${stats.marketsCreated}`);
    console.log(`Price data points: ${stats.priceDataPoints}`);
    console.log(`Rental data points: ${stats.rentalDataPoints}`);
    console.log(`Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more`);
      }
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run if executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };
```

**Add to package.json**:
```json
{
  "scripts": {
    "migrate": "ts-node scripts/migrate-to-postgres.ts"
  },
  "devDependencies": {
    "pg": "^8.11.3",
    "@types/pg": "^8.10.9",
    "csv-parse": "^5.5.3",
    "dotenv": "^16.3.1"
  }
}
```

---

## Phase 2: Data Migration & Testing (Week 2)

### Day 6: Run Initial Migration

```powershell
# Install dependencies
npm install pg @types/pg csv-parse dotenv

# Set environment variable
$env:DB_CONNECTION_STRING="postgresql://api_user:[PASSWORD]@/housing_data?host=/cloudsql/[PROJECT]:us-central1:housing-data-db"

# Run migration (takes ~30-60 minutes for 21k markets)
npm run migrate
```

**Expected Output**:
```
🚀 Starting Housing Data Migration
=====================================

📊 Migrating ZHVI data from: public/data/default-housing-data.csv
   Found 21423 markets to migrate
   Progress: 0/21423 markets (0.0%)
   Progress: 100/21423 markets (0.5%)
   ...
   ✅ ZHVI migration complete!

🏠 Migrating ZORI data from: public/data/default-rental-data.csv
   Found 3847 markets to migrate
   ...
   ✅ ZORI migration complete!

📈 Refreshing market statistics...
   ✅ Statistics refreshed!

=====================================
✅ Migration Complete!
=====================================
Duration: 45.32 minutes
Markets created: 21423
Price data points: 5,783,421
Rental data points: 423,167
Errors: 0
```

### Day 7-8: Verify Data Integrity

**Create verification script: scripts/verify-migration.ts**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

const verify = async () => {
  console.log('🔍 Verifying Migration\n');

  // Check market count
  const marketCount = await pool.query('SELECT COUNT(*) FROM markets');
  console.log(`✓ Markets: ${marketCount.rows[0].count}`);

  // Check price data count
  const priceCount = await pool.query('SELECT COUNT(*) FROM price_data');
  console.log(`✓ Price data points: ${priceCount.rows[0].count}`);

  // Check rental data count
  const rentalCount = await pool.query('SELECT COUNT(*) FROM rental_data');
  console.log(`✓ Rental data points: ${rentalCount.rows[0].count}`);

  // Sample market data
  const sampleMarket = await pool.query(`
    SELECT
      m.*,
      (SELECT COUNT(*) FROM price_data WHERE market_id = m.id) as price_points,
      (SELECT COUNT(*) FROM rental_data WHERE market_id = m.id) as rental_points
    FROM markets m
    WHERE city = 'New York' AND state = 'NY'
    LIMIT 1
  `);

  console.log('\n📊 Sample Market (New York, NY):');
  console.log(JSON.stringify(sampleMarket.rows[0], null, 2));

  // Check materialized view
  const statsCount = await pool.query('SELECT COUNT(*) FROM market_stats');
  console.log(`\n✓ Market stats view: ${statsCount.rows[0].count} rows`);

  // Query performance test
  console.log('\n⏱️  Performance Test:');
  const start = Date.now();
  await pool.query(`
    SELECT * FROM market_stats
    WHERE city = 'Los Angeles' AND state = 'CA'
    LIMIT 1
  `);
  console.log(`   Stats query: ${Date.now() - start}ms`);

  const start2 = Date.now();
  await pool.query(`
    SELECT date, price
    FROM price_data
    WHERE market_id = '32675'
      AND date >= NOW() - INTERVAL '1 year'
    ORDER BY date DESC
  `);
  console.log(`   Time-series query: ${Date.now() - start2}ms`);

  await pool.end();
  console.log('\n✅ Verification complete!');
};

verify();
```

**Run verification**:
```powershell
ts-node scripts/verify-migration.ts
```

### Day 9-10: Build Express API

**File: api/src/index.ts**
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './db';
import marketsRouter from './routes/markets';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/markets', marketsRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
});
```

**File: api/src/db.ts**
```typescript
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});
```

**File: api/src/routes/markets.ts** (See DATA_OPTIMIZATION_GUIDE.md for full implementation)

### Deploy API to Cloud Run

**File: api/Dockerfile**
```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

**Deploy**:
```powershell
cd api

# Build and deploy
gcloud run deploy housing-data-api `
  --source . `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --add-cloudsql-instances [PROJECT-ID]:us-central1:housing-data-db `
  --set-secrets DB_CONNECTION_STRING=db-connection-string:latest `
  --memory 512Mi `
  --cpu 1 `
  --max-instances 10 `
  --port 8080

# Get API URL
$API_URL = gcloud run services describe housing-data-api `
  --region us-central1 `
  --format="value(status.url)"

echo "API URL: $API_URL"
```

---

## Phase 3: Frontend Integration (Week 3)

### Day 11-12: Create API Provider

**File: src/services/providers/api.provider.ts** (See DATA_OPTIMIZATION_GUIDE.md for full implementation)

### Day 13: Add Feature Flag

**File: src/utils/featureFlags.ts**
```typescript
// Feature flags controlled by environment variables
export const FEATURES = {
  USE_DATABASE: import.meta.env.VITE_USE_DATABASE === 'true',
  API_URL: import.meta.env.VITE_API_URL || '',
};

export const getDataProvider = (): 'csv' | 'api' => {
  if (FEATURES.USE_DATABASE && FEATURES.API_URL) {
    return 'api';
  }
  return 'csv';
};
```

**Update provider factory**:
```typescript
// src/services/providers/factory.ts
import { CSVProvider } from './csv.provider';
import { APIProvider } from './api.provider';
import { getDataProvider } from '../../utils/featureFlags';

export const createProvider = () => {
  const providerType = getDataProvider();

  switch (providerType) {
    case 'api':
      return new APIProvider();
    case 'csv':
    default:
      return new CSVProvider();
  }
};
```

### Day 14-15: Testing

**Test both providers side-by-side**:
```powershell
# Test CSV provider
$env:VITE_USE_DATABASE="false"
npm run dev

# Test API provider
$env:VITE_USE_DATABASE="true"
$env:VITE_API_URL="https://housing-data-api-xxx.run.app/api/v1"
npm run dev
```

**Create automated tests**:
```typescript
// tests/providers.test.ts
import { describe, it, expect } from 'vitest';
import { CSVProvider } from '../src/services/providers/csv.provider';
import { APIProvider } from '../src/services/providers/api.provider';

describe('Data Provider Parity', () => {
  it('should return identical data for New York, NY', async () => {
    const csvProvider = new CSVProvider();
    const apiProvider = new APIProvider();

    const csvData = await csvProvider.getMarketStats('New York, NY');
    const apiData = await apiProvider.getMarketStats('New York, NY');

    expect(csvData?.currentPrice).toBeCloseTo(apiData?.currentPrice || 0, -2);
    expect(csvData?.historicalPrices.length).toBe(apiData?.historicalPrices.length);
  });

  // Add more tests for other markets and edge cases
});
```

---

## Phase 4: Gradual Rollout (Week 4)

### Day 16-18: Canary Deployment

**Deploy with 10% traffic to database**:
```powershell
# Build production with feature flag
cd housing-data-app
$env:VITE_USE_DATABASE="true"
$env:VITE_API_URL="https://housing-data-api-xxx.run.app/api/v1"
npm run build

# Deploy to Cloud Run with revision
gcloud run deploy housing-data-app `
  --source . `
  --region us-central1 `
  --tag canary

# Split traffic: 90% CSV, 10% database
gcloud run services update-traffic housing-data-app `
  --to-revisions LATEST=10,canary=10
```

**Monitor for issues**:
- Check Cloud Run logs for errors
- Monitor API latency in Cloud Console
- Watch Cloud SQL performance metrics
- Compare user experience metrics (page load time, chart render time)

### Day 19-20: Increase Traffic

If no issues found:
```powershell
# 50% traffic
gcloud run services update-traffic housing-data-app `
  --to-revisions LATEST=50,canary=50

# Wait 24 hours, monitor

# 100% traffic
gcloud run services update-traffic housing-data-app `
  --to-revisions LATEST=100
```

---

## Phase 5: Cutover & Cleanup (End of Week 4)

### Day 21: Full Cutover

**Update environment variables**:
```powershell
# Update Cloud Build env vars
gcloud builds triggers update housing-data-app-trigger `
  --update-env VITE_USE_DATABASE=true

# Update Secret Manager
gcloud secrets versions add api-url --data-file=- <<< "https://housing-data-api-xxx.run.app/api/v1"
```

**Rebuild and deploy production**:
```powershell
cd housing-data-app
git checkout prod
git merge master
git push origin prod
# Cloud Build automatically deploys
```

### Day 22: Monitor Production

**Set up alerts**:
```powershell
# API latency alert
gcloud alpha monitoring policies create `
  --notification-channels=[CHANNEL-ID] `
  --display-name="API High Latency" `
  --condition-display-name="P95 latency > 500ms" `
  --condition-threshold-value=500 `
  --condition-threshold-duration=300s

# Database CPU alert
gcloud alpha monitoring policies create `
  --notification-channels=[CHANNEL-ID] `
  --display-name="Database High CPU" `
  --condition-display-name="CPU > 80%" `
  --condition-threshold-value=0.8 `
  --condition-threshold-duration=300s
```

### Day 23-25: Cleanup

**Remove CSV-related code (optional - keep as fallback)**:
- Keep CSV provider as fallback for dev environments
- Remove pre-split CSV files from Cloud Storage
- Update documentation

**Document final architecture**:
```powershell
# Update CLAUDE.md with new architecture
# Document API endpoints
# Update README with database setup instructions
```

---

## Rollback Plan

If issues are discovered during rollout:

### Immediate Rollback (< 5 minutes)

```powershell
# Revert to 100% CSV traffic
gcloud run services update-traffic housing-data-app `
  --to-revisions [PREVIOUS-CSV-REVISION]=100
```

### Configuration Rollback

```powershell
# Update environment variables
$env:VITE_USE_DATABASE="false"
npm run build
gcloud run deploy housing-data-app --source .
```

### Database Rollback

If database corruption occurs:
```sql
-- Restore from backup
gcloud sql backups restore [BACKUP-ID] `
  --backup-instance=housing-data-db

-- Or re-run migration
npm run migrate
```

---

## Post-Migration Monitoring

### Key Metrics to Track

**Performance**:
- API response time (target: < 200ms P95)
- Chart render time (target: < 500ms)
- Page load time (target: < 3s)

**Reliability**:
- API error rate (target: < 0.1%)
- Database connection pool usage
- Cloud SQL CPU/memory usage

**Cost**:
- Cloud SQL monthly cost
- API request count
- Network egress

### Dashboard Queries

**API Performance**:
```sql
-- Slow queries (> 500ms)
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 500
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Data Growth**:
```sql
-- Database size
SELECT
  pg_size_pretty(pg_database_size('housing_data')) as db_size;

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Success Criteria

Migration is successful when:

- ✅ All 21,423 markets migrated with price data
- ✅ 3,847 markets have rental data
- ✅ API response time < 200ms P95
- ✅ Zero data loss compared to CSV
- ✅ 99.9% API uptime
- ✅ Cost remains under $15/month
- ✅ User experience is identical or better
- ✅ Rollback plan tested and documented

---

## Timeline Summary

| Week | Phase | Key Milestones |
|------|-------|----------------|
| 1 | Infrastructure Setup | Cloud SQL provisioned, schema created, migration scripts ready |
| 2 | Data Migration | Data migrated, API deployed, initial testing complete |
| 3 | Frontend Integration | Feature flag added, both providers tested, ready for rollout |
| 4 | Gradual Rollout | 10% → 50% → 100% traffic, monitoring, full cutover |

**Total Duration**: 3-4 weeks

**Developer Time**: ~40-60 hours

---

## Next Steps After Migration

Once migration is complete, you can:

1. **Add Advanced Features**:
   - Price alerts (email when market hits target price)
   - Market comparison analytics
   - Trend predictions with ML

2. **Optimize Performance**:
   - Add Redis caching layer
   - Implement GraphQL for flexible queries
   - Set up TimescaleDB continuous aggregates

3. **Scale Database**:
   - Upgrade to db-g1-small for more traffic
   - Enable Cloud SQL read replicas
   - Set up automated backups

4. **Add More Data**:
   - Additional property types (condos, townhomes)
   - Market inventory data
   - Neighborhood demographics

See FUTURE_ENHANCEMENTS.md for detailed roadmap.
