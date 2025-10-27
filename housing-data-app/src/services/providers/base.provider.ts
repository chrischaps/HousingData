/**
 * Base Provider Class
 *
 * Provides common functionality for all housing data providers including
 * caching, error handling, and logging.
 */

import { IndexedDBCache as APICache, CACHE_TTL } from '../../utils/indexedDBCache';
import type { IHousingDataProvider, MarketStats, Property, ProviderInfo } from './types';

export abstract class BaseProvider implements IHousingDataProvider {
  abstract readonly info: ProviderInfo;

  /**
   * Check if provider is configured
   * Override this method to add specific configuration checks
   */
  abstract isConfigured(): boolean;

  /**
   * Fetch market stats from the provider's API
   * Must be implemented by each provider
   */
  protected abstract fetchMarketStatsFromAPI(location: string): Promise<MarketStats | null>;

  /**
   * Fetch properties from the provider's API (optional)
   * Override if provider supports property search
   */
  protected async fetchPropertiesFromAPI(_query: string): Promise<Property[]> {
    throw new Error(`${this.info.name} does not support property search`);
  }

  /**
   * Get cache key for market stats
   */
  protected getMarketStatsCacheKey(location: string): string {
    return `${this.info.id}:market-stats:${location}`;
  }

  /**
   * Get cache key for property search
   */
  protected getPropertySearchCacheKey(query: string): string {
    return `${this.info.id}:search:${query.toLowerCase()}`;
  }

  /**
   * Get market statistics with caching
   */
  async getMarketStats(location: string, forceRefresh: boolean = false): Promise<MarketStats | null> {
    const cacheKey = this.getMarketStatsCacheKey(location);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await APICache.get<MarketStats>(cacheKey);
      if (cached) {
        console.log(
          `%c[${this.info.name}] Cache Hit`,
          'color: #10B981; font-weight: bold',
          { location, cacheKey }
        );
        return cached;
      }
    }

    console.log(
      `%c[${this.info.name}] Fetching market stats`,
      'color: #6366F1; font-weight: bold',
      { location, forceRefresh }
    );

    try {
      const stats = await this.fetchMarketStatsFromAPI(location);

      if (stats) {
        // Store in cache
        const hasValidData =
          stats.saleData?.averagePrice ||
          stats.saleData?.medianPrice ||
          stats.averagePrice ||
          stats.medianPrice;

        if (hasValidData) {
          await APICache.set(cacheKey, stats, CACHE_TTL.MARKET_STATS);
          console.log(
            `%c[${this.info.name}] ✓ Cached valid market data`,
            'color: #10B981',
            { location }
          );
        } else {
          console.warn(
            `%c[${this.info.name}] ⚠ No valid data to cache`,
            'color: #F59E0B',
            { location, stats }
          );
        }
      }

      return stats;
    } catch (error) {
      console.error(
        `%c[${this.info.name}] ✗ Error fetching market stats`,
        'color: #EF4444; font-weight: bold',
        { location, error }
      );
      throw error;
    }
  }

  /**
   * Search for properties with caching (optional feature)
   */
  async searchProperties(query: string, forceRefresh: boolean = false): Promise<Property[]> {
    if (!this.info.features.propertySearch) {
      throw new Error(`${this.info.name} does not support property search`);
    }

    const cacheKey = this.getPropertySearchCacheKey(query);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await APICache.get<Property[]>(cacheKey);
      if (cached) {
        console.log(
          `%c[${this.info.name}] Cache Hit (Search)`,
          'color: #10B981; font-weight: bold',
          { query }
        );
        return cached;
      }
    }

    console.log(
      `%c[${this.info.name}] Searching properties`,
      'color: #6366F1; font-weight: bold',
      { query }
    );

    try {
      const properties = await this.fetchPropertiesFromAPI(query);

      if (properties && properties.length > 0) {
        await APICache.set(cacheKey, properties, CACHE_TTL.SEARCH);
        console.log(
          `%c[${this.info.name}] ✓ Cached search results`,
          'color: #10B981',
          { query, count: properties.length }
        );
      }

      return properties;
    } catch (error) {
      console.error(
        `%c[${this.info.name}] ✗ Error searching properties`,
        'color: #EF4444; font-weight: bold',
        { query, error }
      );
      throw error;
    }
  }

  /**
   * Log provider initialization
   */
  protected logInitialization(): void {
    console.log(
      `%c[${this.info.name}] Provider initialized`,
      'color: #6366F1; font-weight: bold',
      {
        id: this.info.id,
        configured: this.isConfigured(),
        features: this.info.features,
        rateLimits: this.info.rateLimits,
      }
    );
  }
}
