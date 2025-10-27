/**
 * Mock Data Provider
 *
 * Provides sample/mock data for development and testing.
 * No API key required, unlimited usage.
 */

import { BaseProvider } from './base.provider';
import type { MarketStats, Property, ProviderInfo } from './types';

export class MockProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'mock',
    name: 'Mock Data',
    description: 'Sample data for development and testing',
    icon: '🎭',
    requiresApiKey: false,
    rateLimits: {
      limit: Infinity,
      period: 'unlimited',
    },
    features: {
      marketStats: true,
      propertySearch: true,
      propertyDetails: false,
    },
  };

  constructor() {
    super();
    this.logInitialization();
  }

  isConfigured(): boolean {
    // Mock provider is always configured
    return true;
  }

  protected async fetchMarketStatsFromAPI(location: string): Promise<MarketStats | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Parse location
    const isZipCode = /^\d{5}$/.test(location);
    let city = '';
    let state = '';
    let zipCode = '';

    if (isZipCode) {
      zipCode = location;
      // Map common zip codes to cities
      const zipToCityMap: Record<string, { city: string; state: string }> = {
        '48201': { city: 'Detroit', state: 'MI' },
        '92805': { city: 'Anaheim', state: 'CA' },
        '78701': { city: 'Austin', state: 'TX' },
        '33101': { city: 'Miami', state: 'FL' },
        '98101': { city: 'Seattle', state: 'WA' },
      };
      const match = zipToCityMap[zipCode];
      if (match) {
        city = match.city;
        state = match.state;
      } else {
        city = 'Unknown';
        state = 'XX';
      }
    } else {
      const parts = location.split(',').map(s => s.trim());
      city = parts[0] || 'Unknown';
      state = parts[1] || 'XX';
    }

    // Generate realistic-looking mock data based on location
    const basePrices: Record<string, number> = {
      'Detroit': 225000,
      'Anaheim': 875000,
      'Austin': 550000,
      'Miami': 625000,
      'Seattle': 825000,
    };

    const basePrice = basePrices[city] || 350000;
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const medianPrice = Math.round(basePrice * (1 + variation));
    const averagePrice = Math.round(medianPrice * 1.05); // Avg is typically 5% higher

    // Random price change between -5% and +10%
    const priceChange = (Math.random() * 15) - 5;

    return {
      id: zipCode || `${city}-${state}`,
      city,
      state,
      zipCode,
      saleData: {
        lastUpdatedDate: new Date().toISOString(),
        averagePrice,
        medianPrice,
        minPrice: Math.round(medianPrice * 0.5),
        maxPrice: Math.round(medianPrice * 3),
        averagePricePerSquareFoot: Math.round(medianPrice / 2000),
        medianPricePerSquareFoot: Math.round(medianPrice / 2200),
        minPricePerSquareFoot: Math.round(medianPrice / 3000),
        maxPricePerSquareFoot: Math.round(medianPrice / 1000),
        averageSquareFootage: 2000,
        medianSquareFootage: 1850,
        minSquareFootage: 800,
        maxSquareFootage: 5000,
        averageDaysOnMarket: Math.round(20 + Math.random() * 60),
        medianDaysOnMarket: Math.round(15 + Math.random() * 40),
        minDaysOnMarket: 1,
      },
      percentChange: priceChange,
    };
  }

  protected async fetchPropertiesFromAPI(query: string): Promise<Property[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150));

    // Generate 5-10 mock properties
    const count = 5 + Math.floor(Math.random() * 6);
    const properties: Property[] = [];

    for (let i = 0; i < count; i++) {
      properties.push({
        id: `mock-${query}-${i}`,
        addressLine1: `${100 + i * 10} Main Street`,
        city: query,
        state: 'XX',
        zipCode: '00000',
        price: Math.round(200000 + Math.random() * 500000),
        propertyType: ['Single Family', 'Condo', 'Townhouse'][Math.floor(Math.random() * 3)],
        bedrooms: 2 + Math.floor(Math.random() * 4),
        bathrooms: 1 + Math.floor(Math.random() * 3),
        squareFootage: Math.round(1000 + Math.random() * 2500),
      });
    }

    return properties;
  }
}
