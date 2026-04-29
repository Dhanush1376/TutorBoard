import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Redis } from 'ioredis';
import redisClient from '../utils/core/redis.js';
import { Request, Response, NextFunction } from 'express';

// ─── 1. HTTP Rate Limiter (Redis-backed) ───
let httpStore: any;
if (process.env.REDIS_URL) {
  try {
    const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
    httpStore = new RedisStore({
      // @ts-ignore
      sendCommand: (...args: string[]) => client.call(...args),
    });
  } catch (e) {
    console.error('[RateLimit] CRITICAL: Redis unavailable.');
  }
}

export const httpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: httpStore,
  skip: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress;
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: 60,
    });
  },
});

// ─── 2. Socket Rate Limiter ───
const hitsBySocket = new Map<string, number[]>();
const guestMonthlyHits = new Map<string, number>();
const SOCKET_WINDOW_MS = 60_000;
const AUTH_SOCKET_MAX_HITS = 2000;
const GUEST_SOCKET_MAX_HITS = 200;
export const GUEST_MONTHLY_LIMIT = 1000;

export async function checkSocketRate(key: string): Promise<boolean> {
  const now = Date.now();
  const limit = key.startsWith('auth:') ? AUTH_SOCKET_MAX_HITS : GUEST_SOCKET_MAX_HITS;

  if (redisClient.isConnected) {
    const redisKey = `ratelimit:socket:${key}`;
    try {
      const multi = redisClient.client.multi();
      multi.zremrangebyscore(redisKey, 0, now - SOCKET_WINDOW_MS);
      multi.zadd(redisKey, now, now.toString());
      multi.zcard(redisKey);
      multi.expire(redisKey, 65);

      const results = await multi.exec();
      if (results) {
        const count = results[2][1] as number;
        return count <= limit;
      }
    } catch (err: any) {
      console.warn('[RateLimit] Redis failed:', err.message);
    }
  }

  // Fallback to memory
  if (!hitsBySocket.has(key)) hitsBySocket.set(key, []);
  const timestamps = hitsBySocket.get(key)!;
  const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
  fresh.push(now);
  hitsBySocket.set(key, fresh);

  return fresh.length <= limit;
}

export async function getGuestUsageCount(ip: string): Promise<number> {
  const monthKey = new Date().toISOString().substring(0, 7);
  const usageKey = `usage:guest:ip:${ip}:${monthKey}`;

  if (redisClient.isConnected) {
    try {
      const current = await redisClient.client.get(usageKey);
      return parseInt(current || '0', 10);
    } catch (err: any) {
      console.warn('[RateLimit] Redis failed:', err.message);
    }
  }

  const localKey = `${ip}:${monthKey}`;
  return guestMonthlyHits.get(localKey) || 0;
}

export async function checkGuestUsage(ip: string): Promise<boolean> {
  const monthKey = new Date().toISOString().substring(0, 7);
  const usageKey = `usage:guest:ip:${ip}:${monthKey}`;

  if (redisClient.isConnected) {
    try {
      const current = await redisClient.client.incr(usageKey);
      if (current === 1) await redisClient.client.expire(usageKey, 32 * 24 * 3600);
      return current <= GUEST_MONTHLY_LIMIT;
    } catch (err: any) {
      console.warn('[RateLimit] Redis failed:', err.message);
    }
  }

  const localKey = `${ip}:${monthKey}`;
  const currentCount = guestMonthlyHits.get(localKey) || 0;
  const newCount = currentCount + 1;
  guestMonthlyHits.set(localKey, newCount);

  return newCount <= GUEST_MONTHLY_LIMIT;
}

export function cleanupSocket(key: string): void {
  hitsBySocket.delete(key);
  if (redisClient.isConnected) {
    redisClient.client.del(`ratelimit:socket:${key}`).catch(() => { });
  }
}

export const strictGuestLimiter = async (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).user) return next();

  const isAllowed = await checkSocketRate(`guest:${req.ip}`);
  if (!isAllowed) {
    return res.status(429).json({
      error: 'Guest limit exceeded.',
      retryAfterSeconds: 60,
    });
  }
  next();
};
