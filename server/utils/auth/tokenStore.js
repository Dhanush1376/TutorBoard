import RevokedToken from '../../models/RevokedToken.js';
import OauthCode from '../../models/OauthCode.js';
import crypto from 'crypto';
import * as Sentry from "@sentry/node";

/**
 * TokenStore — Persistence-backed store for short-lived OAuth exchange codes and token revocation.
 * Migrated completely from Redis to MongoDB.
 */
class TokenStore {
  constructor() {
    this.TTL_MS = 60 * 1000;
  }

  /** payload: { userId, method, bindingHash } */
  async createCode(payload) {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.TTL_MS);

    try {
      await OauthCode.create({ code, userId: payload.userId, method: payload.method, bindingHash: payload.bindingHash || null, expiresAt });
      return code;
    } catch (err) {
      console.error(`[CRITICAL] MongoDB failed for OAuth code persistence!`, err.message);
      Sentry.captureException(err, {
        level: 'error',
        tags: { component: 'TokenStore', action: 'createCode' }
      });
      throw err;
    }
  }

  /**
   * Single use: returns { userId, method } or null. When the code was bound to a
   * browser, `bindingHash` (hash of that browser's handoff cookie) must match.
   * @param {any} code
   * @param {string|null} [bindingHash]
   */
  async exchange(code, bindingHash = null) {
    if (!code || typeof code !== 'string') return null;

    try {
      const doc = await OauthCode.findOneAndDelete({ code });
      if (doc?.bindingHash && doc.bindingHash !== bindingHash) return null;
      if (doc && doc.expiresAt.getTime() > Date.now() && doc.userId) {
        return { userId: doc.userId.toString(), method: doc.method || 'legacy' };
      }
      return null;
    } catch (err) {
      console.error('[TokenStore] Failed to exchange code in MongoDB:', err.message);
      return null;
    }
  }

  /**
   * Revoke a token by adding it to blocklist (MongoDB)
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

      await RevokedToken.create({ jti, expiresAt });
      console.log(`[TokenStore] Token ${jti} revoked globally`);
    } catch (err) {
      if (err.code !== 11000) {
        console.error(`[TokenStore] Failed to revoke token ${jti}:`, err.message);
      }
    }
  }

  /**
   * High-performance check with fail-open fallback
   */
  async isTokenRevoked(jti) {
    if (!jti) return false;
    
    try {
      const revokedDoc = await RevokedToken.findOne({ jti }).lean();
      return !!revokedDoc;
    } catch (err) {
      console.error(`[SECURITY] Revocation check FAILED — store unreachable: ${err.message}`);
      
      Sentry.captureException(err, {
        level: 'fatal',
        tags: { component: 'TokenStore', action: 'isTokenRevoked' },
        extra: { jti }
      });

      return true; // FAIL CLOSED (Assume revoked)
    }
  }
}

const tokenStore = new TokenStore();
export default tokenStore;
