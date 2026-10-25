import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const GUEST_COOKIE_NAME = 'tb-guest-token';
export const GUEST_HEADER_NAME = 'x-guest-token';

const GUEST_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Mint a new cryptographically signed guest identity token
 */
export function generateGuestToken(existingGuestId = null) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is missing from environment');
  }

  const guestId = existingGuestId || `gst_${crypto.randomUUID()}`;
  const token = jwt.sign(
    {
      guestId,
      type: 'guest',
      jti: crypto.randomBytes(16).toString('hex'),
    },
    jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: GUEST_TOKEN_EXPIRY,
    }
  );

  return { guestId, token };
}

/**
 * Verify a guest token and extract the guestId.
 * Validates algorithm, token type, guestId format, and checks revocation store.
 */
export async function verifyGuestToken(token) {
  if (!token || typeof token !== 'string') return null;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is missing from environment');
  }

  try {
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (
      decoded &&
      decoded.type === 'guest' &&
      typeof decoded.guestId === 'string' &&
      /^gst_[a-zA-Z0-9_-]+$/.test(decoded.guestId)
    ) {
      if (decoded.jti) {
        // Dynamically import tokenStore to avoid circular dependencies
        const { default: tokenStore } = await import('./tokenStore.js');
        if (await tokenStore.isTokenRevoked(decoded.jti)) {
          return null;
        }
      }
      return decoded.guestId;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Extract guest token from Request (cookie or X-Guest-Token header).
 * Client-provided raw IDs are strictly rejected; only signed tokens are accepted.
 */
export function extractGuestToken(req) {
  if (req.cookies && req.cookies[GUEST_COOKIE_NAME]) {
    return req.cookies[GUEST_COOKIE_NAME];
  }

  const headerToken = req.headers?.[GUEST_HEADER_NAME] || req.headers?.['x-guest-token'];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }

  return null;
}

/**
 * Set the guest cookie and response header
 */
export function setGuestCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = isProd ? 'none' : 'lax';

  res.cookie(GUEST_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite,
    maxAge: GUEST_TOKEN_EXPIRY * 1000,
    path: '/',
  });

  res.setHeader('X-Guest-Token', token);
}

/**
 * Issue a guest identity, set cookie, and return { guestId, token }
 */
export function issueGuestIdentity(res, existingGuestId = null) {
  const { guestId, token } = generateGuestToken(existingGuestId);
  setGuestCookie(res, token);
  return { guestId, token };
}
