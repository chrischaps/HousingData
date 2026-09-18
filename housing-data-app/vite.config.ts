import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // The app imports ../shared/* (market key + CSV helpers shared with the
      // data pipeline scripts), which lives one level above this package.
      allow: ['..'],
    },
  },
})
