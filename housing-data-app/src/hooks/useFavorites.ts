/**
 * useFavorites Hook
 *
 * Custom hook for managing user favorites with Firestore.
 * Provides real-time updates using Firestore listeners.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, onSnapshot, type DocumentData } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  addFavorite,
  removeFavorite,
  toggleFavorite,
} from '../services/favorites';
import type { FavoriteMarket } from '../types';

const FAVORITES_COLLECTION = 'favorites';

export const useFavorites = () => {
  const [user, authLoading] = useAuthState(auth);
  const [favorites, setFavorites] = useState<FavoriteMarket[]>([]);
  const [favoritesInitialized, setFavoritesInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Combined loading state:
  // - true if auth is loading
  // - true if user exists AND favorites haven't been fetched yet
  // Key: We only care about favoritesInitialized when there IS a user
  const loading = authLoading || (!!user && !favoritesInitialized);


  /**
   * Set up real-time listener for favorites
   */
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      // Don't set favoritesInitialized to true - keep it false so loading state works correctly
      return;
    }

    console.log(
      '%c[useFavorites] Setting up real-time listener',
      'color: #6366F1; font-weight: bold',
      { userId: user.uid }
    );

    // Mark as not initialized until first callback
    setFavoritesInitialized(false);
    setError(null);

    // Create query for user's favorites
    const q = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', user.uid)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const userFavorites: FavoriteMarket[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data() as DocumentData;
          userFavorites.push({
            id: doc.id,
            userId: data.userId,
            marketId: data.marketId,
            marketName: data.marketName,
            notes: data.notes || '',
            addedAt: data.addedAt,
          });
        });

        // Sort client-side by addedAt (most recent first)
        userFavorites.sort((a, b) => {
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        });

        console.log(
          '%c[useFavorites] ✓ Real-time update received',
          'color: #10B981; font-weight: bold',
          { count: userFavorites.length }
        );

        setFavorites(userFavorites);
        setFavoritesInitialized(true);
      },
      (err) => {
        console.error(
          '%c[useFavorites] ✗ Real-time listener error',
          'color: #EF4444; font-weight: bold',
          err
        );
        setError('Failed to load favorites');
        setFavoritesInitialized(true);
      }
    );

    // Cleanup listener on unmount or user change
    return () => {
      console.log(
        '%c[useFavorites] Cleaning up real-time listener',
        'color: #F59E0B'
      );
      unsubscribe();
    };
  }, [user]);

  /**
   * Add a market to favorites
   */
  const handleAddFavorite = useCallback(
    async (marketId: string, marketName: string, notes?: string) => {
      if (!user) {
        setError('You must be signed in to add favorites');
        return null;
      }

      try {
        setError(null);
        const favorite = await addFavorite(user.uid, marketId, marketName, notes);
        // Real-time listener will automatically update the state
        return favorite;
      } catch (err) {
        console.error('[useFavorites] Failed to add favorite', err);
        setError('Failed to add favorite');
        return null;
      }
    },
    [user]
  );

  /**
   * Remove a favorite by document ID
   */
  const handleRemoveFavorite = useCallback(async (favoriteId: string) => {
    try {
      setError(null);
      await removeFavorite(favoriteId);
      // Real-time listener will automatically update the state
    } catch (err) {
      console.error('[useFavorites] Failed to remove favorite', err);
      setError('Failed to remove favorite');
    }
  }, []);

  /**
   * Toggle favorite status
   */
  const handleToggleFavorite = useCallback(
    async (marketId: string, marketName: string) => {
      if (!user) {
        setError('You must be signed in to manage favorites');
        return null;
      }

      try {
        setError(null);
        const result = await toggleFavorite(user.uid, marketId, marketName);
        // Real-time listener will automatically update the state
        return result;
      } catch (err) {
        console.error('[useFavorites] Failed to toggle favorite', err);
        setError('Failed to update favorite');
        return null;
      }
    },
    [user]
  );

  /**
   * Check if a market is favorited
   */
  const isFavorited = useCallback(
    (marketId: string): boolean => {
      return favorites.some((f) => f.marketId === marketId);
    },
    [favorites]
  );

  /**
   * Get favorite ID for a market
   */
  const getFavoriteIdForMarket = useCallback(
    (marketId: string): string | null => {
      const favorite = favorites.find((f) => f.marketId === marketId);
      return favorite?.id || null;
    },
    [favorites]
  );

  return {
    favorites,
    loading,
    error,
    addFavorite: handleAddFavorite,
    removeFavorite: handleRemoveFavorite,
    toggleFavorite: handleToggleFavorite,
    isFavorited,
    getFavoriteId: getFavoriteIdForMarket,
  };
};
