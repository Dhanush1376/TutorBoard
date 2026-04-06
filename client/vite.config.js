import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('konva') || id.includes('@react-spring/konva')) {
              return 'vendor-konva';
            }
            if (id.includes('framer-motion') || id.includes('@react-spring/web')) {
              return 'vendor-motion';
            }
            if (id.includes('three') || id.includes('@react-three')) {
              return 'vendor-three';
            }
            if (id.includes('lucide') || id.includes('clsx') || id.includes('tailwind')) {
              return 'vendor-ui';
            }
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'konva', 'react-konva', 'framer-motion', 'zustand'],
    exclude: ['three', '@react-three/fiber'],
  },
  server: {
    fs: { allow: ['..'] },
  },
})
