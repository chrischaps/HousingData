import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PriceChartProps } from '../types';
import { formatPriceShort, formatDate, formatPrice } from '../utils/formatters';
import { filterDataByTimeRange } from '../hooks/useHistoricalPrices';

// Color palette for comparison markets
const COMPARISON_COLORS = [
  '#1E40AF', // Primary blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
];

/**
 * Chart loading skeleton
 */
const ChartSkeleton = () => {
  return (
    <div className="w-full h-96 bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="flex flex-col h-full justify-between">
        {/* Y-axis skeleton */}
        <div className="flex justify-between items-end h-full">
          <div className="flex flex-col justify-between h-full py-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 w-12 bg-gray-200 rounded"></div>
            ))}
          </div>
          {/* Chart area skeleton */}
          <div className="flex-1 ml-4 h-full flex items-end gap-2">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-gray-200 rounded-t"
                style={{ height: `${Math.random() * 60 + 40}%` }}
              ></div>
            ))}
          </div>
        </div>
        {/* X-axis skeleton */}
        <div className="flex justify-between mt-4 px-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 w-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PriceChart = ({ data, timeRange, comparisonMarkets = [] }: PriceChartProps) => {
  const [isLoading, setIsLoading] = useState(true);

  // Filter data based on time range
  const filteredData = filterDataByTimeRange(data, timeRange);

  // Merge comparison market data
  const mergedData = useMemo(() => {
    // Always transform data to have "primary" field for consistency
    const dateMap = new Map<string, any>();

    // Add primary market data
    filteredData.forEach(point => {
      dateMap.set(point.date, { date: point.date, primary: point.price });
    });

    // Add comparison market data if present
    if (comparisonMarkets && comparisonMarkets.length > 0) {
      comparisonMarkets.forEach((market, index) => {
        const filtered = filterDataByTimeRange(market.data, timeRange);
        filtered.forEach(point => {
          const existing = dateMap.get(point.date) || { date: point.date };
          existing[`market${index}`] = point.price;
          dateMap.set(point.date, existing);
        });
      });
    }

    // Convert map to array and sort by date
    return Array.from(dateMap.values()).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [filteredData, comparisonMarkets, timeRange]);

  // Simulate loading state when data/timeRange changes
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [data, timeRange, comparisonMarkets]);

  // Show loading skeleton
  if (isLoading) {
    return <ChartSkeleton />;
  }

  // If no data, show placeholder
  if (!mergedData || mergedData.length === 0) {
    return (
      <div className="w-full h-96 bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-500">No historical data available</p>
            <p className="text-gray-400 text-sm mt-2">
              Select a different time range or market
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
          <p className="text-xs text-gray-500 mb-2">{formatDate(payload[0].payload.date)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.stroke }}
              />
              <p className="text-sm font-medium text-gray-900">
                {entry.name}: {formatPrice(entry.value)}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const hasComparisons = comparisonMarkets && comparisonMarkets.length > 0;

  return (
    <div className="w-full h-72 sm:h-80 md:h-96 bg-white rounded-lg shadow p-3 sm:p-4 md:p-6 animate-fadeIn">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={mergedData}
          margin={{ top: 5, right: 10, left: 0, bottom: hasComparisons ? 25 : 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => formatDate(date)}
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            tickFormatter={(price) => formatPriceShort(price)}
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {hasComparisons && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="line"
            />
          )}

          {/* Primary market line */}
          <Line
            type="monotone"
            dataKey="primary"
            name="Primary"
            stroke={COMPARISON_COLORS[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />

          {/* Comparison market lines */}
          {comparisonMarkets.map((market, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={`market${index}`}
              name={market.marketName}
              stroke={market.color || COMPARISON_COLORS[(index + 1) % COMPARISON_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
