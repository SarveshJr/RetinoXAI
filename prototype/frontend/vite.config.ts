import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname ?? '', './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the MATLAB REST backend during development.
      '/api': {
        // Use 127.0.0.1 (not "localhost"): Node resolves localhost to IPv6 ::1
        // first, but the MATLAB ServerSocket binds IPv4 only, so ::1 is refused.
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
