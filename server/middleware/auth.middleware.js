import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import tokenStore from '../utils/auth/tokenStore.js';

/**
 * Middleware to protect routes that require authentication.
 * Expects: Authorization: Bearer <token>
 * 
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Cookie, Authorization header, or Query Param (_auth)
    if (req.cookies && req.cookies['tb-token']) {
      token = req.cookies['tb-token'];
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query._auth) {
      token = req.query._auth;
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

    req.user = user;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;
    next();
  } catch (err) {
    next(); // Invalid token, still continue as guest
  }
};
