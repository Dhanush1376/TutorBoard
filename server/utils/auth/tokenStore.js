import RevokedToken from '../../models/RevokedToken.js';
import crypto from 'crypto';
import { container } from '../../core/container.js';
import * as Sentry from "@sentry/node";

/**
 * TokenStore — Persistence-backed store for short-lived OAuth exchange codes and token revocation.
 * SEC-04: Hardened with Redis fallback to prevent DOS during Mongo outages.
 */

class TokenStore {
  constructor() {
    this.codes = new Map();
    this.TTL_MS = 60 * 1000;
  }

  async createCode(token) {
    const code = crypto.randomBytes(32).toString('hex');
    const data = {
      token,
      expiresAt: Date.now() + this.TTL_MS,
    };

    // SEC-04: Primary store in Redis for persistence across restarts/multi-instance
    let savedInRedis = false;
    try {
      const client = container.resolve('redis-main');
      savedInRedis = await client.set(`auth:code:${code}`, JSON.stringify(data), 'EX', 60);
    } catch (err) {
      savedInRedis = false;
    }
    
    if (!savedInRedis) {
      // REDIS-05: High-severity alert for volatile memory fallback
      console.error(`[CRITICAL] Redis unavailable for OAuth code persistence! Falling back to volatile memory.`);
      console.error(`[CRITICAL] This session will break if the server restarts before code exchange.`);
      
      Sentry.captureMessage('Redis unavailable for OAuth code persistence', {
        level: 'error',
        tags: { component: 'TokenStore', fallback: 'memory' }
      });

      this.codes.set(code, data);
      setTimeout(() => { this.codes.delete(code); }, this.TTL_MS + 100);
    }
    
    return code;
  }

  async exchange(code) {
    if (!code) return null;

    // 1. Primary: Check Redis
    let cached = null;
    try {
      const client = container.resolve('redis-main');
      cached = await client.get(`auth:code:${code}`);
    } catch (err) {
      cached = null;
    }

    if (cached) {
      try {
        const data = JSON.parse(cached);
        try {
          const client = container.resolve('redis-main');
          await client.del(`auth:code:${code}`);
        } catch (err) {}
        return data.token;
      } catch (e) {
        console.error('[TokenStore] Failed to parse cached code data:', e.message);
      }
    }

    // 2. Fallback: Check local memory (handles codes created during Redis outages)
    const data = this.codes.get(code);
    if (!data) return null;
    
    if (Date.now() > data.expiresAt) {
      this.codes.delete(code);
      return null;
    }
    this.codes.delete(code);
    return data.token;
  }

  /**
   * BUG FIX #47: Revoke a token by adding it to blocklist (Mongo + Redis)
   */
  async revokeToken(jti, expiryTime) {
    if (!jti) return;
    
    try {
      let expiresAt;
      if (typeof expiryTime === 'number') {
        expiresAt = expiryTime < 10000000000 ? new Date(expiryTime * 1000) : new Date(expiryTime);
      } else {
        expiresAt = new Date(expiryTime || Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      const ttlSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

      // 1. Primary Cache: Redis (Fast path to prevent replay)
      if (ttlSeconds > 0) {
        try {
          const client = container.resolve('redis-main');
          await client.set(`revoked:${jti}`, '1', 'EX', ttlSeconds);
        } catch (err) {}
      }

      // 2. Durable Store: MongoDB
      await RevokedToken.create({ jti, expiresAt });
      
      console.log(`[TokenStore] Token ${jti} revoked globally`);
    } catch (err) {
      if (err.code !== 11000) {
        console.error(`[TokenStore] Failed to revoke token ${jti}:`, err.message);
      }
    }
  }

  /**
   * SEC-04: High-performance check with fail-open fallback
   */
  async isTokenRevoked(jti) {
    if (!jti) return false;
    
    try {
      // 1. Check Redis Cache (O(1))
      let cached = null;
      try {
        const client = container.resolve('redis-main');
        cached = await client.get(`revoked:${jti}`);
      } catch (err) {}
      
      if (cached === '1') return true;

      // 2. Check MongoDB (Persistence)
      const revokedDoc = await RevokedToken.findOne({ jti }).lean();
      
      // 3. Back-fill Cache if found in DB
      if (revokedDoc) {
        const expiresAt = revokedDoc.expiresAt;
        const ttl = expiresAt 
          ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
          : 3600;

        if (ttl > 0) {
          try {
            const client = container.resolve('redis-main');
            await client.set(`revoked:${jti}`, '1', 'EX', ttl);
          } catch (err) {}
        }
        return true;
      }

      return false;
    } catch (err) {
      // SEC-05: Fail-closed for security. If stores are unreachable, assume revoked to be safe.
      console.error(`[SECURITY] Revocation check FAILED — both stores unreachable: ${err.message}`);
      
      // Send to Sentry for real-time alerting
      Sentry.captureException(err, {
        level: 'fatal',
        tags: { component: 'TokenStore', action: 'isTokenRevoked' },
        extra: { jti }
      });

      return true; // SEC-05: FAIL CLOSED (Assume revoked)
    }
  }
}

const tokenStore = new TokenStore();
export default tokenStore;
