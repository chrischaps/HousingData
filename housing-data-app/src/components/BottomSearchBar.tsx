import { useState } from 'react';
import type { Market } from '../types';
import { useMarketSearch } from '../hooks/useMarketSearch';

interface BottomSearchBarProps {
  onSelectMarket: (market: Market) => void;
  onAddToComparison?: (market: Market) => void;
}

/**
 * Fixed bottom search bar for mobile (Google Finance style)
 * Opens modal with search results when tapped
 */
export const BottomSearchBar = ({ onSelectMarket, onAddToComparison }: BottomSearchBarProps) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
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

  const handleSelectMarket = (market: Market) => {
    onSelectMarket(market);
    setQuery('');
    clearResults();
    setShowSearchModal(false);
  };

  const handleAddToComparison = (market: Market) => {
    if (onAddToComparison) {
      onAddToComparison(market);
    }
  };

  return (
    <>
      {/* Fixed bottom search button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <button
          onClick={() => setShowSearchModal(true)}
          className="w-full px-4 py-3 bg-gray-100 rounded-full text-left text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-3"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search markets...</span>
        </button>
      </div>

      {/* Full-screen search modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fadeIn">
          {/* Modal header */}
          <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
            <button
              onClick={() => {
                setShowSearchModal(false);
                setQuery('');
                clearResults();
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search by city or ZIP code..."
              className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Modal content */}
          <div className="flex-1 overflow-y-auto">
            {/* Loading state */}
            {loading && (
              <div className="p-4 text-center text-gray-500">
                Searching...
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                <p className="text-sm text-yellow-800">{error}</p>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && !loading && (
              <div>
                {totalCount > results.length && (
                  <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800">
                    Showing {results.length} of {totalCount} results
                  </div>
                )}
                {results.map((market) => (
                  <div
                    key={market.id}
                    className="p-4 border-b border-gray-200 active:bg-gray-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        onClick={() => handleSelectMarket(market)}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
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
                            handleAddToComparison(market);
                          }}
                          className="text-purple-600 hover:text-purple-900 hover:bg-purple-50 font-medium text-sm px-3 py-2 rounded transition-all"
                          title="Add to comparison"
                        >
                          ⚖️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {query.length >= 2 && results.length === 0 && !loading && !error && (
              <div className="p-8 text-center text-gray-500">
                No markets found for "{query}"
              </div>
            )}

            {/* Empty state */}
            {query.length < 2 && (
              <div className="p-8 text-center text-gray-500">
                <p className="mb-2">Search for markets by city or ZIP code</p>
                <p className="text-sm">Try "Detroit" or "48201"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
