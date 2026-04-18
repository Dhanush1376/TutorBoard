import RevokedToken from '../../models/RevokedToken.js';
import crypto from 'crypto';

/**
 * TokenStore — Persistence-backed store for short-lived OAuth exchange codes and token revocation.
 * Prevents passing JWTs in URL query parameters.
 * BUG FIX #47: Added token blocklist for revocation mechanism.
 */

class TokenStore {
  constructor() {
    this.codes = new Map();
    this.TTL_MS = 60 * 1000; // Exchange codes expire in 1 minute (in-memory is fine for these)
  }

  /**
   * Create a short-lived exchange code for a JWT
   * @param {string} token - The JWT to protect
   * @returns {string} The exchange code
   */
  createCode(token) {
    const code = crypto.randomBytes(32).toString('hex');
    this.codes.set(code, {
      token,
      expiresAt: Date.now() + this.TTL_MS,
    });

    // Self-cleanup after TTL
    setTimeout(() => {
      this.codes.delete(code);
    }, this.TTL_MS + 100);

    return code;
  }

  /**
   * Exchange a code for its original JWT
   * @param {string} code - The code to exchange
   * @returns {string|null} The JWT, or null if invalid/expired
   */
  exchange(code) {
    if (!code) return null;
    const data = this.codes.get(code);

    if (!data) return null;

    if (Date.now() > data.expiresAt) {
      this.codes.delete(code);
      return null;
    }

    // Single-use: delete after exchange
    this.codes.delete(code);
    return data.token;
  }

  /**
   * BUG FIX #47: Revoke a token by adding it to the blocklist (Persistent MongoDB)
   * @param {string} jti - JWT ID (unique identifier for the token)
   * @param {number} expiryTime - Token expiry timestamp (seconds or milliseconds)
   */
  async revokeToken(jti, expiryTime) {
    if (!jti) return;
    
    try {
      // Clean up expiry to Date object
      // If numeric, assume it might be seconds (JWT style) or ms
      let expiresAt;
      if (typeof expiryTime === 'number') {
        // If it's less than 10^10, it's likely Unix seconds (2026 is ~1.7e9)
        expiresAt = expiryTime < 10000000000 ? new Date(expiryTime * 1000) : new Date(expiryTime);
      } else {
        expiresAt = new Date(expiryTime || Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      await RevokedToken.create({ jti, expiresAt });
      console.log(`[TokenStore] Token ${jti} successfully revoked in MongoDB`);
    } catch (err) {
      // Ignore duplicate key errors (already revoked)
      if (err.code !== 11000) {
        console.error(`[TokenStore] Failed to revoke token ${jti}:`, err.message);
      }
    }
  }

  /**
   * BUG FIX #47: Check if a token is revoked (Persistent MongoDB)
   * @param {string} jti - JWT ID to check
   * @returns {Promise<boolean>} True if token is revoked
   */
  async isTokenRevoked(jti) {
    if (!jti) return false;
    
    try {
      const exists = await RevokedToken.exists({ jti });
      return !!exists;
    } catch (err) {
      console.error(`[TokenStore] Error checking revocation for ${jti}:`, err.message);
      // Fail-safe: if DB is down, assume revoked for security
      return true; 
    }
  }
}

const tokenStore = new TokenStore();
export default tokenStore;
