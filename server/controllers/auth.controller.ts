import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import tokenStore from '../utils/auth/tokenStore.js';
import {
  sendWelcomeEmail,
  sendSecurityAlertEmail,
  sendVerificationCodeEmail,
  sendPasswordResetCodeEmail,
  sendAccountNoticeEmail,
  sendNewSignInEmail,
} from '../utils/core/mailer.js';
import { trackEvent } from '../utils/core/analytics.js';
import { container } from '../core/container.js';
import { AppError, ErrorCode } from '../shared/errors.js';
import { normalizeEmail, publicUser } from '../utils/auth/identity.js';
import passport, { configuredProviders } from '../utils/auth/passport.js';
import { OAUTH_BINDING_COOKIE } from '../utils/auth/oauthStateStore.js';
import {
  startSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
  listSessions,
  clearAuthCookies,
  signAccessToken,
  getRefreshSecret,
} from '../services/auth/session.service.js';
import { issueChallenge, verifyChallenge, consumeResetGrant } from '../services/auth/challenge.service.js';
import { claimGuestData } from '../services/auth/guestMigration.service.js';
import { getPlatformSettings } from '../services/platformConfig.service.js';
import { audit } from '../services/audit.service.js';
import { applyConfiguredRole } from '../services/adminAccess.service.js';

// A real bcrypt hash (same cost as stored passwords) so a sign-in for an unknown
// email takes as long as a wrong password.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('tutorboard-timing-equaliser', 12));
const GENERIC_RESET_MSG = 'If an account exists for that email, we sent a 6-digit code to it.';

const frontendOrigin = (): string => {
  try {
    return new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin;
  } catch {
    return 'http://localhost:5173';
  }
};

async function invalidateUserCache(userId: any) {
  if (!container.has('redis-main')) return;
  try {
    await container.resolve<any>('redis-main').del(`user:${userId}`);
  } catch { /* cache only */ }
}

async function hasPassword(userId: any): Promise<boolean> {
  return !!(await User.exists({ _id: userId, password: { $exists: true, $nin: [null, ''] } }));
}

/**
 * Has this account ever signed in from this browser/device (same User-Agent)?
 * Revoked and expired-but-not-yet-purged sessions count. An account with no
 * sessions at all is brand new (sign-up / first OAuth sign-in): no alert then.
 */
async function isNewDevice(userId: any, userAgent: string) {
  const [anySession, sameDevice] = await Promise.all([
    AuthSession.exists({ userId }),
    AuthSession.exists({ userId, userAgent }),
  ]);
  return !!anySession && !sameDevice;
}

async function respondWithSession(req: Request, res: Response, user: any, method: string, status = 200) {
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 300);
  const newDevice = await isNewDevice(user._id, userAgent).catch(() => false);
  const { accessToken } = await startSession(req, res, user._id, method);
  if (newDevice) {
    sendNewSignInEmail(user, { method, userAgent, ip: req.ip || '', at: new Date() }).catch(() => {});
  }
  const guestClaim = await claimGuestData(req, res, user._id);
  // SUPERADMIN_EMAILS: verified owner of a listed address gets the role at sign-in
  const role = await applyConfiguredRole(user._id).catch(() => null);
  if (role) user.role = role;
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch(() => {});
  res.status(status).json({
    token: accessToken,
    user: { ...publicUser(user), hasPassword: await hasPassword(user._id) },
    guestClaim,
  });
}

function sendVerificationCode(user: any) {
  return issueChallenge(user._id, 'verify_email', async (code: string) => {
    const r: any = await sendVerificationCodeEmail(user, code);
    return !!r?.success;
  });
}

// ─── Email + password ────────────────────────────────────────────────────────

