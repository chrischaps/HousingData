import { useState, useEffect } from 'react';
import type { MarketPriceData } from '../types';
import { createProvider, getProviderType, CSVProvider } from '../services/providers';
import {
  transformToMarketPriceData,
  generateHistoricalData,
  validateMarketData,
} from '../utils/dataTransform';
import { MOCK_MARKETS } from '../utils/constants';

interface UseMarketDataResult {
  data: MarketPriceData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  forceRefresh: () => void;
}

/**
 * Mock data generator for when API is not available
 */
const generateMockMarketData = (): MarketPriceData[] => {
  return [
    {
      marketId: '1',
      marketName: 'New York, NY',
      currentPrice: 725000,
      priceChange: 3.8,
      changeDirection: 'up',
      historicalData: generateHistoricalData(725000, 3.8, 12),
      lastUpdated: new Date().toISOString(),
    },
    {
      marketId: '2',
      marketName: 'Los Angeles, CA',
      currentPrice: 875000,
      priceChange: 2.1,
      changeDirection: 'up',
      historicalData: generateHistoricalData(875000, 2.1, 12),
      lastUpdated: new Date().toISOString(),
    },
    {
      marketId: '3',
      marketName: 'Austin, TX',
      currentPrice: 550000,
      priceChange: 8.7,
      changeDirection: 'up',
      historicalData: generateHistoricalData(550000, 8.7, 12),
      lastUpdated: new Date().toISOString(),
    },
    {
      marketId: '4',
      marketName: 'Columbus, OH',
      currentPrice: 325000,
      priceChange: 4.5,
      changeDirection: 'up',
      historicalData: generateHistoricalData(325000, 4.5, 12),
      lastUpdated: new Date().toISOString(),
    },
    {
      marketId: '5',
      marketName: 'Houston, TX',
      currentPrice: 375000,
      priceChange: 6.2,
      changeDirection: 'up',
      historicalData: generateHistoricalData(375000, 6.2, 12),
      lastUpdated: new Date().toISOString(),
    },
    {
      marketId: '6',
      marketName: 'San Antonio, TX',
      currentPrice: 295000,
      priceChange: 5.9,
      changeDirection: 'up',
      historicalData: generateHistoricalData(295000, 5.9, 12),
      lastUpdated: new Date().toISOString(),
    },
  ];
};

/**
 * Fetch market data for a single location using the provider pattern
 */
const fetchMarketData = async (
  city: string,
  state: string,
  zipCode?: string,
  forceRefresh: boolean = false
): Promise<MarketPriceData | null> => {
  try {
    const location = zipCode || `${city}, ${state}`;
    const provider = createProvider();
    const stats = await provider.getMarketStats(location, forceRefresh);

    if (!stats) {
      return null;
    }

    const marketId = zipCode || `${city}-${state}`;
    const marketName = `${city}, ${state}`;

    const marketData = transformToMarketPriceData(marketId, marketName, stats);

    // Generate historical data
    marketData.historicalData = generateHistoricalData(
      marketData.currentPrice,
      marketData.changeDirection === 'up'
        ? marketData.priceChange
        : -marketData.priceChange,
      12
    );

    return validateMarketData(marketData) ? marketData : null;
  } catch (error) {
    console.error(`Failed to fetch data for ${city}, ${state}:`, error);
    return null;
  }
};

/**
 * Custom hook to fetch market data for multiple markets
 * Falls back to mock data if API is not configured or fails
 */
