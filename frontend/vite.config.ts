import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    strictPort: false,
    host: '0.0.0.0', // Listen on all network interfaces
    hmr: {
      clientPort: 443, // For ngrok HTTPS
    },
    allowedHosts: [
      '.loca.lt', // Allow all localtunnel subdomains
      'localhost',
      '127.0.0.1',
    ],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
