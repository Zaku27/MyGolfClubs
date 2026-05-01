import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
  },
  plugins: [react(), tailwindcss(), cloudflare()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separate vendor chunks
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-helmet-async')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts'
          }
          if (id.includes('node_modules/papaparse') || id.includes('node_modules/zustand')) {
            return 'vendor-utils'
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})