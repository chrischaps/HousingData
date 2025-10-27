import type { Market, MarketPriceData, PriceDataPoint } from '../types';

/**
 * Transform RentCast property data to Market type
 */
export const transformToMarket = (property: any): Market => {
  const city = property.city || property.addressCity || 'Unknown';
  const state = property.state || property.addressState || '';
  const zipCode = property.zipCode || property.addressZipCode || '';

  return {
    id: property.id || `${city}-${state}-${zipCode}`,
    name: `${city}, ${state}`,
    city,
    state,
    zipCode,
  };
};

/**
 * Transform RentCast market stats to MarketPriceData
 */
export const transformToMarketPriceData = (
  marketId: string,
  marketName: string,
  stats: any
): MarketPriceData => {
  // Handle both old format (direct properties) and new format (nested saleData)
  const saleData = stats.saleData || stats;
  const currentPrice = saleData.medianPrice || saleData.averagePrice || 0;

  // Calculate price change from min/max if percentChange not provided
  let priceChange = stats.percentChange || 0;
  if (!priceChange && saleData.minPrice && saleData.maxPrice) {
    // Estimate change as % difference from median
    const range = saleData.maxPrice - saleData.minPrice;
    priceChange = (range / currentPrice) * 100;
  }
  // Default to small positive change for realistic mock
  if (!priceChange) {
    priceChange = 3.5;
  }

  return {
    marketId,
    marketName,
    currentPrice,
    priceChange: Math.abs(priceChange),
    changeDirection: priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'neutral',
    historicalData: [],
    lastUpdated: saleData.lastUpdatedDate || new Date().toISOString(),
  };
};

/**
 * Generate mock historical data for a market
 * This is used when real historical data is not available from the API
 * @param currentPrice - Current market price
 * @param priceChange - Recent price change percentage
 * @param months - Number of months to generate (default 12)
 */
export const generateHistoricalData = (
  currentPrice: number,
  priceChange: number,
  months: number = 12
): PriceDataPoint[] => {
  const data: PriceDataPoint[] = [];
  const now = new Date();

  // Calculate starting price based on current price and trend
  const monthlyChangeRate = priceChange / 12; // Approximate monthly change
  let price = currentPrice / (1 + priceChange / 100); // Approximate starting price

  for (let i = months; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);

    // Add some randomness to make it look realistic
    const randomVariation = (Math.random() - 0.5) * 0.02; // ±1% random variation
    const trendedPrice = price * (1 + (monthlyChangeRate / 100) * (months - i));
    const finalPrice = trendedPrice * (1 + randomVariation);

    data.push({
      date: date.toISOString().split('T')[0], // YYYY-MM-DD format
      price: Math.round(finalPrice),
      propertyType: 'single_family',
    });
  }

  return data;
};

/**
 * Generate extended historical data for different time ranges
 * @param currentPrice - Current market price
 * @param priceChange - Recent price change percentage
 * @param range - Time range ('1M', '6M', '1Y', '5Y', 'MAX')
 */
export const generateHistoricalDataForRange = (
  currentPrice: number,
  priceChange: number,
  range: '1M' | '6M' | '1Y' | '5Y' | 'MAX'
): PriceDataPoint[] => {
  const monthsMap = {
    '1M': 1,
    '6M': 6,
    '1Y': 12,
    '5Y': 60,
    'MAX': 120, // 10 years
  };

  const months = monthsMap[range];
  return generateHistoricalData(currentPrice, priceChange, months);
};

/**
 * Aggregate properties to calculate market statistics
 * Used when we have individual property data but not market-level stats
 */
export const aggregatePropertiesToMarketData = (
  properties: any[],
  marketName: string
): MarketPriceData | null => {
  if (!properties || properties.length === 0) {
    return null;
  }

  // Calculate median price
  const prices = properties
    .map((p) => p.price)
    .filter((p) => p && p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return null;
  }

  const medianPrice = prices[Math.floor(prices.length / 2)];

  // For POC, we'll use a mock price change
  // In a real implementation, we'd compare with historical data
  const mockPriceChange = (Math.random() - 0.5) * 10; // Random ±5%

  return {
    marketId: `market-${marketName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
    marketName,
    currentPrice: Math.round(medianPrice),
    priceChange: Math.abs(mockPriceChange),
    changeDirection: mockPriceChange > 0 ? 'up' : mockPriceChange < 0 ? 'down' : 'neutral',
    historicalData: generateHistoricalData(medianPrice, mockPriceChange, 12),
    lastUpdated: new Date().toISOString(),
  };
};

/**
 * Deduplicate markets by combining similar locations
 */
export const deduplicateMarkets = (markets: Market[]): Market[] => {
  const seen = new Set<string>();
  return markets.filter((market) => {
    const key = `${market.city}-${market.state}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * Validate that market data is complete and reasonable
 */
export const validateMarketData = (data: MarketPriceData): boolean => {
  return (
    Boolean(data.marketId) &&
    Boolean(data.marketName) &&
    data.currentPrice > 0 &&
    data.currentPrice < 100_000_000 && // Sanity check
    Math.abs(data.priceChange) < 100 && // Price change shouldn't exceed 100%
    ['up', 'down', 'neutral'].includes(data.changeDirection)
  );
};
