import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { MarketCard } from './components/MarketCard';
import { MarketCardSkeletonGrid } from './components/MarketCardSkeleton';
import { PriceChart } from './components/PriceChart';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { MarketSearch } from './components/MarketSearch';
import { SettingsPanel } from './components/SettingsPanel';
import { FavoritesPanel } from './components/FavoritesPanel';
import { MobileHeader } from './components/MobileHeader';
import { FeaturedMarketsCarousel } from './components/FeaturedMarketsCarousel';
import { FavoritesCarousel } from './components/FavoritesCarousel';
import { BottomSearchBar } from './components/BottomSearchBar';
import { useMarketData } from './hooks/useMarketData';
import { useFavorites } from './hooks/useFavorites';
import { useIsMobile } from './hooks/useIsMobile';
import { createProvider, getProviderType, CSVProvider } from './services/providers';
import { transformToMarketPriceData, generateHistoricalData } from './utils/dataTransform';
import { formatPrice, formatPercentage } from './utils/formatters';
import type { MarketPriceData, TimeRange, Market } from './types';

// Color palette for comparison (matches PriceChart colors)
const COMPARISON_COLORS = [
  '#1E40AF', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
];

function App() {
  const { user, loading: authLoading, logout, signInWithGoogle } = useAuth();
  const [selectedMarket, setSelectedMarket] = useState<MarketPriceData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('MAX');
  const [comparisonMarkets, setComparisonMarkets] = useState<MarketPriceData[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Detect mobile screen
  const isMobile = useIsMobile();

  // Fetch market data using the custom hook
  const { data: marketData, loading: dataLoading, error } = useMarketData();

  // Favorites hook
  const { favorites, toggleFavorite, isFavorited } = useFavorites();

  // Pre-selection logic: Select first favorite (if logged in with favorites) or first featured market
  useEffect(() => {
    // Only run when data is loaded and no market is selected yet
    if (dataLoading || selectedMarket) return;

    const selectInitialMarket = async () => {
      // If user is logged in and has favorites, select first favorite
      if (user && favorites.length > 0) {
        const firstFavorite = favorites[0];

        try {
          const provider = createProvider();
          const providerType = getProviderType();

          // Wait for CSV provider to load data if needed
          if (providerType === 'csv' && provider instanceof CSVProvider) {
            await provider.waitForDataLoad();
          }

          // Get market stats from provider
          const stats = await provider.getMarketStats(firstFavorite.marketName);

          if (!stats) {
            console.warn('[App] No stats found for favorite:', firstFavorite.marketName);
            // Fallback to first featured market
            if (marketData.length > 0) {
              setSelectedMarket(marketData[0]);
            }
            return;
          }

          // Transform to MarketPriceData
          const selectedMarketData = transformToMarketPriceData(firstFavorite.marketId, firstFavorite.marketName, stats);

          // Add historical data
          if (stats.historicalPrices && stats.historicalPrices.length > 0) {
            selectedMarketData.historicalData = stats.historicalPrices.map(h => ({
              date: h.date,
              price: h.price,
              propertyType: 'single_family' as const,
            }));
          } else {
            selectedMarketData.historicalData = generateHistoricalData(
              selectedMarketData.currentPrice,
              selectedMarketData.changeDirection === 'up'
                ? selectedMarketData.priceChange
                : -selectedMarketData.priceChange,
              12
            );
          }

          console.log('[App] Pre-selected favorite market:', selectedMarketData);
          setSelectedMarket(selectedMarketData);
        } catch (error) {
          console.error('[App] Failed to load favorite market data:', error);
          // Fallback to first featured market
          if (marketData.length > 0) {
            setSelectedMarket(marketData[0]);
          }
        }
        return;
      }

      // Otherwise, select first featured market
      if (marketData.length > 0) {
        setSelectedMarket(marketData[0]);
      }
    };

    selectInitialMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, favorites.length, marketData.length, dataLoading]);

  // Show loading state while checking auth (but allow app to load)
  // We'll show auth loading in the header instead of blocking the whole app

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

  const handleToggleFavorite = async (marketId: string, marketName: string) => {
    // Prompt login if user is not authenticated
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    console.log('[App] Toggling favorite:', marketId, marketName);
    const result = await toggleFavorite(marketId, marketName);

    if (result) {
      console.log(
        `[App] Favorite ${result.action === 'added' ? 'added' : 'removed'}:`,
        marketName
      );
    }
  };

  const handleSelectFavorite = async (marketId: string, marketName: string) => {
    console.log('[App] Selected favorite from panel:', marketId, marketName);

    try {
      const provider = createProvider();
      const providerType = getProviderType();

      // Wait for CSV provider to load data if needed
      if (providerType === 'csv' && provider instanceof CSVProvider) {
        await provider.waitForDataLoad();
      }

      // Get market stats from provider
      const stats = await provider.getMarketStats(marketName);

      if (!stats) {
        console.warn('[App] No stats found for favorite:', marketName);
        return;
      }

      // Transform to MarketPriceData
      const marketData = transformToMarketPriceData(marketId, marketName, stats);

      // Add historical data
      if (stats.historicalPrices && stats.historicalPrices.length > 0) {
        marketData.historicalData = stats.historicalPrices.map(h => ({
          date: h.date,
          price: h.price,
          propertyType: 'single_family' as const,
        }));
      } else {
        marketData.historicalData = generateHistoricalData(
          marketData.currentPrice,
          marketData.changeDirection === 'up'
            ? marketData.priceChange
            : -marketData.priceChange,
          12
        );
      }

      console.log('[App] Setting selected market from favorite:', marketData);
      setSelectedMarket(marketData);
    } catch (error) {
      console.error('[App] Failed to load favorite market data:', error);
    }
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

  // Render mobile or desktop layout
  if (isMobile) {
    // MOBILE LAYOUT (Google Finance style)
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Mobile Header */}
        <MobileHeader
          user={user}
          authLoading={authLoading}
          onSignIn={() => setShowLoginModal(true)}
          onSignOut={logout}
        />

        {/* Carousel - Show Favorites if logged in with favorites, otherwise Featured Markets */}
        <div className="pt-4 pb-2">
          {user && favorites.length > 0 ? (
            <FavoritesCarousel
              favorites={favorites}
              selectedMarketId={selectedMarket?.marketId}
              onSelectMarket={handleSelectFavorite}
              onAddToComparison={handleAddToComparison}
            />
          ) : (
            <FeaturedMarketsCarousel
              markets={marketData}
              selectedMarketId={selectedMarket?.marketId}
              onSelectMarket={handleMarketClick}
              loading={dataLoading}
            />
          )}
        </div>

        {/* Main Chart Area */}
        {selectedMarket && (
          <div className="px-4 pt-2 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedMarket.marketName}
                </h2>
                <button
                  onClick={() => handleToggleFavorite(selectedMarket.marketId, selectedMarket.marketName)}
                  className={
                    isFavorited(selectedMarket.marketId)
                      ? 'text-yellow-600 hover:text-yellow-800 text-xl'
                      : 'text-blue-600 hover:text-blue-900 text-xl'
                  }
                  title={isFavorited(selectedMarket.marketId) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorited(selectedMarket.marketId) ? '★' : '☆'}
                </button>
              </div>
              <TimeRangeSelector
                selected={timeRange}
                onChange={(range) => setTimeRange(range as TimeRange)}
              />
            </div>

            {/* Current Price Display */}
            <div className="mb-4">
              <div className="text-3xl font-bold text-gray-900">
                {formatPrice(selectedMarket.currentPrice)}
              </div>
              <div className={`text-sm font-medium ${
                selectedMarket.changeDirection === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {selectedMarket.changeDirection === 'up' ? '↑' : '↓'} {formatPercentage(Math.abs(selectedMarket.priceChange))}
              </div>
            </div>

            <PriceChart
              data={selectedMarket.historicalData}
              timeRange={timeRange}
              primaryMarketName={selectedMarket.marketName}
              comparisonMarkets={comparisonMarkets.map((market, index) => ({
                marketName: market.marketName,
                data: market.historicalData,
                color: COMPARISON_COLORS[(index + 1) % COMPARISON_COLORS.length],
              }))}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600">⚠️</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-yellow-900">Data Loading Issue</p>
                <p className="text-xs text-yellow-800 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Search Bar */}
        <BottomSearchBar
          onSelectMarket={handleSelectMarket}
          onAddToComparison={handleAddToComparisonFromSearch}
        />

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative animate-fadeIn">
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h2>
                <p className="text-gray-600 mb-6">
                  Sign in to save your favorite markets and sync across devices
                </p>
                <button
                  onClick={async () => {
                    try {
                      await signInWithGoogle();
                      setShowLoginModal(false);
                    } catch (error) {
                      console.error('Login failed:', error);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </button>
                <p className="text-xs text-gray-500 mt-4">
                  No account required - sign in with your Google account
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DESKTOP LAYOUT (Original layout)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/assets/ccc-logo.png" alt="CCC Logo" className="h-8 w-auto" />
              <h1 className="text-2xl font-bold">
                <span className="text-gray-900">Market</span>{' '}
                <span className="text-blue-600">Pulse</span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {authLoading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : user ? (
                <>
                  <div className="text-sm text-gray-700">
                    {user.displayName || user.email}
                  </div>
                  <button
                    onClick={logout}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm hover:shadow-md"
                >
                  Sign In
                </button>
              )}
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
            {user && <FavoritesPanel onSelectMarket={handleSelectFavorite} onAddToComparison={handleAddToComparison} />}
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
                      onToggleFavorite={() => handleToggleFavorite(market.marketId, market.marketName)}
                      isFavorited={isFavorited(market.marketId)}
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
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                      {selectedMarket.marketName}
                      {comparisonMarkets.length > 0 && (
                        <span className="text-sm text-gray-500 ml-2">
                          vs {comparisonMarkets.length} {comparisonMarkets.length === 1 ? 'market' : 'markets'}
                        </span>
                      )}
                    </h2>
                    <button
                      onClick={() => handleToggleFavorite(selectedMarket.marketId, selectedMarket.marketName)}
                      className={
                        isFavorited(selectedMarket.marketId)
                          ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 font-medium text-lg px-3 py-1.5 rounded transition-all hover:scale-110'
                          : 'text-blue-600 hover:text-blue-900 hover:bg-blue-50 font-medium text-lg px-3 py-1.5 rounded transition-all hover:scale-110'
                      }
                      title={isFavorited(selectedMarket.marketId) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFavorited(selectedMarket.marketId) ? '★' : '☆'}
                    </button>
                  </div>
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
                  primaryMarketName={selectedMarket.marketName}
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
            Market Pulse <span className="text-gray-400">| v0.6.0</span>
          </p>
        </div>
      </footer>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative animate-fadeIn">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h2>
              <p className="text-gray-600 mb-6">
                Sign in to save your favorite markets and sync across devices
              </p>
              <button
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                    setShowLoginModal(false);
                  } catch (error) {
                    console.error('Login failed:', error);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
              <p className="text-xs text-gray-500 mt-4">
                No account required - sign in with your Google account
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
