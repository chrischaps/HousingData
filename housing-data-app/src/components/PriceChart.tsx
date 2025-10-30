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
import { useTheme } from '../contexts/ThemeContext';

// Color palette for comparison markets
const COMPARISON_COLORS = [
  '#1E40AF', // Primary blue - Home values
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber - Rentals
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

export const PriceChart = ({
  data,
  timeRange,
  primaryMarketName,
  comparisonMarkets = [],
  rentalData,
  showRentalOverlay = false
}: PriceChartProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();

  // Filter data based on time range
  const filteredData = filterDataByTimeRange(data, timeRange);

  // Filter rental data if present
  const filteredRentalData = useMemo(() => {
    if (!rentalData || rentalData.length === 0) return [];

    // Apply same time range filtering to rental data
    const now = new Date();
    let cutoffDate: Date | null = null;

    switch (timeRange) {
      case '1M':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '6M':
        cutoffDate = new Date(now);
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case '5Y':
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 5);
        break;
      case 'MAX':
      default:
        return rentalData;
    }

    return rentalData.filter(point => new Date(point.date) >= cutoffDate!);
  }, [rentalData, timeRange]);

  // Merge comparison market data and rental data
  const mergedData = useMemo(() => {
    // Always transform data to have "primary" field for consistency
    const dateMap = new Map<string, any>();

    // Add primary market data (home values)
    filteredData.forEach(point => {
      dateMap.set(point.date, { date: point.date, primary: point.price });
    });

    // Add rental data if present and overlay is enabled
    if (showRentalOverlay && filteredRentalData && filteredRentalData.length > 0) {
      filteredRentalData.forEach(point => {
        const existing = dateMap.get(point.date) || { date: point.date };
        existing.rental = point.rent;
        dateMap.set(point.date, existing);
      });
    }

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
  }, [filteredData, filteredRentalData, comparisonMarkets, timeRange, showRentalOverlay]);

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
      <div className="w-full h-96 bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">No historical data available</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
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
        <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{formatDate(payload[0].payload.date)}</p>
          {payload.map((entry: any, index: number) => {
            const isRental = entry.dataKey === 'rental';
            const displayValue = isRental
              ? `$${entry.value.toLocaleString()}/mo`
              : formatPrice(entry.value);

            return (
              <div key={index} className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.stroke }}
                />
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {entry.name}: {displayValue}
                </p>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const hasComparisons = comparisonMarkets && comparisonMarkets.length > 0;
  const hasRentalOverlay = showRentalOverlay && filteredRentalData && filteredRentalData.length > 0;

  return (
    <div className="w-full h-72 sm:h-80 md:h-96 bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-3 sm:p-4 md:p-6 animate-fadeIn outline-none" tabIndex={-1}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={mergedData}
          margin={{ top: 5, right: hasRentalOverlay ? 15 : 10, left: 0, bottom: (hasComparisons || hasRentalOverlay) ? 25 : 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#E5E7EB'} />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => formatDate(date)}
            stroke={theme === 'dark' ? '#94a3b8' : '#6B7280'}
            style={{ fontSize: '12px' }}
          />

          {/* Left Y-axis for home values */}
          <YAxis
            yAxisId="left"
            tickFormatter={(price) => formatPriceShort(price)}
            stroke={COMPARISON_COLORS[0]}
            style={{ fontSize: '12px' }}
            label={hasRentalOverlay ? { value: 'Home Value', angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: COMPARISON_COLORS[0] } } : undefined}
          />

          {/* Right Y-axis for rental prices */}
          {hasRentalOverlay && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(rent) => `$${(rent / 1000).toFixed(1)}k`}
              stroke={COMPARISON_COLORS[3]}
              style={{ fontSize: '12px' }}
              label={{ value: 'Monthly Rent', angle: 90, position: 'insideRight', style: { fontSize: '12px', fill: COMPARISON_COLORS[3] } }}
            />
          )}

          <Tooltip content={<CustomTooltip />} />
          {(hasComparisons || hasRentalOverlay) && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="line"
            />
          )}

          {/* Primary market line (home values) */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="primary"
            name={primaryMarketName ? `${primaryMarketName} Home Values` : "Home Values"}
            stroke={COMPARISON_COLORS[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />

          {/* Rental data line */}
          {hasRentalOverlay && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="rental"
              name={primaryMarketName ? `${primaryMarketName} Rent` : "Rent"}
              stroke={COMPARISON_COLORS[3]}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 6 }}
            />
          )}

          {/* Comparison market lines */}
          {comparisonMarkets.map((market, index) => (
            <Line
              yAxisId="left"
              key={index}
              type="monotone"
              dataKey={`market${index}`}
              name={`${market.marketName} Home Values`}
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