export const signup = async (req: Request, res: Response) => {
  const settings = await getPlatformSettings();
  if (!settings.auth.registrationEnabled || !settings.auth.providers.password) {
    return res.status(403).json({ error: 'New sign-ups are paused right now.', code: 'REGISTRATION_DISABLED' });
  }

  const { password } = req.body;
  const name = String(req.body.name || '').replace(/[<>]/g, '').trim().slice(0, 50);
  const email = normalizeEmail(req.body.email);
  if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });

  let user: any;
  try {
    // the unique index on email is the arbiter: concurrent sign-ups produce exactly one account
    user = await User.create({ name, email, password });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'This email is already registered. Sign in, or reset your password.', code: 'EMAIL_IN_USE' });
    }
    console.error('Signup error:', err?.message);
    return res.status(500).json({ error: 'Registration failed. Please try again later.' });
  }

  await audit(req, 'account.created', { actorId: user._id, targetUserId: user._id, meta: { method: 'password' } });
  sendVerificationCode(user).catch((e) => console.error('[Auth] Verification email failed:', e.message));
  sendWelcomeEmail(user as any).catch(() => {});
  trackEvent(user._id.toString(), 'user_signed_up', { auth_method: 'email' });

  return respondWithSession(req, res, user, 'password', 201);
};

export const signin = async (req: Request, res: Response) => {
  const settings = await getPlatformSettings();
  if (!settings.auth.providers.password) {
    return res.status(403).json({ error: 'Password sign-in is disabled. Use another sign-in method.', code: 'PROVIDER_DISABLED' });
  }
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  const user: any = await User.findOne({ email }).select('+password');
  const ok = user?.password ? await user.comparePassword(password) : (await bcrypt.compare(password, getDummyHash()), false);

  if (!ok || !user) {
    await audit(req, 'auth.signin', { targetUserId: user?._id ?? null, outcome: 'failure', meta: { method: 'password' } });
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.disabledAt) {
    return res.status(403).json({ error: 'This account has been disabled. Contact support.', code: 'ACCOUNT_DISABLED' });
  }

  await audit(req, 'auth.signin', { actorId: user._id, targetUserId: user._id, meta: { method: 'password' } });
  trackEvent(user._id.toString(), 'user_signed_in', { auth_method: 'email' });
  return respondWithSession(req, res, user, 'password');
};

export const getMe = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const userId = (user.id || user._id).toString();
  // a fresh access token for the same session (the client keeps it for socket auth)
  const { token } = signAccessToken(userId, (req as any).sessionId);
  res.json({ token, user: { ...publicUser(user), hasPassword: await hasPassword(userId) } });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.['tb-refresh-token'];
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token missing' });
  try {
    const { accessToken } = await rotateRefreshToken(req, res, refreshToken, {
      loadUser: (id: string) => User.findById(id).select('passwordChangedAt disabledAt').lean(),
    });
    res.json({ success: true, token: accessToken });
  } catch (err: any) {
    if (err.code === 'REFRESH_REUSE') await audit(req, 'session.refresh_reuse', { outcome: 'failure' });
    clearAuthCookies(res);
    res.status(err.status || 401).json({ error: 'Session expired. Please sign in again.', code: err.code || 'INVALID_REFRESH' });
  }
};

/** Ends this browser's session. Works with an expired access token: the refresh cookie identifies the session. */
export const logout = async (req: Request, res: Response) => {
  let sid: string | undefined;
  for (const [cookie, secret] of [['tb-refresh-token', getRefreshSecret()], ['tb-access-token', process.env.JWT_SECRET]] as const) {
    const t = req.cookies?.[cookie];
    if (!sid && t && secret) {
      try {
        sid = (jwt.verify(t, secret, { algorithms: ['HS256'], ignoreExpiration: true }) as any).sid;
      } catch { /* forged or wrong secret: nothing to revoke */ }
    }
  }
  if (!sid) sid = (req as any).sessionId;
  if (sid) await revokeSession(sid, 'logout');
  const { tokenJti, tokenExp } = req as any;
  if (tokenJti) await tokenStore.revokeToken(tokenJti, tokenExp);
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out successfully' });
};

export const logoutAll = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const count = await revokeAllSessions(user._id, 'logout_all');
  await audit(req, 'session.revoke_all', { targetUserId: user._id, meta: { count } });
  clearAuthCookies(res);
  res.json({ success: true, revoked: count });
};

export const getSessions = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const current = (req as any).sessionId;
  const rows = await listSessions(user._id);
  res.json({
    sessions: rows.map((s: any) => ({
      id: s._id,
      method: s.method,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s._id === current,
    })),
  });
};

