/**
 * IndexedDB-based API Response Cache
 *
 * Provides persistent caching across browser sessions with async operations.
 * Advantages over localStorage:
 * - Unlimited storage (no 5-10MB limit)
 * - Async operations (non-blocking)
 * - Better persistence across refreshes
 * - ACID transactions
 * - Structured queries with indexes
 */

export interface CachedRecord {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  expiresAt: number;
  dataType: 'market-stats' | 'search' | 'property' | 'other';
}

export interface CacheStats {
  count: number;
  keys: string[];
  totalSize: number;
  byType: {
    'market-stats': number;
    'search': number;
    'property': number;
    'other': number;
  };
}

/**
 * Cache TTL (Time To Live) configurations in milliseconds
 */
export const CACHE_TTL = {
  MARKET_STATS: 24 * 60 * 60 * 1000,  // 24 hours
  SEARCH: 1 * 60 * 60 * 1000,          // 1 hour
  PROPERTY: 12 * 60 * 60 * 1000,       // 12 hours
};

/**
 * IndexedDB Cache Implementation
 *
 * Provides a Promise-based API for caching with automatic expiration.
 */
export class IndexedDBCache {
  private static dbName = 'HousingDataCache';
  private static version = 1;
  private static storeName = 'api-responses';
  private static dbInstance: IDBDatabase | null = null;
  private static initPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  private static async initDB(): Promise<IDBDatabase> {
    // Return existing instance if available
    if (this.dbInstance) {
      return this.dbInstance;
    }

    // Return in-progress initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    // Create new initialization promise
    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('%c[IndexedDB] Failed to open database', 'color: #EF4444', request.error);
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.dbInstance = request.result;
        console.log('%c[IndexedDB] ✓ Database opened', 'color: #10B981');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store with indexes
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });

          // Indexes for efficient queries
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('dataType', 'dataType', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });

          console.log('%c[IndexedDB] ✓ Object store created', 'color: #6366F1');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get the database instance (initializes if needed)
   */
  private static async getDB(): Promise<IDBDatabase> {
    if (this.dbInstance) {
      return this.dbInstance;
    }
    return this.initDB();
  }

  /**
   * Determine data type from cache key
   */
  private static getDataType(key: string): CachedRecord['dataType'] {
    if (key.startsWith('market-stats:')) return 'market-stats';
    if (key.startsWith('search:')) return 'search';
    if (key.startsWith('property:')) return 'property';
    return 'other';
  }

  /**
   * Get a cached item by key
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);

      return new Promise<T | null>((resolve, reject) => {
        const request = store.get(key);

        request.onerror = () => {
          console.error('%c[IndexedDB] Get error', 'color: #EF4444', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          const record = request.result as CachedRecord | undefined;

          if (!record) {
            console.log('%c[IndexedDB] ✗ Miss', 'color: #9CA3AF', { key });
            resolve(null);
            return;
          }

          // Check expiration
          const now = Date.now();
          if (now > record.expiresAt) {
            const ageHours = ((now - record.timestamp) / (1000 * 60 * 60)).toFixed(1);
            console.log('%c[IndexedDB] Expired', 'color: #F59E0B', { key, ageHours });

            // Remove expired entry
            this.remove(key);
            resolve(null);
            return;
          }

          const ageMinutes = ((now - record.timestamp) / (1000 * 60)).toFixed(1);
          console.log('%c[IndexedDB] ✓ Hit', 'color: #10B981; font-weight: bold', { key, ageMinutes });

          resolve(record.data as T);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Error in get():', error);
      return null;
    }
  }

  /**
   * Store an item in the cache
   */
  static async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      const record: CachedRecord = {
        key,
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
        expiresAt: Date.now() + ttlMs,
        dataType: this.getDataType(key),
      };

      return new Promise<void>((resolve, reject) => {
        const request = store.put(record);

        request.onerror = () => {
          console.error('%c[IndexedDB] Set error', 'color: #EF4444', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          const ttlHours = (ttlMs / (1000 * 60 * 60)).toFixed(1);
          console.log('%c[IndexedDB] ✓ Stored', 'color: #6366F1', { key, ttlHours });
          resolve();
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Error in set():', error);
    }
  }

  /**
   * Remove a specific cache entry
   */
  static async remove(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      return new Promise<void>((resolve, reject) => {
        const request = store.delete(key);

        request.onerror = () => {
          reject(request.error);
        };

        request.onsuccess = () => {
          console.log('%c[IndexedDB] ✓ Removed', 'color: #F59E0B', { key });
          resolve();
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Error in remove():', error);
    }
  }

  /**
   * Clear all cache entries
   */
  static async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      return new Promise<void>((resolve, reject) => {
        const request = store.clear();

        request.onerror = () => {
          console.error('%c[IndexedDB] Clear error', 'color: #EF4444', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          console.log('%c[IndexedDB] ✓ Cleared all entries', 'color: #EF4444; font-weight: bold');
          resolve();
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Error in clear():', error);
    }
  }

  /**
   * Clear only expired cache entries
   */
  static async clearExpired(): Promise<number> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('expiresAt');

      return new Promise<number>((resolve, reject) => {
        const now = Date.now();
        const range = IDBKeyRange.upperBound(now);
        const request = index.openCursor(range);
        let count = 0;

        request.onerror = () => {
          reject(request.error);
        };

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;

          if (cursor) {
            cursor.delete();
            count++;
            cursor.continue();
          } else {
            if (count > 0) {
              console.log('%c[IndexedDB] ✓ Cleared expired', 'color: #F59E0B', { count });
            }
            resolve(count);
          }
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Error in clearExpired():', error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache (and is not expired)
   */
  static async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Get the age of a cached item in milliseconds
   */
  static async getAge(key: string): Promise<number | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);

      return new Promise<number | null>((resolve, reject) => {
        const request = store.get(key);

        request.onerror = () => {
          reject(request.error);
        };

        request.onsuccess = () => {
          const record = request.result as CachedRecord | undefined;

          if (!record) {
            resolve(null);
            return;
          }

          const age = Date.now() - record.timestamp;
          resolve(age);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Error in getAge():', error);
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<CacheStats> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);

      return new Promise<CacheStats>((resolve, reject) => {
        const request = store.getAll();

        request.onerror = () => {
          reject(request.error);
        };

        request.onsuccess = () => {
          const records = request.result as CachedRecord[];

          const stats: CacheStats = {
            count: records.length,
            keys: records.map(r => r.key),
            totalSize: 0,
            byType: {
              'market-stats': 0,
              'search': 0,
              'property': 0,
              'other': 0,
            },
          };

          // Calculate total size and count by type
          records.forEach(record => {
            const size = JSON.stringify(record.data).length;
            stats.totalSize += size;
            stats.byType[record.dataType]++;
          });

          resolve(stats);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Error in getStats():', error);
      return {
        count: 0,
        keys: [],
        totalSize: 0,
        byType: {
          'market-stats': 0,
          'search': 0,
          'property': 0,
          'other': 0,
        },
      };
    }
  }

  /**
   * Get all cache entries (for debugging)
   */
  static async getAll(): Promise<CachedRecord[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);

      return new Promise<CachedRecord[]>((resolve, reject) => {
        const request = store.getAll();

        request.onerror = () => {
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result as CachedRecord[]);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Error in getAll():', error);
      return [];
    }
  }

  /**
   * Check if IndexedDB is supported
   */
  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }
}

/**
 * Format cache size for display
 */
export const formatCacheSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Migrate data from localStorage to IndexedDB
 */
export const migrateFromLocalStorage = async (): Promise<number> => {
  let migratedCount = 0;

  try {
    console.log('%c[IndexedDB] Starting migration from localStorage', 'color: #6366F1; font-weight: bold');

    // Find all localStorage keys with our prefix
    const prefix = 'housing-api-cache:';
    const keysToMigrate: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToMigrate.push(key);
      }
    }

    console.log(`[IndexedDB] Found ${keysToMigrate.length} localStorage entries to migrate`);

    // Migrate each entry
    for (const fullKey of keysToMigrate) {
      try {
        const value = localStorage.getItem(fullKey);
        if (!value) continue;

        const cached = JSON.parse(value);
        const key = fullKey.replace(prefix, '');

        // Check if still valid
        const age = Date.now() - cached.timestamp;
        if (age < cached.ttl) {
          await IndexedDBCache.set(key, cached.data, cached.ttl - age);
          migratedCount++;
        }

        // Remove from localStorage after migration
        localStorage.removeItem(fullKey);
      } catch (error) {
        console.error(`[IndexedDB] Failed to migrate ${fullKey}:`, error);
      }
    }

    console.log('%c[IndexedDB] ✓ Migration complete', 'color: #10B981; font-weight: bold', { migratedCount });
  } catch (error) {
    console.error('[IndexedDB] Migration failed:', error);
  }

  return migratedCount;
};
