import { logger } from './logger.js';

/**
 * Execute a function with timeout and retry logic
 */
export async function withRetry(fn, providerName, maxRetries = 2, timeoutMs = 8000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      
      const result = await fn(controller.signal);
      clearTimeout(timer);
      return result;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        logger.warn(`${providerName} timed out after ${timeoutMs}ms (Attempt ${attempt + 1})`);
      } else {
        logger.warn(`${providerName} failed: ${err.message} (Attempt ${attempt + 1})`);
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }
  
  throw lastError;
}
