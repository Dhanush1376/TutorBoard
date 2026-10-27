import crypto from 'crypto';
import AuthChallenge from '../../models/AuthChallenge.js';

/**
 * Email one-time codes (verify email, reset password).
 *
 *  - 6-digit code from a CSPRNG; only an HMAC of it is stored (keyed with the
 *    server secret, so a database dump alone cannot brute-force codes offline).
 *  - Bound to (user, purpose); a new code replaces the old one only after the
 *    new email was handed to the mail provider, so a failed resend never kills
 *    a code the user already has.
 *  - Expires after CODE_TTL; MAX_ATTEMPTS wrong guesses burn it; resend has a
 *    cooldown and an hourly cap.
 *  - Each guess reserves an attempt atomically before comparing, and success is
 *    a compare-and-set on `verifiedAt: null`, so parallel guesses cannot exceed
 *    the limit and a code is accepted at most once.
 */

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_SENDS_PER_HOUR = 5;
export const RESET_GRANT_TTL_MS = 15 * 60 * 1000;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function codeHash(userId, purpose, code) {
  const key = process.env.JWT_SECRET || 'tutorboard-dev-only';
  return crypto.createHmac('sha256', key).update(`${userId}:${purpose}:${code}`).digest('hex');
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Create (or replace) the challenge and deliver it with `send(code)`.
 * Returns { status: 'sent' | 'cooldown' | 'limited' | 'send_failed', retryAfterS? }.
 */
export async function issueChallenge(userId, purpose, send) {
  const now = Date.now();
  const existing = await AuthChallenge.findOne({ userId, purpose }).lean();

  if (existing && !existing.verifiedAt && now - new Date(existing.sentAt).getTime() < RESEND_COOLDOWN_MS) {
    return { status: 'cooldown', retryAfterS: Math.ceil((RESEND_COOLDOWN_MS - (now - new Date(existing.sentAt).getTime())) / 1000) };
  }
  const windowStart = existing?.windowStart && now - new Date(existing.windowStart).getTime() < 3600_000
    ? new Date(existing.windowStart) : new Date(now);
  const sendCount = existing?.windowStart && windowStart.getTime() === new Date(existing.windowStart).getTime()
    ? (existing.sendCount || 0) : 0;
  if (sendCount >= MAX_SENDS_PER_HOUR) {
    return { status: 'limited', retryAfterS: Math.ceil((windowStart.getTime() + 3600_000 - now) / 1000) };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const delivered = await send(code);
  if (!delivered) return { status: 'send_failed' };

  const write = () => AuthChallenge.findOneAndUpdate(
    { userId, purpose },
    {
      $set: {
        codeHash: codeHash(userId, purpose, code),
        attempts: 0,
        sentAt: new Date(now),
        expiresAt: new Date(now + CODE_TTL_MS),
        verifiedAt: null,
        grantHash: null,
        grantExpiresAt: null,
        windowStart,
        sendCount: sendCount + 1,
      },
    },
    { upsert: true }
  );
  try {
    await write();
  } catch (err) {
    // two first-time requests raced on the (user, purpose) unique index: the row exists now
    if (err.code !== 11000) throw err;
    await write();
  }
  return { status: 'sent' };
}

/**
 * Check a code. Returns { ok: true, challenge } once, or { ok: false, reason }
 * with reason in: none | expired | locked | invalid.
 */
export async function verifyChallenge(userId, purpose, code) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid' };
  const now = new Date();

  // reserve one attempt (atomic): parallel guesses each consume one
  const reserved = await AuthChallenge.findOneAndUpdate(
    { userId, purpose, verifiedAt: null, attempts: { $lt: MAX_ATTEMPTS }, expiresAt: { $gt: now } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  ).lean();

  if (!reserved) {
    const c = await AuthChallenge.findOne({ userId, purpose }).lean();
    if (!c || c.verifiedAt) return { ok: false, reason: 'none' };
    if (c.expiresAt <= now) return { ok: false, reason: 'expired' };
    return { ok: false, reason: 'locked' };
  }

  if (!safeEqual(reserved.codeHash, codeHash(userId, purpose, code))) {
    return { ok: false, reason: reserved.attempts >= MAX_ATTEMPTS ? 'locked' : 'invalid', attemptsLeft: MAX_ATTEMPTS - reserved.attempts };
  }

  const set = { verifiedAt: now };
  let grant = null;
  if (purpose === 'reset_password') {
    grant = crypto.randomBytes(32).toString('base64url');
    set.grantHash = sha256(grant);
    set.grantExpiresAt = new Date(now.getTime() + RESET_GRANT_TTL_MS);
  }
  const won = await AuthChallenge.findOneAndUpdate(
    { _id: reserved._id, verifiedAt: null, codeHash: reserved.codeHash },
    { $set: set },
    { returnDocument: 'after' }
  ).lean();
  if (!won) return { ok: false, reason: 'none' };
  if (purpose === 'verify_email') await AuthChallenge.deleteOne({ _id: won._id });
  return { ok: true, challenge: won, grant };
}

/**
 * Consume a password-reset grant (single use). Returns the userId or null.
 * Deleting the challenge is the consume step, so two concurrent resets with the
 * same grant cannot both succeed.
 */
export async function consumeResetGrant(grant) {
  if (typeof grant !== 'string' || grant.length < 20 || grant.length > 100) return null;
  const doc = await AuthChallenge.findOneAndDelete({
    purpose: 'reset_password',
    grantHash: sha256(grant),
    grantExpiresAt: { $gt: new Date() },
    verifiedAt: { $ne: null },
  }).lean();
  return doc ? doc.userId : null;
}
