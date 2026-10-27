/**
 * Grant or remove the admin role from a shell (break-glass; the normal path is
 * the request/approve flow in the admin portal). Super-admins are NOT set here:
 * they come only from SUPERADMIN_EMAILS in the server environment.
 *
 *   node scripts/grant-admin.mjs <email> [admin|user]
 *
 * The account must already exist. Its sessions are ended so the new role takes
 * effect on the next sign-in.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const [, , rawEmail, role = 'admin'] = process.argv;
if (!rawEmail || !['admin', 'user'].includes(role)) {
  console.error('Usage: node scripts/grant-admin.mjs <email> [admin|user]   (super-admins: set SUPERADMIN_EMAILS in server/.env)');
  process.exit(1);
}
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

const { default: User } = await import('../models/User.js');
const { default: AuthSession } = await import('../models/AuthSession.js');
const { default: AuditEvent } = await import('../models/AuditEvent.js');
const { normalizeEmail } = await import('../utils/auth/identity.js');

await mongoose.connect(uri);
try {
  const email = normalizeEmail(rawEmail);
  const user = await User.findOne({ email }).select('role email');
  if (!user) {
    console.error(`No account with email ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
  } else {
    const from = user.role || 'user';
    await User.updateOne({ _id: user._id }, { $set: { role } });
    const r = await AuthSession.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: 'role_changed' } });
    await AuditEvent.create({ type: 'admin.role_changed', targetUserId: user._id, meta: { from, to: role, via: 'grant-admin script' } });
    console.log(`${email}: ${from} → ${role}. ${r.modifiedCount} session(s) ended; sign in again.`);
  }
} finally {
  await mongoose.disconnect();
}
