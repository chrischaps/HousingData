# Housing Data App - Production

Production-ready housing market data visualization and analysis platform with Firebase authentication.

## Project Status

**Version**: 0.1.0 (Firebase Authentication MVP)

This is the **production application** transitioning from the POC (`housing-data-poc`). Currently implements Firebase authentication with Google Sign-In and Email/Password authentication.

## Features

### Implemented ✅
- Firebase Authentication
  - Google Sign-In
  - Email/Password authentication
  - Sign up / Sign in flows
  - Session management
- Production project structure
- Tailwind CSS styling
- TypeScript configuration
- Reusable components from POC (MarketCard, PriceChart, TimeRangeSelector)

### Coming Next 🚧
- Market data visualization (from POC)
- Firestore-backed favorites system
- Rental data integration
- Rent vs Own calculator
- Advanced visualizations

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project (create at [Firebase Console](https://console.firebase.google.com/))

### Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com/
2. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable "Google" provider
   - Enable "Email/Password" provider
3. Enable Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
4. Get your Firebase configuration:
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
│   ├── components/         # React components
│   │   ├── LoginPage.tsx   # Authentication UI
│   │   ├── MarketCard.tsx  # Market data card (from POC)
│   │   ├── PriceChart.tsx  # Price visualization (from POC)
│   │   └── TimeRangeSelector.tsx
│   ├── contexts/           # React contexts
│   │   └── AuthContext.tsx # Firebase auth state management
│   ├── services/           # External services
│   │   └── firebase.ts     # Firebase configuration
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   │   ├── formatters.ts   # Price/date formatting
│   │   └── constants.ts    # App constants
│   ├── App.tsx             # Main app component
│   └── main.tsx            # App entry point
├── .env.example            # Environment variables template
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **Authentication**: Firebase Auth
- **Database**: Firestore (coming soon)
- **Charts**: Recharts 3
- **HTTP Client**: Axios

## Authentication

The app uses Firebase Authentication with two sign-in methods:

1. **Google Sign-In**: One-click authentication with Google account
2. **Email/Password**: Traditional email/password registration and login

All authentication state is managed through the `AuthContext` provider, making it available throughout the app via the `useAuth()` hook.

## Migration from POC

This production app reuses tested components from the POC:
- ✅ Type definitions (`types/index.ts`)
- ✅ Utility functions (`utils/formatters.ts`, `utils/constants.ts`)
- ✅ UI Components (MarketCard, PriceChart, TimeRangeSelector)
- 🚧 Data providers (will be refactored for Firestore)
- 🚧 Watchlist → Favorites migration (localStorage → Firestore)

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

## Next Steps

Following the SERVERLESS_TRANSITION_PLAN.md:

- **Week 1-2**: ✅ Firebase Authentication (Current)
- **Week 3-4**: Integrate market data visualization
- **Week 5**: Implement Firestore favorites system
- **Week 6**: Add rental data sources
- **Week 7**: Build rent vs own calculator

## Contributing

This is a personal project, but feedback and suggestions are welcome!

## License

Private - Not for distribution
