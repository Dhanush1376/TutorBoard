import mongoose from 'mongoose';
import User from '../models/User.js';
import AdminAccessRequest from '../models/AdminAccessRequest.js';
import { revokeAllSessions } from '../services/auth/session.service.js';
import { audit } from '../services/audit.service.js';
import { configuredSuperadmins } from '../services/adminAccess.service.js';
import { normalizeEmail, isAdmin } from '../utils/auth/identity.js';
import { container } from '../core/container.js';
import {
  sendAdminRequestReceivedEmail,
  sendAdminRequestDecisionEmail,
  sendAdminAccessRevokedEmail,
} from '../utils/core/mailer.js';

/**
 * Admin access requests.
 *
 * Requester (any signed-in account): asks for its OWN account only — the email
 * comes from the session, never from the request body. The email must be
 * verified, one request may be pending at a time, and after a rejection the
 * user waits REJECT_COOLDOWN_MS before asking again.
 *
 * Super-admin only: approve / reject requests, revoke an admin. Approving and
 * revoking also need a recent sign-in (requireRecentAuth on the route). Each
 * decision is a compare-and-set on `status: 'pending'`, so two clicks or two
 * super-admins cannot decide the same request twice. Every step is audited and
 * every role change ends the target's sessions.
 */

const REJECT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const clean = (s, max) => String(s || '').replace(/[<>]/g, '').trim().slice(0, max);

async function invalidateUserCache(userId) {
  if (!container.has('redis-main')) return;
  try { await container.resolve('redis-main').del(`user:${userId}`); } catch { /* cache only */ }
}

const publicRequest = (r) => ({
  id: r._id,
  userId: r.userId,
  email: r.email,
  name: r.name,
  reason: r.reason,
  status: r.status,
  decisionNote: r.decisionNote,
  createdAt: r.createdAt,
  decidedAt: r.decidedAt,
  revokedAt: r.revokedAt,
});

/** Everyone who should hear about a new request: listed and verified super-admins. */
async function superadminRecipients() {
  return User.find({
    role: 'superadmin',
    emailVerifiedAt: { $ne: null },
    disabledAt: null,
    ...(configuredSuperadmins().length ? { email: { $in: configuredSuperadmins() } } : {}),
  }).select('name email').lean();
}

// ─── Requester ──────────────────────────────────────────────────────────────

export const getMyAdminAccess = async (req, res) => {
  const latest = await AdminAccessRequest.findOne({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({
    role: req.user.role || 'user',
    emailVerified: !!req.user.emailVerifiedAt,
    email: req.user.email,
    request: latest ? publicRequest(latest) : null,
  });
};

export const requestAdminAccess = async (req, res) => {
  const user = await User.findById(req.user._id).select('name email role emailVerifiedAt disabledAt').lean();
  if (!user || user.disabledAt) return res.status(403).json({ error: 'This account cannot request admin access.' });
  if (isAdmin(user)) return res.status(409).json({ error: 'You already have admin access.', code: 'ALREADY_ADMIN' });
  if (!user.emailVerifiedAt) {
    return res.status(403).json({ error: 'Verify your email first (Settings → Account), then request access.', code: 'EMAIL_NOT_VERIFIED' });
  }
  // the form shows the account email; anything else in the body is refused, never used
  if (req.body?.email && normalizeEmail(req.body.email) !== normalizeEmail(user.email)) {
    return res.status(400).json({ error: 'You can only request access for the account you are signed in with.', code: 'EMAIL_MISMATCH' });
  }
  const lastRejected = await AdminAccessRequest.findOne({ userId: user._id, status: 'rejected' }).sort({ decidedAt: -1 }).lean();
  if (lastRejected?.decidedAt && Date.now() - new Date(lastRejected.decidedAt).getTime() < REJECT_COOLDOWN_MS) {
    const hours = Math.ceil((REJECT_COOLDOWN_MS - (Date.now() - new Date(lastRejected.decidedAt).getTime())) / 3600_000);
    return res.status(429).json({ error: `Your last request was declined. You can ask again in about ${hours} hour(s).`, code: 'REQUEST_COOLDOWN' });
  }

  let request;
  try {
    request = await AdminAccessRequest.create({
      userId: user._id,
      email: user.email,
      name: user.name,
      reason: clean(req.body?.reason, 500),
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'You already have a request waiting for review.', code: 'REQUEST_PENDING' });
    throw err;
  }

  await audit(req, 'admin_access.requested', { targetUserId: user._id, target: String(request._id) });
  const recipients = await superadminRecipients();
  for (const sa of recipients) sendAdminRequestReceivedEmail(sa, request).catch(() => {});
  res.status(201).json({ request: publicRequest(request.toObject()), notified: recipients.length });
};

export const cancelAdminRequest = async (req, res) => {
  const r = await AdminAccessRequest.findOneAndUpdate(
    { userId: req.user._id, status: 'pending' },
    { $set: { status: 'cancelled', decidedAt: new Date() } },
    { returnDocument: 'after' }
  ).lean();
  if (!r) return res.status(404).json({ error: 'No request is waiting.' });
  await audit(req, 'admin_access.cancelled', { targetUserId: req.user._id, target: String(r._id) });
  res.json({ request: publicRequest(r) });
};

// ─── Super-admin ────────────────────────────────────────────────────────────

export const listAccessRequests = async (req, res) => {
  const status = ['pending', 'approved', 'rejected', 'cancelled', 'revoked'].includes(req.query.status) ? req.query.status : undefined;
  const rows = await AdminAccessRequest.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ requests: rows.map(publicRequest), pending: await AdminAccessRequest.countDocuments({ status: 'pending' }) });
};

