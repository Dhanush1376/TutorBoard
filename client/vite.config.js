import { defineConfig } from 'vite';
import reactPlugin from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const react = reactPlugin.default || reactPlugin;

/**
 * Vite Configuration - TutorBoard
 * 
 * Highly Resilient Production-Grade Setup:
 * 1. Pure Fast Refresh configuration aligned with refactored Context/Hook modules.
 * 2. Deterministic Proxy routing pointing directly to IPv4 backend loopback (127.0.0.1:5000).
 * 3. Graceful fallback/error handling preventing ECONNREFUSED crash loops.
 * 4. Optimized WebSocket (ws: true) proxying with long timeout thresholds.
 */
export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
    }),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: false,
    host: true, // Listen on all local addresses
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        timeout: 120000,
        proxyTimeout: 120000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.error(`[Vite Proxy Error] Target unreachable for ${req.method} ${req.url}:`, err.message);
            if (res && !res.headersSent) {
              res.writeHead(503, { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store' 
              });
              res.end(JSON.stringify({ 
                success: false,
                error: 'Backend service temporarily unreachable', 
                details: err.message, 
                code: 'ECONNREFUSED' 
              }));
            }
          });
        },
      },
      '/socket.io': {
        target: 'ws://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
        secure: false,
        timeout: 120000,
        proxyTimeout: 120000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite WS Proxy Error] /socket.io connection error:', err.message);
            // Catch underlying socket drop to prevent dev server crash loop
          });
        },
      },
      '/teaching': {
        target: 'ws://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
        secure: false,
        timeout: 120000,
        proxyTimeout: 120000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite WS Proxy Error] /teaching connection error:', err.message);
          });
        },
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});
