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
})