/**
 * Standardized Logger for AI Operations
 */
export const logger = {
  info: (msg, data = {}) => {
    console.log(`[AI-ROUTER:INFO] ${msg}`, data);
  },
  warn: (msg, data = {}) => {
    console.warn(`[AI-ROUTER:WARN] ${msg}`, data);
  },
  error: (msg, err = {}) => {
    console.error(`[AI-ROUTER:ERROR] ${msg}`, err.message || err);
  }
};
