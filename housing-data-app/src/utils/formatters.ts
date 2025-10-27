/**
 * Format a price number as currency
 * @param price - The price to format
 * @returns Formatted price string (e.g., "$450,000")
 */
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

/**
 * Format a price for chart Y-axis (abbreviated)
 * @param price - The price to format
 * @returns Abbreviated price string (e.g., "$450K")
 */
export const formatPriceShort = (price: number): string => {
  if (price >= 1_000_000) {
    return `$${(price / 1_000_000).toFixed(1)}M`;
  }
  return `$${(price / 1_000).toFixed(0)}K`;
};

/**
 * Format a date string for display
 * @param dateString - ISO date string
 * @returns Formatted date (e.g., "Jan 2023")
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Format a percentage change
 * @param change - The percentage change
 * @returns Formatted percentage (e.g., "+5.2%" or "-3.1%")
 */
export const formatPercentage = (change: number): string => {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
};

/**
 * Calculate percentage change between two values
 * @param oldValue - Original value
 * @param newValue - New value
 * @returns Percentage change
 */
export const calculatePercentageChange = (
  oldValue: number,
  newValue: number
): number => {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
};
