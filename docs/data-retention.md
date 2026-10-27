# Data retention and cancellation

## Retention policy

**Learning data is kept until the learner deletes it.** Nothing on a timer deletes it.

| Data | Collection | Kept until |
|---|---|---|
| Conversations | `chatsessions` | the learner deletes the conversation, wipes their data, or deletes their account |
| Messages (questions, answers, stopped/failed partials) | `chatmessages` | as above (cascades with the conversation) |
| Visual lessons / artifacts | `artifacts` | as above, or the learner deletes the artifact |
| Saved code walkthroughs | `codevisualizations` | as above; also capped per user (oldest beyond the cap are pruned — see `models/CodeVisualization.js`) |

Explicit deletion paths (all owner-checked):
- `DELETE /api/sessions/:id` — the conversation plus its messages, artifacts and walkthroughs.
- Wipe cloud data / delete account (`controllers/user.controller.js`) — everything owned by the user.
- Deleting a single message, and editing a message (later messages in that branch are replaced).

### Disposable data (keeps its automatic expiry)

| Data | Collection | Expiry | Why |
|---|---|---|---|
| Request ledger (idempotency, retry, resume) | `sessionledgers` | 24 h after last update | only needed while a request can be retried |
| Live lesson engine state | `enginesessionstates` | 48 h of inactivity | in-memory working state; the conversation itself is in `chatsessions` |
| Activity log | `activitylogs` | 30 days | telemetry |
| Usage log | `usagelogs` | 90 days | telemetry / budgets |
| OAuth codes, rate limits, revoked tokens, topic cache | various | their own `expiresAt` | security and caching |

## The removed 90-day conversation expiry

Older deployments created a TTL index on `chatsessions.lastUpdated` (90 days), which silently
deleted conversations that had been idle for three months. It has been removed from the schema
(`models/ChatSession.js`). Removing an index from a schema does **not** remove it from MongoDB,
so the index is dropped from the live database by
`server/core/migrations/removeConversationExpiry.ts`:

- runs automatically at server startup, right after the database connects (never blocks startup;
  set `CONVERSATION_EXPIRY_MIGRATION=off` to skip it);
- only drops indexes that have `expireAfterSeconds` on `chatsessions`, `chatmessages`, `artifacts`
  or `codevisualizations`;
- dropping an index never deletes documents; running it again finds nothing to do.

To inspect or apply it by hand:

```bash
cd server
npx tsx scripts/migrations/remove-conversation-expiry.ts --dry-run   # report only
npx tsx scripts/migrations/remove-conversation-expiry.ts             # apply
```

Rollback (only if an expiry policy is deliberately wanted again — document it here first):

```js
db.chatsessions.createIndex({ lastUpdated: 1 }, { expireAfterSeconds: 90 * 24 * 3600 })
```

Conversations already deleted by the old index before this change cannot be recovered from the
application; only a database backup can restore them.

## Cancellation (Stop)

- Closing the connection (refresh, closed tab, network drop) does **not** cancel an answer: it
  finishes and is saved, and reopening the conversation shows it (`pendingRequest` on
  `GET /api/sessions/:id` while it is still running).
- `POST /api/chat/stop { requestId, sessionId? }` stops an answer. Only its owner can stop it
  (same signed-in user, same verified guest, or a guest naming the conversation).
- Stopping aborts the model call (and the wait for a visual lesson), ends the stream, and saves any
  text already produced as a `cancelled` message. A cancelled answer is never saved as
  `completed` and is never sent back to the model as context.

### Multiple server instances

Running generations are tracked by a `CancellationRegistry`
(`server/services/chat/generationRegistry.ts`). The default is in-memory, which is correct for a
single instance. With several instances, a Stop that lands on a different instance than the one
generating returns `not_found` and the answer runs to completion. To support that, implement
`CancellationRegistry` with a shared channel — for example a cancel flag on the request's
`sessionledgers` entry that the owning instance checks, or a pub/sub message — and install it with
`setCancellationRegistry()` at startup. No callers need to change.
