import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import redisClient from '../utils/core/redis.js';

/**
 * rateLimiter.js — Professional production-grade rate limiter
 * SEC-06: Hardened with Redis-backed socket rate limiting for multi-instance support.
 */

// ─── 1. HTTP Rate Limiter (Redis-backed) ───
let httpStore;
if (process.env.REDIS_URL) {
  try {
    const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
    httpStore = new RedisStore({
      // @ts-ignore
      sendCommand: (...args) => client.call(...args),
    });
  } catch (e) { /* fallback to memory */ }
}

export const httpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: httpStore,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please wait a moment before trying again.',
      retryAfterSeconds: 60,
    });
  },
});

// ─── 2. Socket Rate Limiter (Redis-backed with Memory Fallback) ───
const hitsBySocket = new Map();
const SOCKET_WINDOW_MS = 60_000;
const SOCKET_MAX_HITS  = 20;

/**
 * SEC-06: Global Rate Limit Check
 */
export async function checkSocketRate(key) {
  const now = Date.now();
  
  // 1. Try Redis for global instance-wide limiting
  if (redisClient.isConnected) {
    const redisKey = `ratelimit:socket:${key}`;
    try {
      const multi = redisClient.client.multi();
      multi.zremrangebyscore(redisKey, 0, now - SOCKET_WINDOW_MS);
      multi.zadd(redisKey, now, now.toString());
      multi.zcard(redisKey);
      multi.expire(redisKey, 65); // Just over 1 minute
      
      const results = await multi.exec();
      const count = results[2][1];
      return count <= SOCKET_MAX_HITS;
    } catch (err) {
      console.warn('[RateLimit] Redis socket check failed, falling back to memory:', err.message);
    }
  }

  // 2. Fallback to Local Memory (Safe for single instance or if Redis is down)
  if (!hitsBySocket.has(key)) hitsBySocket.set(key, []);
  const timestamps = hitsBySocket.get(key);
  const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
  fresh.push(now);
  hitsBySocket.set(key, fresh);

  return fresh.length <= SOCKET_MAX_HITS;
}

export function cleanupSocket(key) {
  hitsBySocket.delete(key);
  if (redisClient.isConnected) {
    redisClient.client.del(`ratelimit:socket:${key}`).catch(() => {});
  }
}

// Cleanup local memory map periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hitsBySocket) {
    const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
    if (fresh.length === 0) hitsBySocket.delete(key);
    else hitsBySocket.set(key, fresh);
  }
}, 5 * 60_000);
