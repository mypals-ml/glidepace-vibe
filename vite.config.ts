/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import vitePluginVercelMock from './vite-plugin-vercel-mock';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), vitePluginVercelMock()],
  test: {
    environment: 'jsdom',
    globals: true
  }
})