export const revokeOneSession = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const ok = await revokeSession(String(req.params.sid), 'revoked_by_user', user._id);
  if (!ok) return res.status(404).json({ error: 'Session not found' });
  await audit(req, 'session.revoke', { targetUserId: user._id });
  if (req.params.sid === (req as any).sessionId) clearAuthCookies(res);
  res.json({ success: true });
};

// ─── Email verification ─────────────────────────────────────────────────────

export const sendEmailVerification = async (req: Request, res: Response) => {
  const user = await User.findById((req as any).user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.emailVerifiedAt) return res.json({ success: true, alreadyVerified: true });
  const r = await sendVerificationCode(user);
  if (r.status === 'sent') return res.json({ success: true, message: `We sent a 6-digit code to ${user.email}.` });
  if (r.status === 'cooldown' || r.status === 'limited') {
    return res.status(429).json({ error: `Please wait ${r.retryAfterS}s before requesting another code.`, code: 'RESEND_COOLDOWN', retryAfterS: r.retryAfterS });
  }
  await audit(req, 'email.delivery_failed', { targetUserId: user._id, outcome: 'failure', meta: { purpose: 'verify_email' } });
  return res.status(502).json({ error: 'We could not send the email right now. Try again in a minute.', code: 'EMAIL_DELIVERY_FAILED' });
};

export const confirmEmailVerification = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const r = await verifyChallenge(userId, 'verify_email', req.body.code);
  if (!r.ok) {
    const msg: Record<string, string> = {
      invalid: 'That code is not right. Check the email and try again.',
      expired: 'That code has expired. Request a new one.',
      locked: 'Too many wrong attempts. Request a new code.',
      none: 'No active code. Request a new one.',
    };
    const reason = String((r as any).reason || 'invalid');
    return res.status(400).json({ error: msg[reason], code: `CODE_${reason.toUpperCase()}`, attemptsLeft: (r as any).attemptsLeft });
  }
  await User.updateOne({ _id: userId }, { $set: { emailVerifiedAt: new Date() } });
  await invalidateUserCache(userId);
  await applyConfiguredRole(userId).catch(() => null);
  await audit(req, 'email.verified', { targetUserId: userId });
  res.json({ success: true, emailVerified: true });
};

// ─── Password recovery (OTP) ────────────────────────────────────────────────

/** Step A: always the same answer, whether or not the account exists. */
export const forgotPassword = async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email);
  const user: any = await User.findOne({ email }).select('name email disabledAt');
  if (user && !user.disabledAt) {
    const r = await issueChallenge(user._id, 'reset_password', async (code: string) => {
      const sent: any = await sendPasswordResetCodeEmail(user, code);
      return !!sent?.success;
    });
    await audit(req, 'password.reset_requested', {
      actorId: null,
      targetUserId: user._id,
      outcome: r.status === 'sent' ? 'success' : 'failure',
      meta: { status: r.status },
    });
  }
  res.json({ success: true, message: GENERIC_RESET_MSG });
};

/** Step B: code → single-use reset token (15 min). */
export const verifyResetCode = async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email);
  const user: any = await User.findOne({ email }).select('_id disabledAt');
  const r = user && !user.disabledAt
    ? await verifyChallenge(user._id, 'reset_password', req.body.code)
    : { ok: false, reason: 'invalid' as const };
  if (!r.ok) {
    await audit(req, 'password.reset_code', { actorId: null, targetUserId: user?._id ?? null, outcome: 'failure', meta: { reason: r.reason } });
    const locked = r.reason === 'locked';
    return res.status(400).json({
      error: locked ? 'Too many wrong attempts. Request a new code.' : 'That code is invalid or has expired.',
      code: locked ? 'CODE_LOCKED' : 'CODE_INVALID',
    });
  }
  res.json({ success: true, resetToken: (r as any).grant });
};

