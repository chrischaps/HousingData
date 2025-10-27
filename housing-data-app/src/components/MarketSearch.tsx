import { useState } from 'react';
import type { MarketSearchProps } from '../types';
import { useMarketSearch } from '../hooks/useMarketSearch';

export const MarketSearch = ({ onSelectMarket, onAddToComparison }: MarketSearchProps) => {
  const [query, setQuery] = useState('');
  const { results, loading, error, totalCount, search, clearResults } = useMarketSearch();

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (value.length >= 2) {
      search(value);
    } else {
      clearResults();
    }
  };

  const handleSelectMarket = (market: any) => {
    onSelectMarket(market);
    setQuery('');
    clearResults();
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Search Markets</h2>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search by city or ZIP code..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute top-12 left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
            <p className="text-sm text-gray-500">Searching...</p>
          </div>
        )}

        {/* Error message */}
        {error && !loading && (
          <div className="absolute top-12 left-0 right-0 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-3">
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        )}

        {/* Search results */}
        {results.length > 0 && !loading && (
          <div className="absolute top-12 left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
            {totalCount > results.length && (
              <div className="sticky top-0 bg-blue-50 border-b border-blue-200 px-3 py-2 text-xs text-blue-800">
                Showing {results.length} of {totalCount} results
              </div>
            )}
            {results.map((market) => (
              <div
                key={market.id}
                onClick={() => handleSelectMarket(market)}
                className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 flex items-start justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{market.name}</p>
                  <p className="text-sm text-gray-500">
                    {market.city}, {market.state}
                    {market.zipCode && ` • ${market.zipCode}`}
                  </p>
                </div>
                {onAddToComparison && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToComparison(market);
                    }}
                    className="text-purple-600 hover:text-purple-900 hover:bg-purple-50 font-medium text-sm px-2 py-1 rounded transition-all hover:scale-105 flex-shrink-0"
                    title="Add to comparison"
                  >
                    ⚖️
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No results message */}
        {query.length >= 2 && results.length === 0 && !loading && !error && (
          <div className="absolute top-12 left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
            <p className="text-sm text-gray-500">No markets found</p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Try searching for cities like "Detroit" or ZIP codes like "48201"
      </p>
    </div>
  );
};
