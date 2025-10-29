/**
 * CSV Parser Utility
 *
 * Parses CSV files containing housing market data.
 * Expected CSV format:
 * - Headers: city, state, zipCode, medianPrice, averagePrice, percentChange, lastUpdatedDate
 * - Optional fields: minPrice, maxPrice, averagePricePerSquareFoot, etc.
 */

import type { MarketStats } from '../services/providers/types';

/**
 * Detect CSV format type
 */
function detectCSVFormat(headers: string[]): 'simple' | 'zillow-zhvi' {
  // Check for Zillow ZHVI format
  // Zillow format has: RegionID, SizeRank, RegionName, RegionType, StateName, State, Metro, CountyName, [dates...]
  const hasRegionID = headers.includes('regionid');
  const hasRegionName = headers.includes('regionname');
  const hasStateName = headers.includes('statename');

  // Check if there are date columns (format: YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const hasDateColumns = headers.some(h => datePattern.test(h));

  if (hasRegionID && hasRegionName && hasStateName && hasDateColumns) {
    return 'zillow-zhvi';
  }

  return 'simple';
}

/**
 * Parse Zillow ZORI time-series CSV format (rental data)
 * Format: RegionID, SizeRank, RegionName, RegionType, StateName, State, Metro, CountyName, [dates...]
 * Returns rental data that can be merged with ZHVI home value data
 */
function parseZillowZORI(lines: string[], headers: string[]): Map<string, { currentRent: number; rentChange: number; historicalRentals: Array<{ date: string; rent: number }> }> {
  const rentalData = new Map<string, { currentRent: number; rentChange: number; historicalRentals: Array<{ date: string; rent: number }> }>();

  // Find column indices
  const regionIDIdx = headers.indexOf('regionid');
  const regionNameIdx = headers.indexOf('regionname');
  const stateIdx = headers.indexOf('state');

  // Find all date columns (YYYY-MM-DD format)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const dateColumns: { index: number; date: string }[] = [];

  headers.forEach((header, index) => {
    if (datePattern.test(header)) {
      dateColumns.push({ index, date: header });
    }
  });

  // Sort date columns by date (most recent last)
  dateColumns.sort((a, b) => a.date.localeCompare(b.date));

  console.log(
    '%c[CSV Parser] Zillow ZORI format detected',
    'color: #F97316',
    {
      dateColumns: dateColumns.length,
      dateRange: `${dateColumns[0]?.date} to ${dateColumns[dateColumns.length - 1]?.date}`,
      totalRows: lines.length - 1,
    }
  );

  // Parse each row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    if (values.length < headers.length) {
      continue;
    }

    try {
      const _regionID = values[regionIDIdx]; // Prefix with _ to indicate intentionally unused
      const city = values[regionNameIdx];
      const state = values[stateIdx];

      if (!city || !state) {
        continue;
      }

      // Get the most recent non-empty ZORI value and previous value for percent change
      let currentRent: number | undefined;
      let previousRent: number | undefined;

      // Iterate from most recent to oldest
      for (let j = dateColumns.length - 1; j >= 0; j--) {
        const dateCol = dateColumns[j];
        const value = values[dateCol.index];

        if (value && value.trim() !== '') {
          const numValue = parseFloat(value);

          if (!isNaN(numValue)) {
            if (currentRent === undefined) {
              currentRent = numValue;
            } else if (previousRent === undefined) {
              previousRent = numValue;
              break;
            }
          }
        }
      }

      if (currentRent === undefined) {
        continue;
      }

      // Suppress unused variable warning
      void _regionID;

      // Calculate percent change
      let rentChange = 0;
      if (previousRent !== undefined && previousRent > 0) {
        rentChange = ((currentRent - previousRent) / previousRent) * 100;
      }

      // Extract ALL historical rental prices
      const historicalRentals: Array<{ date: string; rent: number }> = [];

      for (let j = 0; j < dateColumns.length; j++) {
        const dateCol = dateColumns[j];
        const value = parseFloat(values[dateCol.index]);

        if (!isNaN(value) && value > 0) {
          historicalRentals.push({
            date: dateCol.date,
            rent: Math.round(value),
          });
        }
      }

      // Use both regionID and city-state as keys for matching
      const marketKey = `${city}, ${state}`.toLowerCase();
      rentalData.set(marketKey, {
        currentRent: Math.round(currentRent),
        rentChange,
        historicalRentals,
      });

      console.log(
        `%c[CSV Parser] ZORI: ${city}, ${state} - $${Math.round(currentRent)}/mo (${rentChange.toFixed(1)}%)`,
        'color: #F97316; font-size: 10px'
      );
    } catch (error) {
      console.error(
        `%c[CSV Parser] Failed to parse Zillow ZORI row ${i}`,
        'color: #EF4444',
        error
      );
    }
  }

  console.log(
    '%c[CSV Parser] ✓ Successfully parsed Zillow ZORI data',
    'color: #10B981; font-weight: bold',
    { markets: rentalData.size }
  );

  return rentalData;
}

