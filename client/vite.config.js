import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { fileURLToPath } from 'node:url';
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
const BACKEND = process.env.TB_BACKEND || '127.0.0.1:5001';

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
    }),
    tailwindcss(),
  ],
  server: {
    // Scene Lab (dev only) reads the golden scenes from the server package.
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        fileURLToPath(new URL('../server/engine/scene/fixtures', import.meta.url)),
        // the geometry resolver is shared with the server (pure, no imports)
        fileURLToPath(new URL('../server/engine/scene/resolveGeometry.ts', import.meta.url)),
      ],
    },
    port: 5173,
    strictPort: false,
    host: true, // Listen on all local addresses
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/api': {
        target: `http://${BACKEND}`,
        changeOrigin: true,
        secure: false,
        ws: true,
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
        target: `ws://${BACKEND}`,
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
        target: `ws://${BACKEND}`,
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
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks'
  }
});
