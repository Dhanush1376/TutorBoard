import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import tokenStore from '../utils/auth/tokenStore.js';
import { container } from '../core/container.js';

/**
 * getCachedUser: Optimized user lookup with Redis fallback
 */
async function getCachedUser(userId) {
  const normalize = (u) => {
    if (u && u._id && !u.id) u.id = u._id.toString();
    return u;
  };

  if (!container.has('redis-main')) return normalize(await User.findById(userId).lean());

  const cacheKey = `user:${userId}`;
  try {
    const client = container.resolve('redis-main');
    const cached = await client.get(cacheKey);
    if (cached) return normalize(JSON.parse(cached));

    const user = await User.findById(userId).lean();
    if (user) {
      await client.set(cacheKey, JSON.stringify(user), 'EX', 300); // 5 min TTL
    }
    return normalize(user);
  } catch (err) {
    console.warn('[Auth:Cache] Redis error:', err.message);
    return normalize(await User.findById(userId).lean());
  }
}

/**
 * Middleware to protect routes that require authentication.
 * Expects: Authorization: Bearer <token>
 * 
 */
export const protect = async (req, res, next) => {
  // SEC-GDPR: Explicitly reject tokens in query parameters to prevent leakage in server/proxy logs
  const url = req.originalUrl || req.url || '';
  if (req.query.token || req.query.access_token || url.includes('token=') || url.includes('access_token=')) {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
      console.warn(`[Security] Rejected request with token in URL: ${req.method} ${req.path}`);
    }
    return res.status(400).json({ 
      error: 'Security violation: Authentication token detected in URL query string.',
      code: 'TOKEN_IN_URL' 
    });
  }

  try {
    let token;

    // Extract token from Cookie or Authorization header
    if (req.cookies && req.cookies['tb-access-token']) {
      token = req.cookies['tb-access-token'];
    } else if (req.cookies && req.cookies['tb-token']) {
      token = req.cookies['tb-token'];
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Not authorized — no token provided',
      });
    }

    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Auth] CRITICAL: JWT_SECRET is missing from environment.');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });

    // SEC-09: Strict JTI and Type Validation
    if (!decoded.jti || (decoded.type && decoded.type !== 'access')) {
      console.warn(`[Auth] Invalid token: ${decoded.id} (JTI: ${decoded.jti}, Type: ${decoded.type})`);
      return res.status(401).json({
        error: 'Not authorized — invalid token (missing JTI or incorrect type)',
      });
    }

    // BUG FIX #47: Check if token has been revoked
    if (await tokenStore.isTokenRevoked(decoded.jti)) {
      if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
        console.warn(`[Auth] Attempt to use revoked token: ${decoded.jti}`);
      }
      return res.status(401).json({
        error: 'Not authorized — token has been revoked',
      });
    }

    // PERFORMANCE: Use Redis-cached user lookup (lean)
    const user = await getCachedUser(decoded.id);
    
    if (!user) {
      if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
        console.warn(`[Auth] User ${decoded.id} not found in database for token ${decoded.jti}`);
      }
      return res.status(401).json({
        error: 'Not authorized — user not found',
      });
    }

    // SEC-16: Reject tokens issued before password change
    if (user.passwordChangedAt) {
      const changedTimestamp = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        console.warn(`[Auth] Rejected stale token for user ${user._id} (issued before password change)`);
        return res.status(401).json({
          error: 'Not authorized — password has been changed since this session started',
        });
      }
    }

    // SEC-17: Avoid logging every request in production to protect privacy and reduce noise
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[Auth] User ${user._id} authenticated successfully for ${req.method} ${req.path}`);
    }

    // Attach actual user from DB (lean object)
    // CRITICAL FIX: .lean() strips Mongoose virtuals including the `id` getter.
    // Many controllers use `req.user.id` instead of `req.user._id`.
    // Normalize by adding `id` as a string representation of `_id`.
    user.id = user._id.toString();
    req.user = user;
    req.tokenJti = decoded.jti; // Store JTI for potential revocation
    req.tokenExp = decoded.exp; // Store expiration for TTL management
    next();
  } catch (err) {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
      console.error('Auth middleware error:', err.message);
    }
    return res.status(401).json({
      error: 'Not authorized — invalid token',
    });
  }
};

/**
 * Middleware that attempts to identify the user but does not block guests.
 * Used for routes that have different behavior or rate limits for guests vs users.
 */
export const optionalProtect = async (req, res, next) => {
  // SEC-GDPR: Explicitly reject tokens in query parameters even for optional auth
  if (req.query.token || req.query.access_token) {
    console.warn(`[Security] Rejected optional auth request with token in URL: ${req.path}`);
    return res.status(400).json({ 
      error: 'Security violation: Authentication token detected in URL query string.',
      code: 'TOKEN_IN_URL' 
    });
  }

  try {
    let token;
    if (req.cookies && req.cookies['tb-access-token']) {
      token = req.cookies['tb-access-token'];
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return next(); // Continue as guest

    // If a token was provided, we MUST validate it. 
    // Failure to validate (missing secret, invalid token, revoked token) must be a 401, not a fall-through.
    if (!process.env.JWT_SECRET) {
      console.error('[Auth:Optional] JWT_SECRET missing from environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!decoded.jti) {
      return res.status(401).json({ error: 'Not authorized — invalid token (missing JTI)', code: 'INVALID_TOKEN' });
    }

    if (await tokenStore.isTokenRevoked(decoded.jti)) {
      console.warn(`[Auth:Optional] Token ${decoded.jti} is revoked or check failed. Blocking.`);
      return res.status(401).json({
        error: 'Not authorized — token has been revoked or security check failed',
        code: 'REVOKED_TOKEN'
      });
    }

    const user = await getCachedUser(decoded.id);
    if (!user) {
      console.warn(`[Auth:Optional] User ${decoded.id} not found for provided token. Blocking.`);
      return res.status(401).json({ error: 'Not authorized — user not found', code: 'USER_NOT_FOUND' });
    }

    // SEC-16: Reject tokens issued before password change
    if (user.passwordChangedAt) {
      const changedTimestamp = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        console.warn(`[Auth:Optional] Stale token for user ${user.id}. Blocking.`);
        return res.status(401).json({ error: 'Not authorized — session expired due to password change', code: 'STALE_TOKEN' });
      }
    }

    // Normalize id for lean objects (same fix as protect middleware)
    if (user._id && !user.id) user.id = user._id.toString();
    req.user = user;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;
    next();
  } catch (err) {
    // If a token was provided but verify/getCachedUser failed, we MUST return 401.
    console.error('[Auth:Optional] Token validation failed:', err.message);
    return res.status(401).json({
      error: 'Not authorized — invalid or expired token provided',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Middleware to explicitly block users who are guests or don't have a DB profile.
 * Use for account management, billing, and API keys.
 */
export const restrictToUsers = (req, res, next) => {
  if (!req.user || req.user.isGuest) {
    return res.status(403).json({
      error: 'Forbidden — this section requires a persistent account',
      code: 'USER_ONLY'
    });
  }
  next();
};
