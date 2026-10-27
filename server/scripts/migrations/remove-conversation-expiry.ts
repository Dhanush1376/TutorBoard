/**
 * Drop TTL indexes that would silently delete conversations (see
 * core/migrations/removeConversationExpiry.ts and docs/data-retention.md).
 * The server also runs this check at startup; this script lets you inspect
 * or apply it by hand.
 *
 *   npx tsx scripts/migrations/remove-conversation-expiry.ts --dry-run   # report only
 *   npx tsx scripts/migrations/remove-conversation-expiry.ts             # apply
 *
 * Uses MONGODB_URI (or MONGO_URI) from server/.env. Never deletes documents.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { removeConversationExpiry } from '../../core/migrations/removeConversationExpiry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dryRun = process.argv.includes('--dry-run');

async function run() {
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  const report = await removeConversationExpiry(mongoose.connection, { dryRun });
  if (report.length === 0) console.log('No expiry indexes on conversation data. Nothing to do.');
  else console.table(report);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Retention migration failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
