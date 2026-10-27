/**
 * removeConversationExpiry — drop TTL indexes that silently delete conversations.
 *
 * Conversations (chatsessions) and their messages, artifacts and walkthroughs
 * are kept until the learner deletes them. Older deployments created a TTL index
 * on chatsessions.lastUpdated (90 days); removing it from the schema does not
 * remove it from MongoDB, so this drops it from the live database.
 *
 * Safe and idempotent:
 *  - only indexes with `expireAfterSeconds` on the protected collections are touched
 *  - dropping an index never deletes documents
 *  - a second run finds nothing to do
 * TTLs on disposable data (request ledger, engine state, caches, logs, tokens)
 * are left alone. Rollback: re-create the index (see docs/data-retention.md).
 */
import type { Connection } from 'mongoose';

/** Collections whose documents must never expire on a timer. */
export const PROTECTED_COLLECTIONS = ['chatsessions', 'chatmessages', 'artifacts', 'codevisualizations'] as const;

export interface ExpiryIndexReport {
  collection: string;
  index: string;
  key: Record<string, unknown>;
  expireAfterSeconds: number;
  dropped: boolean;
}

export async function removeConversationExpiry(
  connection: Connection,
  { dryRun = false, log = console }: { dryRun?: boolean; log?: Pick<Console, 'info' | 'warn'> } = {},
): Promise<ExpiryIndexReport[]> {
  const db = connection.db;
  if (!db) throw new Error('removeConversationExpiry: database connection is not open');
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const report: ExpiryIndexReport[] = [];

  for (const name of PROTECTED_COLLECTIONS) {
    if (!existing.has(name)) continue;
    const indexes = await db.collection(name).indexes();
    for (const idx of indexes) {
      if (typeof idx.expireAfterSeconds !== 'number' || !idx.name) continue;
      const entry: ExpiryIndexReport = {
        collection: name,
        index: idx.name,
        key: idx.key as Record<string, unknown>,
        expireAfterSeconds: idx.expireAfterSeconds,
        dropped: false,
      };
      if (!dryRun) {
        await db.collection(name).dropIndex(idx.name);
        entry.dropped = true;
        log.info(`[Retention] Dropped expiry index ${name}.${idx.name} (was ${idx.expireAfterSeconds}s) — documents are kept`);
      } else {
        log.info(`[Retention] Would drop expiry index ${name}.${idx.name} (${idx.expireAfterSeconds}s)`);
      }
      report.push(entry);
    }
  }
  return report;
}