/** Step C: set the new password. Only a verified, unused, unexpired reset token works. */
export const resetPassword = async (req: Request, res: Response) => {
  const userId = await consumeResetGrant(req.body.resetToken);
  if (!userId) {
    return res.status(400).json({ error: 'This reset link has expired. Start again.', code: 'RESET_TOKEN_INVALID' });
  }
  const user: any = await User.findById(userId).select('+password');
  if (!user || user.disabledAt) return res.status(400).json({ error: 'This reset link has expired. Start again.', code: 'RESET_TOKEN_INVALID' });

  user.password = req.body.password;
  user.passwordChangedAt = new Date(Date.now() - 1000) as any; // iat is whole seconds; never reject the next sign-in
  // receiving the code proved control of the mailbox
  if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
  await user.save();
  const revoked = await revokeAllSessions(user._id, 'password_reset');
  await invalidateUserCache(user._id);
  await audit(req, 'password.reset', { actorId: user._id, targetUserId: user._id, meta: { sessionsRevoked: revoked } });
  sendSecurityAlertEmail(user).catch(() => {});
  clearAuthCookies(res);
  res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
};

// ─── OAuth ──────────────────────────────────────────────────────────────────

const LINK_COOKIE = 'tb-oauth-link';
// Binds the one-time ?code= handoff to the browser that completed OAuth, so a code
// cannot be replayed in someone else's browser to sign them into another account.
const HANDOFF_COOKIE = 'tb-oauth-handoff';
const handoffCookieOpts = () => {
  const isProd = process.env.NODE_ENV === 'production';
  // the exchange is a cross-site XHR from the frontend in production
  return { httpOnly: true, secure: isProd, sameSite: (isProd ? 'none' : 'lax') as any, path: '/api/auth', maxAge: 120_000 };
};
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export const listAuthProviders = async (_req: Request, res: Response) => {
  const s = await getPlatformSettings();
  res.json({
    password: s.auth.providers.password,
    google: s.auth.providers.google && configuredProviders.google,
    github: s.auth.providers.github && configuredProviders.github,
    registrationEnabled: s.auth.registrationEnabled,
    guestEnabled: s.guest.enabled,
    requireEmailVerification: s.auth.requireEmailVerification,
  });
};

