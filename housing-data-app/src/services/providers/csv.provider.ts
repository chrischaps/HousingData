/**
 * CSV File Provider
 *
 * Loads housing market data from a user-uploaded CSV file.
 * Data is stored in localStorage for persistence across sessions.
 */

import { BaseProvider } from './base.provider';
import type { MarketStats, ProviderInfo } from './types';
import { parseCSV, validateCSVContent, parseRentalCSV, mergeRentalData } from '../../utils/csvParser';
import { IndexedDBCache } from '../../utils/indexedDBCache';

const CSV_FILENAME_STORAGE_KEY = 'csv-file-name';
const CSV_MARKETS_STORAGE_KEY = 'csv-parsed-markets';
const CSV_DATA_SOURCE_KEY = 'csv-data-source'; // 'default' or 'user-upload'

// Support environment variable for Cloud Run / serverless deployments
// Use VITE_DEFAULT_CSV_URL to point to Cloud Storage or CDN
// Falls back to local file in public folder
const DEFAULT_ZHVI_PATH = import.meta.env.VITE_DEFAULT_CSV_URL || '/data/default-housing-data.csv';
const DEFAULT_ZORI_PATH = import.meta.env.VITE_DEFAULT_ZORI_URL || '/data/default-rental-data.csv';

// Support for split CSV files (one file per market)
// When USE_SPLIT_CSV is true, fetches individual market files instead of full CSV
const USE_SPLIT_CSV = import.meta.env.VITE_USE_SPLIT_CSV === 'true';
const MARKET_DATA_BASE_URL = import.meta.env.VITE_MARKET_DATA_URL || '/data/markets';

export class CSVProvider extends BaseProvider {
  private cachedMarkets: Map<string, MarketStats> = new Map();
  private isDataLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  private loadingProgress: number = 0;
  private loadingMessage: string = '';

  readonly info: ProviderInfo = {
    id: USE_SPLIT_CSV ? 'csv-split' : 'csv',
    name: 'CSV File',
    description: 'Upload your own market data from a CSV file',
    icon: '📊',
    requiresApiKey: false,
    rateLimits: {
      limit: Infinity,
      period: 'unlimited',
    },
    features: {
      marketStats: true,
      propertySearch: false,
      propertyDetails: false,
    },
  };

  constructor() {
    super();

    // In split CSV mode, skip initial data load (fetch on-demand instead)
    if (USE_SPLIT_CSV) {
      console.log(
        '%c[CSV Provider] Split CSV mode enabled - skipping initial data load',
        'color: #8B5CF6; font-weight: bold',
        {
          USE_SPLIT_CSV,
          MARKET_DATA_BASE_URL,
          env_USE_SPLIT_CSV: import.meta.env.VITE_USE_SPLIT_CSV,
          env_MARKET_DATA_URL: import.meta.env.VITE_MARKET_DATA_URL
        }
      );
      this.isDataLoaded = true; // Mark as loaded since we'll fetch on-demand
      this.loadingPromise = Promise.resolve();
    } else {
      // Load data asynchronously and store the promise
      this.loadingPromise = this.loadDataFromStorage().catch(error => {
        console.error('[CSV Provider] Failed to load on construction', error);
      });
    }

    this.logInitialization();
  }

  /**
   * Wait for data to finish loading
   */
  async waitForDataLoad(): Promise<void> {
    if (this.loadingPromise) {
      await this.loadingPromise;
    }
  }

  /**
   * Get current loading progress (0-100)
   */
  getLoadingProgress(): number {
    return this.loadingProgress;
  }

  /**
   * Get current loading message
   */
  getLoadingMessage(): string {
    return this.loadingMessage;
  }

  isConfigured(): boolean {
    // In split CSV mode, we're always configured (fetch on-demand)
    if (USE_SPLIT_CSV) {
      return true;
    }
    return this.isDataLoaded && this.cachedMarkets.size > 0;
  }

