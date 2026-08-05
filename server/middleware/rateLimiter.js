import { rateLimit } from 'express-rate-limit';
import RateLimit from '../models/RateLimit.js';

// ─── 1. Custom MongoDB Rate Limit Store ───
class MongoStore {
  constructor(prefix, failClosed = false) {
    this.prefix = `ratelimit:${prefix}:`;
    this.failClosed = failClosed;
    this.windowMs = 60 * 1000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    try {
      const fullKey = `${this.prefix}${key}`;
      const now = Date.now();
      const expiresAt = new Date(now + this.windowMs);

      const doc = await RateLimit.findOneAndUpdate(
        { key: fullKey },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt }
        },
        { upsert: true, returnDocument: 'after' }
      );

      if (doc.expiresAt.getTime() <= now) {
        const resetDoc = await RateLimit.findOneAndUpdate(
          { key: fullKey },
          { $set: { count: 1, expiresAt } },
          { returnDocument: 'after' }
        );
        return {
          totalHits: resetDoc.count,
          resetTime: resetDoc.expiresAt
        };
      }

      return {
        totalHits: doc.count,
        resetTime: doc.expiresAt
      };
    } catch (err) {
      console.error(`[RateLimit:${this.prefix}] Mongo command failed:`, err.message || err);
      if (this.failClosed) {
        console.error(`[RateLimit:${this.prefix}] Mongo failed - FAILING CLOSED`, err.message);
        return {
          totalHits: 9999,
          resetTime: new Date(Date.now() + this.windowMs)
        };
      }
      return {
        totalHits: 1,
        resetTime: new Date(Date.now() + this.windowMs)
      };
    }
  }

  async decrement(key) {
    try {
      const fullKey = `${this.prefix}${key}`;
      await RateLimit.updateOne({ key: fullKey }, { $inc: { count: -1 } });
    } catch (err) {
      console.error(`[RateLimit:${this.prefix}] Decrement failed:`, err.message);
    }
  }

  async resetKey(key) {
    try {
      const fullKey = `${this.prefix}${key}`;
      await RateLimit.deleteOne({ key: fullKey });
    } catch (err) {
      console.error(`[RateLimit:${this.prefix}] Reset key failed:`, err.message);
    }
  }
}

const createStore = (prefix, failClosed = false) => {
  return new MongoStore(prefix, failClosed);
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
    if (req.user && req.user._id) {
      return `user:${req.user._id}`;
    }
    // express-rate-limit 7+ requires an explicit string. IPv6 req.ip might trigger warnings
    // if ipKeyGenerator isn't used, but we can safely just return req.ip || 'unknown'
    return req.ip || 'unknown';
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

// ─── 2. Socket Rate Limiter (In-Memory for performance) ───
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

  if (guestMonthlyHits.size > 20000) {
    const keysToDelete = [...guestMonthlyHits.keys()].slice(0, 5000);
    keysToDelete.forEach(k => guestMonthlyHits.delete(k));
  }
}, 60 * 1000);

rateLimiterInterval.unref();

export async function checkSocketRate(key) {
  const now = Date.now();
  const limit = key.startsWith('auth:') ? AUTH_SOCKET_MAX_HITS : GUEST_SOCKET_MAX_HITS;

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
  try {
    const doc = await RateLimit.findOne({ key: usageKey });
    return doc ? doc.count : 0;
  } catch (err) {
    console.warn('[RateLimit] MongoDB failed (getUsage):', err.message);
  }
  return guestMonthlyHits.get(`${ip}:${monthKey}`) || 0;
}

export async function checkGuestUsage(ip) {
  const monthKey = new Date().toISOString().substring(0, 7);
  const usageKey = `usage:guest:ip:${ip}:${monthKey}`;
  try {
    const expiresAt = new Date(Date.now() + 32 * 24 * 3600 * 1000);
    const doc = await RateLimit.findOneAndUpdate(
      { key: usageKey },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt }
      },
      { upsert: true, returnDocument: 'after' }
    );
    return doc.count <= GUEST_MONTHLY_LIMIT;
  } catch (err) {
    console.warn('[RateLimit] MongoDB failed (checkUsage):', err.message);
  }
  const localKey = `${ip}:${monthKey}`;
  const count = (guestMonthlyHits.get(localKey) || 0) + 1;
  guestMonthlyHits.set(localKey, count);
  return count <= GUEST_MONTHLY_LIMIT;
}

export function cleanupSocket(key) {
  hitsBySocket.delete(key);
}

export const strictGuestLimiter = async (req, res, next) => {
  if (req.user) return next();
  const isAllowed = await checkSocketRate(`guest:${req.ip}`);
  if (!isAllowed) {
    return res.status(429).json({ error: 'Guest limit exceeded.', retryAfterSeconds: 60 });
  }
  next();
};
