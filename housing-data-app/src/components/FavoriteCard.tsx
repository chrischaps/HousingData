import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { createProvider, getProviderType, CSVProvider } from '../services/providers';
import { transformToMarketPriceData, generateHistoricalData } from '../utils/dataTransform';
import { formatPrice, formatPercentage } from '../utils/formatters';
import type { MarketPriceData } from '../types';

interface FavoriteCardProps {
  favoriteId: string;
  marketId: string;
  marketName: string;
  addedAt: string;
  notes?: string;
  onClick: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onAddToComparison?: (marketData: MarketPriceData) => void;
}

/**
 * Card for displaying a favorite market with sparkline chart in the sidebar
 */
export const FavoriteCard = ({
  marketId,
  marketName,
  addedAt,
  notes,
  onClick,
  onRemove,
  onAddToComparison,
}: FavoriteCardProps) => {
  const [marketData, setMarketData] = useState<MarketPriceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMarketData = async () => {
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
          console.warn('[FavoriteCard] No stats found for:', marketName);
          setLoading(false);
          return;
        }

        // Transform to MarketPriceData
        const data = transformToMarketPriceData(marketId, marketName, stats);

        // Add historical data
        if (stats.historicalPrices && stats.historicalPrices.length > 0) {
          data.historicalData = stats.historicalPrices.map(h => ({
            date: h.date,
            price: h.price,
            propertyType: 'single_family' as const,
          }));
        } else {
          data.historicalData = generateHistoricalData(
            data.currentPrice,
            data.changeDirection === 'up' ? data.priceChange : -data.priceChange,
            12
          );
        }

        setMarketData(data);
        setLoading(false);
      } catch (error) {
        console.error('[FavoriteCard] Failed to load market data:', error);
        setLoading(false);
      }
    };

    loadMarketData();
  }, [marketId, marketName]);

  if (loading) {
    return (
      <div className="p-3 rounded-lg border border-gray-200 dark:border-slate-700 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
      </div>
    );
  }

  if (!marketData) {
    return (
      <div
        onClick={onClick}
        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer border border-gray-200 dark:border-slate-700 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{marketName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Data unavailable</p>
        </div>
        <button
          onClick={onRemove}
          className="ml-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Remove from favorites"
        >
          ✕
        </button>
      </div>
    );
  }

  const isPositive = marketData.changeDirection === 'up';
  const arrow = isPositive ? '↑' : '↓';
  const lineColor = isPositive ? '#10B981' : '#EF4444';
  const chartData = marketData.historicalData.map(point => ({ value: point.price }));

  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer border border-gray-200 dark:border-slate-700 transition-colors group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate text-sm">{marketName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Added {new Date(addedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 flex-shrink-0">
          {onAddToComparison && marketData && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToComparison(marketData);
              }}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 px-2 py-1 rounded transition-colors"
              title="Add to comparison"
            >
              ⚖️
            </button>
          )}
          <button
            onClick={onRemove}
            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded transition-colors"
            title="Remove from favorites"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatPrice(marketData.currentPrice)}
          </p>
          <p className={`text-xs font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {arrow} {formatPercentage(isPositive ? marketData.priceChange : -Math.abs(marketData.priceChange))}
          </p>
        </div>

        {/* Sparkline chart */}
        <div className="w-20 h-10 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {notes && (
        <p className="text-xs text-gray-600 italic mt-2 truncate">
          {notes}
        </p>
      )}
    </div>
  );
};