  /**
   * Load CSV data from IndexedDB if available, otherwise load default CSV
   */
  private async loadDataFromStorage(): Promise<void> {
    try {
      // Try to load pre-parsed markets first (faster)
      const cachedMarkets = await IndexedDBCache.get<MarketStats[]>(CSV_MARKETS_STORAGE_KEY);

      if (cachedMarkets && cachedMarkets.length > 0) {
        const filename = localStorage.getItem(CSV_FILENAME_STORAGE_KEY) || 'unknown.csv';
        const dataSource = localStorage.getItem(CSV_DATA_SOURCE_KEY) || 'user-upload';

        console.log(
          '%c[CSV Provider] Loading parsed markets from IndexedDB',
          'color: #8B5CF6; font-weight: bold',
          { filename, markets: cachedMarkets.length, source: dataSource }
        );

        this.cacheMarkets(cachedMarkets);
        this.isDataLoaded = true;

        console.log(
          '%c[CSV Provider] ✓ Data loaded successfully',
          'color: #10B981; font-weight: bold',
          { markets: cachedMarkets.length, filename, source: dataSource }
        );
        return;
      }

      // No cached data - load default CSV from public folder
      console.log(
        '%c[CSV Provider] No cached data, loading default CSV',
        'color: #8B5CF6; font-weight: bold'
      );
      await this.loadDefaultCSV();
    } catch (error) {
      console.error(
        '%c[CSV Provider] Failed to load data from storage',
        'color: #EF4444; font-weight: bold',
        error
      );
      await this.clearData();
    }
  }

