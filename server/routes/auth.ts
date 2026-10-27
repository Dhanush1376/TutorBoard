import express, { Request, Response, NextFunction } from 'express';
import {
  signup,
  signin,
  logout,
  logoutAll,
  getMe,
  getSessions,
  revokeOneSession,
  exchangeToken,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  refresh,
  forceReset,
  sendEmailVerification,
  confirmEmailVerification,
  listAuthProviders,
  startProviderLink,
  unlinkProvider,
  oauthStart,
  oauthCallback,
} from '../controllers/auth.controller.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { protect, restrictToUsers, requireRecentAuth } from '../middleware/auth.middleware.js';
import {
  validateBody,
  SignupSchema,
  SigninSchema,
  EmailOnlySchema,
  VerifyCodeSchema,
  ResetVerifySchema,
  ResetPasswordSchema,
  ExchangeSchema,
} from '../middleware/validation.middleware.js';
import { authSigninRateLimiter, authSignupRateLimiter, authRecoveryRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const inlineProtect = (req: Request, res: Response, next: NextFunction) => {
  const url = req.originalUrl || req.url || '';
  if (req.query.token || req.query.access_token || url.includes('token=') || url.includes('access_token=')) {
    return res.status(400).json({ error: 'TOKEN_IN_URL_REJECTED' });
  }
  next();
};

router.get('/providers', asyncHandler(listAuthProviders));
router.post('/exchange', authSigninRateLimiter, validateBody(ExchangeSchema), asyncHandler(exchangeToken));
router.get('/me', inlineProtect, protect, asyncHandler(getMe));
router.post('/signup', authSignupRateLimiter, validateBody(SignupSchema), asyncHandler(signup));
router.post('/signin', authSigninRateLimiter, validateBody(SigninSchema), asyncHandler(signin));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.post('/logout-all', protect, restrictToUsers, asyncHandler(logoutAll));
router.post('/force-reset', asyncHandler(forceReset));

// sessions (devices)
router.get('/sessions', protect, restrictToUsers, asyncHandler(getSessions));
router.delete('/sessions/:sid', protect, restrictToUsers, asyncHandler(revokeOneSession));

// email verification (signed in)
router.post('/verify-email/send', protect, restrictToUsers, authRecoveryRateLimiter, asyncHandler(sendEmailVerification));
router.post('/verify-email/confirm', protect, restrictToUsers, authRecoveryRateLimiter, validateBody(VerifyCodeSchema), asyncHandler(confirmEmailVerification));

// password recovery: request code → verify code (→ reset token) → set password
router.post('/password/forgot', authRecoveryRateLimiter, validateBody(EmailOnlySchema), asyncHandler(forgotPassword));
router.post('/password/verify', authRecoveryRateLimiter, validateBody(ResetVerifySchema), asyncHandler(verifyResetCode));
router.post('/password/reset', authRecoveryRateLimiter, validateBody(ResetPasswordSchema), asyncHandler(resetPassword));
// legacy paths
router.post('/forgot-password', authRecoveryRateLimiter, validateBody(EmailOnlySchema), asyncHandler(forgotPassword));
router.post('/reset-password', authRecoveryRateLimiter, validateBody(ResetPasswordSchema), asyncHandler(resetPassword));

// linked sign-in methods
router.post('/link/:provider', protect, restrictToUsers, requireRecentAuth(), asyncHandler(startProviderLink));
router.delete('/providers/:provider', protect, restrictToUsers, requireRecentAuth(), asyncHandler(unlinkProvider));

// ─── OAUTH (state + PKCE, browser-bound) ───
router.get('/google', asyncHandler(oauthStart('google')));
router.get('/google/callback', oauthCallback('google'));
router.get('/github', asyncHandler(oauthStart('github')));
router.get('/github/callback', oauthCallback('github'));

export default router;
