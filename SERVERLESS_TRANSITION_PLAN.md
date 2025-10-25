# Serverless-First Production Transition Plan
## POC → Feature-Rich Serverless Application

**Version**: 2.0 (Serverless-Optimized)
**Date**: October 25, 2025
**Current POC Version**: 0.3.0
**Architecture**: Serverless-First (Firebase + Cloud Run)
**Priority**: Stay serverless while adding authentication, multiple data sources, and advanced features

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Serverless Architecture](#serverless-architecture)
3. [Firebase Integration Strategy](#firebase-integration-strategy)
4. [Feature Roadmap](#feature-roadmap)
5. [Implementation Phases](#implementation-phases)
6. [Cost Analysis](#cost-analysis)
7. [Scalability Considerations](#scalability-considerations)

---

## Executive Summary

### Philosophy: "Serverless Until You Can't"

Rather than immediately jumping to a traditional backend (Express + PostgreSQL), we'll leverage serverless technologies to add features incrementally while maintaining:
- ✅ Zero server management
- ✅ Auto-scaling
- ✅ Pay-per-use pricing
- ✅ Fast iteration cycles
- ✅ Simple deployment

### Transition Strategy

**Current POC** → **Enhanced Serverless** → **Eventually Backend (if needed)**

```
┌─────────────────────────────────────────────────────────┐
│              Phase 1: POC (Current)                      │
│  • Frontend only                                         │
│  • CSV data from Cloud Storage                           │
│  • No auth                                               │
│  • localStorage watchlists                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         Phase 2: Serverless Enhancement (Target)         │
│  • Frontend: Vite + React (keep current)                │
│  • Auth: Firebase Authentication                         │
│  • Database: Firestore (user data, watchlists)          │
│  • Functions: Cloud Functions (data aggregation)         │
│  • Storage: Cloud Storage (CSV data)                     │
│  • APIs: Direct provider calls + caching                 │
└─────────────────────────────────────────────────────────┘
                          ↓ (Optional, Future)
┌─────────────────────────────────────────────────────────┐
│    Phase 3: Hybrid (Only if serverless limits reached)   │
│  • Keep frontend + Firebase Auth                         │
│  • Add backend for heavy data processing                 │
│  • TimescaleDB for time-series if needed                 │
└─────────────────────────────────────────────────────────┘
```

### Key Decision: Why Stay Serverless?

| Consideration | Serverless | Traditional Backend |
|---------------|-----------|---------------------|
| **Setup Time** | Hours | Weeks |
| **Infrastructure** | Managed | Self-managed |
| **Scaling** | Automatic | Manual config |
| **Cost (low traffic)** | ~$5-20/month | ~$50-100/month |
| **Dev Complexity** | Lower | Higher |
| **Time to Feature** | Days | Weeks |

**Recommendation**: Stay serverless for the next 6-12 months, transition to backend only when:
- User count > 10,000 active users
- API costs > $500/month
- Need for complex batch jobs
- Real-time data streaming required

---

## Serverless Architecture

### Target Architecture (Phase 2)

```
┌───────────────────────────────────────────────────────────────┐
│                         User's Browser                         │
└───────────────────────────────┬───────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
           ┌────────▼────────┐     ┌────────▼─────────┐
           │  Vite + React   │     │  Firebase Auth   │
           │  (Cloud Run)    │     │  (Google OAuth)  │
           └────────┬────────┘     └────────┬─────────┘
                    │                       │
        ┌───────────┴───────────┐          │
        │                       │          │
┌───────▼────────┐   ┌──────────▼──────┐  │
│  Cloud Storage │   │   Firestore DB   │◄─┘
│  (CSV Data)    │   │  • User profiles │
│  • 86MB Zillow │   │  • Watchlists    │
│  • Historical  │   │  • Favorites     │
└────────────────┘   │  • Calculations  │
                     └──────────────────┘
           │
┌──────────▼──────────────┐
│  Cloud Functions        │
│  • Data Aggregation     │
│  • RentCast API Proxy   │
│  • Rent vs Own Calc     │
│  • Email Notifications  │
└─────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────┐  ┌────▼─────┐
│RentCast│  │  Other   │
│  API   │  │ APIs     │
└────────┘  └──────────┘
```

### Component Responsibilities

| Component | Purpose | Why Serverless Works |
|-----------|---------|---------------------|
| **Vite + React** | UI layer, client routing | Static hosting, fast CDN delivery |
| **Firebase Auth** | User authentication | Built-in OAuth, magic links, 10k+ free users |
| **Firestore** | User data, watchlists, favorites | NoSQL, real-time, generous free tier |
| **Cloud Functions** | API proxy, calculations, aggregations | Pay per invocation, auto-scales |
| **Cloud Storage** | CSV files, user uploads | Cheap storage, CDN backed |
| **BigQuery** (optional) | Analytics, trends analysis | Query as needed, no server |

---

## Firebase Integration Strategy

### Why Firebase for This Use Case?

**Perfect Fit:**
- ✅ User authentication out-of-the-box
- ✅ Firestore for user data (watchlists, favorites)
- ✅ Real-time updates (watchlist changes sync instantly)
- ✅ Offline support built-in
- ✅ Free tier: 50k reads/day, 20k writes/day, 1GB storage
- ✅ Integrates seamlessly with existing Cloud Run deployment

**What Firebase Replaces:**
- ❌ No need for Express backend
- ❌ No need for PostgreSQL for user data
- ❌ No need for Redis for simple caching
- ❌ No need for separate auth service

### Firebase Setup

#### 1. Firebase Authentication

**Supported Methods:**
- Google Sign-In (recommended for real estate audience)
- Email/Password
- Magic Link (passwordless email)
- Phone (for SMS verification)

**Integration:**
```typescript
// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "housing-data-poc.firebaseapp.com",
  projectId: "housing-data-poc",
  storageBucket: "housing-data-poc.appspot.com",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
```

**POC Component Updates:**
```typescript
// Minimal changes to existing components
// src/App.tsx
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';

function App() {
  const [user, loading] = useAuthState(auth);

  if (!user) return <LoginPage />;
  return <Dashboard user={user} />;
}
```

#### 2. Firestore Database Structure

**Collections:**
```
users/
  {userId}/
    email: string
    displayName: string
    photoURL: string
    createdAt: timestamp
    preferences: {
      theme: 'light' | 'dark'
      defaultTimeRange: '1Y'
      notifications: boolean
    }

watchlists/
  {watchlistId}/
    userId: string
    name: string
    isDefault: boolean
    createdAt: timestamp
    updatedAt: timestamp
    markets: [
      {
        marketId: string
        marketName: string
        addedAt: timestamp
      }
    ]

favorites/
  {favoriteId}/
    userId: string
    marketId: string
    marketName: string
    notes: string
    createdAt: timestamp

rentVsOwnCalculations/
  {calculationId}/
    userId: string
    marketId: string
    purchasePrice: number
    downPayment: number
    interestRate: number
    rentPrice: number
    results: {
      monthlyMortgage: number
      monthlyTotal: number
      breakEvenYears: number
      totalCostOwn: number
      totalCostRent: number
    }
    createdAt: timestamp
```

**Security Rules:**
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    match /watchlists/{watchlistId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }

    match /favorites/{favoriteId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }

    match /rentVsOwnCalculations/{calculationId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
  }
}
```

#### 3. Migration from localStorage

**One-Time Migration Script:**
```typescript
// src/utils/migrateToFirebase.ts
export async function migrateLocalStorageToFirebase(userId: string) {
  // Migrate watchlist
  const localWatchlist = localStorage.getItem('housing-watchlist');
  if (localWatchlist) {
    const items = JSON.parse(localWatchlist);

    const watchlistRef = collection(db, 'watchlists');
    await addDoc(watchlistRef, {
      userId,
      name: 'My Watchlist',
      isDefault: true,
      markets: items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Clear localStorage after migration
    localStorage.removeItem('housing-watchlist');
  }
}
```

---

## Feature Roadmap

### Phase 2A: Authentication & User Data (Weeks 1-2)

**Features:**
1. **Firebase Authentication**
   - Google Sign-In (primary)
   - Email/Password (fallback)
   - Anonymous mode (browse without account)

2. **User Profile**
   - Display name, photo
   - Preferences (theme, default time range)
   - Account management

3. **Watchlist Migration**
   - Move from localStorage to Firestore
   - Real-time sync across devices
   - Multiple watchlists support

**Implementation:**
```powershell
# Install Firebase
cd housing-data-poc
npm install firebase react-firebase-hooks

# Create Firebase project (one-time)
# 1. Go to https://console.firebase.google.com
# 2. Create new project
# 3. Enable Authentication (Google, Email)
# 4. Enable Firestore Database
# 5. Copy config to .env
```

**Component Updates:**
- ✅ Keep: PriceChart, MarketCard (no changes needed)
- 🔄 Update: WatchlistPanel (Firestore instead of localStorage)
- 🔄 Update: SettingsPanel (add auth settings)
- ➕ New: LoginPage, ProfilePage

**Estimated Time:** 1-2 weeks
**Cost Impact:** $0-5/month (within Firebase free tier)

---

### Phase 2B: Multiple Data Sources (Weeks 3-4)

**Goal:** Add rental market data alongside purchase prices

**New Data Sources:**
1. **RentCast API** (already have provider)
   - Median rent prices
   - Rental market trends
   - For-rent inventory

2. **Redfin Data Center** (free, batch import)
   - Historical rental data
   - Market statistics
   - Download CSV, upload to Cloud Storage

3. **Zillow Rental Index** (if available)
   - ZORI (Zillow Observed Rent Index)
   - Complement existing ZHVI data

**Architecture:**
```
┌─────────────────────────────────────────────┐
│        Data Provider Manager (Frontend)     │
├─────────────────────────────────────────────┤
│  • CSV Provider (ZHVI - Purchase)           │
│  • CSV Provider (ZORI - Rental)             │
│  • RentCast Provider (Real-time)            │
│  • Mock Provider (Fallback)                 │
└─────────────────────────────────────────────┘
                  ↓
        ┌─────────────────┐
        │  Cloud Functions │
        │  (Rate Limiting) │
        └─────────────────┘
```

**New Components:**
```typescript
// src/components/RentalTrendsChart.tsx
// Dual-line chart: Purchase vs. Rental trends
<LineChart>
  <Line dataKey="purchasePrice" stroke="#1E40AF" name="Median Home Price" />
  <Line dataKey="medianRent" stroke="#10B981" name="Median Rent" />
</LineChart>

// src/components/MarketToggle.tsx
// Switch between Purchase / Rental / Both views
<ToggleGroup>
  <ToggleButton value="purchase">Home Prices</ToggleButton>
  <ToggleButton value="rental">Rent Prices</ToggleButton>
  <ToggleButton value="both">Both</ToggleButton>
</ToggleGroup>
```

**Data Storage:**
- Purchase data: Existing CSV (Cloud Storage)
- Rental data: New CSV (Cloud Storage)
- Combined data: Merge in-memory on client
- Cache: IndexedDB (keep existing caching strategy)

**Estimated Time:** 2 weeks
**Cost Impact:** $0-10/month (more API calls, still within limits)

---

### Phase 2C: Favorites & Enhanced Watchlists (Week 5)

**Features:**

1. **Favorites System**
   - Star/favorite specific markets
   - Add personal notes
   - Quick access from dashboard
   - Firestore collection: `favorites/`

2. **Enhanced Watchlists**
   - Create multiple watchlists ("Investment", "Retirement", "First Home")
   - Drag-and-drop reordering
   - Share watchlist via link
   - Export to CSV

**New Components:**
```typescript
// src/components/FavoriteButton.tsx
// Star icon, saves to Firestore
const handleFavorite = async () => {
  await addDoc(collection(db, 'favorites'), {
    userId: user.uid,
    marketId,
    marketName,
    notes: '',
    createdAt: serverTimestamp()
  });
};

// src/components/WatchlistManager.tsx
// CRUD operations for multiple watchlists
// Uses react-beautiful-dnd for drag-and-drop
```

**Firestore Operations:**
- Read favorites on dashboard load
- Write favorite on star click
- Real-time listener for watchlist updates
- Delete on unfavorite

**Estimated Time:** 1 week
**Cost Impact:** Minimal (Firestore read/writes within free tier)

---

### Phase 2D: Rent vs. Own Calculator (Week 6)

**Feature:** Help users decide whether to rent or buy in a specific market

**Calculator Inputs:**
- **Purchase Scenario:**
  - Home price (pre-filled from market data)
  - Down payment (%, default 20%)
  - Interest rate (%, default current rate)
  - Property tax rate (% of home value)
  - HOA fees (monthly)
  - Home insurance (annual)
  - Maintenance (% of home value, default 1%)

- **Rental Scenario:**
  - Monthly rent (pre-filled from market data)
  - Renter's insurance (annual)
  - Rent increase rate (% annual)

- **Time Horizon:**
  - Years to compare (default 5, 10, 30)

**Calculator Outputs:**
- Monthly cost comparison
- Total cost over time horizon
- Break-even point (years)
- Equity built (for purchase)
- Opportunity cost (investment returns if not buying)
- Tax benefits (mortgage interest deduction)

**Implementation:**
```typescript
// src/utils/rentVsOwnCalculator.ts
export interface RentVsOwnInputs {
  // Purchase
  homePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  propertyTaxRate: number;
  hoaFees: number;
  homeInsurance: number;
  maintenanceRate: number;

  // Rental
  monthlyRent: number;
  rentersInsurance: number;
  rentIncreaseRate: number;

  // Time
  years: number;
}

export function calculateRentVsOwn(inputs: RentVsOwnInputs) {
  // Calculate monthly mortgage payment
  const principal = inputs.homePrice * (1 - inputs.downPaymentPercent / 100);
  const monthlyRate = inputs.interestRate / 100 / 12;
  const numPayments = inputs.years * 12;

  const monthlyMortgage = principal *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  // Calculate total monthly cost of ownership
  const monthlyPropertyTax = (inputs.homePrice * inputs.propertyTaxRate / 100) / 12;
  const monthlyInsurance = inputs.homeInsurance / 12;
  const monthlyMaintenance = (inputs.homePrice * inputs.maintenanceRate / 100) / 12;

  const totalMonthlyOwn = monthlyMortgage + monthlyPropertyTax +
    inputs.hoaFees + monthlyInsurance + monthlyMaintenance;

  // Calculate rental costs over time
  let totalRentCost = 0;
  let currentRent = inputs.monthlyRent;

  for (let year = 0; year < inputs.years; year++) {
    totalRentCost += currentRent * 12;
    currentRent *= (1 + inputs.rentIncreaseRate / 100);
  }

  // Calculate ownership costs over time
  const totalOwnCost = totalMonthlyOwn * numPayments +
    (inputs.homePrice * inputs.downPaymentPercent / 100); // Down payment

  // Calculate equity built
  const totalPrincipalPaid = (monthlyMortgage * numPayments) -
    (principal * inputs.interestRate / 100 * inputs.years);

  const equityBuilt = totalPrincipalPaid +
    (inputs.homePrice * inputs.downPaymentPercent / 100);

  // Break-even calculation
  const netCostOwn = totalOwnCost - equityBuilt;
  const breakEvenYears = netCostOwn < totalRentCost
    ? findBreakEvenPoint(inputs)
    : inputs.years;

  return {
    monthlyMortgage,
    totalMonthlyOwn,
    totalRentCost,
    totalOwnCost,
    netCostOwn,
    equityBuilt,
    breakEvenYears,
    recommendation: netCostOwn < totalRentCost ? 'Buy' : 'Rent'
  };
}
```

**New Components:**
```typescript
// src/components/RentVsOwnCalculator.tsx
// Interactive form with real-time calculation
// Pre-filled with market data
// Results displayed as chart + table

// src/components/RentVsOwnChart.tsx
// Line chart showing costs over time
// Two lines: Cumulative cost of renting vs. owning
// Crossover point highlighted (break-even)
```

**Save Calculations:**
```typescript
// Save to Firestore for later reference
const saveCalculation = async (inputs: RentVsOwnInputs, results: Results) => {
  await addDoc(collection(db, 'rentVsOwnCalculations'), {
    userId: user.uid,
    marketId,
    ...inputs,
    results,
    createdAt: serverTimestamp()
  });
};
```

**Estimated Time:** 1 week
**Cost Impact:** $0 (client-side calculation, Firestore storage within free tier)

---

### Phase 2E: Advanced Visualizations (Week 7)

**New Chart Types:**

1. **Market Heatmap**
   - Color-coded map of U.S. cities by price change
   - Click to drill down into specific market
   - Uses Mapbox GL JS or Google Maps API

2. **Price Distribution Histogram**
   - Show distribution of home prices in a market
   - Quartiles, median, mean
   - Compare to national averages

3. **Rent-to-Price Ratio Chart**
   - Scatter plot: Rent vs. Purchase price
   - Identify undervalued/overvalued markets
   - Helps find investment opportunities

4. **Seasonal Trends**
   - Month-over-month price changes
   - Identify best time to buy/sell
   - Historical seasonal patterns

**Implementation:**
```typescript
// src/components/MarketHeatmap.tsx
import mapboxgl from 'mapbox-gl';

// Plot markets on map, color by price change
// Uses Cloud Storage CSV data

// src/components/PriceDistribution.tsx
import { BarChart, Bar } from 'recharts';

// Histogram of price ranges
// Data from historical CSV

// src/components/RentToPriceScatter.tsx
import { ScatterChart, Scatter } from 'recharts';

// X-axis: Median rent, Y-axis: Median price
// Each point is a market
```

**Data Requirements:**
- Existing CSV data (already have it)
- Geolocation data (add lat/long to CSV or lookup)
- Aggregate statistics (calculate client-side or Cloud Function)

**Estimated Time:** 1 week
**Cost Impact:** $0-20/month (Mapbox has generous free tier)

---

## Implementation Phases

### Timeline Overview (7-9 Weeks Total)

```
Week 1-2:   Firebase Auth + User Data Migration
Week 3-4:   Multiple Data Sources (Rental Data)
Week 5:     Favorites & Enhanced Watchlists
Week 6:     Rent vs. Own Calculator
Week 7:     Advanced Visualizations
Week 8:     Testing, Optimization, Polish
Week 9:     Deployment, Documentation
```

### Detailed Phase Breakdown

---

### **Phase 2A: Authentication (Weeks 1-2)**

#### Week 1: Firebase Setup & Basic Auth

**Day 1-2: Firebase Project Setup**
```powershell
# 1. Create Firebase project
# Visit: https://console.firebase.google.com
# Click "Add Project" → Enter name → Enable Google Analytics (optional)

# 2. Enable Authentication
# Firebase Console → Authentication → Get Started
# Enable Google Sign-In
# Enable Email/Password

# 3. Enable Firestore
# Firebase Console → Firestore Database → Create Database
# Start in "production mode" (we'll add security rules)

# 4. Get Firebase config
# Project Settings → Your Apps → Add App → Web
# Copy config object

# 5. Install Firebase SDK
cd housing-data-poc
npm install firebase react-firebase-hooks
```

**Day 3-4: Auth Integration**

Create auth service:
```typescript
// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Helper functions
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const signUpWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);
export const signOut = () => firebaseSignOut(auth);
```

Create auth components:
```typescript
// src/components/LoginPage.tsx
import { signInWithGoogle, signInWithEmail } from '../services/firebase';

export const LoginPage = () => {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">
          Housing Market Data
        </h2>
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50"
        >
          <img src="/google-logo.svg" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>
        {/* Email/password form here */}
      </div>
    </div>
  );
};
```

Update App.tsx:
```typescript
// src/App.tsx
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';
import { LoginPage } from './components/LoginPage';

function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return <LoadingProgress />; // Reuse existing component
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Existing app content */}
      {/* Add user profile menu in header */}
    </div>
  );
}
```

**Day 5: Testing & Refinement**
- Test Google Sign-In flow
- Test Email/Password flow
- Test sign-out
- Handle auth errors gracefully

**Deliverables:**
- [ ] Firebase project configured
- [ ] Google Sign-In working
- [ ] Email/Password sign-in working
- [ ] Auth state persisted across page reloads
- [ ] LoginPage component
- [ ] User profile displayed in header

---

#### Week 2: Firestore Integration & Data Migration

**Day 1-2: Firestore Security Rules**

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function: Check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }

    // Helper function: Check if user owns the document
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isOwner(userId);
    }

    // Watchlists collection
    match /watchlists/{watchlistId} {
      allow read: if isOwner(resource.data.userId);
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isOwner(resource.data.userId);
    }

    // Favorites collection
    match /favorites/{favoriteId} {
      allow read: if isOwner(resource.data.userId);
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isOwner(resource.data.userId);
    }

    // Rent vs Own calculations
    match /rentVsOwnCalculations/{calculationId} {
      allow read: if isOwner(resource.data.userId);
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isOwner(resource.data.userId);
    }
  }
}
```

Deploy rules:
```powershell
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize Firestore
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

**Day 3-4: Watchlist Migration**

Create Firestore hooks:
```typescript
// src/hooks/useWatchlist.ts
import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export const useWatchlist = () => {
  const [watchlists, setWatchlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // Real-time listener
    const q = query(
      collection(db, 'watchlists'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWatchlists(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const addToWatchlist = async (marketId: string, marketName: string) => {
    if (!user) return;

    // Get default watchlist or create one
    let watchlist = watchlists.find(w => w.isDefault);

    if (!watchlist) {
      const ref = await addDoc(collection(db, 'watchlists'), {
        userId: user.uid,
        name: 'My Watchlist',
        isDefault: true,
        markets: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      watchlist = { id: ref.id, markets: [] };
    }

    // Add market to watchlist
    await updateDoc(doc(db, 'watchlists', watchlist.id), {
      markets: arrayUnion({ marketId, marketName, addedAt: serverTimestamp() }),
      updatedAt: serverTimestamp()
    });
  };

  const removeFromWatchlist = async (watchlistId: string, marketId: string) => {
    const watchlist = watchlists.find(w => w.id === watchlistId);
    if (!watchlist) return;

    await updateDoc(doc(db, 'watchlists', watchlistId), {
      markets: watchlist.markets.filter(m => m.marketId !== marketId),
      updatedAt: serverTimestamp()
    });
  };

  return { watchlists, loading, addToWatchlist, removeFromWatchlist };
};
```

Update WatchlistPanel:
```typescript
// src/components/WatchlistPanel.tsx
import { useWatchlist } from '../hooks/useWatchlist';

export const WatchlistPanel = ({ onSelectMarket }) => {
  const { watchlists, loading, removeFromWatchlist } = useWatchlist();

  if (loading) return <div>Loading watchlist...</div>;

  const defaultWatchlist = watchlists.find(w => w.isDefault);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">My Watchlist</h3>
      {defaultWatchlist?.markets.map(market => (
        <div key={market.marketId} className="flex items-center justify-between py-2">
          <button
            onClick={() => onSelectMarket(market.marketId)}
            className="text-blue-600 hover:underline"
          >
            {market.marketName}
          </button>
          <button
            onClick={() => removeFromWatchlist(defaultWatchlist.id, market.marketId)}
            className="text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};
```

**Day 5: Migration Script**

Create one-time migration:
```typescript
// src/utils/migrateToFirebase.ts
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export async function migrateLocalStorageToFirebase(userId: string) {
  console.log('Starting migration from localStorage to Firestore...');

  try {
    // Migrate watchlist
    const localWatchlist = localStorage.getItem('housing-watchlist');
    if (localWatchlist) {
      const items = JSON.parse(localWatchlist);

      await addDoc(collection(db, 'watchlists'), {
        userId,
        name: 'My Watchlist',
        isDefault: true,
        markets: items.map(item => ({
          marketId: item.marketId,
          marketName: item.marketName,
          addedAt: serverTimestamp()
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log(`Migrated ${items.length} watchlist items`);
      localStorage.removeItem('housing-watchlist');
    }

    // Migrate preferences (if any)
    const preferences = localStorage.getItem('user-preferences');
    if (preferences) {
      // Save to Firestore users collection
      await setDoc(doc(db, 'users', userId), {
        preferences: JSON.parse(preferences),
        createdAt: serverTimestamp()
      });

      localStorage.removeItem('user-preferences');
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
```

Run migration on first login:
```typescript
// src/App.tsx
useEffect(() => {
  if (user) {
    // Check if migration needed
    const migrated = localStorage.getItem('migrated-to-firebase');
    if (!migrated) {
      migrateLocalStorageToFirebase(user.uid).then(() => {
        localStorage.setItem('migrated-to-firebase', 'true');
      });
    }
  }
}, [user]);
```

**Deliverables:**
- [ ] Firestore security rules deployed
- [ ] Watchlist stored in Firestore
- [ ] Real-time sync working
- [ ] Migration script tested
- [ ] localStorage cleared after migration

---

### **Phase 2B: Multiple Data Sources (Weeks 3-4)**

#### Week 3: Add Rental Data

**Goal:** Show rental trends alongside purchase prices

**Data Sources:**
1. Upload ZORI (Zillow Observed Rent Index) CSV to Cloud Storage
2. Keep existing ZHVI (purchase) CSV

**Steps:**

1. **Download ZORI data:**
   - Visit: https://www.zillow.com/research/data/
   - Download "ZORI (Smoothed): All Homes Plus Multifamily Time Series"
   - CSV format, ~20-30MB

2. **Upload to Cloud Storage:**
```powershell
# Upload rental data CSV
gcloud storage cp zori-data.csv gs://poc-housing-data/zori-data.csv

# Set cache headers
gcloud storage objects update gs://poc-housing-data/zori-data.csv `
  --cache-control="public, max-age=86400"
```

3. **Create rental data provider:**
```typescript
// src/services/providers/rental.provider.ts
// Similar to csv.provider.ts but for rental data
export class RentalDataProvider extends BaseProvider {
  private static readonly RENTAL_CSV_URL =
    import.meta.env.VITE_RENTAL_CSV_URL ||
    'https://storage.googleapis.com/poc-housing-data/zori-data.csv';

  async loadRentalData(): Promise<MarketStats[]> {
    // Fetch, parse, cache (same pattern as CSV provider)
  }
}
```

4. **Merge purchase + rental data:**
```typescript
// src/hooks/useMarketData.ts
// Update to fetch both purchase and rental
const { data: purchaseData } = useQuery({
  queryKey: ['purchase-data'],
  queryFn: () => csvProvider.getAllMarkets()
});

const { data: rentalData } = useQuery({
  queryKey: ['rental-data'],
  queryFn: () => rentalProvider.getAllMarkets()
});

// Merge by market ID
const mergedData = purchaseData.map(market => ({
  ...market,
  rentalStats: rentalData.find(r => r.id === market.id)
}));
```

5. **Update chart to show both:**
```typescript
// src/components/DualTrendChart.tsx
export const DualTrendChart = ({ marketData }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={marketData.historicalData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="purchasePrice"
          stroke="#1E40AF"
          name="Home Price"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="rentPrice"
          stroke="#10B981"
          name="Median Rent"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
```

**Deliverables:**
- [ ] ZORI data uploaded to Cloud Storage
- [ ] Rental data provider created
- [ ] Data merged in useMarketData hook
- [ ] Dual-line chart component
- [ ] Toggle to switch between Purchase / Rental / Both views

---

#### Week 4: RentCast API Integration

**Goal:** Add real-time rental data via RentCast API (already have provider)

**Tasks:**

1. **Enhance RentCast provider:**
```typescript
// src/services/providers/rentcast.provider.ts
// Already exists, add rental-specific methods

async getRentalMarketStats(location: string): Promise<RentalStats> {
  const endpoint = `/v1/markets/${location}/rental-stats`;
  const response = await this.api.get(endpoint);

  return {
    medianRent: response.data.medianRent,
    rentGrowthRate: response.data.rentGrowthRate,
    vacancyRate: response.data.vacancyRate,
    rentalInventory: response.data.inventory,
    pricePerSqFt: response.data.pricePerSqFt
  };
}
```

2. **Add provider selection in settings:**
```typescript
// src/components/SettingsPanel.tsx
<select onChange={(e) => setRentalProvider(e.target.value)}>
  <option value="csv">ZORI CSV (Historical)</option>
  <option value="rentcast">RentCast API (Real-time)</option>
  <option value="mock">Mock Data (Offline)</option>
</select>
```

3. **Cloud Function for API proxy (optional):**
```typescript
// functions/src/rentcast-proxy.ts
// Proxy RentCast API calls to hide API key from client
import * as functions from 'firebase-functions';
import axios from 'axios';

export const getRentalStats = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { location } = data;
  const apiKey = functions.config().rentcast.apikey;

  const response = await axios.get(
    `https://api.rentcast.io/v1/markets/${location}/rental-stats`,
    { headers: { 'X-Api-Key': apiKey } }
  );

  return response.data;
});
```

**Deliverables:**
- [ ] RentCast provider enhanced for rental stats
- [ ] Provider selection in settings
- [ ] (Optional) Cloud Function API proxy
- [ ] Real-time rental data displayed

---

### **Phase 2C: Favorites (Week 5)**

**Features:**
- Star/favorite markets
- Add personal notes
- Quick access on dashboard

**Implementation:**

1. **Add favorite button to MarketCard:**
```typescript
// src/components/MarketCard.tsx
import { useFavorites } from '../hooks/useFavorites';

export const MarketCard = ({ market, onClick }) => {
  const { isFavorite, toggleFavorite } = useFavorites(market.marketId);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-start">
        <button onClick={onClick}>
          <h3 className="font-semibold">{market.marketName}</h3>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite();
          }}
          className="text-yellow-500 hover:text-yellow-600"
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>
      {/* Rest of card */}
    </div>
  );
};
```

2. **Create favorites hook:**
```typescript
// src/hooks/useFavorites.ts
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export const useFavorites = (marketId: string) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const checkFavorite = async () => {
      const q = query(
        collection(db, 'favorites'),
        where('userId', '==', user.uid),
        where('marketId', '==', marketId)
      );
      const snapshot = await getDocs(q);
      setIsFavorite(!snapshot.empty);
    };

    checkFavorite();
  }, [user, marketId]);

  const toggleFavorite = async () => {
    if (!user) return;

    if (isFavorite) {
      // Remove favorite
      const q = query(
        collection(db, 'favorites'),
        where('userId', '==', user.uid),
        where('marketId', '==', marketId)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(doc => deleteDoc(doc.ref));
      setIsFavorite(false);
    } else {
      // Add favorite
      await addDoc(collection(db, 'favorites'), {
        userId: user.uid,
        marketId,
        marketName: market.marketName,
        notes: '',
        createdAt: serverTimestamp()
      });
      setIsFavorite(true);
    }
  };

  return { isFavorite, toggleFavorite };
};
```

3. **Favorites page:**
```typescript
// src/pages/FavoritesPage.tsx
import { useFavoritesList } from '../hooks/useFavoritesList';

export const FavoritesPage = () => {
  const { favorites, loading } = useFavoritesList();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Favorites</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {favorites.map(favorite => (
          <MarketCard key={favorite.marketId} market={favorite} />
        ))}
      </div>
    </div>
  );
};
```

**Deliverables:**
- [ ] Favorite button on MarketCard
- [ ] useFavorites hook
- [ ] Favorites page
- [ ] Add/remove favorites working

---

### **Phase 2D: Rent vs. Own Calculator (Week 6)**

Already detailed above in Feature Roadmap.

**Key Components:**
- RentVsOwnCalculator.tsx (form + inputs)
- RentVsOwnChart.tsx (visualization)
- rentVsOwnCalculator.ts (calculation logic)
- Save calculations to Firestore

**Deliverables:**
- [ ] Calculator form with inputs
- [ ] Real-time calculation as user types
- [ ] Chart showing costs over time
- [ ] Break-even point highlighted
- [ ] Save calculations to Firestore
- [ ] View saved calculations

---

### **Phase 2E: Advanced Visualizations (Week 7)**

See Feature Roadmap above for details.

**Components:**
- MarketHeatmap.tsx (map view)
- PriceDistribution.tsx (histogram)
- RentToPriceScatter.tsx (scatter plot)
- SeasonalTrends.tsx (monthly patterns)

**Deliverables:**
- [ ] Heatmap showing markets on map
- [ ] Histogram of price distribution
- [ ] Scatter plot of rent-to-price ratio
- [ ] Seasonal trends chart

---

## Cost Analysis

### Serverless Cost Breakdown (Estimated Monthly)

#### Free Tier Usage (Typical for <1,000 users)

| Service | Free Tier | Expected Usage | Cost |
|---------|-----------|----------------|------|
| **Firebase Auth** | 10,000 users | 200 users | $0 |
| **Firestore** | 50k reads, 20k writes, 1GB | 10k reads, 5k writes | $0 |
| **Cloud Storage** | 5GB, 1GB egress | 100MB data, 50GB egress | $0-5 |
| **Cloud Run** | 2M requests, 360k GB-sec | 100k requests | $0 |
| **Cloud Functions** | 2M invocations, 400k GB-sec | 50k invocations | $0 |
| **RentCast API** | 50 calls/month | 50 calls | $0 |
| **Mapbox** | 50k map loads | 10k loads | $0 |
| **Total** | | | **$0-5/month** |

#### Growth Scenario (1,000-10,000 users)

| Service | Usage | Cost |
|---------|-------|------|
| **Firebase Auth** | 5,000 users | $0 (still free) |
| **Firestore** | 500k reads, 100k writes, 5GB | $5-10 |
| **Cloud Storage** | 500GB egress | $10-20 |
| **Cloud Run** | 1M requests | $5-10 |
| **Cloud Functions** | 500k invocations | $5 |
| **RentCast API** | 500 calls (upgrade to $49/month tier) | $49 |
| **Mapbox** | 200k map loads | $0 (still free) |
| **Total** | | **$75-100/month** |

**Key Insight:** Serverless remains very affordable until you hit significant scale (>10k users).

---

## Scalability Considerations

### When to Consider a Traditional Backend

**Serverless is great until:**

1. **API Costs Exceed Backend Costs**
   - RentCast: $49/month (500 calls) → $199/month (2,500 calls)
   - If you need >2,500 API calls/month, caching in your own DB becomes cheaper

2. **Data Processing Needs Increase**
   - Batch jobs (daily CSV imports, aggregations)
   - Complex queries that Firestore can't handle efficiently
   - Need for TimescaleDB (time-series optimizations)

3. **Firestore Limits Hit**
   - 1 write per second per document (watchlist updates)
   - 10 MB/s read bandwidth
   - Complex queries not supported

4. **Real-Time Features Required**
   - WebSockets for live price updates
   - Streaming data feeds

### Migration Path (If Needed Later)

**Hybrid Approach:**
```
Keep Firebase Auth (it's good!)
Keep Firestore for user data (watchlists, favorites)
Add Express backend for:
  • API proxying & caching
  • Batch data processing
  • Complex aggregations
Add PostgreSQL + TimescaleDB for:
  • Historical price data (time-series)
  • Market statistics
```

**When to Migrate:**
- User count > 10,000
- API costs > $200/month
- Need for complex analytics
- Revenue justifies infrastructure investment

**Cost at that scale:**
- Backend: $50-100/month (Cloud Run or Railway)
- Database: $50-100/month (managed PostgreSQL)
- Redis: $15-30/month
- Firebase: $20-40/month (just auth + user data)
- **Total: $135-270/month**

Still reasonable for a product generating revenue!

---

## Summary & Next Steps

### What We're Building (Phase 2)

**A feature-rich, serverless housing data app with:**
- ✅ User authentication (Firebase Auth - Google + Email)
- ✅ Cloud-synced watchlists (Firestore)
- ✅ Favorites with notes
- ✅ Multiple data sources (Purchase + Rental data)
- ✅ Rent vs. Own calculator
- ✅ Advanced visualizations (heatmap, distribution, scatter plots)
- ✅ Real-time data sync
- ✅ Offline support
- ✅ Mobile responsive

**All while staying serverless:**
- No servers to manage
- Auto-scaling
- ~$5-20/month for first 1,000 users
- ~$75-100/month for 10,000 users

### Timeline: 7-9 Weeks

| Phase | Duration | Features |
|-------|----------|----------|
| 2A: Auth | 2 weeks | Firebase Auth, user profiles, Firestore migration |
| 2B: Data | 2 weeks | Rental data, multiple providers, dual charts |
| 2C: Favorites | 1 week | Star markets, notes, favorites page |
| 2D: Calculator | 1 week | Rent vs. Own calculator with visualizations |
| 2E: Viz | 1 week | Heatmap, distribution, scatter plots |
| Testing | 1-2 weeks | QA, optimization, polish |

**Total: 7-9 weeks to feature-rich serverless app**

### Next Steps

**Immediate Actions:**

1. **Create Firebase Project**
   - Visit: https://console.firebase.google.com
   - Create new project
   - Enable Authentication (Google, Email)
   - Enable Firestore Database
   - Copy config to `.env`

2. **Install Firebase SDK**
   ```powershell
   cd housing-data-poc
   npm install firebase react-firebase-hooks
   ```

3. **Start Week 1 Implementation**
   - Set up Firebase service
   - Create LoginPage component
   - Integrate auth state into App.tsx
   - Test Google Sign-In flow

4. **Update CLAUDE.md**
   - Add Firebase setup instructions
   - Document new environment variables
   - Add deployment steps for Firestore rules

**Ready to Begin?**

Let me know when you'd like to start implementation! I can:
- Walk through Firebase setup step-by-step
- Create the auth components
- Set up Firestore structure
- Build any of the features in the roadmap

This serverless approach gives you maximum flexibility:
- Fast feature development
- Low infrastructure costs
- Easy to scale
- Migrate to backend only if/when needed

What feature would you like to tackle first? 🚀