  /**
   * Load default CSV file from public folder
   */
  private async loadDefaultCSV(): Promise<void> {
    try {
      this.loadingProgress = 0;
      this.loadingMessage = 'Downloading housing data...';

      console.log(
        '%c[CSV Provider] Fetching default ZHVI (home values) and ZORI (rentals) files',
        'color: #8B5CF6; font-weight: bold',
        { zhvi: DEFAULT_ZHVI_PATH, zori: DEFAULT_ZORI_PATH }
      );

      // Load ZHVI (home values) file
      const zhviResponse = await fetch(DEFAULT_ZHVI_PATH);

      if (!zhviResponse.ok) {
        throw new Error(`Failed to fetch default ZHVI CSV: ${zhviResponse.statusText}`);
      }

      // Get total file size for progress tracking
      const zhviContentLength = zhviResponse.headers.get('content-length');
      const zhviTotal = zhviContentLength ? parseInt(zhviContentLength, 10) : 0;

      this.loadingMessage = zhviTotal > 0
        ? `Downloading home values (${(zhviTotal / 1024 / 1024).toFixed(1)} MB)...`
        : 'Downloading home values...';

      let zhviLoaded = 0;
      const zhviReader = zhviResponse.body?.getReader();
      const zhviChunks: Uint8Array[] = [];

      if (zhviReader) {
        while (true) {
          const { done, value } = await zhviReader.read();
          if (done) break;

          zhviChunks.push(value);
          zhviLoaded += value.length;

          if (zhviTotal > 0) {
            this.loadingProgress = Math.round((zhviLoaded / zhviTotal) * 45); // 0-45% for ZHVI download
            console.log(
              `%c[CSV Provider] ZHVI download progress: ${this.loadingProgress}%`,
              'color: #8B5CF6',
              { loaded: `${(zhviLoaded / 1024 / 1024).toFixed(1)} MB`, total: `${(zhviTotal / 1024 / 1024).toFixed(1)} MB` }
            );
          }
        }
      }

      // Combine chunks into single array
      const zhviAllChunks = new Uint8Array(zhviLoaded);
      let zhviPosition = 0;
      for (const chunk of zhviChunks) {
        zhviAllChunks.set(chunk, zhviPosition);
        zhviPosition += chunk.length;
      }

      // Decode to text
      const zhviContent = new TextDecoder('utf-8').decode(zhviAllChunks);
      this.loadingProgress = 50;
      this.loadingMessage = 'Processing home values...';

      // Validate and parse ZHVI CSV
      const zhviValidation = validateCSVContent(zhviContent);
      if (!zhviValidation.valid) {
        throw new Error(`ZHVI CSV validation failed: ${zhviValidation.error}`);
      }

      const markets = parseCSV(zhviContent);

      if (markets.length === 0) {
        throw new Error('No valid market data found in ZHVI file');
      }

      this.loadingProgress = 60;
      this.loadingMessage = 'Downloading rental data...';

      // Load ZORI (rental) file
      try {
        const zoriResponse = await fetch(DEFAULT_ZORI_PATH);

        if (zoriResponse.ok) {
          const zoriContentLength = zoriResponse.headers.get('content-length');
          const zoriTotal = zoriContentLength ? parseInt(zoriContentLength, 10) : 0;

          this.loadingMessage = zoriTotal > 0
            ? `Downloading rentals (${(zoriTotal / 1024 / 1024).toFixed(1)} MB)...`
            : 'Downloading rentals...';

          let zoriLoaded = 0;
          const zoriReader = zoriResponse.body?.getReader();
          const zoriChunks: Uint8Array[] = [];

          if (zoriReader) {
            while (true) {
              const { done, value } = await zoriReader.read();
              if (done) break;

              zoriChunks.push(value);
              zoriLoaded += value.length;

              if (zoriTotal > 0) {
                this.loadingProgress = 60 + Math.round((zoriLoaded / zoriTotal) * 20); // 60-80% for ZORI download
              }
            }
          }

          const zoriAllChunks = new Uint8Array(zoriLoaded);
          let zoriPosition = 0;
          for (const chunk of zoriChunks) {
            zoriAllChunks.set(chunk, zoriPosition);
            zoriPosition += chunk.length;
          }

          const zoriContent = new TextDecoder('utf-8').decode(zoriAllChunks);
          this.loadingProgress = 85;
          this.loadingMessage = 'Processing rental data...';

          // Parse rental data
          const rentalData = parseRentalCSV(zoriContent);

          // Merge rental data with home values
          if (rentalData.size > 0) {
            const mergedMarkets = mergeRentalData(markets, rentalData);
            this.loadingProgress = 95;
            this.loadingMessage = 'Finalizing...';

            // Store merged markets
            await IndexedDBCache.set(CSV_MARKETS_STORAGE_KEY, mergedMarkets, Infinity);
            this.cacheMarkets(mergedMarkets);
          } else {
            // Store home values only
            await IndexedDBCache.set(CSV_MARKETS_STORAGE_KEY, markets, Infinity);
            this.cacheMarkets(markets);
          }
        } else {
          // ZORI file not found, continue with ZHVI only
          console.warn(
            '%c[CSV Provider] ZORI file not found, continuing with home values only',
            'color: #F59E0B'
          );
          await IndexedDBCache.set(CSV_MARKETS_STORAGE_KEY, markets, Infinity);
          this.cacheMarkets(markets);
        }
      } catch (error) {
        // If ZORI loading fails, continue with ZHVI only
        console.warn(
          '%c[CSV Provider] Failed to load ZORI data, continuing with home values only',
          'color: #F59E0B',
          error
        );
        await IndexedDBCache.set(CSV_MARKETS_STORAGE_KEY, markets, Infinity);
        this.cacheMarkets(markets);
      }

      // Store metadata in localStorage
      localStorage.setItem(CSV_FILENAME_STORAGE_KEY, 'default-housing-data.csv');
      localStorage.setItem(CSV_DATA_SOURCE_KEY, 'default');

      // Mark as loaded
      this.isDataLoaded = true;
      this.loadingProgress = 100;
      this.loadingMessage = 'Complete!';

      const marketCount = this.cachedMarkets.size;
      const withRentals = Array.from(this.cachedMarkets.values()).filter(m => m.historicalRentals).length;

      console.log(
        '%c[CSV Provider] ✓ Default data loaded successfully',
        'color: #10B981; font-weight: bold',
        {
          markets: marketCount,
          withRentals,
          source: 'default'
        }
      );
    } catch (error) {
      this.loadingProgress = 0;
      this.loadingMessage = '';
      console.error(
        '%c[CSV Provider] Failed to load default CSV',
        'color: #EF4444; font-weight: bold',
        error
      );
      throw error;
    }
  }

