/**
 * redis.js — TutorBoard v4.0
 *
 * Upgrades over v3:
 * - Dedicated pub/sub clients (ioredis requires separate connections for subscribe)
 * - publish() / subscribe() / unsubscribe() for multi-instance streaming fan-out
 * - incr() / decr() for atomic counters (replaces non-atomic get+set patterns)
 * - All ops silently no-op when Redis unavailable (graceful in-memory fallback)
 * - getClient() escape hatch for advanced pipeline operations
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.SESSION_STORE_URL || null;

const BASE_CONFIG = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    if (times > 10) return null; // stop retrying — prevents log spam
    return Math.min(times * 200, 2000);
  },
};

class RedisClient {
  constructor() {
    this.client = null;
    this.pubClient = null;
    this.subClient = null;
    this.isConnected = false;
    this.isConnecting = false;
    this._subHandlers = new Map(); // channel → Set<handler>

    if (REDIS_URL) {
      this._connect();
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[Redis] No REDIS_URL in production — in-memory fallback. Multi-instance streaming disabled.');
    }
  }

  _connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.client = new Redis(REDIS_URL, BASE_CONFIG);
      this.client.on('connect', () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log('✅ [Redis] Main client connected.');
      });
      this.client.on('error', (err) => {
        this.isConnected = false;
        this.isConnecting = false;
        console.error(`❌ [Redis] Main: ${err.message}`);
      });

      this.pubClient = new Redis(REDIS_URL, BASE_CONFIG);
      this.pubClient.on('error', (err) => console.error(`❌ [Redis] Pub: ${err.message}`));

      this.subClient = new Redis(REDIS_URL, BASE_CONFIG);
      this.subClient.on('error', (err) => console.error(`❌ [Redis] Sub: ${err.message}`));
      this.subClient.on('message', (channel, message) => {
        const handlers = this._subHandlers.get(channel);
        if (handlers) {
          for (const h of handlers) {
            try { h(message, channel); } catch (_) { /* absorb handler errors */ }
          }
        }
      });
    } catch (err) {
      this.isConnecting = false;
      console.error(`❌ [Redis] Init failed: ${err.message}`);
    }
  }

  // ── Pub/Sub — multi-instance streaming fan-out ─────────────────────────────

  /**
   * Publish a message to a Redis channel.
   * Other Node instances subscribed to the same channel will receive it.
   */
  async publish(channel, message) {
    if (!this.pubClient) return 0;
    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.pubClient.publish(channel, payload);
    } catch { return 0; }
  }

  /**
   * Subscribe a handler to a Redis channel.
   * Multiple handlers per channel are supported.
   */
  async subscribe(channel, handler) {
    if (!this.subClient) return;
    try {
      if (!this._subHandlers.has(channel)) {
        this._subHandlers.set(channel, new Set());
        await this.subClient.subscribe(channel);
      }
      this._subHandlers.get(channel).add(handler);
    } catch (err) {
      console.error(`[Redis] subscribe error: ${err.message}`);
    }
  }

  /**
   * Remove a handler (or all handlers) from a channel.
   * Automatically unsubscribes from Redis when no handlers remain.
   */
  async unsubscribe(channel, handler) {
    if (!this.subClient) return;
    const handlers = this._subHandlers.get(channel);
    if (!handlers) return;
    if (handler) handlers.delete(handler);
    else handlers.clear();
    if (handlers.size === 0) {
      this._subHandlers.delete(channel);
      try { await this.subClient.unsubscribe(channel); } catch { /* noop */ }
    }
  }

  // ── Standard K/V ──────────────────────────────────────────────────────────

  async get(key) {
    if (!this.isConnected) return null;
    try { return await this.client.get(key); } catch { return null; }
  }

  async set(key, value, ttlSeconds = null) {
    if (!this.isConnected) return false;
    try {
      if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
      else await this.client.set(key, value);
      return true;
    } catch { return false; }
  }

  async del(key) {
    if (!this.isConnected) return false;
    try { await this.client.del(key); return true; } catch { return false; }
  }

  /** Atomic increment — safe for rate limiting counters */
  async incr(key) {
    if (!this.isConnected) return null;
    try { return await this.client.incr(key); } catch { return null; }
  }

  async decr(key) {
    if (!this.isConnected) return null;
    try { return await this.client.decr(key); } catch { return null; }
  }

  // ── Sorted sets (rate limiting sliding window) ─────────────────────────────

  async zadd(key, score, member) {
    if (!this.isConnected) return false;
    try { await this.client.zadd(key, score, member); return true; } catch { return false; }
  }

  async zremrangebyscore(key, min, max) {
    if (!this.isConnected) return 0;
    try { return await this.client.zremrangebyscore(key, min, max); } catch { return 0; }
  }

  async zcard(key) {
    if (!this.isConnected) return 0;
    try { return await this.client.zcard(key); } catch { return 0; }
  }

  async expire(key, seconds) {
    if (!this.isConnected) return false;
    try { await this.client.expire(key, seconds); return true; } catch { return false; }
  }

  // ── Hash ops ───────────────────────────────────────────────────────────────

  async hset(key, field, value) {
    if (!this.isConnected) return false;
    try { await this.client.hset(key, field, value); return true; } catch { return false; }
  }

  async hget(key, field) {
    if (!this.isConnected) return null;
    try { return await this.client.hget(key, field); } catch { return null; }
  }

  async hgetall(key) {
    if (!this.isConnected) return null;
    try { return await this.client.hgetall(key); } catch { return null; }
  }

  /** Escape hatch for pipeline / advanced commands */
  getClient() { return this.client; }
}

export default new RedisClient();