export const listAdmins = async (_req, res) => {
  const listed = configuredSuperadmins();
  const rows = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('name email role emailVerifiedAt disabledAt lastLoginAt createdAt').sort({ role: -1, createdAt: 1 }).lean();
  res.json({
    admins: rows.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      fromEnv: listed.includes(u.email),
      disabled: !!u.disabledAt,
      lastLoginAt: u.lastLoginAt,
    })),
    configuredSuperadmins: listed.length,
  });
};

export const approveAccessRequest = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Request not found' });
  const pending = await AdminAccessRequest.findOne({ _id: req.params.id, status: 'pending' }).lean();
  if (!pending) return res.status(409).json({ error: 'This request was already decided.', code: 'NOT_PENDING' });

  // the account must still be the one that asked: same verified email, not disabled
  const user = await User.findById(pending.userId).select('name email role emailVerifiedAt disabledAt').lean();
  const stale = !user || user.disabledAt || !user.emailVerifiedAt || normalizeEmail(user.email) !== normalizeEmail(pending.email);
  const decided = await AdminAccessRequest.findOneAndUpdate(
    { _id: pending._id, status: 'pending' },
    { $set: stale
      ? { status: 'rejected', decidedBy: req.user._id, decidedAt: new Date(), decisionNote: 'The account changed after the request was made.' }
      : { status: 'approved', decidedBy: req.user._id, decidedAt: new Date(), decisionNote: clean(req.body?.note, 300) } },
    { returnDocument: 'after' }
  ).lean();
  if (!decided) return res.status(409).json({ error: 'This request was already decided.', code: 'NOT_PENDING' });
  if (stale) {
    await audit(req, 'admin_access.rejected', { targetUserId: pending.userId, target: String(pending._id), meta: { reason: 'account_changed' } });
    return res.status(409).json({ error: 'The account changed (email, verification or status) since it asked, so the request was closed.', code: 'ACCOUNT_CHANGED' });
  }

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    await User.updateOne({ _id: user._id, role: { $nin: ['admin', 'superadmin'] } }, { $set: { role: 'admin' } });
    await revokeAllSessions(user._id, 'role_changed');
    await invalidateUserCache(user._id);
  }
  await audit(req, 'admin_access.approved', { targetUserId: user._id, target: String(pending._id), meta: { from: user.role || 'user', to: 'admin' } });
  sendAdminRequestDecisionEmail(user, true, decided.decisionNote).catch(() => {});
  res.json({ request: publicRequest(decided) });
};

export const rejectAccessRequest = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Request not found' });
  const decided = await AdminAccessRequest.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { $set: { status: 'rejected', decidedBy: req.user._id, decidedAt: new Date(), decisionNote: clean(req.body?.note, 300) } },
    { returnDocument: 'after' }
  ).lean();
  if (!decided) return res.status(409).json({ error: 'This request was already decided.', code: 'NOT_PENDING' });
  await audit(req, 'admin_access.rejected', { targetUserId: decided.userId, target: String(decided._id) });
  const user = await User.findById(decided.userId).select('name email').lean();
  if (user) sendAdminRequestDecisionEmail(user, false, decided.decisionNote).catch(() => {});
  res.json({ request: publicRequest(decided) });
};

export const revokeAdminAccess = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ error: 'User not found' });
  if (String(req.params.userId) === String(req.user._id)) return res.status(400).json({ error: 'You cannot revoke your own access.' });
  const target = await User.findById(req.params.userId).select('name email role').lean();
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'superadmin') {
    return res.status(403).json({ error: 'Super-admins come from SUPERADMIN_EMAILS on the server; remove the address there.', code: 'SUPERADMIN_FROM_ENV' });
  }
  const r = await User.updateOne({ _id: target._id, role: 'admin' }, { $set: { role: 'user' } });
  if (r.modifiedCount === 0) return res.status(409).json({ error: 'This account is not an admin.' });
  const revoked = await revokeAllSessions(target._id, 'admin_revoked');
  await invalidateUserCache(target._id);
  await AdminAccessRequest.updateMany(
    { userId: target._id, status: 'approved' },
    { $set: { status: 'revoked', revokedBy: req.user._id, revokedAt: new Date() } }
  );
  await audit(req, 'admin_access.revoked', { targetUserId: target._id, meta: { sessionsRevoked: revoked } });
  sendAdminAccessRevokedEmail(target).catch(() => {});
  res.json({ success: true });
};
