// API Configuration
export const API_BASE_URL = 'https://api.rentcast.io/v1';
export const API_KEY = import.meta.env.VITE_RENTCAST_API_KEY || '';

// localStorage keys
export const WATCHLIST_STORAGE_KEY = 'housing-watchlist';

// Time ranges
export const TIME_RANGES = ['1M', '6M', '1Y', '5Y', 'MAX'] as const;

// Mock markets for initial display
export const MOCK_MARKETS = [
  { id: '1', name: 'New York, NY', city: 'New York', state: 'NY', zipCode: '10001' },
  { id: '2', name: 'Los Angeles, CA', city: 'Los Angeles', state: 'CA', zipCode: '90001' },
  { id: '3', name: 'Austin, TX', city: 'Austin', state: 'TX', zipCode: '78701' },
  { id: '4', name: 'Columbus, OH', city: 'Columbus', state: 'OH', zipCode: '43201' },
  { id: '5', name: 'Houston, TX', city: 'Houston', state: 'TX', zipCode: '77001' },
  { id: '6', name: 'San Antonio, TX', city: 'San Antonio', state: 'TX', zipCode: '78201' },
];

// Design system colors (matching Tailwind config)
export const COLORS = {
  primary: '#1E40AF',
  priceUp: '#10B981',
  priceDown: '#EF4444',
  neutral: '#6B7280',
} as const;
