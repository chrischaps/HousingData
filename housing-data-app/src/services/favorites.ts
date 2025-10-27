/**
 * Firestore Favorites Service
 *
 * Manages user favorites (markets) with Firestore persistence.
 * Replaces the old localStorage-based watchlist system.
 */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { FavoriteMarket } from '../types';

const FAVORITES_COLLECTION = 'favorites';

/**
 * Add a market to user's favorites
 */
export const addFavorite = async (
  userId: string,
  marketId: string,
  marketName: string,
  notes?: string
): Promise<FavoriteMarket> => {
  try {
    console.log(
      '%c[Favorites] Adding favorite',
      'color: #8B5CF6; font-weight: bold',
      { userId, marketId, marketName }
    );

    const favoriteData = {
      userId,
      marketId,
      marketName,
      notes: notes || '',
      addedAt: new Date().toISOString(),
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, FAVORITES_COLLECTION), favoriteData);

    console.log(
      '%c[Favorites] ✓ Added successfully',
      'color: #10B981; font-weight: bold',
      { id: docRef.id }
    );

    return {
      id: docRef.id,
      userId,
      marketId,
      marketName,
      notes: notes || '',
      addedAt: favoriteData.addedAt,
    };
  } catch (error) {
    console.error(
      '%c[Favorites] ✗ Failed to add favorite',
      'color: #EF4444; font-weight: bold',
      error
    );
    throw new Error('Failed to add favorite');
  }
};

/**
 * Remove a favorite by document ID
 */
export const removeFavorite = async (favoriteId: string): Promise<void> => {
  try {
    console.log(
      '%c[Favorites] Removing favorite',
      'color: #F59E0B; font-weight: bold',
      { favoriteId }
    );

    await deleteDoc(doc(db, FAVORITES_COLLECTION, favoriteId));

    console.log(
      '%c[Favorites] ✓ Removed successfully',
      'color: #10B981; font-weight: bold'
    );
  } catch (error) {
    console.error(
      '%c[Favorites] ✗ Failed to remove favorite',
      'color: #EF4444; font-weight: bold',
      error
    );
    throw new Error('Failed to remove favorite');
  }
};

/**
 * Get all favorites for a user
 */
export const getUserFavorites = async (userId: string): Promise<FavoriteMarket[]> => {
  try {
    console.log(
      '%c[Favorites] Fetching user favorites',
      'color: #6366F1; font-weight: bold',
      { userId }
    );

    const q = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    const favorites: FavoriteMarket[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as DocumentData;
      favorites.push({
        id: doc.id,
        userId: data.userId,
        marketId: data.marketId,
        marketName: data.marketName,
        notes: data.notes || '',
        addedAt: data.addedAt,
      });
    });

    // Sort client-side by addedAt (most recent first)
    favorites.sort((a, b) => {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    console.log(
      '%c[Favorites] ✓ Fetched successfully',
      'color: #10B981; font-weight: bold',
      { count: favorites.length }
    );

    return favorites;
  } catch (error) {
    console.error(
      '%c[Favorites] ✗ Failed to fetch favorites',
      'color: #EF4444; font-weight: bold',
      error
    );
    throw new Error('Failed to fetch favorites');
  }
};

/**
 * Check if a market is in user's favorites
 */
export const isFavorite = async (userId: string, marketId: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', userId),
      where('marketId', '==', marketId)
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('[Favorites] Failed to check favorite status', error);
    return false;
  }
};

/**
 * Get favorite document ID for a market (if exists)
 */
export const getFavoriteId = async (
  userId: string,
  marketId: string
): Promise<string | null> => {
  try {
    const q = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', userId),
      where('marketId', '==', marketId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    return querySnapshot.docs[0].id;
  } catch (error) {
    console.error('[Favorites] Failed to get favorite ID', error);
    return null;
  }
};

/**
 * Toggle favorite status (add if not favorite, remove if favorite)
 */
export const toggleFavorite = async (
  userId: string,
  marketId: string,
  marketName: string
): Promise<{ action: 'added' | 'removed'; favorite?: FavoriteMarket }> => {
  try {
    const existingId = await getFavoriteId(userId, marketId);

    if (existingId) {
      // Remove existing favorite
      await removeFavorite(existingId);
      return { action: 'removed' };
    } else {
      // Add new favorite
      const favorite = await addFavorite(userId, marketId, marketName);
      return { action: 'added', favorite };
    }
  } catch (error) {
    console.error('[Favorites] Failed to toggle favorite', error);
    throw error;
  }
};
