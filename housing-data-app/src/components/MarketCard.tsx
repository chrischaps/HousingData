import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { MarketCardProps } from '../types';
import { formatPrice, formatPercentage } from '../utils/formatters';

export const MarketCard = ({ market, onClick, onToggleFavorite, isFavorited = false, onAddToComparison }: MarketCardProps) => {
  const isPositive = market.changeDirection === 'up';
  const arrow = isPositive ? '↑' : '↓';
  const lineColor = isPositive ? '#10B981' : '#EF4444';

  // Prepare data for sparkline chart (use ALL historical data for MAX timescale)
  const chartData = market.historicalData.map(point => ({ value: point.price }));

  // Debug logging
  console.log('[MarketCard] Rendering:', {
    marketName: market.marketName,
    changeDirection: market.changeDirection,
    isPositive,
    priceChange: market.priceChange,
    isFavorited
  });

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-4 cursor-pointer hover-lift hover:shadow-lg dark:hover:shadow-slate-900"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{market.marketName}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Single Family Home</p>
        </div>
        <div className="flex gap-2">
          {onAddToComparison && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToComparison();
              }}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 font-medium text-sm px-2 py-1 rounded transition-all hover:scale-105"
              title="Add to comparison"
            >
              ⚖️
            </button>
          )}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={
                isFavorited
                  ? 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 font-medium text-sm px-2 py-1 rounded transition-all hover:scale-105'
                  : 'text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium text-sm px-2 py-1 rounded transition-all hover:scale-105'
              }
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorited ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatPrice(market.currentPrice)}
          </p>
          {isPositive ? (
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              {arrow} {formatPercentage(market.priceChange)}
            </p>
          ) : (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {arrow} {formatPercentage(-Math.abs(market.priceChange))}
            </p>
          )}
        </div>

        {/* Sparkline chart */}
        <div className="w-24 h-12 pointer-events-none">
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
    </div>
  );
};
