import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import AuthSession from '../../models/AuthSession.js';
import tokenStore from '../../utils/auth/tokenStore.js';
import { generateCsrfSecret, deriveCsrfToken } from '../../utils/auth/csrf.js';

/**
 * Sessions: one AuthSession row per sign-in, short-lived access JWTs and a
 * rotating refresh JWT, both carrying the session id (`sid`). Revoking the row
 * ends every token issued for it.
 */

export const ACCESS_TOKEN_TTL_S = 15 * 60;
export const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;
const ROTATION_GRACE_MS = 20 * 1000;

export const getRefreshSecret = () => {
  if (process.env.JWT_REFRESH_SECRET) return process.env.JWT_REFRESH_SECRET;
  if (process.env.JWT_SECRET) {
    const derived = crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update('tutorboard-jwt-refresh-secret-derivation')
      .digest('hex');
    process.env.JWT_REFRESH_SECRET = derived;
    return derived;
  }
  throw new Error('JWT_REFRESH_SECRET missing — access and refresh tokens must use independent secrets');
};

const accessSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing');
  return process.env.JWT_SECRET;
};

export function signAccessToken(userId, sid) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ id: String(userId), jti, type: 'access', sid }, accessSecret(), { expiresIn: ACCESS_TOKEN_TTL_S });
  return { token, jti };
}

function signRefreshToken(userId, sid) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ id: String(userId), jti, type: 'refresh', sid }, getRefreshSecret(), { expiresIn: REFRESH_TOKEN_TTL_S });
  return { token, jti };
}

const cookieBase = () => {
  const isProd = process.env.NODE_ENV === 'production';
  // frontend and API are on different sites in production, so cookies must be SameSite=None (+Secure)
  return { secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' };
};

export function setAuthCookies(res, accessToken, refreshToken) {
  const base = cookieBase();
  res.cookie('tb-access-token', accessToken, { ...base, httpOnly: true, maxAge: ACCESS_TOKEN_TTL_S * 1000 });
  if (refreshToken) {
    res.cookie('tb-refresh-token', refreshToken, { ...base, httpOnly: true, maxAge: REFRESH_TOKEN_TTL_S * 1000 });
  }
  // CSRF pair is re-keyed on every sign-in (SEC-03)
  const csrfSecret = generateCsrfSecret();
  res.cookie('tb-csrf-secret', csrfSecret, { ...base, httpOnly: true, maxAge: REFRESH_TOKEN_TTL_S * 1000 });
  res.cookie('tb-csrf-token', deriveCsrfToken(csrfSecret), { ...base, httpOnly: false, maxAge: REFRESH_TOKEN_TTL_S * 1000 });
}

export function clearAuthCookies(res) {
  const base = cookieBase();
  res.clearCookie('tb-access-token', { ...base, httpOnly: true });
  res.clearCookie('tb-refresh-token', { ...base, httpOnly: true });
  res.clearCookie('tb-token', { ...base, httpOnly: true });
  res.clearCookie('tb-csrf-secret', { ...base, httpOnly: true });
  res.clearCookie('tb-csrf-token', { ...base, httpOnly: false });
}

/** Start a new session for `userId` and set its cookies. Returns { accessToken, sid }. */
export async function startSession(req, res, userId, method) {
  const sid = crypto.randomBytes(24).toString('base64url');
  const refresh = signRefreshToken(userId, sid);
  await AuthSession.create({
    _id: sid,
    userId,
    method,
    refreshJti: refresh.jti,
    userAgent: String(req.headers?.['user-agent'] || '').slice(0, 300),
    ip: req.ip || '',
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_S * 1000),
  });
  const access = signAccessToken(userId, sid);
  setAuthCookies(res, access.token, refresh.token);
  return { accessToken: access.token, sid };
}

/**
 * Exchange a refresh token for a new pair. Returns { userId, accessToken } or
 * throws { status: 401, code }. Rotation is a single atomic compare-and-set on
 * the stored jti, so two concurrent refreshes cannot both rotate.
 */
