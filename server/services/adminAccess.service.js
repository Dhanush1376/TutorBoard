import User from '../models/User.js';
import AuditEvent from '../models/AuditEvent.js';
import { normalizeEmail } from '../utils/auth/identity.js';
import { container } from '../core/container.js';

/**
 * Who is super-admin is configuration, not data: SUPERADMIN_EMAILS (comma-
 * separated) in the server environment. An account gets the role only once its
 * email is verified — otherwise anyone could register that address first and
 * inherit the role. When the variable is set, a super-admin whose email is no
 * longer listed drops to admin. Nothing on the website can create or remove a
 * super-admin.
 */

export function configuredSuperadmins() {
  return String(process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter((e) => /^\S+@\S+\.\S+$/.test(e));
}

export const isConfiguredSuperadmin = (email) => configuredSuperadmins().includes(normalizeEmail(email));

async function invalidateUserCache(userId) {
  if (!container.has('redis-main')) return;
  try { await container.resolve('redis-main').del(`user:${userId}`); } catch { /* cache only */ }
}

const record = (type, targetUserId, meta) =>
  AuditEvent.create({ type, targetUserId, meta: { ...meta, via: 'SUPERADMIN_EMAILS' } }).catch(() => {});

/**
 * Bring one account in line with SUPERADMIN_EMAILS. Called at sign-in and after
 * email verification, so the role applies the moment the owner proves the
 * address. Returns the role the account has afterwards.
 */
export async function applyConfiguredRole(userId) {
  const list = configuredSuperadmins();
  if (list.length === 0) return null;
  const u = await User.findById(userId).select('email role emailVerifiedAt').lean();
  if (!u) return null;
  const listed = list.includes(normalizeEmail(u.email));
  if (listed && u.emailVerifiedAt && u.role !== 'superadmin') {
    await User.updateOne({ _id: u._id }, { $set: { role: 'superadmin' } });
    await invalidateUserCache(u._id);
    await record('admin.role_changed', u._id, { from: u.role || 'user', to: 'superadmin' });
    return 'superadmin';
  }
  if (!listed && u.role === 'superadmin') {
    await User.updateOne({ _id: u._id }, { $set: { role: 'admin' } });
    await invalidateUserCache(u._id);
    await record('admin.role_changed', u._id, { from: 'superadmin', to: 'admin', reason: 'not in SUPERADMIN_EMAILS' });
    return 'admin';
  }
  return u.role || 'user';
}

/**
 * Startup: apply SUPERADMIN_EMAILS to every account it concerns. Never throws.
 * @param {{ info?: (m: string) => void, warn?: (m: string) => void }} [log]
 */
export async function syncConfiguredSuperadmins(log = console) {
  const list = configuredSuperadmins();
  if (list.length === 0) return;
  try {
    const affected = await User.find({ $or: [{ email: { $in: list } }, { role: 'superadmin' }] }).select('_id').lean();
    for (const u of affected) await applyConfiguredRole(u._id);
    const waiting = list.length - (await User.countDocuments({ email: { $in: list }, role: 'superadmin' }));
    if (waiting > 0) log.info?.(`[Admin] ${waiting} SUPERADMIN_EMAILS address(es) will become super-admin once the account exists with a verified email`);
  } catch (err) {
    log.warn?.(`[Admin] super-admin sync failed: ${err.message}`);
  }
}
