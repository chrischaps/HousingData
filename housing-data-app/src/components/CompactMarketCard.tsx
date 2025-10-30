import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { MarketPriceData } from '../types';
import { formatPrice, formatPercentage } from '../utils/formatters';

interface CompactMarketCardProps {
  market: MarketPriceData;
  onClick: () => void;
  isSelected?: boolean;
  onAddToComparison?: (market: MarketPriceData) => void;
}

/**
 * Compact market card with mini sparkline chart for carousel display
 * Optimized for mobile horizontal scrolling (Google Finance style)
 */
export const CompactMarketCard = ({ market, onClick, isSelected = false, onAddToComparison }: CompactMarketCardProps) => {
  const isPositive = market.changeDirection === 'up';
  const arrow = isPositive ? '↑' : '↓';
  const changeColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const lineColor = isPositive ? '#10B981' : '#EF4444';

  // Prepare data for mini chart (use ALL historical data for MAX timescale)
  const chartData = market.historicalData.map(point => ({ value: point.price }));

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
        {onAddToComparison && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToComparison(market);
            }}
            className="absolute -top-1 -right-1 text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 bg-white dark:bg-slate-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-full w-5 h-5 flex items-center justify-center text-xs border border-purple-200 dark:border-purple-600 transition-all hover:scale-110 z-10"
            title="Add to comparison"
          >
            ⚖️
          </button>
        )}

        {/* Market name (truncated) */}
        <div className="text-xs font-medium text-gray-900 dark:text-white truncate mb-1">
          {market.marketName}
        </div>

        {/* Current price */}
        <div className="text-base font-bold text-gray-900 dark:text-white mb-1">
          {formatPrice(market.currentPrice)}
        </div>

        {/* Price change */}
        <div className={`text-xs font-medium ${changeColor} mb-1.5`}>
          {arrow} {formatPercentage(isPositive ? market.priceChange : -Math.abs(market.priceChange))}
        </div>

        {/* Mini sparkline chart - increased height */}
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
