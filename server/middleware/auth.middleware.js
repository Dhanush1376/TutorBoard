import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import tokenStore from '../utils/auth/tokenStore.js';

/**
 * Middleware to protect routes that require authentication.
 * Expects: Authorization: Bearer <token>
 * 
 */
export const protect = async (req, res, next) => {
  // SEC-GDPR: Explicitly reject tokens in query parameters to prevent leakage in server/proxy logs
  const url = req.originalUrl || req.url || '';
  if (req.query.token || req.query.access_token || url.includes('token=') || url.includes('access_token=')) {
    console.warn(`[Security] Rejected request with token in URL: ${req.method} ${req.path}`);
    return res.status(400).json({ 
      error: 'Security violation: Authentication token detected in URL query string.',
      code: 'TOKEN_IN_URL' 
    });
  }

  try {
    let token;

    // Extract token from Cookie or Authorization header
    if (req.cookies && req.cookies['tb-token']) {
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
    if (!process.env.JWT_SECRET) {
      console.error('[Auth] CRITICAL: JWT_SECRET is missing from environment.');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // SEC-09: Strict JTI Validation
    if (!decoded.jti) {
      console.warn(`[Auth] Token missing JTI: ${decoded.id}`);
      return res.status(401).json({
        error: 'Not authorized — invalid token signature (missing JTI)',
      });
    }

    // BUG FIX #47: Check if token has been revoked
    if (await tokenStore.isTokenRevoked(decoded.jti)) {
      console.warn(`[Auth] Attempt to use revoked token: ${decoded.jti}`);
      return res.status(401).json({
        error: 'Not authorized — token has been revoked',
      });
    }

    // BUG FIX #46: Query actual user from database instead of mocking
    const user = await User.findById(decoded.id);
    
    if (!user) {
      console.warn(`[Auth] User ${decoded.id} not found in database for token ${decoded.jti}`);
      return res.status(401).json({
        error: 'Not authorized — user not found',
      });
    }

    // SEC-16: Reject tokens issued before password change
    if (user.passwordChangedAt) {
      const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        console.warn(`[Auth] Rejected stale token for user ${user._id} (issued before password change)`);
        return res.status(401).json({
          error: 'Not authorized — password has been changed since this session started',
        });
      }
    }

    console.log(`[Auth] User ${user._id} authenticated successfully for ${req.path}`);

    // Attach actual user from DB (not mocked)
    req.user = user;
    req.tokenJti = decoded.jti; // Store JTI for potential revocation
    req.tokenExp = decoded.exp; // Store expiration for TTL management
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
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
    if (req.cookies && req.cookies['tb-token']) {
      token = req.cookies['tb-token'];
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return next(); // Continue as guest

    if (!process.env.JWT_SECRET) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.jti) return next();

    if (await tokenStore.isTokenRevoked(decoded.jti)) return next();

    const user = await User.findById(decoded.id);
    if (!user) return next();

    // SEC-16: Reject tokens issued before password change
    if (user.passwordChangedAt) {
      const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTimestamp) return next();
    }

    req.user = user;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;
    next();
  } catch (err) {
    next(); // Invalid token, still continue as guest
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