/**
 * Parse Zillow ZHVI time-series CSV format
 * Format: RegionID, SizeRank, RegionName, RegionType, StateName, State, Metro, CountyName, [dates...]
 */
function parseZillowZHVI(lines: string[], headers: string[]): MarketStats[] {
  const markets: MarketStats[] = [];

  // Find column indices
  const regionIDIdx = headers.indexOf('regionid');
  const regionNameIdx = headers.indexOf('regionname');
  const stateIdx = headers.indexOf('state');

  // Find all date columns (YYYY-MM-DD format)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const dateColumns: { index: number; date: string }[] = [];

  headers.forEach((header, index) => {
    if (datePattern.test(header)) {
      dateColumns.push({ index, date: header });
    }
  });

  // Sort date columns by date (most recent last)
  dateColumns.sort((a, b) => a.date.localeCompare(b.date));

  console.log(
    '%c[CSV Parser] Zillow ZHVI format detected',
    'color: #8B5CF6',
    {
      dateColumns: dateColumns.length,
      dateRange: `${dateColumns[0]?.date} to ${dateColumns[dateColumns.length - 1]?.date}`,
      totalRows: lines.length - 1,
    }
  );

  console.log(
    '%c[CSV Parser] Processing all markets from CSV',
    'color: #8B5CF6',
    { totalMarkets: lines.length - 1 }
  );

  // Parse each row (all rows, not just first 20)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    if (values.length < headers.length) {
      console.warn(
        `%c[CSV Parser] Row ${i} has ${values.length} values but expected ${headers.length}`,
        'color: #F59E0B'
      );
      continue;
    }

    try {
      const regionID = values[regionIDIdx];
      const city = values[regionNameIdx];
      const state = values[stateIdx];

      if (!city || !state) {
        continue;
      }

      // Get the most recent non-empty ZHVI value and previous value for percent change
      let currentValue: number | undefined;
      let previousValue: number | undefined;
      let lastUpdatedDate: string | undefined;

      // Iterate from most recent to oldest
      for (let j = dateColumns.length - 1; j >= 0; j--) {
        const dateCol = dateColumns[j];
        const value = values[dateCol.index];

        if (value && value.trim() !== '') {
          const numValue = parseFloat(value);

          if (!isNaN(numValue)) {
            if (currentValue === undefined) {
              currentValue = numValue;
              lastUpdatedDate = dateCol.date;
            } else if (previousValue === undefined) {
              previousValue = numValue;
              break; // We have both values now
            }
          }
        }
      }

      if (currentValue === undefined) {
        console.warn(
          `%c[CSV Parser] No valid ZHVI data for ${city}, ${state}`,
          'color: #F59E0B'
        );
        continue;
      }

      // Calculate percent change
      let percentChange = 0;
      if (previousValue !== undefined && previousValue > 0) {
        percentChange = ((currentValue - previousValue) / previousValue) * 100;
      }

      // Calculate statistics from time series (last 12 months if available)
      const recentValues: number[] = [];
      for (let j = dateColumns.length - 1; j >= Math.max(0, dateColumns.length - 12); j--) {
        const value = parseFloat(values[dateColumns[j].index]);
        if (!isNaN(value)) {
          recentValues.push(value);
        }
      }

      const minPrice = recentValues.length > 0 ? Math.min(...recentValues) : currentValue;
      const maxPrice = recentValues.length > 0 ? Math.max(...recentValues) : currentValue;
      const avgPrice =
        recentValues.length > 0
          ? recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length
          : currentValue;

      // Extract ALL historical prices for charts (supports 1M, 6M, 1Y, 5Y, MAX)
      // The chart component will filter based on selected time range
      const historicalPrices: Array<{ date: string; price: number }> = [];

      for (let j = 0; j < dateColumns.length; j++) {
        const dateCol = dateColumns[j];
        const value = parseFloat(values[dateCol.index]);

        if (!isNaN(value) && value > 0) {
          historicalPrices.push({
            date: dateCol.date,
            price: Math.round(value),
          });
        }
      }

      console.log(
        `%c[CSV Parser] Extracted ${historicalPrices.length} historical data points for ${city}`,
        'color: #8B5CF6; font-size: 10px'
      );

      markets.push({
        id: regionID || `${city}-${state}`,
        city,
        state,
        zipCode: undefined,
        saleData: {
          lastUpdatedDate: lastUpdatedDate || new Date().toISOString(),
          medianPrice: Math.round(currentValue),
          averagePrice: Math.round(avgPrice),
          minPrice: Math.round(minPrice),
          maxPrice: Math.round(maxPrice),
        },
        percentChange,
        historicalPrices,
      });
    } catch (error) {
      console.error(
        `%c[CSV Parser] Failed to parse Zillow ZHVI row ${i}`,
        'color: #EF4444',
        error
      );
    }
  }

  console.log(
    '%c[CSV Parser] ✓ Successfully parsed Zillow ZHVI data',
    'color: #10B981; font-weight: bold',
    { markets: markets.length }
  );

  return markets;
}

