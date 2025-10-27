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
      <div className="flex-shrink-0 w-36 h-32 rounded-lg p-3 bg-white border border-gray-200 animate-pulse">
        <div className="flex flex-col h-full">
          <div className="h-3 w-20 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-16 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 w-12 bg-gray-200 rounded mb-2"></div>
          <div className="flex-1 flex items-end gap-0.5">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-gray-200 rounded-t"
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
            ? 'bg-blue-50 border-2 border-blue-500 shadow-md'
            : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md'
          }
        `}
      >
        <div className="flex flex-col h-full justify-center items-center">
          <div className="text-xs font-medium text-gray-500">{marketName}</div>
          <div className="text-xs text-gray-400 mt-1">No data</div>
        </div>
      </button>
    );
  }

  const isPositive = marketData.changeDirection === 'up';
  const arrow = isPositive ? '↑' : '↓';
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
  const lineColor = isPositive ? '#10B981' : '#EF4444';
  const chartData = marketData.historicalData.map(point => ({ value: point.price }));

  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0 w-36 h-32 rounded-lg p-3 cursor-pointer transition-all
        ${isSelected
          ? 'bg-blue-50 border-2 border-blue-500 shadow-md'
          : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md'
        }
      `}
    >
      <div className="flex flex-col h-full">
        {/* Market name (truncated) + Star indicator */}
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-medium text-gray-900 truncate flex-1">
            {marketName}
          </div>
          <span className="text-yellow-600 text-sm ml-1 flex-shrink-0">★</span>
        </div>

        {/* Current price */}
        <div className="text-base font-bold text-gray-900 mb-1">
          {formatPrice(marketData.currentPrice)}
        </div>

        {/* Price change */}
        <div className={`text-xs font-medium ${changeColor} mb-1.5`}>
          {arrow} {formatPercentage(Math.abs(marketData.priceChange))}
        </div>

        {/* Mini sparkline chart */}
        <div className="flex-1 -mx-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </button>
  );
};
