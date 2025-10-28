/**
 * FavoritesPanel Component
 *
 * Displays user's favorited markets with Firestore persistence.
 * Replaces the old WatchlistPanel component.
 */

import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { useFavorites } from '../hooks/useFavorites';
import { FavoriteCard } from './FavoriteCard';
import type { MarketPriceData } from '../types';

interface FavoritesPanelProps {
  onSelectMarket: (marketId: string, marketName: string) => void;
  onAddToComparison?: (marketData: MarketPriceData) => void;
}

export const FavoritesPanel = ({ onSelectMarket, onAddToComparison }: FavoritesPanelProps) => {
  const [user] = useAuthState(auth);
  const { favorites, loading, error, removeFavorite } = useFavorites();

  const handleRemove = async (favoriteId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const confirmed = window.confirm('Remove this market from your favorites?');
    if (!confirmed) return;

    await removeFavorite(favoriteId);
  };

  // Not signed in
  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900">My Favorites</h2>
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            Sign in to save your favorite markets
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900">My Favorites</h2>
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
          <p className="text-gray-500 text-sm mt-4">Loading favorites...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900">My Favorites</h2>
        <div className="text-center py-8">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (favorites.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900">My Favorites</h2>
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            No favorites yet. Click the "Add to Favorites" button on any market card to get started!
          </p>
        </div>
      </div>
    );
  }

  // Favorites list
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">My Favorites</h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {favorites.length} {favorites.length === 1 ? 'market' : 'markets'}
        </span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {favorites.map((favorite) => (
          <FavoriteCard
            key={favorite.id}
            favoriteId={favorite.id}
            marketId={favorite.marketId}
            marketName={favorite.marketName}
            addedAt={favorite.addedAt}
            notes={favorite.notes}
            onClick={() => onSelectMarket(favorite.marketId, favorite.marketName)}
            onRemove={(e) => handleRemove(favorite.id, e)}
            onAddToComparison={onAddToComparison}
          />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Click any market to view details
        </p>
      </div>
    </div>
  );
};
