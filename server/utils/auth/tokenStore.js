import RevokedToken from '../../models/RevokedToken.js';
import crypto from 'crypto';
import redisClient from '../core/redis.js';
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
    const savedInRedis = await redisClient.set(`auth:code:${code}`, JSON.stringify(data), 60);
    
    if (!savedInRedis) {
      // SEC-04: Fallback to local memory if Redis is disconnected
      console.warn('[TokenStore] Redis unavailable, using volatile memory for OAuth code');
      this.codes.set(code, data);
      setTimeout(() => { this.codes.delete(code); }, this.TTL_MS + 100);
    }
    
    return code;
  }

  async exchange(code) {
    if (!code) return null;

    // 1. Primary: Check Redis
    const cached = await redisClient.get(`auth:code:${code}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        await redisClient.del(`auth:code:${code}`);
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

      // 1. Primary Store: MongoDB
      await RevokedToken.create({ jti, expiresAt });
      
      // 2. Performance Cache: Redis
      if (ttlSeconds > 0) {
        await redisClient.set(`revoked:${jti}`, '1', ttlSeconds);
      }
      
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
      const cached = await redisClient.get(`revoked:${jti}`);
      if (cached === '1') return true;

      // 2. Check MongoDB (Persistence)
      const exists = await RevokedToken.exists({ jti });
      
      // 3. Back-fill Cache if found in DB
      if (exists) {
        await redisClient.set(`revoked:${jti}`, '1', 3600); // Cache for 1 hour
        return true;
      }

      return false;
    } catch (err) {
      // SEC-04: Fail-open for availability, but log a high-severity alert for visibility
      console.error(`[SECURITY] Revocation check BYPASSED — both stores unreachable: ${err.message}`);
      
      // Send to Sentry for real-time alerting
      Sentry.captureException(err, {
        level: 'fatal',
        tags: { component: 'TokenStore', action: 'isTokenRevoked' },
        extra: { jti }
      });

      return false; 
    }
  }
}

const tokenStore = new TokenStore();
export default tokenStore;
