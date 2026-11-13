import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const apiProxy = process.env.CRM_API_PROXY || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Same-origin /api avoids CSRF cookie failures when the page host
    // and the API host are different sites.
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true,
      },
    },
    watch: {
      // Avoid random full reloads from unrelated folders / antivirus file touches.
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    fileParallelism: false,
    env: {
      VITE_API_BASE_URL: '',
      VITE_DEFAULT_LANGUAGE: 'en',
    },
  },
})
