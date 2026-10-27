/**
 * Read-only reconciliation report for legacy account data. Changes nothing.
 *
 *   node scripts/migrations/report-duplicate-accounts.mjs
 *
 * Reports:
 *  1. Emails that differ only by case/whitespace (would collide under the
 *     canonical normalisation; the unique index is on the stored form).
 *  2. Accounts whose email is a synthetic "<username>@github.com" created by the
 *     old GitHub sign-in fallback (not a real verified address).
 *  3. Accounts that have neither a password nor a linked provider (cannot sign in).
 *
 * Any merge must be done deliberately, account by account, preserving both
 * accounts' conversations — this script never merges or deletes.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

await mongoose.connect(uri);
try {
  const users = mongoose.connection.collection('users');

  const collisions = await users.aggregate([
    { $group: { _id: { $toLower: { $trim: { input: '$email' } } }, ids: { $push: '$_id' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]).toArray();

  const synthetic = await users.find({ email: /@github\.com$/i, githubId: { $exists: true, $ne: null } })
    .project({ _id: 1, githubId: 1, createdAt: 1 }).toArray();

  const stranded = await users.countDocuments({
    $and: [
      { $or: [{ password: { $exists: false } }, { password: null }, { password: '' }] },
      { $or: [{ googleId: { $exists: false } }, { googleId: null }] },
      { $or: [{ githubId: { $exists: false } }, { githubId: null }] },
    ],
  });

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    caseCollisions: collisions.map((c) => ({ count: c.n, ids: c.ids })),
    syntheticGithubEmails: synthetic.map((u) => ({ id: u._id, createdAt: u.createdAt })),
    accountsWithoutSignInMethod: stranded,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
