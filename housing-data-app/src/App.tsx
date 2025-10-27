import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { MarketCard } from './components/MarketCard';
import { MarketCardSkeletonGrid } from './components/MarketCardSkeleton';
import { PriceChart } from './components/PriceChart';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { MarketSearch } from './components/MarketSearch';
import { SettingsPanel } from './components/SettingsPanel';
import { ApiStatusIndicator } from './components/ApiStatusIndicator';
import { useMarketData } from './hooks/useMarketData';
import { createProvider, getProviderType, CSVProvider } from './services/providers';
import { transformToMarketPriceData, generateHistoricalData } from './utils/dataTransform';
import type { MarketPriceData, TimeRange, Market } from './types';

// Color palette for comparison (matches PriceChart colors)
const COMPARISON_COLORS = [
  '#1E40AF', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
];

function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const [selectedMarket, setSelectedMarket] = useState<MarketPriceData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [comparisonMarkets, setComparisonMarkets] = useState<MarketPriceData[]>([]);

  // Fetch market data using the custom hook
  const { data: marketData, loading: dataLoading, error } = useMarketData();

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-blue-600 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  const handleMarketClick = (market: MarketPriceData) => {
    setSelectedMarket(market);
  };

  const handleSelectMarket = async (market: Market) => {
    console.log('[App] Selected market from search:', market);

    try {
      const provider = createProvider();
      const providerType = getProviderType();

      // Wait for CSV provider to load data if needed
      if (providerType === 'csv' && provider instanceof CSVProvider) {
        console.log('[App] Waiting for CSV provider to load data...');
        await provider.waitForDataLoad();
      }

      // Get market stats from provider
      const location = `${market.city}, ${market.state}`;
      const stats = await provider.getMarketStats(location);

      if (!stats) {
        console.warn('[App] No stats found for market:', location);
        return;
      }

      // Transform to MarketPriceData
      const marketId = market.id;
      const marketName = market.name;
      const marketData = transformToMarketPriceData(marketId, marketName, stats);

      // Add historical data
      if (stats.historicalPrices && stats.historicalPrices.length > 0) {
        marketData.historicalData = stats.historicalPrices.map(h => ({
          date: h.date,
          price: h.price,
          propertyType: 'single_family' as const,
        }));
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

      console.log('[App] Setting selected market:', marketData);
      setSelectedMarket(marketData);
    } catch (error) {
      console.error('[App] Failed to load market data:', error);
    }
  };

  const handleAddToWatchlist = () => {
    console.log('Add to watchlist clicked');
  };

  const handleAddToComparison = (market: MarketPriceData) => {
    // Don't add if already in comparison or is the selected market
    if (selectedMarket && market.marketId === selectedMarket.marketId) {
      alert('This is already the primary market being displayed');
      return;
    }

    if (comparisonMarkets.some(m => m.marketId === market.marketId)) {
      alert('This market is already in the comparison');
      return;
    }

    if (comparisonMarkets.length >= 5) {
      alert('Maximum of 5 comparison markets allowed');
      return;
    }

    console.log('[App] Adding market to comparison:', market.marketName);
    setComparisonMarkets([...comparisonMarkets, market]);
  };

  const handleRemoveFromComparison = (marketId: string) => {
    console.log('[App] Removing market from comparison:', marketId);
    setComparisonMarkets(comparisonMarkets.filter(m => m.marketId !== marketId));
  };

  const handleClearComparison = () => {
    console.log('[App] Clearing all comparison markets');
    setComparisonMarkets([]);
  };

  const handleAddToComparisonFromSearch = async (market: Market) => {
    console.log('[App] Adding market to comparison from search:', market);

    // Don't add if already in comparison or is the selected market
    if (selectedMarket && market.id === selectedMarket.marketId) {
      alert('This is already the primary market being displayed');
      return;
    }

    if (comparisonMarkets.some(m => m.marketId === market.id)) {
      alert('This market is already in the comparison');
      return;
    }

    if (comparisonMarkets.length >= 5) {
      alert('Maximum of 5 comparison markets allowed');
      return;
    }

    try {
      const provider = createProvider();
      const providerType = getProviderType();

      // Wait for CSV provider to load data if needed
      if (providerType === 'csv' && provider instanceof CSVProvider) {
        await provider.waitForDataLoad();
      }

      // Get market stats from provider
      const location = `${market.city}, ${market.state}`;
      const stats = await provider.getMarketStats(location);

      if (!stats) {
        console.warn('[App] No stats found for market:', location);
        alert(`Could not load data for ${market.name}`);
        return;
      }

      // Transform to MarketPriceData
      const marketId = market.id;
      const marketName = market.name;
      const marketData = transformToMarketPriceData(marketId, marketName, stats);

      // Add historical data
      if (stats.historicalPrices && stats.historicalPrices.length > 0) {
        marketData.historicalData = stats.historicalPrices.map(h => ({
          date: h.date,
          price: h.price,
          propertyType: 'single_family' as const,
        }));
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

      console.log('[App] Adding market to comparison:', marketData.marketName);
      setComparisonMarkets([...comparisonMarkets, marketData]);
    } catch (error) {
      console.error('[App] Failed to load market data for comparison:', error);
      alert(`Failed to load data for ${market.name}`);
    }
  };

  // Main application for authenticated users
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Housing Market Data
              </h1>
              <ApiStatusIndicator hasError={!!error} dataSource="mock" />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-700">
                {user.displayName || user.email}
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-4 sm:space-y-6">
            <MarketSearch
              onSelectMarket={handleSelectMarket}
              onAddToComparison={handleAddToComparisonFromSearch}
            />
            <SettingsPanel onDataChange={() => window.location.reload()} />
          </aside>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 animate-slideIn">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-600 text-xl flex-shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      Data Loading Issue
                    </p>
                    <p className="text-sm text-yellow-800">
                      {error}
                    </p>
                    <p className="text-xs text-yellow-700 mt-2">
                      Showing sample data for demonstration.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Market Cards Grid */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Featured Markets
              </h2>

              {/* Loading State */}
              {dataLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MarketCardSkeletonGrid count={6} />
                </div>
              )}

              {/* Market Data */}
              {!dataLoading && marketData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-animation">
                  {marketData.map((market) => (
                    <MarketCard
                      key={market.marketId}
                      market={market}
                      onClick={() => handleMarketClick(market)}
                      onAddToWatchlist={handleAddToWatchlist}
                      onAddToComparison={() => handleAddToComparison(market)}
                    />
                  ))}
                </div>
              )}

              {/* No Data State */}
              {!dataLoading && marketData.length === 0 && (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-500">No market data available</p>
                </div>
              )}
            </section>

            {/* Chart Section */}
            {selectedMarket && (
              <section className="space-y-3 sm:space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    {selectedMarket.marketName}
                    {comparisonMarkets.length > 0 && (
                      <span className="text-sm text-gray-500 ml-2">
                        vs {comparisonMarkets.length} {comparisonMarkets.length === 1 ? 'market' : 'markets'}
                      </span>
                    )}
                  </h2>
                  <TimeRangeSelector
                    selected={timeRange}
                    onChange={(range) => setTimeRange(range as TimeRange)}
                  />
                </div>

                {/* Comparison Panel */}
                {comparisonMarkets.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-purple-900">
                            ⚖️ Comparing with:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {comparisonMarkets.map((market, index) => (
                            <div
                              key={market.marketId}
                              className="inline-flex items-center gap-2 bg-white border border-purple-200 rounded px-2 py-1"
                            >
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COMPARISON_COLORS[(index + 1) % COMPARISON_COLORS.length] }}
                              />
                              <span className="text-sm text-gray-900">{market.marketName}</span>
                              <button
                                onClick={() => handleRemoveFromComparison(market.marketId)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove from comparison"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={handleClearComparison}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium whitespace-nowrap"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                )}

                <PriceChart
                  data={selectedMarket.historicalData}
                  timeRange={timeRange}
                  comparisonMarkets={comparisonMarkets.map((market, index) => ({
                    marketName: market.marketName,
                    data: market.historicalData,
                    color: COMPARISON_COLORS[(index + 1) % COMPARISON_COLORS.length],
                  }))}
                />
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Housing Market Data - Production Application <span className="text-gray-400">| v0.5.3</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
