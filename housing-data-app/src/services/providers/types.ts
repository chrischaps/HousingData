/**
 * Provider Types and Interfaces
 *
 * Defines the contract that all housing data providers must implement.
 */

/**
 * Market statistics data structure
 * Standardized across all providers
 */
export interface MarketStats {
  id?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  // Direct properties (for backward compatibility)
  averagePrice?: number;
  medianPrice?: number;
  percentChange?: number;
  // Nested saleData structure (preferred)
  saleData?: {
    lastUpdatedDate?: string;
    averagePrice?: number;
    medianPrice?: number;
    minPrice?: number;
    maxPrice?: number;
    averagePricePerSquareFoot?: number;
    medianPricePerSquareFoot?: number;
    minPricePerSquareFoot?: number;
    maxPricePerSquareFoot?: number;
    averageSquareFootage?: number;
    medianSquareFootage?: number;
    minSquareFootage?: number;
    maxSquareFootage?: number;
    averageDaysOnMarket?: number;
    medianDaysOnMarket?: number;
    minDaysOnMarket?: number;
  };
  rentalData?: {
    [key: string]: any;
  };
  // Historical time-series data (for charts)
  historicalPrices?: Array<{
    date: string;
    price: number;
  }>;
}

/**
 * Property search result
 */
export interface Property {
  id: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  price?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
}

/**
 * Rate limit information
 */
export interface RateLimits {
  limit: number;          // Number of requests allowed
  period: string;         // Time period ('hour', 'day', 'month')
  remaining?: number;     // Requests remaining (if known)
  resetAt?: Date;         // When the limit resets
}

/**
 * Provider metadata
 */
export interface ProviderInfo {
  id: string;             // Unique identifier (e.g., 'zillow-metrics')
  name: string;           // Display name (e.g., 'Zillow Market Metrics')
  description: string;    // Short description
  icon: string;           // Emoji or icon character
  requiresApiKey: boolean; // Whether API key is needed
  rateLimits: RateLimits; // Rate limit information
  features: {
    marketStats: boolean;    // Supports getMarketStats
    propertySearch: boolean; // Supports searchProperties
    propertyDetails: boolean; // Supports getPropertyDetails (future)
  };
}

/**
 * Main provider interface
 * All housing data providers must implement this interface
 */
export interface IHousingDataProvider {
  /**
   * Provider information
   */
  readonly info: ProviderInfo;

  /**
   * Check if provider is properly configured with required credentials
   */
  isConfigured(): boolean;

  /**
   * Get market statistics for a location
   * @param location - ZIP code or "City, State" format
   * @param forceRefresh - Bypass cache and fetch fresh data
   */
  getMarketStats(location: string, forceRefresh?: boolean): Promise<MarketStats | null>;

  /**
   * Search for properties by location (optional feature)
   * @param query - City name or ZIP code
   * @param forceRefresh - Bypass cache and fetch fresh data
   */
  searchProperties?(query: string, forceRefresh?: boolean): Promise<Property[]>;

  /**
   * Get detailed property information by ID (optional feature)
   * @param propertyId - Unique property identifier
   * @param forceRefresh - Bypass cache and fetch fresh data
   */
  getPropertyDetails?(propertyId: string, forceRefresh?: boolean): Promise<Property | null>;
}

/**
 * Provider configuration from environment variables
 */
export interface ProviderConfig {
  type: 'zillow-metrics' | 'rentcast' | 'mock';
  apiKey?: string;
  baseURL?: string;
  options?: Record<string, any>;
}
