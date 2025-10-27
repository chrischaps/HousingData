/**
 * API Response Cache Utility
 *
 * Provides localStorage-based caching for API responses with TTL (Time To Live).
 * Helps reduce API calls and improve performance by caching responses locally.
 */

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

interface CacheStats {
  count: number;
  keys: string[];
  totalSize: number; // in bytes
}

/**
 * TTL constants for different data types
 */
export const CACHE_TTL = {
  MARKET_STATS: 24 * 60 * 60 * 1000,  // 24 hours - market data changes slowly
  SEARCH: 1 * 60 * 60 * 1000,          // 1 hour - search results moderate freshness
  PROPERTY: 12 * 60 * 60 * 1000,      // 12 hours - property details
};

/**
 * API Cache Manager
 *
 * Handles caching of API responses in localStorage with automatic expiration.
 */
export class APICache {
  private static prefix = 'housing-api-cache:';

  /**
   * Get data from cache
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   */
  static get<T>(key: string): T | null {
    try {
      const fullKey = this.prefix + key;
      const cached = localStorage.getItem(fullKey);

      if (!cached) {
        return null;
      }

      const { data, timestamp, ttl }: CachedData<T> = JSON.parse(cached);
      const now = Date.now();
      const age = now - timestamp;

      // Check if expired
      if (age > ttl) {
        console.log(
          '%c[Cache] Expired',
          'color: #F59E0B',
          { key, ageHours: (age / (1000 * 60 * 60)).toFixed(1) }
        );
        this.remove(key);
        return null;
      }

      console.log(
        '%c[Cache] ✓ Hit',
        'color: #10B981; font-weight: bold',
        { key, ageMinutes: (age / (1000 * 60)).toFixed(1) }
      );

      return data;
    } catch (error) {
      console.error('[Cache] Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Store data in cache
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds
   */
  static set<T>(key: string, data: T, ttlMs: number): void {
    try {
      const fullKey = this.prefix + key;
      const cached: CachedData<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
      };

      localStorage.setItem(fullKey, JSON.stringify(cached));

      console.log(
        '%c[Cache] ✓ Stored',
        'color: #6366F1',
        { key, ttlHours: (ttlMs / (1000 * 60 * 60)).toFixed(1) }
      );
    } catch (error) {
      // localStorage might be full or disabled
      console.error('[Cache] Error storing in cache:', error);

      // Try to clear old entries and retry
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[Cache] Storage quota exceeded, clearing old entries');
        this.clearExpired();
      }
    }
  }

  /**
   * Remove specific key from cache
   * @param key - Cache key
   */
  static remove(key: string): void {
    try {
      const fullKey = this.prefix + key;
      localStorage.removeItem(fullKey);
      console.log('%c[Cache] Removed', 'color: #EF4444', { key });
    } catch (error) {
      console.error('[Cache] Error removing from cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      let cleared = 0;

      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
          cleared++;
        }
      });

      console.log(
        '%c[Cache] ✓ Cleared',
        'color: #EF4444; font-weight: bold',
        { itemsCleared: cleared }
      );
    } catch (error) {
      console.error('[Cache] Error clearing cache:', error);
    }
  }

  /**
   * Clear only expired entries
   */
  static clearExpired(): void {
    try {
      const keys = Object.keys(localStorage);
      let cleared = 0;

      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const cached = localStorage.getItem(key);
          if (cached) {
            try {
              const { timestamp, ttl } = JSON.parse(cached);
              const age = Date.now() - timestamp;

              if (age > ttl) {
                localStorage.removeItem(key);
                cleared++;
              }
            } catch {
              // Invalid cached data, remove it
              localStorage.removeItem(key);
              cleared++;
            }
          }
        }
      });

      if (cleared > 0) {
        console.log(
          '%c[Cache] Cleared expired entries',
          'color: #F59E0B',
          { itemsCleared: cleared }
        );
      }
    } catch (error) {
      console.error('[Cache] Error clearing expired cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  static getStats(): CacheStats {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith(this.prefix));

      let totalSize = 0;
      cacheKeys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += item.length * 2; // 2 bytes per character (UTF-16)
        }
      });

      return {
        count: cacheKeys.length,
        keys: cacheKeys.map(k => k.replace(this.prefix, '')),
        totalSize,
      };
    } catch (error) {
      console.error('[Cache] Error getting stats:', error);
      return {
        count: 0,
        keys: [],
        totalSize: 0,
      };
    }
  }

  /**
   * Check if a key exists in cache (regardless of expiration)
   * @param key - Cache key
   * @returns true if key exists
   */
  static has(key: string): boolean {
    const fullKey = this.prefix + key;
    return localStorage.getItem(fullKey) !== null;
  }

  /**
   * Get cache age in milliseconds
   * @param key - Cache key
   * @returns Age in milliseconds, or null if not found
   */
  static getAge(key: string): number | null {
    try {
      const fullKey = this.prefix + key;
      const cached = localStorage.getItem(fullKey);

      if (!cached) return null;

      const { timestamp } = JSON.parse(cached);
      return Date.now() - timestamp;
    } catch {
      return null;
    }
  }
}

/**
 * Format cache size for display
 * @param bytes - Size in bytes
 * @returns Formatted string
 */
export function formatCacheSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
