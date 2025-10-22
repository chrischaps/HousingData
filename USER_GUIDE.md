# Housing Data App - User Guide

**Version**: 1.0
**Last Updated**: 2025-10-21
**App Status**: POC Complete

---

## Welcome!

The Housing Data App helps you visualize and analyze housing market trends across different cities and regions. Whether you're a homebuyer, investor, or researcher, this tool makes it easy to explore historical price data and compare markets.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Viewing Market Data](#viewing-market-data)
3. [Using Interactive Charts](#using-interactive-charts)
4. [Uploading CSV Files](#uploading-csv-files)
5. [Managing Your Watchlist](#managing-your-watchlist)
6. [Switching Data Sources](#switching-data-sources)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Getting Started

### First Visit

When you first open the Housing Data App, you'll see:

1. **Featured Markets** - A grid of market cards showing current prices and trends
2. **Sidebar** - Tools for searching, uploading data, and managing settings
3. **Chart Area** - Appears when you click on a market card

### Understanding the Interface

```
┌─────────────────────────────────────────────────────────┐
│  Housing Market Data                       POC Phase 2   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────┐  ┌──────────────────────────────────────┐ │
│  │          │  │                                      │ │
│  │ Sidebar  │  │      Featured Markets                │ │
│  │          │  │                                      │ │
│  │ Settings │  │  ┌──────┐ ┌──────┐ ┌──────┐        │ │
│  │ Search   │  │  │Market│ │Market│ │Market│        │ │
│  │ Upload   │  │  │Card 1│ │Card 2│ │Card 3│        │ │
│  │ Watchlist│  │  └──────┘ └──────┘ └──────┘        │ │
│  │          │  │                                      │ │
│  └──────────┘  │  Interactive Chart (when selected)   │ │
│                │                                      │ │
│                └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Viewing Market Data

### Market Cards

Each market card shows:
- **Market Name**: City and state (e.g., "Detroit, MI")
- **Current Price**: Median home price (e.g., "$225,000")
- **Price Change**: Percentage and direction (e.g., "↑ 5.2%")
- **Property Type**: Single Family Home

**To view detailed data**:
1. Click on any market card
2. The interactive chart will appear below
3. Explore different time ranges

### Color Indicators

- **Green ↑**: Price increasing
- **Red ↓**: Price decreasing

---

## Using Interactive Charts

### Viewing a Chart

1. **Click on a market card** to display its chart
2. The chart shows historical median home prices over time
3. **Hover over the line** to see exact prices and dates

### Time Range Selection

Use the time range buttons to zoom in/out:

- **1M** - Last month
- **6M** - Last 6 months
- **1Y** - Last year
- **5Y** - Last 5 years
- **MAX** - All available data (up to 25 years!)

**To change the time range**:
1. Click one of the buttons above the chart
2. The chart will update automatically

### Reading the Chart

- **X-axis**: Date (formatted as "Jan 2024")
- **Y-axis**: Price (formatted as "$500K")
- **Tooltip**: Hover to see exact values
  - Date: Full date (e.g., "January 15, 2024")
  - Price: Exact price (e.g., "$525,450")

---

## Uploading CSV Files

### Why Upload a CSV?

Upload your own housing market data to analyze custom datasets:
- Zillow ZHVI data files
- Custom market research
- Historical price data

### Supported CSV Formats

#### Format 1: Simple Format

**Required columns**: `city`, `state`

**Optional columns**: `zipCode`, `medianPrice`, `averagePrice`, `percentChange`, `lastUpdatedDate`

**Example**:
```csv
city,state,zipCode,medianPrice,averagePrice,percentChange,lastUpdatedDate
Detroit,MI,48201,225000,235000,5.2,2025-10-21
Anaheim,CA,92805,875000,920000,-2.1,2025-10-21
```

#### Format 2: Zillow ZHVI Format

**Automatically detected!** No configuration needed.

**Characteristics**:
- Columns: `RegionID`, `RegionName`, `State`, `2000-01-31`, `2000-02-29`, ...
- 300+ date columns with historical prices
- Supports up to 25 years of data

**Where to get Zillow data**:
Visit [Zillow Research Data](https://www.zillow.com/research/data/) to download ZHVI files.

### How to Upload

1. **Click "CSV File Upload"** in the sidebar
2. **Choose a file**:
   - Click "Choose CSV File" button, OR
   - Drag and drop a CSV file onto the upload area
3. **Wait for processing**:
   - You'll see "Reading file..." → "Validating format..." → "Parsing data..."
4. **Success!**: Markets will appear in the featured markets grid

### Download Template

Need a sample file?
1. Click the **"📥 Template"** button in the CSV Upload section
2. A file called `housing-data-template.csv` will download
3. Open it in Excel or Google Sheets
4. Replace the sample data with your own
5. Save and upload!

### File Size Limits

- **Recommended**: < 10MB for best performance
- **Maximum**: ~50MB (browser-dependent)
- **Performance tip**: Larger files will be limited to the first 20 markets

---

## Managing Your Watchlist

### Adding Markets

1. Find a market card you want to track
2. Click the **"+ Add"** button in the top-right of the card
3. The market will appear in your watchlist (sidebar)

### Viewing Watchlist

Your watchlist is always visible in the sidebar:
- Shows all tracked markets
- Click on a market name to view its chart
- Persists across browser sessions (saved in localStorage)

### Removing Markets

To remove a market from your watchlist:
1. Find the market in the watchlist panel
2. Click the **"Remove"** button next to it
3. The market will be removed immediately

---

## Switching Data Sources

### Available Data Sources

The app supports three data sources:

1. **CSV File** (📊)
   - Your uploaded CSV data
   - Status: Shows filename and market count
   - Use: Custom datasets, Zillow ZHVI files

2. **Zillow Metrics API** (🔑)
   - Real-time Zillow data via API
   - Status: Shows "Configured" if API key is set
   - Use: Live market data

3. **Mock Data** (🎭)
   - Sample data for demos
   - Status: Always available
   - Use: Testing, demonstrations

### How to Switch

1. Open the **Settings** panel in the sidebar
2. Look for "Data Source" section
3. Click on a different provider
4. Data will reload automatically

### Checking Current Source

Look for the status indicator in the header:
- **API Mode**: Real data from Zillow
- **Mock Mode**: Sample data
- **CSV Mode**: Your uploaded file

---

## Troubleshooting

### Problem: CSV Upload Failed

**Error**: "Missing required columns: city"

**Solution**:
- Check that your CSV has column headers in the first row
- Required columns: `city` and `state`
- Column names are **case-insensitive** (City, CITY, city all work)

**Error**: "No valid market data found in CSV file"

**Solution**:
- Ensure your CSV has at least one data row (besides headers)
- Check for proper formatting (commas between values)
- Try downloading the template and comparing formats

---

### Problem: Charts Not Showing Data

**Symptom**: Chart says "No historical data available"

**Solutions**:
1. Try a different time range (1M, 6M, 1Y instead of MAX)
2. Check if the market has recent data (some markets may have gaps)
3. Re-upload your CSV file if using CSV source

---

### Problem: Markets Look Wrong

**Symptom**: Prices seem unrealistic or market names are incorrect

**Solutions**:
1. **Check data source**: Are you in Mock mode? (Sample data only)
2. **Verify CSV data**: Open your CSV file and check the values
3. **Try re-uploading**: Clear the current CSV and upload again

**To clear CSV data**:
1. Find the green checkmark box in CSV Upload section
2. Click the **"✕"** button in the top-right
3. Upload a new file

---

### Problem: Page Loading Slowly

**Causes and Solutions**:

1. **Large CSV file**:
   - Limit your CSV to ~1000 rows for best performance
   - App automatically limits to first 20 markets

2. **Slow internet**:
   - Charts may take longer to render
   - Wait for the loading animation to complete

3. **Old browser**:
   - Use Chrome, Firefox, Edge, or Safari (latest versions)

---

### Problem: Watchlist Not Saving

**Symptom**: Watchlist resets when you refresh the page

**Solutions**:
1. **Check browser settings**: Ensure cookies/localStorage are enabled
2. **Private browsing**: Data doesn't persist in incognito mode
3. **Clear cache**: Try clearing your watchlist and re-adding markets

---

## FAQ

### General

**Q: Is my data stored online?**
A: No, all data is stored locally in your browser using IndexedDB. Your CSV files and watchlist never leave your device.

**Q: Can I use this on mobile?**
A: Yes! The app is fully responsive and works on phones and tablets.

**Q: Is there a limit to how many markets I can view?**
A: For performance, the app shows up to 20 markets at a time from CSV files. Mock and API modes typically show 5-10 markets.

**Q: Can I export charts or data?**
A: Not yet! This feature is planned for the next phase.

---

### CSV Files

**Q: What CSV software can I use?**
A: Any! Excel, Google Sheets, Numbers, LibreOffice, or even a text editor.

**Q: Do I need all the optional columns?**
A: No. Only `city` and `state` are required. The app will calculate what it can from available data.

**Q: Can I mix different markets in one CSV?**
A: Yes! Each row represents a different market.

**Q: How do I get Zillow ZHVI files?**
A: Visit [https://www.zillow.com/research/data/](https://www.zillow.com/research/data/), find "Home Values" → "ZHVI", and download the CSV.

---

### Data & Charts

**Q: How is "median price" calculated?**
A: It comes directly from your data source (CSV, API, or mock data). For Zillow ZHVI files, it's the most recent ZHVI value.

**Q: What does "percent change" represent?**
A: The percentage difference between the most recent price and the previous period.

**Q: Why does MAX only show 5 years of data?**
A: Check your data source. If using CSV, ensure your file has historical data. Zillow ZHVI files contain 20+ years.

**Q: Can I compare two markets side-by-side?**
A: Not yet! This feature is planned for Phase 2.

---

### Technical

**Q: What browsers are supported?**
A: Chrome, Firefox, Safari, and Edge (latest versions). Internet Explorer is not supported.

**Q: Do I need an API key?**
A: Only if you want to use the Zillow Metrics API provider. CSV and Mock data work without any setup.

**Q: Where do I get a Zillow API key?**
A: Visit [https://www.zillow.com/howto/api/](https://www.zillow.com/howto/api/) to apply for API access.

**Q: Is my API key secure?**
A: For this POC, API keys are stored in environment variables (not in code). For production, use a backend service.

---

## Need More Help?

### Resources

- **Developer Guide**: See `DEVELOPER_GUIDE.md` for technical details
- **Project Learnings**: See `PROJECT_LEARNINGS.md` for insights
- **GitHub Issues**: Report bugs at [repository URL]

### Contact

- Email: [support email]
- GitHub: [repository URL]

---

## Tips & Tricks

### Power User Tips

1. **Keyboard Navigation**: Tab through markets, Enter to select
2. **Quick Upload**: Drag-drop CSV files directly onto the upload area
3. **Time Range Shortcuts**: Click time ranges in sequence for smooth animation
4. **Watchlist Organization**: Add markets you compare frequently

### Best Practices

1. **Keep CSV files under 10MB** for best performance
2. **Use Zillow ZHVI format** for richest historical data
3. **Check "MAX" time range** to see full data coverage
4. **Download the template** before creating custom CSVs

### Hidden Features

- **Colored console logs**: Open browser DevTools to see detailed loading information
- **Staggered animations**: Market cards fade in with a slight delay for visual appeal
- **Smart date filtering**: Charts automatically adjust to your dataset's date range

---

**Happy exploring!** 🏠📈

---

**Document Version**: 1.0
**Last Updated**: 2025-10-21
**App Version**: POC Phase 2
