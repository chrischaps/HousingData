# Housing Data App - Production

Production-ready housing market data visualization and analysis platform with Firebase authentication and real-time favorites.

## Project Status

**Version**: 0.6.0 (Firestore Favorites + Market Comparison)

This is the **production application** built from the POC (`housing-data-poc`) with Firebase authentication, Firestore-backed favorites, and advanced market comparison features.

## Features

### Implemented ✅
- **Firebase Authentication**
  - Google Sign-In
  - Session management with automatic persistence
  - Protected routes and user context

- **Market Data Visualization**
  - Interactive price charts with Recharts
  - Multiple time ranges (1M, 6M, 1Y, 5Y, MAX)
  - 21,000+ markets from Zillow ZHVI dataset
  - Real-time search across all markets
  - Historical price data (2000-2025)

- **Firestore-Backed Favorites System** ⭐ NEW
  - Real-time sync across devices/tabs
  - Add/remove favorites with one click
  - Star (☆/★) indicators on all market cards
  - Favorites panel with instant updates
  - Click favorites to view market charts
  - Secure with Firestore Security Rules

- **Market Comparison** ⭐ NEW
  - Compare up to 5 markets on one chart
  - Color-coded overlays for easy comparison
  - Add markets from search or featured grid
  - Visual comparison panel with remove options

- **Data Providers**
  - CSV provider with Zillow ZHVI data (default)
  - IndexedDB caching for performance
  - Singleton pattern for memory optimization
  - Support for custom CSV uploads

- **UI/UX Features**
  - Responsive design (mobile, tablet, desktop)
  - Smooth animations and transitions
  - Loading states and skeleton screens
  - Error handling with user feedback
  - Settings panel with cache management

