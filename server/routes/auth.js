import express from 'express';
import { signup, signin, logout, getMe, socialLoginSuccess, exchangeToken } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateBody, SignupSchema, SigninSchema } from '../middleware/validation.middleware.js';
import { authSigninRateLimiter, authSignupRateLimiter } from '../middleware/rateLimiter.js';
import passport from '../utils/auth/passport.js';

const router = express.Router();

router.get('/exchange', exchangeToken);
const inlineProtect = (req, res, next) => {
  const url = req.originalUrl || req.url || '';
  if (req.query.token || req.query.access_token || url.includes('token=') || url.includes('access_token=')) {
    return res.status(400).json({ error: 'TOKEN_IN_URL_REJECTED' });
  }
  next();
};

router.get('/me', inlineProtect, protect, getMe);
router.post('/signup', authSignupRateLimiter, validateBody(SignupSchema), signup);
router.post('/signin', authSigninRateLimiter, validateBody(SigninSchema), signin);
router.post('/logout', protect, logout);

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
