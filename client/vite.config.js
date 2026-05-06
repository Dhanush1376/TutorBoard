import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: ['react-window'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/teaching': {
        target: 'http://127.0.0.1:3001',
        ws: true,
      }
    }
  }
})
