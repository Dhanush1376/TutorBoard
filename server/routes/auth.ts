import express, { Request, Response, NextFunction } from 'express';
import { 
  signup, 
  signin, 
  logout, 
  getMe, 
  socialLoginSuccess, 
  exchangeToken, 
  forgotPassword, 
  resetPassword, 
  refresh,
  forceReset
} from '../controllers/auth.controller.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateBody, SignupSchema, SigninSchema } from '../middleware/validation.middleware.js';
import { authSigninRateLimiter, authSignupRateLimiter } from '../middleware/rateLimiter.js';
import passport from '../utils/auth/passport.js';

const router = express.Router();

router.post('/exchange', asyncHandler(exchangeToken));

const inlineProtect = (req: Request, res: Response, next: NextFunction) => {
  const url = req.originalUrl || req.url || '';
  if (req.query.token || req.query.access_token || url.includes('token=') || url.includes('access_token=')) {
    return res.status(400).json({ error: 'TOKEN_IN_URL_REJECTED' });
  }
  next();
};

router.get('/me', inlineProtect, protect, asyncHandler(getMe));
router.post('/signup', authSignupRateLimiter, validateBody(SignupSchema), asyncHandler(signup));
router.post('/signin', authSigninRateLimiter, validateBody(SigninSchema), asyncHandler(signin));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', protect, asyncHandler(logout));
router.post('/forgot-password', authSigninRateLimiter, asyncHandler(forgotPassword));
router.post('/reset-password', authSigninRateLimiter, asyncHandler(resetPassword));
router.get('/force-reset', asyncHandler(forceReset));
router.post('/force-reset', asyncHandler(forceReset));

// ─── GOOGLE OAUTH ───
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=google_failed', session: false }),
  socialLoginSuccess
);

// ─── GITHUB OAUTH ───
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login?error=github_failed', session: false }),
  socialLoginSuccess
);

export default router;
