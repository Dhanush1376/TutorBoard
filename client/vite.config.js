import { defineConfig } from 'vite'
import reactPlugin from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const react = reactPlugin.default || reactPlugin;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
      '/teaching': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
