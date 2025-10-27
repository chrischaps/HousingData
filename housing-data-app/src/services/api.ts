import axios, { type AxiosInstance } from 'axios';
import { API_BASE_URL, API_KEY } from '../utils/constants';
import { IndexedDBCache as APICache, CACHE_TTL } from '../utils/indexedDBCache';

/**
 * API Response types from RentCast
 */
interface RentCastProperty {
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

interface RentCastMarketStats {
  id?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  // Direct properties (older API format)
  averagePrice?: number;
  medianPrice?: number;
  percentChange?: number;
  // Nested saleData structure (current API format)
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
}

/**
 * API Error handling
 */
export class APIError extends Error {
  statusCode?: number;
  isRateLimit: boolean;

  constructor(
    message: string,
    statusCode?: number,
    isRateLimit: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.isRateLimit = isRateLimit;
  }
}

/**
 * Axios instance configured for RentCast API
 */
const createAPIClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
  });

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        const status = error.response.status;
        const isRateLimit = status === 429;

        if (isRateLimit) {
          throw new APIError(
            'API rate limit exceeded. Please try again later.',
            status,
            true
          );
        }

        if (status === 401 || status === 403) {
          throw new APIError(
            'Invalid API key. Please check your configuration.',
            status
          );
        }

        throw new APIError(
          `API request failed: ${error.response.data?.message || error.message}`,
          status
        );
      }

      if (error.code === 'ECONNABORTED') {
        throw new APIError('Request timeout. Please try again.');
      }

      throw new APIError('Network error. Please check your connection.');
    }
  );

  return client;
};

const apiClient = createAPIClient();

/**
 * Search for properties by location
 * @param query - City name or ZIP code
 * @param forceRefresh - Bypass cache and fetch fresh data
 * @returns Array of properties
 */
export const searchProperties = async (
  query: string,
  forceRefresh: boolean = false
): Promise<RentCastProperty[]> => {
  const cacheKey = `search:${query.toLowerCase()}`;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await APICache.get<RentCastProperty[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    // Try ZIP code first (numeric)
    if (/^\d{5}$/.test(query)) {
      const response = await apiClient.get('/properties', {
        params: {
          zipCode: query,
          limit: 50,
        },
      });
      const data = response.data || [];

      // Store in cache
      APICache.set(cacheKey, data, CACHE_TTL.SEARCH);

      return data;
    }

    // Otherwise search by city
    const response = await apiClient.get('/properties', {
      params: {
        city: query,
        limit: 50,
      },
    });
    const data = response.data || [];

    // Store in cache
    APICache.set(cacheKey, data, CACHE_TTL.SEARCH);

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Failed to search properties');
  }
};

/**
 * Get market statistics for a location
 * @param location - City name or ZIP code
 * @param forceRefresh - Bypass cache and fetch fresh data
 * @returns Market statistics
 */
export const getMarketStats = async (
  location: string,
  forceRefresh: boolean = false
): Promise<RentCastMarketStats | null> => {
  const cacheKey = `market-stats:${location}`;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await APICache.get<RentCastMarketStats>(cacheKey);
    if (cached) {
      console.log('%c[API] Using cached data', 'color: #10B981', { location, cached });
      return cached;
    }
  }

  const isZipCode = /^\d{5}$/.test(location);

  // Parse city,state format if not a zip code
  let params: any;
  if (isZipCode) {
    params = { zipCode: location };
  } else {
    // Parse "City, State" format
    const parts = location.split(',').map(s => s.trim());
    if (parts.length === 2) {
      params = { city: parts[0], state: parts[1] };
    } else {
      params = { city: location };
    }
  }

  console.log(
    '%c[API] Fetching market stats',
    'color: #6366F1',
    { location, params, endpoint: '/markets', cached: false }
  );

  try {
    const response = await apiClient.get('/markets', { params });

    // Log the complete response structure
    console.log(
      '%c[API] ✓ Success - Raw Response',
      'color: #10B981',
      {
        location,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        hasMarketsArray: response.data?.markets ? true : false,
        marketsLength: response.data?.markets?.length || 0,
        responseKeys: response.data ? Object.keys(response.data) : [],
        data: response.data
      }
    );

    // Log response structure details
    if (response.data) {
      console.log(
        '%c[API] Response structure details:',
        'color: #6366F1',
        {
          topLevelKeys: Object.keys(response.data),
          hasSaleData: !!response.data.saleData,
          hasRentalData: !!response.data.rentalData,
          hasMarkets: !!response.data.markets,
          saleDataKeys: response.data.saleData ? Object.keys(response.data.saleData) : []
        }
      );
    }

    // RentCast API returns the market data directly (not wrapped in an array)
    let marketData = null;

    if (response.data && response.data.saleData) {
      // Direct market data response with saleData property
      marketData = response.data;
      console.log('%c[API] ✓ Using direct market response', 'color: #6366F1', {
        id: marketData.id,
        zipCode: marketData.zipCode,
        hasSaleData: !!marketData.saleData,
        hasRentalData: !!marketData.rentalData
      });
    } else if (response.data?.markets && Array.isArray(response.data.markets) && response.data.markets.length > 0) {
      // Fallback: wrapped in markets array (in case API changes)
      marketData = response.data.markets[0];
      console.log('%c[API] ✓ Extracted from markets array', 'color: #6366F1', marketData);
    } else {
      console.warn(
        '%c[API] ⚠ Unexpected response structure',
        'color: #F59E0B; font-weight: bold',
        { location, params, response: response.data }
      );
    }

    // Store in cache (only if we have valid data)
    const hasValidData = marketData && (
      marketData.saleData?.averagePrice ||
      marketData.saleData?.medianPrice ||
      marketData.averagePrice ||
      marketData.medianPrice
    );

    if (hasValidData) {
      await APICache.set(cacheKey, marketData, CACHE_TTL.MARKET_STATS);
      console.log('%c[API] ✓ Cached valid market data', 'color: #6366F1');
    } else {
      console.warn(
        '%c[API] ⚠ No valid market data to cache',
        'color: #F59E0B; font-weight: bold',
        { location, params, marketData }
      );
    }

    return marketData || null;
  } catch (error) {
    console.error(
      '%c[API] ✗ Failed',
      'color: #EF4444; font-weight: bold',
      { location, error }
    );

    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Failed to fetch market statistics');
  }
};

/**
 * Get property value estimate
 * @param address - Full address or ZIP code
 * @returns Value estimate data
 */
export const getValueEstimate = async (address: string) => {
  try {
    const response = await apiClient.get('/value-estimate', {
      params: { address },
    });
    return response.data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Failed to fetch value estimate');
  }
};

/**
 * Check if API key is configured
 */
export const isAPIConfigured = (): boolean => {
  return Boolean(API_KEY && API_KEY !== 'your_api_key_here');
};

export default apiClient;
