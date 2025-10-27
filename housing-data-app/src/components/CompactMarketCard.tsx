import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { MarketPriceData } from '../types';
import { formatPrice, formatPercentage } from '../utils/formatters';

interface CompactMarketCardProps {
  market: MarketPriceData;
  onClick: () => void;
  isSelected?: boolean;
}

/**
 * Compact market card with mini sparkline chart for carousel display
 * Optimized for mobile horizontal scrolling (Google Finance style)
 */
export const CompactMarketCard = ({ market, onClick, isSelected = false }: CompactMarketCardProps) => {
  const isPositive = market.changeDirection === 'up';
  const arrow = isPositive ? '↑' : '↓';
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
  const lineColor = isPositive ? '#10B981' : '#EF4444';

  // Prepare data for mini chart (use last 30 data points for sparkline)
  const chartData = market.historicalData
    .slice(-30)
    .map(point => ({ value: point.price }));

  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0 w-36 h-28 rounded-lg p-3 cursor-pointer transition-all
        ${isSelected
          ? 'bg-blue-50 border-2 border-blue-500 shadow-md'
          : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md'
        }
      `}
    >
      <div className="flex flex-col h-full">
        {/* Market name (truncated) */}
        <div className="text-xs font-medium text-gray-900 truncate mb-1">
          {market.marketName}
        </div>

        {/* Current price */}
        <div className="text-base font-bold text-gray-900 mb-1">
          {formatPrice(market.currentPrice)}
        </div>

        {/* Price change */}
        <div className={`text-xs font-medium ${changeColor} mb-2`}>
          {arrow} {formatPercentage(Math.abs(market.priceChange))}
        </div>

        {/* Mini sparkline chart */}
        <div className="flex-1 -mx-1">
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
