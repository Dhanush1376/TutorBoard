import ChatSession from '../../models/ChatSession.js';
import ChatMessage from '../../models/ChatMessage.js';
import Artifact from '../../models/Artifact.js';
import { extractGuestToken, readGuestToken, GUEST_COOKIE_NAME } from '../../utils/auth/guestToken.js';

/**
 * Move the caller's guest work (conversations, messages, visual artifacts) to
 * the account they just signed in to.
 *
 * Ownership comes only from the signed guest token on this request — never
 * from a client-supplied id — so nobody can claim another guest's data.
 * Each step is `updateMany({ guestId, userId: null })`: a retry after a partial
 * failure moves only what is left and can never duplicate anything. Messages
 * and artifacts move before their sessions, so a crash midway leaves every
 * session still readable by its guest until the next sign-in finishes the job.
 * The guest cookie is cleared only after every step succeeded.
 */
export async function claimGuestData(req, res, userId) {
  const token = extractGuestToken(req);
  if (!token) return { claimed: false };
  const guest = await readGuestToken(token);
  if (!guest?.guestId) return { claimed: false };
  const { guestId } = guest;

  try {
    const owned = { guestId, $or: [{ userId: null }, { userId: { $exists: false } }] };
    const moveTo = { $set: { userId, guestId: null } };
    const messages = await ChatMessage.updateMany(owned, moveTo);
    const artifacts = await Artifact.updateMany(owned, moveTo);
    const sessions = await ChatSession.updateMany(owned, moveTo);

    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(GUEST_COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' });

    return {
      claimed: true,
      sessions: sessions.modifiedCount,
      messages: messages.modifiedCount,
      artifacts: artifacts.modifiedCount,
    };
  } catch (err) {
    // keep the guest cookie so the next sign-in retries the rest
    console.error('[GuestMigration] partial failure, will retry on next sign-in:', err.message);
    return { claimed: false, error: true };
  }
}