/**
 * Parse CSV text content into MarketStats array
 */
export function parseCSV(csvContent: string): MarketStats[] {
  const lines = csvContent.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  console.log(
    '%c[CSV Parser] Parsing CSV file',
    'color: #8B5CF6; font-weight: bold',
    { rows: lines.length - 1, headers: headers.slice(0, 10) }
  );

  // Detect format
  const format = detectCSVFormat(headers);

  console.log(
    '%c[CSV Parser] Detected format',
    'color: #8B5CF6; font-weight: bold',
    { format }
  );

  if (format === 'zillow-zhvi') {
    return parseZillowZHVI(lines, headers);
  }

  // Validate required headers for simple format
  const requiredHeaders = ['city', 'state'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

  if (missingHeaders.length > 0) {
    throw new Error(`CSV missing required headers: ${missingHeaders.join(', ')}`);
  }

  // Parse data rows
  const markets: MarketStats[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);

    if (values.length !== headers.length) {
      console.warn(
        `%c[CSV Parser] Row ${i} has ${values.length} values but expected ${headers.length}`,
        'color: #F59E0B'
      );
      continue;
    }

    // Create object from headers and values
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    // Transform to MarketStats
    try {
      const marketStats = transformRowToMarketStats(row, i);
      markets.push(marketStats);
    } catch (error) {
      console.error(
        `%c[CSV Parser] Failed to parse row ${i}`,
        'color: #EF4444',
        { row, error }
      );
    }
  }

  console.log(
    '%c[CSV Parser] ✓ Successfully parsed CSV',
    'color: #10B981; font-weight: bold',
    { markets: markets.length }
  );

  return markets;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Add the last value
  values.push(currentValue.trim());

  return values;
}

/**
 * Transform a CSV row object to MarketStats
 */
function transformRowToMarketStats(row: Record<string, string>, rowIndex: number): MarketStats {
  const city = row.city || '';
  const state = row.state || '';
  const zipCode = row.zipcode || row.zip_code || row.zip || undefined;

  if (!city || !state) {
    throw new Error(`Row ${rowIndex}: city and state are required`);
  }

  // Parse numeric values with defaults
  const medianPrice = parseNumber(row.medianprice || row.median_price);
  const averagePrice = parseNumber(row.averageprice || row.average_price);
  const minPrice = parseNumber(row.minprice || row.min_price);
  const maxPrice = parseNumber(row.maxprice || row.max_price);
  const percentChange = parseNumber(row.percentchange || row.percent_change || row.change);

  const averagePricePerSquareFoot = parseNumber(
    row.averagepricepersquarefoot || row.average_price_per_sqft || row.price_per_sqft
  );
  const medianPricePerSquareFoot = parseNumber(
    row.medianpricepersquarefoot || row.median_price_per_sqft
  );
  const averageSquareFootage = parseNumber(
    row.averagesquarefootage || row.average_sqft || row.sqft
  );
  const medianSquareFootage = parseNumber(
    row.mediansquarefootage || row.median_sqft
  );
  const averageDaysOnMarket = parseNumber(
    row.averagedaysonmarket || row.average_dom || row.dom
  );
  const medianDaysOnMarket = parseNumber(
    row.mediandaysonmarket || row.median_dom
  );

  // Parse date
  const lastUpdatedDate = row.lastupdateddate || row.last_updated || row.date || new Date().toISOString();

  return {
    id: zipCode || `${city}-${state}`,
    city,
    state,
    zipCode,
    saleData: {
      lastUpdatedDate,
      medianPrice,
      averagePrice,
      minPrice,
      maxPrice,
      averagePricePerSquareFoot,
      medianPricePerSquareFoot,
      averageSquareFootage,
      medianSquareFootage,
      averageDaysOnMarket,
      medianDaysOnMarket,
    },
    percentChange,
  };
}

