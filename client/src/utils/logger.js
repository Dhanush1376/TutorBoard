/**
 * Logger.js
 * Simple wrapper for console.log that only executes in development.
 * This allows Vite to tree-shake logs in production and avoids overhead.
 */

const logger = {
  log: (...args) => {
    if (import.meta.env.DEV) {
      import.meta.env.DEV && console.log(...args);
    }
  },
  warn: (...args) => {
    if (import.meta.env.DEV) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // We usually want to keep errors even in production for Sentry or monitoring,
    // but the user specifically asked for console.log behind dev flag.
    console.error(...args);
  },
  debug: (...args) => {
    if (import.meta.env.DEV) {
      console.debug(...args);
    }
  }
};

export default logger;
