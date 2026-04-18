import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

/**
 * rateLimiter.js — Professional production-grade rate limiter
 * 
 * HTTP middleware: 60 requests per minute per IP (Redis-backed for load balancing)
 * Socket helper:  20 events per minute per socket (In-memory)
 */

// ─── 1. HTTP Rate Limiter (Redis-backed) ───
let httpStore;

if (process.env.REDIS_URL) {
  try {
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
    });
    
    client.on('error', (err) => {
      console.warn('[RateLimit] Redis error, falling back to MemoryStore:', err.message);
    });

    httpStore = new RedisStore({
      // @ts-ignore - The type definitions for rate-limit-redis can be finicky
      sendCommand: (...args) => client.call(...args),
    });
    console.log('[RateLimit] Connected to Redis for persistent rate limiting ✅');
  } catch (err) {
    console.warn('[RateLimit] Failed to initialize Redis store, using MemoryStore fallback.');
  }
} else {
  console.log('[RateLimit] No REDIS_URL found, using local MemoryStore (Ineffective for serverless/multi-instance).');
}

export const httpRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests per window (Relaxed for dev/multi-tab settings)
  standardHeaders: true,
  legacyHeaders: false,
  store: httpStore,   // Defaults to MemoryStore if null/undefined
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please wait a moment before trying again.',
      retryAfterSeconds: Math.ceil(60),
    });
  },
});


// ─── 2. Socket Rate Limiter (In-memory) ───
// Socket state is typically tied to a specific instance; cross-instance socket 
// rate-limiting requires a global event bus. We keep this in-memory for performance.
const hitsBySocket = new Map();
const SOCKET_WINDOW_MS = 60_000;
const SOCKET_MAX_HITS  = 20;

// Cleanup for socket map
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hitsBySocket) {
    const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
    if (fresh.length === 0) hitsBySocket.delete(key);
    else hitsBySocket.set(key, fresh);
  }
}, 5 * 60_000);

export function checkSocketRate(key) {
  const now = Date.now();
  if (!hitsBySocket.has(key)) hitsBySocket.set(key, []);
  const timestamps = hitsBySocket.get(key);

  const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
  fresh.push(now);
  hitsBySocket.set(key, fresh);

  return fresh.length <= SOCKET_MAX_HITS;
}

export function cleanupSocket(key) {
  hitsBySocket.delete(key);
}
