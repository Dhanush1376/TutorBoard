import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import tokenStore from '../utils/tokenStore.js';

/**
 * Middleware to protect routes that require authentication.
 * Expects: Authorization: Bearer <token>
 * 
 * BUG FIX #46: Now queries User from DB instead of mocking as "Guest User"
 * BUG FIX #47: Now checks token revocation list
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
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

    // BUG FIX #47: Check if token has been revoked
    if (decoded.jti && tokenStore.isTokenRevoked(decoded.jti)) {
      console.warn(`[Auth] Attempt to use revoked token: ${decoded.jti}`);
      return res.status(401).json({
        error: 'Not authorized — token has been revoked',
      });
    }

    // BUG FIX #46: Query actual user from database instead of mocking
    const user = await User.findById(decoded.id);
    
    if (!user) {
      console.warn(`[Auth] User ${decoded.id} not found in database`);
      return res.status(401).json({
        error: 'Not authorized — user not found',
      });
    }

    // Attach actual user from DB (not mocked)
    req.user = user;
    req.tokenJti = decoded.jti; // Store JTI for potential revocation
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({
      error: 'Not authorized — invalid token',
    });
  }
};