export async function rotateRefreshToken(req, res, refreshToken, { loadUser }) {
  const fail = (code) => Object.assign(new Error(code), { status: 401, code });
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, getRefreshSecret(), { algorithms: ['HS256'] });
  } catch {
    throw fail('INVALID_REFRESH');
  }
  if (decoded.type !== 'refresh' || !decoded.jti || !decoded.id) throw fail('INVALID_REFRESH');

  const user = await loadUser(decoded.id);
  if (!user) throw fail('USER_NOT_FOUND');
  if (user.disabledAt) throw Object.assign(new Error('ACCOUNT_DISABLED'), { status: 403, code: 'ACCOUNT_DISABLED' });
  if (user.passwordChangedAt && decoded.iat < Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)) {
    throw fail('STALE_SESSION');
  }

  // Tokens issued before sessions existed: honour once, convert to a session.
  if (!decoded.sid) {
    if (await tokenStore.isTokenRevoked(decoded.jti)) throw fail('REFRESH_REVOKED');
    await tokenStore.revokeToken(decoded.jti, decoded.exp);
    const { accessToken } = await startSession(req, res, decoded.id, 'legacy');
    return { userId: decoded.id, accessToken };
  }

  const now = new Date();
  const next = signRefreshToken(decoded.id, decoded.sid);
  const rotated = await AuthSession.findOneAndUpdate(
    { _id: decoded.sid, userId: decoded.id, refreshJti: decoded.jti, revokedAt: null, expiresAt: { $gt: now } },
    {
      $set: {
        refreshJti: next.jti,
        prevRefreshJti: decoded.jti,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_S * 1000),
      },
    },
    { returnDocument: 'after' }
  ).lean();

  if (rotated) {
    const access = signAccessToken(decoded.id, decoded.sid);
    setAuthCookies(res, access.token, next.token);
    return { userId: decoded.id, accessToken: access.token };
  }

  const session = await AuthSession.findById(decoded.sid).lean();
  if (!session || session.revokedAt || session.expiresAt <= now || String(session.userId) !== String(decoded.id)) {
    throw fail('SESSION_ENDED');
  }
  // Another tab rotated this token a moment ago: its response already set the new
  // refresh cookie, so hand back an access token only and leave that cookie alone.
  if (session.prevRefreshJti === decoded.jti && session.rotatedAt && now - session.rotatedAt < ROTATION_GRACE_MS) {
    const access = signAccessToken(decoded.id, decoded.sid);
    res.cookie('tb-access-token', access.token, { ...cookieBase(), httpOnly: true, maxAge: ACCESS_TOKEN_TTL_S * 1000 });
    return { userId: decoded.id, accessToken: access.token };
  }
  // An old refresh token came back after rotation: someone else holds a copy.
  await revokeSession(decoded.sid, 'refresh_reuse');
  throw fail('REFRESH_REUSE');
}

export async function revokeSession(sid, reason = 'logout', userId = null) {
  if (!sid) return false;
  const q = { _id: sid, revokedAt: null };
  if (userId) q.userId = userId;
  const r = await AuthSession.updateOne(q, { $set: { revokedAt: new Date(), revokedReason: reason } });
  return r.modifiedCount > 0;
}

export async function revokeAllSessions(userId, reason, { exceptSid = null } = {}) {
  const q = { userId, revokedAt: null };
  if (exceptSid) q._id = { $ne: exceptSid };
  const r = await AuthSession.updateMany(q, { $set: { revokedAt: new Date(), revokedReason: reason } });
  return r.modifiedCount;
}

/** Is the session behind an access token still usable? Tokens without a sid predate sessions. */
export async function isSessionActive(sid, userId) {
  if (!sid) return true;
  const s = await AuthSession.findOne({ _id: sid, userId, revokedAt: null, expiresAt: { $gt: new Date() } }).select('_id').lean();
  return !!s;
}

export async function listSessions(userId) {
  return AuthSession.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .select('method userAgent ip createdAt lastUsedAt')
    .lean();
}
