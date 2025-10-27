/**
 * Housing Data Providers
 *
 * Export all provider-related types, classes, and utilities.
 */

// Types and interfaces
export type {
  IHousingDataProvider,
  MarketStats,
  Property,
  ProviderInfo,
  RateLimits,
  ProviderConfig,
} from './types';

// Base provider class
export { BaseProvider } from './base.provider';

// Provider implementations
export { MockProvider } from './mock.provider';
export { ZillowMetricsProvider } from './zillow-metrics.provider';
export { CSVProvider } from './csv.provider';

// Provider factory
export { createProvider, getProviderType, getAvailableProviders, clearProviderCache } from './factory';
