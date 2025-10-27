/**
 * Provider Factory
 *
 * Creates and returns the appropriate housing data provider based on
 * environment configuration or user selection.
 *
 * Uses singleton pattern to reuse provider instances and reduce memory usage.
 */

import type { IHousingDataProvider } from './types';
import { MockProvider } from './mock.provider';
import { ZillowMetricsProvider } from './zillow-metrics.provider';
import { CSVProvider } from './csv.provider';

// Singleton cache for provider instances
const providerCache = new Map<string, IHousingDataProvider>();

/**
 * Get the configured provider type from environment or localStorage
 */
export function getProviderType(): string {
  // Check localStorage first (user selection takes precedence)
  const storedProvider = localStorage.getItem('housing-data-provider');
  if (storedProvider) {
    console.log(
      '%c[Provider Factory] Using provider from localStorage',
      'color: #8B5CF6; font-weight: bold',
      { provider: storedProvider }
    );
    return storedProvider;
  }

  // Fall back to environment variable, defaulting to CSV (not mock)
  const envProvider = import.meta.env.VITE_DATA_PROVIDER || 'csv';
  console.log(
    '%c[Provider Factory] Using provider from environment',
    'color: #8B5CF6; font-weight: bold',
    { provider: envProvider }
  );
  return envProvider;
}

/**
 * Create and return the appropriate housing data provider
 * Uses singleton pattern - returns cached instance if available
 */
export function createProvider(): IHousingDataProvider {
  const providerType = getProviderType();

  // Check if we already have a cached provider of this type
  if (providerCache.has(providerType)) {
    console.log(
      '%c[Provider Factory] Reusing cached provider',
      'color: #10B981; font-weight: bold',
      { type: providerType }
    );
    return providerCache.get(providerType)!;
  }

  console.log(
    '%c[Provider Factory] Creating new provider',
    'color: #8B5CF6; font-weight: bold; font-size: 14px',
    { type: providerType }
  );

  let provider: IHousingDataProvider;

  switch (providerType) {
    case 'zillow-metrics':
      // Lazy load Zillow provider
      provider = createZillowMetricsProvider();
      break;

    case 'rentcast':
      // Lazy load RentCast provider
      provider = createRentCastProvider();
      break;

    case 'csv':
      // CSV file provider
      provider = createCSVProvider();
      break;

    case 'mock':
    default:
      provider = new MockProvider();
      break;
  }

  // Cache the provider for reuse
  providerCache.set(providerType, provider);

  return provider;
}

/**
 * Clear the provider cache (useful when switching providers or resetting)
 */
export function clearProviderCache(): void {
  console.log(
    '%c[Provider Factory] Clearing provider cache',
    'color: #F59E0B; font-weight: bold'
  );
  providerCache.clear();
}

/**
 * Create Zillow Metrics provider
 */
function createZillowMetricsProvider(): IHousingDataProvider {
  const provider = new ZillowMetricsProvider();

  if (!provider.isConfigured()) {
    console.warn(
      '%c[Provider Factory] Zillow Metrics not configured',
      'color: #F59E0B; font-weight: bold',
      'Falling back to Mock provider. Add VITE_ZILLOW_METRICS_API_KEY to .env'
    );
    return new MockProvider();
  }

  return provider;
}

/**
 * Create RentCast provider
 * (Will be implemented in refactoring step)
 */
function createRentCastProvider(): IHousingDataProvider {
  console.warn(
    '%c[Provider Factory] RentCast provider not yet migrated',
    'color: #F59E0B; font-weight: bold',
    'Falling back to Mock provider'
  );

  // TODO: Implement RentCastProvider by refactoring existing code
  // For now, fall back to mock
  return new MockProvider();
}

/**
 * Create CSV provider
 */
function createCSVProvider(): IHousingDataProvider {
  const provider = new CSVProvider();

  if (!provider.isConfigured()) {
    console.warn(
      '%c[Provider Factory] CSV provider not configured',
      'color: #F59E0B; font-weight: bold',
      'No CSV file loaded. Upload a CSV file to use this provider'
    );
  }

  return provider;
}

/**
 * Get available provider types
 */
export function getAvailableProviders(): Array<{
  id: string;
  name: string;
  icon: string;
  description: string;
  status: 'available' | 'pending' | 'requires-setup';
}> {
  return [
    {
      id: 'mock',
      name: 'Mock Data',
      icon: '🎭',
      description: 'Sample data for development and testing',
      status: 'available',
    },
    {
      id: 'csv',
      name: 'CSV File',
      icon: '📊',
      description: 'Upload your own market data from a CSV file',
      status: 'available',
    },
    {
      id: 'zillow-metrics',
      name: 'Zillow Market Metrics',
      icon: '🏘️',
      description: 'Market-level statistics from national to neighborhood',
      status: 'requires-setup',
    },
    {
      id: 'rentcast',
      name: 'RentCast',
      icon: '🏠',
      description: 'Property and market data with valuations',
      status: 'pending', // Will be 'requires-setup' after implementation
    },
  ];
}