  /**
   * Cache parsed markets for quick lookup
   */
  private cacheMarkets(markets: MarketStats[]): void {
    this.cachedMarkets.clear();

    markets.forEach(market => {
      // Create multiple lookup keys for flexibility
      const keys = [];

      if (market.zipCode) {
        keys.push(market.zipCode);
        keys.push(market.zipCode.toLowerCase());
      }

      if (market.city && market.state) {
        keys.push(`${market.city}, ${market.state}`);
        keys.push(`${market.city.toLowerCase()}, ${market.state.toLowerCase()}`);
        keys.push(`${market.city}-${market.state}`);
        keys.push(`${market.city.toLowerCase()}-${market.state.toLowerCase()}`);
      }

      keys.forEach(key => {
        this.cachedMarkets.set(key, market);
      });
    });

    console.log(
      '%c[CSV Provider] Cached markets',
      'color: #8B5CF6',
      { markets: markets.length, lookupKeys: this.cachedMarkets.size }
    );
  }

  /**
   * Upload and parse a CSV file
   */
  async uploadCSVFile(file: File): Promise<{ success: boolean; error?: string; markets?: number }> {
    try {
      console.log(
        '%c[CSV Provider] Uploading file',
        'color: #8B5CF6; font-weight: bold',
        { filename: file.name, size: file.size, type: file.type }
      );

      // Read file content
      const csvContent = await this.readFileAsText(file);

      // Validate CSV content
      const validation = validateCSVContent(csvContent);
      if (!validation.valid) {
        console.error(
          '%c[CSV Provider] Validation failed',
          'color: #EF4444; font-weight: bold',
          validation.error
        );
        return { success: false, error: validation.error };
      }

      // Parse CSV
      const markets = parseCSV(csvContent);

      if (markets.length === 0) {
        return { success: false, error: 'No valid market data found in CSV file' };
      }

      // Store parsed markets in IndexedDB (more efficient than storing raw CSV)
      await IndexedDBCache.set(CSV_MARKETS_STORAGE_KEY, markets, Infinity);

      // Store filename in localStorage (small, so localStorage is fine)
      localStorage.setItem(CSV_FILENAME_STORAGE_KEY, file.name);
      localStorage.setItem(CSV_DATA_SOURCE_KEY, 'user-upload');

      // Cache markets in memory
      this.cacheMarkets(markets);
      this.isDataLoaded = true;

      console.log(
        '%c[CSV Provider] ✓ File uploaded successfully',
        'color: #10B981; font-weight: bold',
        { filename: file.name, markets: markets.length, source: 'user-upload' }
      );

      return { success: true, markets: markets.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(
        '%c[CSV Provider] Upload failed',
        'color: #EF4444; font-weight: bold',
        error
      );

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Read file content as text
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
          resolve(content);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };

      reader.onerror = () => {
        reject(new Error('File reading error'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Get all markets from CSV
   */
  getAllMarkets(): MarketStats[] {
    if (!this.isDataLoaded) {
      return [];
    }

    // Get unique markets (deduplicate by id)
    const uniqueMarkets = new Map<string, MarketStats>();

    this.cachedMarkets.forEach(market => {
      if (market.id && !uniqueMarkets.has(market.id)) {
        uniqueMarkets.set(market.id, market);
      }
    });

    return Array.from(uniqueMarkets.values());
  }

  /**
   * Get loaded filename
   */
  getFilename(): string | null {
    return localStorage.getItem(CSV_FILENAME_STORAGE_KEY);
  }

  /**
   * Get data source ('default' or 'user-upload')
   */
  getDataSource(): 'default' | 'user-upload' {
    return (localStorage.getItem(CSV_DATA_SOURCE_KEY) as 'default' | 'user-upload') || 'default';
  }

  /**
   * Check if currently using default data
   */
  isUsingDefaultData(): boolean {
    return this.getDataSource() === 'default';
  }

  /**
   * Reset to default CSV data
   */
  async resetToDefault(): Promise<void> {
    console.log(
      '%c[CSV Provider] Resetting to default data',
      'color: #8B5CF6; font-weight: bold'
    );

    // Clear current data
    await this.clearData();

    // Load default CSV
    await this.loadDefaultCSV();
  }

  /**
   * Clear all CSV data
   */
  async clearData(): Promise<void> {
    await IndexedDBCache.remove(CSV_MARKETS_STORAGE_KEY);
    localStorage.removeItem(CSV_FILENAME_STORAGE_KEY);
    localStorage.removeItem(CSV_DATA_SOURCE_KEY);
    this.cachedMarkets.clear();
    this.isDataLoaded = false;

    console.log(
      '%c[CSV Provider] Data cleared',
      'color: #8B5CF6'
    );
  }

  /**
   * Normalize location to create safe filename
   */
  private normalizeLocationToFilename(location: string): string {
    return location
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Fetch individual market file (split CSV mode)
   */
  private async fetchSplitMarketFile(location: string): Promise<MarketStats | null> {
    try {
      const marketKey = this.normalizeLocationToFilename(location);

      // Fetch both ZHVI and ZORI files for this market
      const zhviUrl = `${MARKET_DATA_BASE_URL}/zhvi/${marketKey}.csv`;
      const zoriUrl = `${MARKET_DATA_BASE_URL}/zori/${marketKey}.csv`;

      console.log(
        '%c[CSV Provider] Fetching split market files',
        'color: #8B5CF6',
        { location, marketKey, zhviUrl, zoriUrl }
      );

      const [zhviResponse, zoriResponse] = await Promise.all([
        fetch(zhviUrl).catch(() => null),
        fetch(zoriUrl).catch(() => null)
      ]);

      if (!zhviResponse || !zhviResponse.ok) {
        console.warn(
          '%c[CSV Provider] ZHVI file not found',
          'color: #F59E0B',
          { location, marketKey }
        );
        return null;
      }

      // Parse ZHVI file
      const zhviContent = await zhviResponse.text();
      const zhviLines = zhviContent.trim().split('\n');

      console.log(
        '%c[CSV Provider] Parsing ZHVI file',
        'color: #8B5CF6',
        { location, marketKey, lines: zhviLines.length, firstLine: zhviLines[0].substring(0, 100) }
      );

      if (zhviLines.length < 2) {
        console.warn('%c[CSV Provider] Invalid ZHVI file', 'color: #F59E0B', { location });
        return null;
      }

      const zhviHeaders = zhviLines[0].split(',');
      const zhviValues = zhviLines[1].split(',');

      console.log(
        '%c[CSV Provider] Parsed ZHVI headers and values',
        'color: #8B5CF6',
        {
          headers: zhviHeaders.length,
          values: zhviValues.length,
          regionId: zhviValues[0],
          regionName: zhviValues[1],
          state: zhviValues[2]
        }
      );

      // Extract basic market info
      const regionId = zhviValues[0];
      const regionName = zhviValues[1];
      const state = zhviValues[2];
      const city = regionName.split(',')[0].trim();

      // Extract historical prices (date columns start at index 8 after metadata columns)
      const historicalPrices: Array<{ date: string; price: number }> = [];

      for (let i = 8; i < zhviHeaders.length; i++) {
        const date = zhviHeaders[i];
        const price = parseFloat(zhviValues[i]);
        if (!isNaN(price)) {
          historicalPrices.push({ date, price });
        }
      }

      if (historicalPrices.length === 0) {
        return null;
      }

      const currentPrice = historicalPrices[historicalPrices.length - 1].price;
      const previousPrice = historicalPrices.length >= 2 ? historicalPrices[historicalPrices.length - 2].price : currentPrice;

      // Calculate percent change from previous data point
      let percentChange = 0;
      if (previousPrice > 0) {
        percentChange = ((currentPrice - previousPrice) / previousPrice) * 100;
      }

      const marketStats: MarketStats = {
        id: regionId,
        city,
        state,
        saleData: {
          medianPrice: currentPrice,
          minPrice: Math.min(...historicalPrices.map(h => h.price)),
          maxPrice: Math.max(...historicalPrices.map(h => h.price)),
          lastUpdatedDate: new Date().toISOString()
        },
        percentChange,
        historicalPrices
      };

      // Parse ZORI file if available
      if (zoriResponse && zoriResponse.ok) {
        const zoriContent = await zoriResponse.text();
        const zoriLines = zoriContent.trim().split('\n');

        if (zoriLines.length >= 2) {
          const zoriHeaders = zoriLines[0].split(',');
          const zoriValues = zoriLines[1].split(',');

          const historicalRentals: Array<{ date: string; rent: number }> = [];

          for (let i = 8; i < zoriHeaders.length; i++) {
            const date = zoriHeaders[i];
            const rent = parseFloat(zoriValues[i]);
            if (!isNaN(rent)) {
              historicalRentals.push({ date, rent });
            }
          }

          if (historicalRentals.length > 0) {
            const currentRent = historicalRentals[historicalRentals.length - 1].rent;
            const previousRent = historicalRentals.length >= 2 ? historicalRentals[historicalRentals.length - 2].rent : currentRent;

            // Calculate rent change from previous data point
            let rentChange = 0;
            if (previousRent > 0) {
              rentChange = ((currentRent - previousRent) / previousRent) * 100;
            }

            marketStats.rentalData = {
              medianRent: currentRent
            };
            marketStats.rentChange = rentChange;
            marketStats.historicalRentals = historicalRentals;
          }
        }
      }

      console.log(
        '%c[CSV Provider] ✓ Loaded split market files',
        'color: #10B981',
        {
          location,
          prices: historicalPrices.length,
          rentals: marketStats.historicalRentals?.length || 0
        }
      );

      return marketStats;
    } catch (error) {
      console.error(
        '%c[CSV Provider] Failed to fetch split market files',
        'color: #EF4444',
        { location, error }
      );
      return null;
    }
  }

  /**
   * Fetch market stats from cached CSV data or split files
   */
  protected async fetchMarketStatsFromAPI(location: string): Promise<MarketStats | null> {
    // If using split CSV mode, fetch individual market file
    if (USE_SPLIT_CSV) {
      console.log(
        '%c[CSV Provider] Using split CSV mode',
        'color: #8B5CF6',
        { location }
      );
      return this.fetchSplitMarketFile(location);
    }

    // Otherwise use cached full CSV data
    if (!this.isDataLoaded) {
      console.warn(
        '%c[CSV Provider] No data loaded',
        'color: #F59E0B; font-weight: bold',
        'Upload a CSV file first'
      );
      return null;
    }

    // Simulate slight delay for consistency with other providers
    await new Promise(resolve => setTimeout(resolve, 50));

    // Try exact match first
    let market = this.cachedMarkets.get(location);

    // Try case-insensitive match
    if (!market) {
      market = this.cachedMarkets.get(location.toLowerCase());
    }

    if (market) {
      console.log(
        '%c[CSV Provider] ✓ Found market',
        'color: #10B981',
        { location, market: market.city + ', ' + market.state }
      );
    } else {
      console.warn(
        '%c[CSV Provider] Market not found',
        'color: #F59E0B',
        { location, available: Array.from(this.cachedMarkets.keys()).slice(0, 10) }
      );
    }

    return market || null;
  }
}
