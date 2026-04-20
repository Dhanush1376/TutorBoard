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
  max: 1000000, // Effectively unlimited for development
  standardHeaders: true,
  legacyHeaders: false,
  store: httpStore,
  skip: (req) => {
    // skip rate limiting for local development
    const ip = req.ip || req.connection.remoteAddress;
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit unreachable (Unlimited Mode)',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: 60,
    });
  },
});

// ─── 2. Socket Rate Limiter (Redis-backed with Memory Fallback) ───
const hitsBySocket = new Map();
const guestMonthlyHits = new Map(); // Fallback for month-level guest usage
const SOCKET_WINDOW_MS = 60_000;
const SOCKET_MAX_HITS  = 10000; // Increased to prevent drawing/doubt blocking
export const GUEST_MONTHLY_LIMIT = 1000; 

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

/**
 * SEC-10: Monthly Guest Usage Enforcement with Redis + Memory Fallback
 */
export async function checkGuestUsage(ip) {
  const monthKey = new Date().toISOString().substring(0, 7);
  const usageKey = `usage:guest:ip:${ip}:${monthKey}`;

  if (redisClient.isConnected) {
    try {
      const current = await redisClient.client.incr(usageKey);
      if (current === 1) await redisClient.client.expire(usageKey, 32 * 24 * 3600);
      return current <= GUEST_MONTHLY_LIMIT;
    } catch (err) {
      console.warn('[RateLimit] Redis guest usage check failed, falling back to memory:', err.message);
    }
  }

  // Fallback to in-memory map
  const localKey = `${ip}:${monthKey}`;
  const currentCount = guestMonthlyHits.get(localKey) || 0;
  const newCount = currentCount + 1;
  guestMonthlyHits.set(localKey, newCount);

  return newCount <= GUEST_MONTHLY_LIMIT;
}

/**
 * Returns current count for a guest IP
 */
export async function getGuestUsageCount(ip) {
  const monthKey = new Date().toISOString().substring(0, 7);
  const usageKey = `usage:guest:ip:${ip}:${monthKey}`;

  if (redisClient.isConnected) {
    try {
      const current = await redisClient.client.get(usageKey);
      return parseInt(current || '0', 10);
    } catch (err) {
      console.warn('[RateLimit] Redis guest usage get failed:', err.message);
    }
  }

  const localKey = `${ip}:${monthKey}`;
  return guestMonthlyHits.get(localKey) || 0;
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
  const currentMonth = new Date().toISOString().substring(0, 7);

  // Cleanup short-term socket rate limits
  for (const [key, timestamps] of hitsBySocket) {
    const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
    if (fresh.length === 0) hitsBySocket.delete(key);
    else hitsBySocket.set(key, fresh);
  }

  // Cleanup guest usage for past months
  for (const [key] of guestMonthlyHits) {
    if (!key.endsWith(currentMonth)) guestMonthlyHits.delete(key);
  }
}, 5 * 60_000);

/**
 * SEC-10: Strict Guest Limiter for expensive operations
 * Differentiates between authenticated users and guests using req.user.
 */
export const strictGuestLimiter = async (req, res, next) => {
  // If user is identifies, skip strict guest limit (global rate limiter still applies)
  if (req.user) return next();

  const isAllowed = await checkSocketRate(`guest:${req.ip}`);
  if (!isAllowed) {
    return res.status(429).json({
      error: 'Guest limit exceeded. Please sign in to continue using this feature.',
      retryAfterSeconds: 60,
    });
  }
  next();
};
