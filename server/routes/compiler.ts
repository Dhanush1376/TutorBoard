import express, { Request, Response, NextFunction } from 'express';
import { executeCodeProxy } from '../controllers/compiler.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { codeRunLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Signed-in users are verified as usual. Guests (no token) may also run code;
 * every caller is capped by codeRunLimiter so the shared compiler can't be abused.
 */
const protectIfSignedIn = (req: Request, res: Response, next: NextFunction) => {
  const hasToken =
    req.cookies?.['tb-access-token'] ||
    req.cookies?.['tb-token'] ||
    (req.headers.authorization || '').startsWith('Bearer');
  return hasToken ? protect(req, res, next) : next();
};

// SEC-33: rate-limited code execution proxy
router.post('/execute', codeRunLimiter, protectIfSignedIn, executeCodeProxy);

export default router;
