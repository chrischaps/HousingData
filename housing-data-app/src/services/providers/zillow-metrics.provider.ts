/**
 * Zillow Housing Market Metrics Provider
 *
 * Uses the Bridge Data Output API to access Zillow's ZHVI (Zillow Home Value Index)
 * and other housing market metrics.
 *
 * API Documentation: https://documenter.getpostman.com/view/9197254/UVsFz93V
 * Base URL: https://api.bridgedataoutput.com/api/v2/zgecon/marketreport
 */

import axios, { type AxiosInstance } from 'axios';
import { BaseProvider } from './base.provider';
import type { MarketStats, ProviderInfo } from './types';

interface ZillowMetricResponse {
  success: boolean;
  status: number;
  bundle: Array<{
    stateCodeFIPS: string;
    releaseDate: string;
    dataValue: number;
    regionCity: string | null;
    timePeriodTypeKey: string;
    metricTypeKey: string;
    regionMetro: string;
    regionTypeID: number;
    regionID: number;
    regionType: string;
    regionCounty: string;
    cutTypeKey: string;
    municipalCodeFIPS: string;
    regionState: string;
    timePeriodEndDateTime: string;
    id: number;
    region: string;
    createDate: string;
    url: string;
  }>;
}

export class ZillowMetricsProvider extends BaseProvider {
  private baseURL = 'https://api.bridgedataoutput.com/api/v2/zgecon/marketreport';
  private accessToken: string;
  private client: AxiosInstance;

  readonly info: ProviderInfo = {
    id: 'zillow-metrics',
    name: 'Zillow Market Metrics',
    description: 'ZHVI and market statistics via Bridge Data Output API',
    icon: '🏘️',
    requiresApiKey: true,
    rateLimits: {
      limit: 1000, // Estimate - needs verification
      period: 'day',
    },
    features: {
      marketStats: true,
      propertySearch: false,
      propertyDetails: false,
    },
  };

  constructor() {
    super();

    this.accessToken = import.meta.env.VITE_ZILLOW_METRICS_API_KEY || '';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000, // 15 second timeout
    });

    this.logInitialization();
  }

  isConfigured(): boolean {
    const configured = Boolean(this.accessToken && this.accessToken.length > 0);

    if (!configured) {
      console.warn(
        '%c[Zillow Metrics] Not configured',
        'color: #F59E0B; font-weight: bold',
        'Missing VITE_ZILLOW_METRICS_API_KEY in .env'
      );
    }

    return configured;
  }

  protected async fetchMarketStatsFromAPI(location: string): Promise<MarketStats | null> {
    if (!this.isConfigured()) {
      throw new Error('Zillow Metrics provider not configured. Add VITE_ZILLOW_METRICS_API_KEY to .env');
    }

    // Parse location
    const { city, state, zipCode } = this.parseLocation(location);

    if (!city && !zipCode) {
      console.error(
        '%c[Zillow Metrics] Invalid location format',
        'color: #EF4444',
        { location, expected: 'City, State or ZIP code' }
      );
      return null;
    }

    try {
      // Determine regionTypeID and region parameter
      let regionTypeID: number;
      let regionParam: string;

      if (zipCode) {
        regionTypeID = 8; // ZIP code level
        regionParam = zipCode;
      } else {
        regionTypeID = 6; // City level
        regionParam = city;
      }

      // Build API request parameters
      const params = {
        access_token: this.accessToken,
        metricTypeKey: 'zhvi', // Zillow Home Value Index
        cutTypeKey: 'uc_sfrcondo', // Single-family homes and condos
        regionTypeID,
        region: regionParam,
      };

      console.log(
        '%c[Zillow Metrics] Fetching ZHVI',
        'color: #6366F1',
        { params: { ...params, access_token: '***' } }
      );

      const response = await this.client.get<ZillowMetricResponse>('', { params });

      console.log(
        '%c[Zillow Metrics] ✓ Response received',
        'color: #10B981',
        {
          success: response.data.success,
          status: response.data.status,
          dataPoints: response.data.bundle?.length || 0,
        }
      );

      if (!response.data.success || !response.data.bundle || response.data.bundle.length === 0) {
        console.warn(
          '%c[Zillow Metrics] No data in response',
          'color: #F59E0B',
          { location, response: response.data }
        );
        return null;
      }

      // Transform response to MarketStats
      return this.transformResponse(response.data, city, state, zipCode);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        if (status === 401 || status === 403) {
          console.error(
            '%c[Zillow Metrics] Authentication failed',
            'color: #EF4444; font-weight: bold',
            'Check VITE_ZILLOW_METRICS_API_KEY'
          );
        } else if (status === 429) {
          console.error(
            '%c[Zillow Metrics] Rate limit exceeded',
            'color: #EF4444; font-weight: bold',
            'Too many requests'
          );
        } else {
          console.error(
            '%c[Zillow Metrics] API request failed',
            'color: #EF4444',
            { status, message, location }
          );
        }
      }

      throw error;
    }
  }

  /**
   * Transform Zillow API response to MarketStats format
   */
  private transformResponse(
    data: ZillowMetricResponse,
    city: string,
    state: string,
    zipCode?: string
  ): MarketStats | null {
    const bundle = data.bundle;

    if (!bundle || bundle.length === 0) {
      return null;
    }

    // Sort by release date (most recent first)
    const sorted = [...bundle].sort(
      (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );

    const latest = sorted[0];
    const previous = sorted[1];

    // Calculate price change from previous month
    let percentChange = 0;
    if (latest && previous && previous.dataValue > 0) {
      percentChange = ((latest.dataValue - previous.dataValue) / previous.dataValue) * 100;
    }

    // Calculate min/max from available data
    const values = sorted.map(item => item.dataValue).filter(v => v > 0);
    const minPrice = values.length > 0 ? Math.min(...values) : 0;
    const maxPrice = values.length > 0 ? Math.max(...values) : 0;
    const avgPrice = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;

    console.log(
      '%c[Zillow Metrics] ✓ Transformed data',
      'color: #6366F1',
      {
        region: latest.region,
        currentValue: latest.dataValue,
        percentChange: percentChange.toFixed(2) + '%',
        dataPoints: sorted.length,
      }
    );

    return {
      id: latest.regionID.toString(),
      city: city || latest.regionCity || latest.region,
      state: state || latest.regionState,
      zipCode: zipCode,
      saleData: {
        lastUpdatedDate: latest.releaseDate,
        medianPrice: Math.round(latest.dataValue),
        averagePrice: Math.round(avgPrice),
        minPrice: Math.round(minPrice),
        maxPrice: Math.round(maxPrice),
        // Note: ZHVI doesn't provide these metrics, would need additional API calls
        averagePricePerSquareFoot: undefined,
        medianPricePerSquareFoot: undefined,
        averageSquareFootage: undefined,
        medianSquareFootage: undefined,
        averageDaysOnMarket: undefined,
        medianDaysOnMarket: undefined,
      },
      percentChange,
    };
  }

  /**
   * Parse location string into components
   */
  private parseLocation(location: string): {
    city: string;
    state: string;
    zipCode?: string;
  } {
    // Check if it's a ZIP code
    if (/^\d{5}$/.test(location)) {
      return {
        city: '',
        state: '',
        zipCode: location,
      };
    }

    // Parse "City, State" format
    const parts = location.split(',').map(s => s.trim());
    const city = parts[0] || '';
    const state = parts[1] || '';

    return { city, state };
  }
}
