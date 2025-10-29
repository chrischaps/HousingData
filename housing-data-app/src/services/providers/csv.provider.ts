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

export class CSVProvider extends BaseProvider {
  private cachedMarkets: Map<string, MarketStats> = new Map();
  private isDataLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  private loadingProgress: number = 0;
  private loadingMessage: string = '';

  readonly info: ProviderInfo = {
    id: 'csv',
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
    // Load data asynchronously and store the promise
    this.loadingPromise = this.loadDataFromStorage().catch(error => {
      console.error('[CSV Provider] Failed to load on construction', error);
    });
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
   * Fetch market stats from cached CSV data
   */
  protected async fetchMarketStatsFromAPI(location: string): Promise<MarketStats | null> {
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