/**
 * Parse a string to number, return undefined if invalid
 */
function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;

  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);

  return isNaN(num) ? undefined : num;
}

/**
 * Validate CSV content before parsing
 */
export function validateCSVContent(csvContent: string): { valid: boolean; error?: string } {
  if (!csvContent || csvContent.trim().length === 0) {
    return { valid: false, error: 'CSV file is empty' };
  }

  const lines = csvContent.trim().split('\n');

  if (lines.length < 2) {
    return { valid: false, error: 'CSV must contain at least a header row and one data row' };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  // Detect format
  const format = detectCSVFormat(headers);

  if (format === 'zillow-zhvi') {
    // Validate Zillow ZHVI format
    const requiredHeaders = ['regionid', 'regionname', 'statename', 'state'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return {
        valid: false,
        error: `Missing required Zillow ZHVI columns: ${missingHeaders.join(', ')}`
      };
    }

    // Check for at least one date column
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const hasDateColumns = headers.some(h => datePattern.test(h));

    if (!hasDateColumns) {
      return {
        valid: false,
        error: 'Zillow ZHVI file must contain date columns (YYYY-MM-DD format)'
      };
    }
  } else {
    // Validate simple format
    const requiredHeaders = ['city', 'state'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return {
        valid: false,
        error: `Missing required columns: ${missingHeaders.join(', ')}`
      };
    }
  }

  return { valid: true };
}

/**
 * Parse rental CSV (ZORI format) and return rental data by market
 */
export function parseRentalCSV(csvContent: string): Map<string, { currentRent: number; rentChange: number; historicalRentals: Array<{ date: string; rent: number }> }> {
  const lines = csvContent.trim().split('\n');

  if (lines.length < 2) {
    console.warn('[CSV Parser] ZORI file is empty or invalid');
    return new Map();
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  return parseZillowZORI(lines, headers);
}

/**
 * Merge rental data into home value markets
 */
export function mergeRentalData(
  markets: MarketStats[],
  rentalData: Map<string, { currentRent: number; rentChange: number; historicalRentals: Array<{ date: string; rent: number }> }>
): MarketStats[] {
  console.log(
    '%c[CSV Parser] Merging rental data with home value data',
    'color: #8B5CF6; font-weight: bold',
    { totalMarkets: markets.length, rentalMarkets: rentalData.size }
  );

  let mergedCount = 0;

  const mergedMarkets = markets.map(market => {
    const marketKey = `${market.city}, ${market.state}`.toLowerCase();
    const rental = rentalData.get(marketKey);

    if (rental) {
      mergedCount++;
      return {
        ...market,
        rentalData: {
          lastUpdatedDate: market.saleData?.lastUpdatedDate || new Date().toISOString(),
          medianRent: rental.currentRent,
          averageRent: rental.currentRent,
        },
        rentChange: rental.rentChange,
        historicalRentals: rental.historicalRentals,
      };
    }

    return market;
  });

  console.log(
    '%c[CSV Parser] ✓ Merged rental data',
    'color: #10B981; font-weight: bold',
    {
      totalMarkets: markets.length,
      marketsWithRentals: mergedCount,
      percentage: `${((mergedCount / markets.length) * 100).toFixed(1)}%`
    }
  );

  return mergedMarkets;
}

/**
 * Generate sample CSV content for download
 */
export function generateSampleCSV(): string {
  return `city,state,zipCode,medianPrice,averagePrice,minPrice,maxPrice,percentChange,lastUpdatedDate
Detroit,MI,48201,225000,235000,180000,320000,5.2,2025-10-21
Anaheim,CA,92805,875000,920000,650000,1200000,-2.1,2025-10-21
Austin,TX,78701,550000,580000,420000,750000,8.7,2025-10-21
Miami,FL,33101,625000,650000,480000,850000,3.4,2025-10-21
Seattle,WA,98101,825000,860000,680000,1100000,-1.8,2025-10-21`;
}