### Coming Next 🚧
- Rental data integration
- Rent vs Own calculator
- Advanced filtering and sorting
- Export favorites to CSV
- Market notes and tags

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project (create at [Firebase Console](https://console.firebase.google.com/))

### Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com/
2. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable "Google" provider
3. Enable Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
4. **Configure Firestore Security Rules** (REQUIRED):
   - Go to Firestore Database > Rules tab
   - Copy the rules from `firestore.rules` in this directory
   - Click "Publish" to deploy
5. Get your Firebase configuration:
   - Go to Project Settings > General
   - Scroll to "Your apps" section
   - Copy the Firebase SDK config object

### Installation

```powershell
# Clone the repository
cd housing-data-app

# Install dependencies
npm install

# Set up environment variables
Copy-Item .env.example .env
# Edit .env and add your Firebase configuration
```

### Environment Variables

Create a `.env` file in the root directory with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Development

```powershell
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The development server will start at http://localhost:5173

## Project Structure

```
housing-data-app/
├── src/
│   ├── components/              # React components
│   │   ├── LoginPage.tsx        # Authentication UI
│   │   ├── MarketCard.tsx       # Market card with favorites
│   │   ├── PriceChart.tsx       # Multi-market chart
│   │   ├── TimeRangeSelector.tsx # Time range buttons
│   │   ├── MarketSearch.tsx     # Search with autocomplete
│   │   ├── FavoritesPanel.tsx   # Real-time favorites list ⭐
│   │   ├── SettingsPanel.tsx    # Cache & provider settings
│   │   └── MarketCardSkeleton.tsx # Loading states
│   ├── contexts/                # React contexts
│   │   └── AuthContext.tsx      # Firebase auth state
│   ├── services/                # External services
│   │   ├── firebase.ts          # Firebase configuration
│   │   ├── favorites.ts         # Firestore favorites CRUD ⭐
│   │   └── providers/           # Data provider pattern
│   │       ├── csv.provider.ts  # CSV data source
│   │       ├── mock.provider.ts # Mock data
│   │       └── factory.ts       # Provider factory
│   ├── hooks/                   # Custom React hooks
│   │   ├── useFavorites.ts      # Real-time favorites hook ⭐
│   │   ├── useMarketData.ts     # Market data fetching
│   │   └── useMarketSearch.ts   # Search functionality
│   ├── types/                   # TypeScript definitions
│   │   └── index.ts             # All type definitions
│   ├── utils/                   # Utility functions
│   │   ├── formatters.ts        # Price/date formatting
│   │   ├── csvParser.ts         # Zillow ZHVI parser
│   │   ├── indexedDBCache.ts    # Client-side caching
│   │   └── dataTransform.ts     # Data transformations
│   ├── App.tsx                  # Main app component
│   ├── main.tsx                 # App entry point
│   └── index.css                # Global styles + animations
├── public/
│   └── data/
│       └── default-housing-data.csv # 21k+ markets (86MB)
├── firestore.rules              # Firestore security rules
├── .env.example                 # Environment template
├── package.json                 # v0.6.0
└── README.md                    # This file
```

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7.1.12
- **Styling**: Tailwind CSS 4.1.16
- **Authentication**: Firebase Auth 12.4.0
- **Database**: Firestore (real-time listeners)
- **Charts**: Recharts 3.3.0
- **HTTP Client**: Axios 1.12.2
- **Caching**: IndexedDB (unlimited storage)
- **State Management**: React Context + Custom Hooks

## Key Features Explained

### Authentication

The app uses Firebase Authentication with Google Sign-In for secure, passwordless access. All authentication state is managed through the `AuthContext` provider, making user info available throughout the app via the `useAuth()` hook.

### Favorites System

Built on Firestore with real-time synchronization:
- **Add favorites**: Click the star (☆) on any market card or chart header
- **Real-time updates**: Changes sync instantly across all devices/tabs
- **Persistence**: All favorites stored securely in Firestore
- **Security**: Users can only access their own favorites (enforced by Firestore rules)
- **Performance**: IndexedDB caching reduces Firestore reads

### Market Comparison

Compare up to 5 markets simultaneously:
- Click the ⚖️ button on any market card
- Markets overlay on the same chart with different colors
- Add markets from search results or featured grid
- Remove individual markets or clear all at once
- Visual legend shows which color represents each market

### Data Sources

**Default Dataset**: Zillow ZHVI (Home Value Index)
- 21,423 U.S. markets (cities)
- Historical data from 2000-2025
- Monthly median home values
- Loaded automatically on first visit
- Cached in IndexedDB for performance

**Search**: Fast, client-side search across all 21k+ markets with instant results.

## Migration from POC

This production app successfully transitioned from the POC:
- ✅ Type definitions (`types/index.ts`)
- ✅ Utility functions (`utils/formatters.ts`, `utils/constants.ts`)
- ✅ UI Components (MarketCard, PriceChart, TimeRangeSelector)
- ✅ Data providers (CSV, Mock, with provider factory pattern)
- ✅ Watchlist → Favorites migration (localStorage → Firestore with real-time sync)
- ✅ Market comparison feature (not in POC)
- ✅ Advanced search across 21k+ markets

See `SERVERLESS_TRANSITION_PLAN.md` in the root directory for the complete transition roadmap.

## Development Workflow

### Adding a New Feature

1. Create a feature branch:
   ```powershell
   git checkout -b feature/feature-name
   ```

2. Make changes and test:
   ```powershell
   npm run dev    # Test in development
   npm run build  # Verify build works
   ```

3. Commit and push:
   ```powershell
   git add .
   git commit -m "Add feature description"
   git push -u origin feature/feature-name
   ```

### Building for Production

Always run the build before deploying to catch TypeScript errors:

```powershell
npm run build
```

The build output will be in the `dist/` directory.

## Troubleshooting

### Firebase Configuration Errors

If you see "Firebase: Error (auth/invalid-api-key)" or similar:
1. Double-check your `.env` file has the correct Firebase credentials
2. Ensure all `VITE_FIREBASE_*` variables are set
3. Restart the dev server after changing `.env`

### Build Errors

TypeScript errors during build? Common fixes:
- Use type-only imports: `import type { Type } from 'module'`
- Ensure all required props are passed to components
- Check for unused variables (prefix with `_` if intentionally unused)

## Development Progress

Following the SERVERLESS_TRANSITION_PLAN.md:

- **Week 1-2**: ✅ Firebase Authentication
- **Week 3-4**: ✅ Market data visualization (CSV provider)
- **Week 5**: ✅ Firestore favorites system with real-time sync
- **Week 6**: 🚧 Add rental data sources (Next)
- **Week 7**: 🚧 Build rent vs own calculator

## Security

Security audit completed (see `SECURITY_AUDIT_REPORT.md` in root directory):
- **Overall Grade**: B+ (Very Good)
- ✅ Zero vulnerabilities in production dependencies
- ✅ Firestore Security Rules configured
- ✅ API keys managed via environment variables
- ✅ XSS protection with React auto-escaping
- ✅ No code injection vulnerabilities

**Firestore Rules**: Users can only read/write their own favorites. See `firestore.rules` for the complete security configuration.

## Contributing

This is a personal project, but feedback and suggestions are welcome!

## License

Private - Not for distribution
