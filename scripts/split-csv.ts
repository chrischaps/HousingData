import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface ZillowRow {
  RegionID: string;
  RegionName: string;
  State: string;
  [date: string]: string; // Dynamic date columns
}

interface SplitStats {
  marketsProcessed: number;
  filesCreated: number;
  errors: string[];
}

/**
 * Normalize market name to create safe filename
 */
const normalizeMarketName = (regionName: string, state: string): string => {
  return `${regionName}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Split Zillow CSV file into individual market files
 */
const splitZillowCSV = async (
  inputPath: string,
  outputDir: string,
  type: 'zhvi' | 'zori'
): Promise<SplitStats> => {
  console.log(`\n📊 Splitting ${type.toUpperCase()} file: ${inputPath}`);

  const stats: SplitStats = {
    marketsProcessed: 0,
    filesCreated: 0,
    errors: []
  };

  try {
    // Read and parse CSV
    const content = fs.readFileSync(inputPath, 'utf-8');
    const rows: ZillowRow[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true
    });

    console.log(`   Found ${rows.length} markets to process`);

    // Create output directory
    const dir = path.join(outputDir, type);
    fs.mkdirSync(dir, { recursive: true });

    // Process each market
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (i % 100 === 0 && i > 0) {
        console.log(`   Progress: ${i}/${rows.length} markets (${((i / rows.length) * 100).toFixed(1)}%)`);
      }

      try {
        const marketKey = normalizeMarketName(row.RegionName, row.State);
        const fileName = `${marketKey}.csv`;
        const filePath = path.join(dir, fileName);

        // Create CSV content for this market
        const headers = Object.keys(row);
        const values = Object.values(row);
        const csvContent = headers.join(',') + '\n' + values.join(',');

        // Write file
        fs.writeFileSync(filePath, csvContent, 'utf-8');

        stats.marketsProcessed++;
        stats.filesCreated++;
      } catch (error) {
        const err = error as Error;
        stats.errors.push(`Market ${row.RegionID} (${row.RegionName}): ${err.message}`);
      }
    }

    console.log(`   ✅ Split complete! Created ${stats.filesCreated} files`);
  } catch (error) {
    console.error(`   ❌ Failed to split CSV:`, error);
    throw error;
  }

  return stats;
};

/**
 * Main runner
 */
const runSplitter = async () => {
  console.log('🚀 Starting CSV Splitter');
  console.log('=========================\n');

  const startTime = Date.now();
  const totalStats: SplitStats = {
    marketsProcessed: 0,
    filesCreated: 0,
    errors: []
  };

  try {
    // Split ZHVI
    const zhviStats = await splitZillowCSV(
      path.join(__dirname, '../housing-data-app/public/data/default-housing-data.csv'),
      path.join(__dirname, '../housing-data-app/public/data/markets'),
      'zhvi'
    );

    totalStats.marketsProcessed += zhviStats.marketsProcessed;
    totalStats.filesCreated += zhviStats.filesCreated;
    totalStats.errors.push(...zhviStats.errors);

    // Split ZORI
    const zoriStats = await splitZillowCSV(
      path.join(__dirname, '../housing-data-app/public/data/default-rental-data.csv'),
      path.join(__dirname, '../housing-data-app/public/data/markets'),
      'zori'
    );

    totalStats.marketsProcessed += zoriStats.marketsProcessed;
    totalStats.filesCreated += zoriStats.filesCreated;
    totalStats.errors.push(...zoriStats.errors);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n=========================');
    console.log('✅ Splitting Complete!');
    console.log('=========================');
    console.log(`Duration: ${duration} seconds`);
    console.log(`Markets processed: ${totalStats.marketsProcessed}`);
    console.log(`Files created: ${totalStats.filesCreated}`);
    console.log(`Errors: ${totalStats.errors.length}`);

    if (totalStats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      totalStats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (totalStats.errors.length > 10) {
        console.log(`   ... and ${totalStats.errors.length - 10} more`);
      }
    }

    console.log('\n📁 Output directory: housing-data-app/public/data/markets/');
    console.log('   - zhvi/ (home values)');
    console.log('   - zori/ (rentals)');
    console.log('\n💡 Next steps:');
    console.log('   1. Test locally with split files');
    console.log('   2. Upload to Cloud Storage (see DATA_OPTIMIZATION_GUIDE.md)');
    console.log('   3. Update environment variables');
  } catch (error) {
    console.error('\n❌ Splitting failed:', error);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  runSplitter();
}

export { runSplitter, splitZillowCSV, normalizeMarketName };
