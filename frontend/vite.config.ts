import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // In Docker, proxy to backend service name; otherwise use localhost
        target: process.env.DOCKER_ENV === 'true' 
          ? 'http://backend:8080' 
          : (process.env.VITE_API_URL || 'http://localhost:8081'),
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
})
