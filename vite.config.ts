/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { qrcode } from 'vite-plugin-qrcode'

import vitePluginVercelMock from './vite-plugin-vercel-mock';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), qrcode(), vitePluginVercelMock()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@dnd-kit')) return 'vendor-dnd';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('i18next')) return 'vendor-i18n';
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true
  },
  server: {
    host: '0.0.0.0', // allow testing from mobile devices on local network
    port: 5173
  }
})