export const useMarketData = (): UseMarketDataResult => {
  const [data, setData] = useState<MarketPriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);

    const providerType = getProviderType();
    const provider = createProvider();

    console.log(
      `%c[useMarketData] ${forceRefresh ? 'Force refreshing' : 'Fetching'} market data via provider`,
      'color: #1E40AF; font-weight: bold',
      { forceRefresh, providerType }
    );

    try {
      // For CSV provider, get markets directly from the loaded data
      if (providerType === 'csv' && provider instanceof CSVProvider) {
        // Wait for data to finish loading from IndexedDB
        await provider.waitForDataLoad();

        const allMarkets = provider.getAllMarkets();

        if (allMarkets.length === 0) {
          console.warn(
            '%c[useMarketData] CSV provider has no markets - Falling back to MOCK DATA',
            'color: #F59E0B; font-weight: bold'
          );
          setData(generateMockMarketData());
          setLoading(false);
          return;
        }

        // Featured cities to display (matching MOCK_MARKETS)
        const featuredCities = [
          { city: 'New York', state: 'NY' },
          { city: 'Los Angeles', state: 'CA' },
          { city: 'Austin', state: 'TX' },
          { city: 'Columbus', state: 'OH' },
          { city: 'Houston', state: 'TX' },
          { city: 'San Antonio', state: 'TX' },
        ];

        // Filter for featured cities only
        const marketsToShow = featuredCities
          .map(({ city, state }) =>
            allMarkets.find(market =>
              market.city === city && market.state === state
            )
          )
          .filter((market): market is NonNullable<typeof market> => market !== undefined);

        console.log(
          '%c[useMarketData] Loading markets from CSV',
          'color: #8B5CF6; font-weight: bold',
          {
            total: allMarkets.length,
            requested: featuredCities.length,
            found: marketsToShow.length,
            markets: marketsToShow.map(m => `${m.city}, ${m.state}`)
          }
        );

        // Transform to MarketPriceData
        const transformedMarkets = marketsToShow.map(stats => {
          const marketId = stats.id || `${stats.city}-${stats.state}`;
          const marketName = `${stats.city}, ${stats.state}`;
          const marketData = transformToMarketPriceData(marketId, marketName, stats);

          // Use real historical data if available, otherwise generate
          if (stats.historicalPrices && stats.historicalPrices.length > 0) {
            marketData.historicalData = stats.historicalPrices.map(h => ({
              date: h.date,
              price: h.price,
              propertyType: 'single_family' as const,
            }));

            console.log(
              `%c[useMarketData] ${marketName} historical data`,
              'color: #10B981',
              {
                dataPoints: marketData.historicalData.length,
                dateRange: `${marketData.historicalData[0]?.date} to ${marketData.historicalData[marketData.historicalData.length - 1]?.date}`
              }
            );
          } else {
            // Generate historical data as fallback
            marketData.historicalData = generateHistoricalData(
              marketData.currentPrice,
              marketData.changeDirection === 'up'
                ? marketData.priceChange
                : -marketData.priceChange,
              12
            );
          }

          return marketData;
        }).filter(m => validateMarketData(m));

        setData(transformedMarkets);
        setLoading(false);
        return;
      }

      // For other providers, fetch specific markets
      const promises = MOCK_MARKETS.map((market) =>
        fetchMarketData(market.city, market.state, market.zipCode, forceRefresh)
      );

      const results = await Promise.all(promises);

      // Filter out null results and use valid data
      const validData = results.filter(
        (result): result is MarketPriceData => result !== null
      );

      console.log(
        `%c[useMarketData] API Response Summary`,
        'color: #1E40AF; font-weight: bold',
        {
          requested: MOCK_MARKETS.length,
          received: validData.length,
          markets: validData.map(m => ({ name: m.marketName, price: m.currentPrice }))
        }
      );

      if (validData.length === 0) {
        console.warn(
          '%c[useMarketData] No valid API data - Falling back to MOCK DATA',
          'color: #F59E0B; font-weight: bold'
        );
        setData(generateMockMarketData());
      } else {
        // If we got some data but not all, fill in with mock data
        if (validData.length < MOCK_MARKETS.length) {
          console.warn(
            `%c[useMarketData] Partial API data - Using ${validData.length} real + ${MOCK_MARKETS.length - validData.length} mock`,
            'color: #F59E0B; font-weight: bold'
          );
          const mockData = generateMockMarketData();
          const combined = [...validData];

          // Add mock data for missing markets
          for (let i = validData.length; i < MOCK_MARKETS.length; i++) {
            combined.push(mockData[i]);
          }

          setData(combined);
        } else {
          console.log(
            '%c[useMarketData] ✓ Successfully loaded REAL API data',
            'color: #10B981; font-weight: bold; font-size: 14px'
          );
          setData(validData);
        }
      }
    } catch (err) {
      console.error('Error fetching market data:', err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load market data. Showing sample data.');
      }

      // Fall back to mock data on error
      setData(generateMockMarketData());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(false),
    forceRefresh: () => fetchData(true),
  };
};
