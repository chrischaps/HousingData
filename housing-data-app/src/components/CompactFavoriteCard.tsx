import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { createProvider, getProviderType, CSVProvider } from '../services/providers';
import { transformToMarketPriceData, generateHistoricalData } from '../utils/dataTransform';
import { formatPrice, formatPercentage } from '../utils/formatters';
import type { MarketPriceData } from '../types';

interface CompactFavoriteCardProps {
  marketId: string;
  marketName: string;
  onClick: () => void;
  isSelected?: boolean;
  onAddToComparison?: (marketData: MarketPriceData) => void;
}

/**
 * Compact favorite card with sparkline for mobile carousel
 * Loads market data on mount, similar to FavoriteCard but compact like CompactMarketCard
 */
export const CompactFavoriteCard = ({
  marketId,
  marketName,
  onClick,
  isSelected = false,
  onAddToComparison,
}: CompactFavoriteCardProps) => {
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
          console.warn('[CompactFavoriteCard] No stats found for:', marketName);
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
        console.error('[CompactFavoriteCard] Failed to load market data:', error);
        setLoading(false);
      }
    };

    loadMarketData();
  }, [marketId, marketName]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex-shrink-0 w-36 h-32 rounded-lg p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 animate-pulse">
        <div className="flex flex-col h-full">
          <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded mb-2"></div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded mb-2"></div>
          <div className="h-3 w-12 bg-gray-200 dark:bg-slate-700 rounded mb-2"></div>
          <div className="flex-1 flex items-end gap-0.5">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-t"
                style={{ height: `${Math.random() * 60 + 40}%` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No data fallback
  if (!marketData) {
    return (
      <button
        onClick={onClick}
        className={`
          flex-shrink-0 w-36 h-32 rounded-lg p-3 cursor-pointer transition-all
          ${isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400 shadow-md'
            : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md'
          }
        `}
      >
        <div className="flex flex-col h-full justify-center items-center">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{marketName}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">No data</div>
        </div>
      </button>
    );
  }

  const isPositive = marketData.changeDirection === 'up';
  const arrow = isPositive ? '↑' : '↓';
  const changeColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const lineColor = isPositive ? '#10B981' : '#EF4444';
  const chartData = marketData.historicalData.map(point => ({ value: point.price }));

  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0 w-36 h-32 rounded-lg p-3 cursor-pointer transition-all
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400 shadow-md'
          : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md'
        }
      `}
    >
      <div className="flex flex-col h-full relative">
        {/* Comparison button - top right corner */}
        {onAddToComparison && marketData && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToComparison(marketData);
            }}
            className="absolute -top-1 -right-1 text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 bg-white dark:bg-slate-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-full w-5 h-5 flex items-center justify-center text-xs border border-purple-200 dark:border-purple-600 transition-all hover:scale-110 z-10"
            title="Add to comparison"
          >
            ⚖️
          </button>
        )}

        {/* Market name (truncated) + Star indicator */}
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-medium text-gray-900 dark:text-white truncate flex-1">
            {marketName}
          </div>
          <span className="text-yellow-600 dark:text-yellow-400 text-sm ml-1 flex-shrink-0">★</span>
        </div>

        {/* Current price */}
        <div className="text-base font-bold text-gray-900 dark:text-white mb-1">
          {formatPrice(marketData.currentPrice)}
        </div>

        {/* Price change */}
        <div className={`text-xs font-medium ${changeColor} mb-1.5`}>
          {arrow} {formatPercentage(isPositive ? marketData.priceChange : -Math.abs(marketData.priceChange))}
        </div>

        {/* Mini sparkline chart */}
        <div className="flex-1 -mx-1 min-h-0 pointer-events-none">
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
    </button>
  );
};