/** Signed-in user asks to link a provider: a 5-minute cookie marks the next OAuth start as a link. */
export const startProviderLink = async (req: Request, res: Response) => {
  const provider = String(req.params.provider);
  if (!['google', 'github'].includes(provider) || !(configuredProviders as any)[provider]) {
    return res.status(400).json({ error: 'That sign-in method is not available' });
  }
  const userId = (req as any).user._id.toString();
  const ticket = jwt.sign({ uid: userId, provider, type: 'oauth_link' }, process.env.JWT_SECRET as string, { expiresIn: 300 });
  res.cookie(LINK_COOKIE, ticket, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth', maxAge: 300_000 });
  res.json({ success: true, url: `/api/auth/${provider}` });
};

export const oauthStart = (provider: 'google' | 'github') => async (req: Request, res: Response, next: any) => {
  const s = await getPlatformSettings();
  if (!configuredProviders[provider] || !s.auth.providers[provider]) {
    return res.redirect(`${frontendOrigin()}/login?error=provider_disabled`);
  }
  (req as any).oauthIntent = { mode: 'login', userId: null };
  const ticket = req.cookies?.[LINK_COOKIE];
  if (ticket) {
    res.clearCookie(LINK_COOKIE, { path: '/api/auth' });
    try {
      const t: any = jwt.verify(ticket, process.env.JWT_SECRET as string, { algorithms: ['HS256'] });
      if (t.type === 'oauth_link' && t.provider === provider) (req as any).oauthIntent = { mode: 'link', userId: t.uid };
    } catch { /* expired ticket: plain sign-in */ }
  }
  const scope = provider === 'google' ? ['profile', 'email'] : ['user:email'];
  passport.authenticate(provider, { scope, session: false })(req, res, next);
};

export const oauthCallback = (provider: 'google' | 'github') => (req: Request, res: Response, next: any) => {
  const front = frontendOrigin();
  passport.authenticate(provider, { session: false }, async (err: any, user: any, info: any) => {
    res.clearCookie(OAUTH_BINDING_COOKIE, { path: '/api/auth' });
    const intent = (req as any).oauthIntent || { mode: 'login' };
    const errorTarget = intent.mode === 'link' ? `${front}/settings` : `${front}/login`;
    try {
      if (err) {
        console.error(`[Auth] ${provider} callback error:`, err.message);
        await audit(req, `oauth.${provider}`, { outcome: 'failure', meta: { reason: 'provider_error' } });
        return res.redirect(`${errorTarget}?error=${provider}_failed`);
      }
      if (!user) {
        const reason = String(info?.message || 'auth_failed').replace(/[^a-z_]/g, '').slice(0, 40) || 'auth_failed';
        await audit(req, `oauth.${provider}`, { outcome: 'failure', meta: { reason } });
        return res.redirect(`${errorTarget}?error=${reason}&provider=${provider}`);
      }
      const result = (req as any).oauthResult || {};
      if (result.linked) {
        await invalidateUserCache(user._id);
        await audit(req, 'identity.linked', { actorId: user._id, targetUserId: user._id, meta: { provider, via: intent.mode } });
        sendAccountNoticeEmail(user, 'Sign-in method added', `${provider === 'google' ? 'Google' : 'GitHub'} can now be used to sign in to your TutorBoard account.`).catch(() => {});
      }
      if (result.created) await audit(req, 'account.created', { actorId: user._id, targetUserId: user._id, meta: { method: provider } });
      if (intent.mode === 'link') return res.redirect(`${front}/settings?linked=${provider}`);

      const handoff = crypto.randomBytes(32).toString('base64url');
      res.cookie(HANDOFF_COOKIE, handoff, handoffCookieOpts());
      const code = await tokenStore.createCode({ userId: user._id, method: provider, bindingHash: sha256(handoff) });
      return res.redirect(`${front}/?code=${code}`);
    } catch (e: any) {
      console.error('[Auth] Social login error:', e.message);
      return res.redirect(`${errorTarget}?error=server_error`);
    }
  })(req, res, next);
};

export const exchangeToken = async (req: Request, res: Response) => {
  const handoff = req.cookies?.[HANDOFF_COOKIE];
  res.clearCookie(HANDOFF_COOKIE, handoffCookieOpts());
  const payload = await tokenStore.exchange(req.body.code, typeof handoff === 'string' ? sha256(handoff) : null);
  if (!payload) throw new AppError(ErrorCode.AUTH_TOKEN_EXPIRED, 'Invalid or expired exchange code');
  const user: any = await User.findById(payload.userId);
  if (!user || user.disabledAt) return res.status(401).json({ error: 'Sign-in failed' });
  await audit(req, 'auth.signin', { actorId: user._id, targetUserId: user._id, meta: { method: payload.method } });
  trackEvent(user._id.toString(), 'user_signed_in', { auth_method: payload.method });
  return respondWithSession(req, res, user, payload.method === 'github' ? 'github' : payload.method === 'google' ? 'google' : 'legacy');
};

export const unlinkProvider = async (req: Request, res: Response) => {
  const provider = String(req.params.provider);
  const field = provider === 'google' ? 'googleId' : provider === 'github' ? 'githubId' : null;
  if (!field) return res.status(400).json({ error: 'Unknown sign-in method' });
  const userId = (req as any).user._id;
  const user: any = await User.findById(userId).select('+password googleId githubId email name');
  if (!user?.[field]) return res.status(404).json({ error: 'That sign-in method is not linked' });

  const other = field === 'googleId' ? 'githubId' : 'googleId';
  const remaining = (user.password ? 1 : 0) + (user[other] ? 1 : 0);
  if (remaining === 0) {
    return res.status(409).json({ error: 'Add a password or another sign-in method first, so you can still sign in.', code: 'LAST_SIGNIN_METHOD' });
  }
  // conditional update: a concurrent unlink of the other method cannot leave zero methods
  const guard: any = { _id: userId, [field]: user[field] };
  if (!user.password) guard[other] = { $nin: [null, undefined] };
  const r = await User.updateOne(guard, { $unset: { [field]: 1 } });
  if (r.modifiedCount === 0) return res.status(409).json({ error: 'Your sign-in methods changed. Reload and try again.' });
  await invalidateUserCache(userId);
  await audit(req, 'identity.unlinked', { targetUserId: userId, meta: { provider } });
  sendAccountNoticeEmail(user, 'Sign-in method removed', `${provider === 'google' ? 'Google' : 'GitHub'} was removed from your TutorBoard account.`).catch(() => {});
  res.json({ success: true });
};

/** Clears this browser's auth cookies. POST only (a GET could be triggered by any page). */
export const forceReset = async (req: Request, res: Response) => {
  await logout(req, res);
};
