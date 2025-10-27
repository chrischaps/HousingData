import type { PriceDataPoint, TimeRange } from '../types';

/**
 * Filter historical data by time range
 * This is a helper function for components that already have historical data
 * and just need to filter it by time range
 */
export const filterDataByTimeRange = (
  data: PriceDataPoint[],
  timeRange: TimeRange
): PriceDataPoint[] => {
  if (!data || data.length === 0) {
    return [];
  }

  // For MAX, return all data
  if (timeRange === 'MAX') {
    return data;
  }

  // Use the most recent date in the data as the reference point
  // (not current system date, since data might be historical)
  const mostRecentDate = new Date(
    Math.max(...data.map(point => new Date(point.date).getTime()))
  );

  const cutoffDate = new Date(mostRecentDate);

  switch (timeRange) {
    case '1M':
      cutoffDate.setMonth(mostRecentDate.getMonth() - 1);
      break;
    case '6M':
      cutoffDate.setMonth(mostRecentDate.getMonth() - 6);
      break;
    case '1Y':
      cutoffDate.setFullYear(mostRecentDate.getFullYear() - 1);
      break;
    case '5Y':
      cutoffDate.setFullYear(mostRecentDate.getFullYear() - 5);
      break;
  }

  return data.filter((point) => new Date(point.date) >= cutoffDate);
};
