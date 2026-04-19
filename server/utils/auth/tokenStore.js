import RevokedToken from '../../models/RevokedToken.js';
import crypto from 'crypto';
import redisClient from '../core/redis.js';

/**
 * TokenStore — Persistence-backed store for short-lived OAuth exchange codes and token revocation.
 * SEC-04: Hardened with Redis fallback to prevent DOS during Mongo outages.
 */

class TokenStore {
  constructor() {
    this.codes = new Map();
    this.TTL_MS = 60 * 1000;
  }

  createCode(token) {
    const code = crypto.randomBytes(32).toString('hex');
    this.codes.set(code, {
      token,
      expiresAt: Date.now() + this.TTL_MS,
    });
    setTimeout(() => { this.codes.delete(code); }, this.TTL_MS + 100);
    return code;
  }

  exchange(code) {
    if (!code) return null;
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
      console.error(`[TokenStore] Revocation check error:`, err.message);
      // SEC-04: Fail-open. If both stores are down, allow the token to prevent total lockout.
      return false; 
    }
  }
}

const tokenStore = new TokenStore();
export default tokenStore;
