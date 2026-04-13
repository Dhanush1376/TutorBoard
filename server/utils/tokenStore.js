/**
 * TokenStore — In-memory store for short-lived OAuth exchange codes and token revocation.
 * Prevents passing JWTs in URL query parameters.
 * BUG FIX #47: Added token blocklist for revocation mechanism.
 */

class TokenStore {
  constructor() {
    this.codes = new Map();
    this.revokedTokens = new Map(); // Map<tokenJti, expiryTime>
    this.TTL_MS = 60 * 1000; // Codes expire in 1 minute
    
    // Periodically clean up expired revoked tokens to prevent memory leak
    setInterval(() => {
      const now = Date.now();
      for (const [jti, expiryTime] of this.revokedTokens.entries()) {
        if (now > expiryTime) {
          this.revokedTokens.delete(jti);
        }
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Create a short-lived exchange code for a JWT
   * @param {string} token - The JWT to protect
   * @returns {string} The exchange code
   */
  createCode(token) {
    const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
   * BUG FIX #47: Revoke a token by adding it to the blocklist
   * @param {string} jti - JWT ID (unique identifier for the token)
   * @param {number} expiryTime - Token expiry timestamp (to clean up blocklist)
   */
  revokeToken(jti, expiryTime) {
    if (jti) {
      this.revokedTokens.set(jti, expiryTime || Date.now() + 7 * 24 * 60 * 60 * 1000);
      console.log(`[TokenStore] Token ${jti} revoked`);
    }
  }

  /**
   * BUG FIX #47: Check if a token is revoked
   * @param {string} jti - JWT ID to check
   * @returns {boolean} True if token is revoked
   */
  isTokenRevoked(jti) {
    if (!jti) return false;
    const expiryTime = this.revokedTokens.get(jti);
    if (!expiryTime) return false;
    
    // Check if revocation is still valid (not expired)
    if (Date.now() > expiryTime) {
      this.revokedTokens.delete(jti);
      return false;
    }
    
    return true;
  }
}

const tokenStore = new TokenStore();
export default tokenStore;
