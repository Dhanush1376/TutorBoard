import { validateCsrf } from '../utils/auth/csrf.js';

/**
 * CSRF Protection Middleware (SEC-03)
 * Implements Double Submit Cookie pattern using the derived token approach.
 */
export const csrfCheck = (req, res, next) => {
  // GET, HEAD, OPTIONS are idempotent and don't require CSRF protection
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Requests carrying a Bearer token in the Authorization header are immune to CSRF
  // because custom headers cannot be set cross-origin without explicit CORS preflight approval.
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  const secret = req.cookies['tb-csrf-secret'];
  const token = req.headers['x-csrf-token'] || req.headers['tb-csrf-token'] || req.body?._csrf;

  if (!secret || !token || !validateCsrf(secret, token)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[CSRF] Validation failed for ${req.method} ${req.path}. Secret present: ${!!secret}, Token present: ${!!token}`);
    }
    return res.status(403).json({
      error: 'Security violation: CSRF validation failed. Please refresh the page.',
      code: 'CSRF_INVALID'
    });
  }

  next();
};
