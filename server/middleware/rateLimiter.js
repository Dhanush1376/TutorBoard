import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { container } from '../core/container.js';

// ─── 1. HTTP Rate Limiter (Redis-backed) ───
const createStore = (prefix, failClosed = false) => {
  return new RedisStore({
    sendCommand: async (...args) => {
      try {
        const client = container.resolve('redis-main');
        if (!client) throw new Error('NOT_READY');
        const res = await client.call(...args);
        if (res === null) throw new Error('REDIS_DEGRADED');
        return res;
      } catch (err) {
        if (failClosed) {
          // SEC-13: Fail closed for sensitive routes (AI/Auth) to prevent abuse during Redis outage
          console.error(`[RateLimit:${prefix}] Redis failed - FAILING CLOSED`, err.message);
          return [9999, 60]; // Return a huge count to trigger rate limit
        }
        // Gracefully fail open for general HTTP routes
        return [1, 60];
      }
    },
    prefix: `ratelimit:${prefix}:`,
  });
};

/**
 * Enterprise-grade Rate Limiting
 * Handles IPv6 and Proxy scenarios correctly by relying on Express 'trust proxy'.
 */

export const httpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('http'),
  // Rely on default keyGenerator which is (req) => req.ip
  // This avoids ERR_ERL_KEY_GEN_IPV6 validation errors
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: 60,
    });
  },
});

// Dedicated limiter for expensive AI LLM calls
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 AI modifications per hour per user/IP
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('ai', true), // Fail closed
  keyGenerator: (req, res) => {
    // SEC-RATE: Prioritize user-based limiting to prevent authenticated account abuse
    if (req.user && req.user._id) {
      return `user:${req.user._id}`;
    }
    // SEC-RATE: Use the recommended ipKeyGenerator to avoid ERR_ERL_KEY_GEN_IPV6
    return req.ip;
  },
  message: {
    error: 'AI modification limit reached. Please try again in an hour.',
    code: 'AI_RATE_LIMIT_EXCEEDED'
  }
});

// ─── Auth Rate Limiters ───
export const authSigninRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth-signin', true), // Fail closed
  message: {
    error: 'Too many sign-in attempts. Please try again in 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

export const authSignupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth-signup', true), // Fail closed
  message: {
    error: 'Too many accounts created. Please try again in an hour.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// ─── 2. Socket Rate Limiter ───
const hitsBySocket = new Map();
const guestMonthlyHits = new Map();
const SOCKET_WINDOW_MS = 60_000;
const AUTH_SOCKET_MAX_HITS = 2000;
const GUEST_SOCKET_MAX_HITS = 200;
export const GUEST_MONTHLY_LIMIT = 1000;

// ─── 3. Periodic Cleanup ───
export const rateLimiterInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hitsBySocket.entries()) {
    const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
    if (fresh.length === 0) {
      hitsBySocket.delete(key);
    } else if (fresh.length !== timestamps.length) {
      hitsBySocket.set(key, fresh);
    }
  }

  const currentMonthKey = new Date().toISOString().substring(0, 7);
  for (const [key] of guestMonthlyHits.entries()) {
    if (!key.endsWith(currentMonthKey)) {
      guestMonthlyHits.delete(key);
    }
  }

  // SCALE-02: Hard cap guest monthly hits map to prevent memory leak
  if (guestMonthlyHits.size > 20000) {
    const keysToDelete = [...guestMonthlyHits.keys()].slice(0, 5000);
    keysToDelete.forEach(k => guestMonthlyHits.delete(k));
  }
}, 60 * 1000);

// ASYNC-09: Prevent the interval from keeping the process alive
rateLimiterInterval.unref();

export async function checkSocketRate(key) {
  const now = Date.now();
  const limit = key.startsWith('auth:') ? AUTH_SOCKET_MAX_HITS : GUEST_SOCKET_MAX_HITS;

  if (container.has('redis-main')) {
    const redisKey = `ratelimit:socket:${key}`;
    try {
      const client = container.resolve('redis-main');
      await client.zremrangebyscore(redisKey, 0, now - SOCKET_WINDOW_MS);
      await client.zadd(redisKey, now, now.toString());
      const count = await client.zcard(redisKey);
      await client.expire(redisKey, 65);
      return count <= limit;
    } catch (err) {
      console.warn('[RateLimit] Redis failed:', err.message);
    }
  }

  if (!hitsBySocket.has(key)) {
    if (hitsBySocket.size > 10000) {
      const oldestKeys = [...hitsBySocket.keys()].slice(0, 2000);
      oldestKeys.forEach(k => hitsBySocket.delete(k));
    }
    hitsBySocket.set(key, []);
  }
  const timestamps = hitsBySocket.get(key);
  const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
  fresh.push(now);
  hitsBySocket.set(key, fresh);
  return fresh.length <= limit;
}

export async function getGuestUsageCount(ip) {
  const monthKey = new Date().toISOString().substring(0, 7);
  const usageKey = `usage:guest:ip:${ip}:${monthKey}`;
  if (container.has('redis-main')) {
    try {
      const client = container.resolve('redis-main');
      const count = await client.get(usageKey).then(c => parseInt(c || '0', 10));
      return count;
    } catch (err) {
      console.warn('[RateLimit] Redis failed (getUsage):', err.message);
    }
  }
  return guestMonthlyHits.get(`${ip}:${monthKey}`) || 0;
}

export async function checkGuestUsage(ip) {
  const monthKey = new Date().toISOString().substring(0, 7);
  const usageKey = `usage:guest:ip:${ip}:${monthKey}`;
  if (container.has('redis-main')) {
    try {
      const client = container.resolve('redis-main');
      const current = await client.incr(usageKey);
      if (current === 1) await client.expire(usageKey, 32 * 24 * 3600);
      return current <= GUEST_MONTHLY_LIMIT;
    } catch (err) {
      console.warn('[RateLimit] Redis failed (checkUsage):', err.message);
    }
  }
  const localKey = `${ip}:${monthKey}`;
  const count = (guestMonthlyHits.get(localKey) || 0) + 1;
  guestMonthlyHits.set(localKey, count);
  return count <= GUEST_MONTHLY_LIMIT;
}

export function cleanupSocket(key) {
  hitsBySocket.delete(key);
  if (container.has('redis-main')) {
    try {
      const client = container.resolve('redis-main');
      client.del(`ratelimit:socket:${key}`).catch(() => { });
    } catch (err) {}
  }
}

export const strictGuestLimiter = async (req, res, next) => {
  if (req.user) return next();
  const isAllowed = await checkSocketRate(`guest:${req.ip}`);
  if (!isAllowed) {
    return res.status(429).json({ error: 'Guest limit exceeded.', retryAfterSeconds: 60 });
  }
  next();
};
