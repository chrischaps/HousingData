/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'text-positive',
    'text-negative',
    'bg-primary',
    'text-primary',
    'hover:text-blue-800',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        positive: '#10B981',
        negative: '#EF4444',
      },
    },
  },
  plugins: [],
}
