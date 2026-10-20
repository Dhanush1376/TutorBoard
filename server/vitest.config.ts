import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // setup.ts starts an in-memory mongod per test file; with every file in
    // parallel that start can exceed the 10s default and fail a random file.
    hookTimeout: 60000,
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
