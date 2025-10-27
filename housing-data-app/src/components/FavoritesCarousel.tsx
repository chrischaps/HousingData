import { useRef } from 'react';
import type { FavoriteMarket } from '../types';
import { CompactFavoriteCard } from './CompactFavoriteCard';

interface FavoritesCarouselProps {
  favorites: FavoriteMarket[];
  selectedMarketId?: string;
  onSelectMarket: (marketId: string, marketName: string) => void;
}

/**
 * Horizontal scrolling carousel of user's favorite markets (mobile only)
 * Replaces FeaturedMarketsCarousel when user is logged in and has favorites
 */
export const FavoritesCarousel = ({
  favorites,
  selectedMarketId,
  onSelectMarket,
}: FavoritesCarouselProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      const currentScroll = scrollContainerRef.current.scrollLeft;
      const targetScroll = direction === 'left'
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;

      scrollContainerRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">My Favorites</h2>
          <span className="text-yellow-600 text-lg">★</span>
        </div>

        {/* Scroll buttons - hidden on mobile, shown on larger screens */}
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-full bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-full bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Carousel container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto px-4 pb-3 snap-x snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {favorites.length > 0 ? (
          favorites.map((favorite) => (
            <div key={favorite.id} className="snap-start">
              <CompactFavoriteCard
                marketId={favorite.marketId}
                marketName={favorite.marketName}
                onClick={() => onSelectMarket(favorite.marketId, favorite.marketName)}
                isSelected={favorite.marketId === selectedMarketId}
              />
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center py-8 text-gray-500 text-sm">
            No favorites yet
          </div>
        )}
      </div>

      {/* CSS to hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
