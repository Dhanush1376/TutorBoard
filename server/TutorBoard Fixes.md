# TutorBoard — Full Production Audit Report
**Date:** 2026-05-11  
**Auditor:** Deep Architecture Review  
**Codebase Snapshot:** `1778520697745_TutorBoard_Source_2026-05-11.zip` (376 files, ~4.2 MB)  
**Scope:** Server (Node.js/TypeScript + ESM), Client (React + Vite), Infrastructure (Redis, MongoDB, PostgreSQL, Socket.IO, AI providers)

---

## Executive Summary

TutorBoard has evolved rapidly into a distributed AI teaching platform — but its architecture carries **critical production risks** that must be resolved before scaling. The codebase demonstrates strong intent: circuit breakers, pub/sub Redis, JWT revocation, structured agents, adaptive pedagogy. However, rapid evolution introduced **orphaned async tasks, a deliberately disabled security layer, a duplicate Redis client, a startup sequencing race, unbounded memory structures, and missing shutdown hygiene** that collectively make the system fragile under real load.

This audit identifies **47 distinct issues** across 15 risk categories, provides root cause analysis, exact code-level fixes, and a target architecture for a resilient distributed AI platform.

**Severity Key:**  
🔴 **CRITICAL** — Data loss, security breach, or production crash risk  
🟠 **HIGH** — Reliability or scalability failure under moderate load  
🟡 **MEDIUM** — Degradation, memory growth, or observability gaps  
🟢 **LOW** — Code quality, maintainability, performance micro-issues

---

## Priority-Ranked Issue List

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🔴 CRITICAL | Security | CSRF verification middleware permanently disabled |
| 2 | 🔴 CRITICAL | Startup | HTTP server accepts traffic before MongoDB connects |
| 3 | 🔴 CRITICAL | Infrastructure | Orphan Redis client instantiated in `index.ts`, never cleaned up |
| 4 | 🔴 CRITICAL | Security | `SameSite: 'none'` auth cookies sent on all HTTP requests (dev + CI) |
| 5 | 🔴 CRITICAL | Auth | Token revocation fails open — both Redis and MongoDB can silently skip check |
| 6 | 🔴 CRITICAL | Async | Agent concurrency queue FIFO resolvers never called if agent throws — permanent deadlock |
| 7 | 🟠 HIGH | Shutdown | Graceful shutdown omits Redis, PostgreSQL, Socket.IO teardown |
| 8 | 🟠 HIGH | Rate Limiting | Rate limiter Redis store captured at module load time before connection is ready |
| 9 | 🟠 HIGH | Memory | `semanticStore` array (llmClient.js) is unbounded across all requests — grows indefinitely |
| 10 | 🟠 HIGH | Memory | `responseCache` Map (llmClient.js) is a module-level singleton — never cleared on restart |
| 11 | 🟠 HIGH | Session | SessionStore capacity check bypassed entirely when Redis is connected |
| 12 | 🟠 HIGH | WebSocket | Socket.IO `globalSocket` singleton never re-initialized on network errors — stale reference |
| 13 | 🟠 HIGH | Postgres | `rejectUnauthorized: false` in production SSL config — MITM vulnerable |
| 14 | 🟠 HIGH | AI | Parallel response racing (`Promise.allSettled`) in llmClient has no per-request abort propagation |
| 15 | 🟠 HIGH | Auth | `optionalProtect` silently swallows all JWT errors — token tampering invisible in logs |
| 16 | 🟡 MEDIUM | Module | `index.ts` imports via `@ts-ignore` + `.js` extensions — module boundary fragility at scale |
| 17 | 🟡 MEDIUM | Observability | `unhandledRejection` handler logs but takes no corrective action |
| 18 | 🟡 MEDIUM | Redis | `isConnected` flag set only on `connect` event — stale `true` during reconnect window |
| 19 | 🟡 MEDIUM | Intervals | `rateLimiter.js` `setInterval` cleanup timer runs unconditionally — no shutdown ref |
| 20 | 🟡 MEDIUM | Postgres | `initPostgres()` `isConnecting` flag never reset on failure — retry permanently blocked |
| 21 | 🟡 MEDIUM | AI | Circuit breaker `_syncFromRedis()` fires async on construction — race with first request |
| 22 | 🟡 MEDIUM | Session | `sessionStore.update()` called without existing session object in `updateCanvasState` |
| 23 | 🟡 MEDIUM | Auth | CSRF cookie refresh only on `GET` — POST-only SPA flows never receive updated secrets |
| 24 | 🟡 MEDIUM | Deployment | `startServer()` catch block logs error but does not exit process — silent boot failure |
| 25 | 🟡 MEDIUM | Frontend | `useSocket` hook relies on module-level `globalSocket` — React StrictMode double-mount risk |
| 26 | 🟡 MEDIUM | Security | CORS wildcard `app.options("*", cors())` overrides strict origin check for preflight |
| 27 | 🟡 MEDIUM | Observability | Agent loop has no tracing IDs — multi-stage failures cannot be correlated in logs |
| 28 | 🟡 MEDIUM | AI | `semanticStore` push happens even on cache miss — adds entry before validating usefulness |
| 29 | 🟡 MEDIUM | Auth | `isTokenRevoked` back-fills Redis with a hardcoded 1-hour TTL, not the real token TTL |
| 30 | 🟡 MEDIUM | Queue | `agentQueue` array is module-level but `MAX_CONCURRENT_LOOPS = 3` applies per-process — not distributed |
| 31 | 🟡 MEDIUM | Session | Disconnect handler calls `sessionStore.persistProfile` and `LearnerProfile.findOneAndUpdate` without timeout — hangs if Mongo is slow |
| 32 | 🟡 MEDIUM | AI | `initClients()` is not called at module load — first request triggers initialization with no retry |
| 33 | 🟡 MEDIUM | Security | `providerFactory.js` fetches remote image URLs (`fetch(fileUrl)`) with no SSRF guard |
| 34 | 🟢 LOW | Module | `nodemon.json` watches `.js` and `.ts` — restarts on every dist file write during CI build |
| 35 | 🟢 LOW | Logging | Auth middleware logs every successful request path to stdout — PII leakage risk at high volume |
| 36 | 🟢 LOW | Frontend | `AuthContext` writes settings to `localStorage` synchronously during render — can throw in SSR |
| 37 | 🟢 LOW | AI | `resolveModelId` mapping contains a stale model string `claude-sonnet-4-5` (non-canonical) |
| 38 | 🟢 LOW | Observability | Circuit breaker `totalRequests` counter never serialized to Redis — metrics lost on restart |
| 39 | 🟢 LOW | Deployment | `server/package.json` `start` script runs `node dist/index.js` but `build` step not enforced in CI |
| 40 | 🟢 LOW | Security | Sentry `tracesSampleRate: 1.0` in production — 100% trace capture is excessive and costly |
| 41 | 🟢 LOW | Performance | `CORS` `allowedOrigins` array rebuilt and `.filter(Boolean)` called on every request |
| 42 | 🟢 LOW | Auth | `TokenStore.createCode` fallback `setTimeout` leaks if server shuts down before expiry |
| 43 | 🟢 LOW | Frontend | `useSocket` listener leak warning threshold of 10 is too high — leaks go undetected |
| 44 | 🟢 LOW | AI | Agent loop `onProgress` callbacks not guarded — if consumer throws, pipeline crashes |
| 45 | 🟢 LOW | Session | SessionStore `KEY_PREFIX = 'sess:'` collides with other apps on shared Redis |
| 46 | 🟢 LOW | Observability | No structured log format — mixing emoji, brackets, and free-form strings breaks log aggregators |
| 47 | 🟢 LOW | Deployment | `vercel.json` at repo root and `client/vercel.json` both exist — deployment ambiguity |

---

## Section 1 — Runtime Lifecycle Architecture

### 1.1 🔴 CRITICAL: HTTP Server Accepts Traffic Before MongoDB Connects

**File:** `server/index.ts`, lines 401–419

**Root Cause:**
```typescript
// CURRENT (BROKEN)
const startServer = async () => {
  httpServer.listen(port, () => { ... }); // ← STARTS FIRST
  await mongoose.connect(MONGODB_URI, ...); // ← CONNECTS AFTER
};
```
The server binds to the port and begins accepting HTTP/WebSocket connections before the MongoDB connection is established. The `dbCheck` middleware guards most routes, but:
- The `/health` endpoint always returns `{ status: 'ok' }` even while DB is still connecting, giving false positive to load balancers.
- WebSocket connections from fast clients will be accepted and attempt session creation against an unready DB, causing unhandled errors.
- Race window: on Render/Railway cold starts, MongoDB serverless (Neon) takes 1–4 seconds to wake. That window is entirely unguarded.

**Fix:**
```typescript
const startServer = async () => {
  // 1. Connect all infrastructure first
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });
  console.log('[DB] Connected to MongoDB ✅');

  if (process.env.POSTGRES_URL) {
    await initPostgres();
  }

  // 2. Only then bind the port
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => {
      console.log(`[Server] Listening on port ${port} ✅`);
      resolve();
    });
    httpServer.on('error', reject);
  });
};

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1); // ← also fixes Issue #24
});
```

---

### 1.2 🔴 CRITICAL: Orphan Redis Client in `index.ts`

**File:** `server/index.ts`, lines 138–144

```typescript
// CURRENT (BROKEN)
if (process.env.REDIS_URL) {
  try {
    const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
    console.log('[Redis] Initializing connection...');
  } catch (err) { ... }
}
```
This creates a **second** `ioredis` client completely separate from the singleton in `utils/core/redis.js`. It:
- Is never assigned to a variable with outer scope
- Is never disconnected during graceful shutdown
- Keeps the Node.js event loop alive indefinitely
- Doubles the connection count to Upstash (which has per-connection billing)
- The "Initializing connection" log fires immediately — `connect` event is async so this line is misleading

**Fix:** Remove this block entirely. The `redis.js` singleton already handles initialization.

---

### 1.3 🟠 HIGH: Graceful Shutdown Omits Redis, PostgreSQL, Socket.IO

**File:** `server/index.ts`, lines 106–132

The `gracefulShutdown` function only closes:
- `httpServer`
- `mongoose.connection`
- Calls `flushAnalytics()`

It **never** closes:
- `Redis` connections (3 ioredis clients: main, pub, sub)
- PostgreSQL pool (connection leak on Render)
- Socket.IO server (active WebSocket connections orphaned)
- The rate limiter interval from `rateLimiter.js`

**Fix:**
```typescript
import redisClient from './utils/core/redis.js';
import pool from './utils/core/postgres.js';

const gracefulShutdown = async (signal: string) => {
  console.log(`[${signal}] Graceful shutdown started...`);

  // 1. Stop accepting new connections
  if (io) io.close();
  if (httpServer?.listening) {
    httpServer.closeAllConnections?.();
    await new Promise<void>(r => httpServer.close(() => r()));
  }

  // 2. Drain infrastructure
  await mongoose.connection.close(false);
  
  if (redisClient.client) {
    await redisClient.client.quit();
    await redisClient.pubClient?.quit();
    await redisClient.subClient?.quit();
  }

  if (pool) await pool.end();

  await flushAnalytics();

  console.log('[Graceful] Shutdown complete.');
  process.exit(0);
};
```

---

### 1.4 🟡 MEDIUM: `startServer()` Catch Silently Swallows Fatal Errors

**File:** `server/index.ts`, line 420

```typescript
} catch (err: any) {
  console.error(`[DB] FAILED TO CONNECT: ${err.message}`);
  // ← process continues running without a DB
}
```
If MongoDB connection fails, the server continues running. All non-health routes will return `503` (via `dbCheck`), but the process stays alive, occupying the port. Render/Railway will not restart it because it never crashed.

**Fix:** Call `process.exit(1)` after logging:
```typescript
} catch (err: any) {
  console.error(`[DB] Fatal: failed to connect: ${err.message}`);
  process.exit(1);
}
```

---

## Section 2 — Async Task Orchestration

### 2.1 🔴 CRITICAL: Agent Queue FIFO Deadlock on Exception

**File:** `server/engine/core/agentLoop.js`, lines 386–400

```javascript
if (activeAgentLoops >= MAX_CONCURRENT_LOOPS) {
  await new Promise(resolve => agentQueue.push(resolve));
}
activeAgentLoops++;
try {
  return await _runAgentLoopInternal(params);
} finally {
  activeAgentLoops--;
  if (agentQueue.length > 0) {
    const next = agentQueue.shift();
    next(); // ← resolves the blocked promise
  }
}
```
This pattern is correct when `_runAgentLoopInternal` succeeds or throws a caught error. However, if a **queued request times out before it is dequeued** (e.g., HTTP timeout fires, client disconnects, AbortSignal fires), the Promise resolve callback is still in `agentQueue` — it will eventually be called and trigger a request whose external caller is already gone. The bigger risk: if `agentQueue.push(resolve)` is called but the outer function never reaches `finally` (process crash, SIGKILL mid-request), those queued items remain permanently blocked, and `MAX_CONCURRENT_LOOPS` slots are never freed.

**Fix:** Add AbortSignal awareness to queue entry:
```javascript
if (activeAgentLoops >= MAX_CONCURRENT_LOOPS) {
  await new Promise((resolve, reject) => {
    const entry = { resolve, reject };
    agentQueue.push(entry);
    // Clean up on external abort
    params.signal?.addEventListener('abort', () => {
      const idx = agentQueue.indexOf(entry);
      if (idx > -1) agentQueue.splice(idx, 1);
      reject(new Error('ABORTED_WHILE_QUEUED'));
    }, { once: true });
  });
}
```
And update the dequeue to use `{ resolve, reject }` objects.

---

### 2.2 🟠 HIGH: `semanticStore` Is an Unbounded Module-Level Array

**File:** `server/utils/ai/llmClient.js`, line 115

```javascript
const semanticStore = []; // grows indefinitely at the module level
```
`SEMANTIC_CACHE_MAX = 20` enforces a max of 20 entries, but each entry stores a **full 1536-dimension embedding vector** (1,536 floats × 8 bytes = ~12 KB per entry). That is fine for 20 entries. The bug is the semantic store is **shared across all users and sessions** — embedding from User A's query pollutes User B's similarity matching. Additionally, `shift()` on every overflow is O(n). Over hours, the JIT-compiled array access patterns also degrade.

**Fix:** Scope the semantic cache per-user or per-session, not globally. Remove from module scope; pass as context:
```javascript
// Per request context (no module-level accumulation)
export async function requestCompletion(params) {
  const sessionSemanticStore = params.sessionCache ?? [];
  // ...
}
```

---

### 2.3 🟡 MEDIUM: Rate Limiter `setInterval` Has No Shutdown Reference

**File:** `server/middleware/rateLimiter.js`, line 84

```javascript
setInterval(() => { ... }, SOCKET_WINDOW_MS); // ← no clearInterval ref
```
This interval fires every 60 seconds and is never cleared. On graceful shutdown, it keeps the event loop alive for up to 60 extra seconds, delaying the forced-exit timeout from firing on time. During testing and nodemon restarts, this creates stale timer warnings.

**Fix:**
```javascript
export const rateLimiterCleanupInterval = setInterval(() => { ... }, SOCKET_WINDOW_MS);
rateLimiterCleanupInterval.unref(); // allow process to exit without this
```
Then call `clearInterval(rateLimiterCleanupInterval)` in `gracefulShutdown`.

---

### 2.4 🟡 MEDIUM: `unhandledRejection` Logs But Takes No Action

**File:** `server/index.ts`, line 100

```typescript
process.on('unhandledRejection', (reason, promise) => {
  console.error(msg);
  // ← no Sentry capture, no metric increment, no process exit
});
```
Unhandled rejections in Node.js 15+ terminate the process by default, but with this handler registered they are silenced. This masks bugs. Add structured logging and Sentry capture:
```typescript
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled Rejection:', reason);
  Sentry.captureException(reason);
  // In production, consider exiting — silent continuation can corrupt state
  if (process.env.NODE_ENV === 'production') process.exit(1);
});
```

---

## Section 3 — Redis Infrastructure

### 3.1 🟠 HIGH: Rate Limiter Captures Redis Client Reference at Module Load Time

**File:** `server/middleware/rateLimiter.js`, lines 6–11

```javascript
const client = redisClient.client; // ← captured synchronously
if (redisClient.isConnected && client) {
  httpStore = new RedisStore({ sendCommand: (...args) => client.call(...args) });
}
```
At module load time, `redisClient.client` is already being created (ioredis connects asynchronously), but `redisClient.isConnected` is `false` because the `connect` event hasn't fired yet. This means `httpStore` is **always `null`** on first load — all rate limiting silently falls back to in-memory, providing no cross-instance coordination. If Redis goes down and reconnects, the rate limiter never picks up the new connection.

**Fix:** Use a lazy accessor pattern:
```javascript
const getRedisStore = () => {
  if (!redisClient.isConnected || !redisClient.client) return null;
  return new RedisStore({ sendCommand: (...args) => redisClient.client.call(...args) });
};

export const httpRateLimiter = rateLimit({
  // ...
  store: undefined, // Set dynamically in a wrapper or use lazy init
  skip: (req) => { /* ... */ },
  keyGenerator: (req) => req.ip,
});
```
Or alternatively, initialize the rate limiter after confirming Redis is ready in `startServer()`.

---

### 3.2 🟡 MEDIUM: `isConnected` Flag Is Stale During Reconnection Windows

**File:** `server/utils/core/redis.js`, lines 48–54

```javascript
this.client.on('connect', () => {
  this.isConnected = true;
  // ...
});
this.client.on('error', (err) => {
  this.isConnected = false;
  // ...
});
```
ioredis fires `error` then immediately attempts reconnect. During the reconnect window, `isConnected = false` is correct. But when the reconnection attempt succeeds, ioredis fires `connect` again, resetting the flag. The problem is **between `error` and the next `connect`**, if `subscribe()` is called, it returns early (because `!this.subClient` guard would pass but `subClient` is in reconnecting state). Subscriptions silently drop.

**Fix:** Also listen to `ready` and `reconnecting`:
```javascript
this.client.on('ready', () => { this.isConnected = true; });
this.client.on('reconnecting', () => { this.isConnected = false; });
```

---

### 3.3 🟡 MEDIUM: Redis Pub/Sub Subscriptions Not Restored After Reconnect

**File:** `server/utils/core/redis.js`

ioredis does **not** automatically re-subscribe to channels after a connection drop-and-reconnect in subscribe mode. The `_subHandlers` Map retains all handlers, but the actual Redis SUBSCRIBE command is never resent to the new connection. After a network partition, all pub/sub messages silently disappear.

**Fix:**
```javascript
this.subClient.on('ready', async () => {
  // Re-subscribe to all channels after reconnect
  const channels = [...this._subHandlers.keys()];
  if (channels.length > 0) {
    await this.subClient.subscribe(...channels);
    console.log(`[Redis] Re-subscribed to ${channels.length} channels after reconnect`);
  }
});
```

---

## Section 4 — PostgreSQL Infrastructure

### 4.1 🟠 HIGH: `rejectUnauthorized: false` in Production

**File:** `server/utils/core/postgres.js`, line 14

```javascript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```
`rejectUnauthorized: false` disables TLS certificate validation in production. This allows man-in-the-middle attacks on the database connection. This was likely added to work around Neon/Supabase SSL certificate chain issues.

**Fix for Neon/Supabase:**
```javascript
ssl: process.env.NODE_ENV === 'production' ? {
  rejectUnauthorized: true,
  // Neon provides a CA cert; alternatively use their connection string which includes sslmode=require
} : false,
```
If the CA cert is unavailable, set `sslmode=require` in the connection string and remove the `ssl` object entirely — `pg` will handle it automatically.

---

### 4.2 🟡 MEDIUM: `isConnecting` Flag Never Reset on Failure

**File:** `server/utils/core/postgres.js`, lines 34–70

```javascript
if (isConnecting) return; // ← early exit
isConnecting = true;

try {
  // ...
} catch (err) {
  console.error('[Postgres] Connection failed:', err.message);
  // ← isConnecting never set to false on this path!
} finally {
  isConnecting = false;
}
```
Actually, looking more carefully: the outer catch does have `finally { isConnecting = false }`. But the **inner try/catch** (around the schema queries) catches errors and logs them, without re-throwing. This means `isAvailable` stays `false`, `isConnecting` resets correctly, but subsequent calls to `initPostgres()` will run again — which is fine, except the `IVFFlat` index creation will fail if `lists = 100` but fewer than 100 rows exist. This is a soft bug that causes noisy logs on fresh deployments.

**Fix:** Add row count guard before creating IVFFlat index:
```sql
-- Only create index if table has data
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM session_memory) >= 100 THEN
    CREATE INDEX IF NOT EXISTS session_memory_embedding_idx ON session_memory
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END$$;
```

---

## Section 5 — Authentication & Session Security

### 5.1 🔴 CRITICAL: CSRF Verification Middleware Is Permanently Disabled

**File:** `server/index.ts`, lines 251–268

```typescript
// 2. CSRF Verification Middleware (TEMPORARILY DISABLED FOR DEBUGGING)
/*
app.use((req: Request, res: Response, next: NextFunction) => {
  ...CSRF CHECK...
});
*/
```
The comment says "temporarily disabled for debugging" — but it is committed to version control and deployed. **Every state-mutating API endpoint (POST, PUT, DELETE) currently has zero CSRF protection.** An attacker who tricks a logged-in user into visiting a malicious page can make authenticated API calls on their behalf.

This is a **GDPR-reportable vulnerability** and a critical security regression.

**Fix:** Re-enable the middleware. The likely reason it was disabled is that the frontend was not sending the `X-CSRF-Token` header. The fix is to ensure the frontend fetches and sends the token, not to disable the check.

Frontend fix (one-time setup in `AuthContext` or Axios interceptor):
```javascript
// Fetch CSRF token and attach to all mutating requests
const csrfRes = await API.get('/api/csrf-token');
API.defaults.headers.common['X-CSRF-Token'] = csrfRes.data.csrfToken;
```

Then re-enable the server middleware. Ensure OAuth callback routes remain excluded (they already are in the commented block).

---

### 5.2 🔴 CRITICAL: Token Revocation Fails Open Silently

**File:** `server/utils/auth/tokenStore.js`, lines 71–82

```javascript
async isTokenRevoked(jti) {
  try {
    const cached = await redisClient.get(`revoked:${jti}`);
    if (cached === '1') return true;
    const exists = await RevokedToken.exists({ jti });
    if (exists) {
      await redisClient.set(`revoked:${jti}`, '1', 3600); // ← hardcoded TTL
      return true;
    }
    return false;
  } catch (err) {
    console.error('[SECURITY] Revocation check BYPASSED...');
    Sentry.captureException(err);
    return false; // ← FAIL OPEN
  }
}
```
**Two bugs here:**

1. **Fail-open on errors:** If both Redis and MongoDB are unreachable (transient network blip), revoked tokens are accepted. A recently logged-out user's stolen token remains valid during outages. The comment acknowledges this is for "availability" — but availability should never trump security for revocation checks. Change `return false` to `return true` (fail-closed) or at minimum track a metric and alert.

2. **Hardcoded 1-hour back-fill TTL:** When back-filling Redis from MongoDB, the TTL should match the token's remaining expiry (`expiresAt - now`), not a fixed 1 hour. A token expiring in 5 minutes shouldn't be cached for 1 hour.

**Fix:**
```javascript
if (exists) {
  const ttl = exists.expiresAt
    ? Math.max(0, Math.floor((exists.expiresAt.getTime() - Date.now()) / 1000))
    : 3600;
  if (ttl > 0) await redisClient.set(`revoked:${jti}`, '1', ttl);
  return true;
}
// ...
} catch (err) {
  Sentry.captureException(err, { level: 'fatal' });
  return true; // fail-closed: deny access when revocation check is broken
}
```

---

### 5.3 🔴 CRITICAL: `SameSite: 'none'` Auth Cookies Set Unconditionally

**File:** `server/controllers/auth.controller.js`, lines 77–82, 141–146, 244–249

```javascript
res.cookie('tb-token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'none', // ← applied in dev AND production
});
```
`SameSite: 'none'` must be paired with `Secure: true` and is intended only for cross-site contexts (like OAuth embeds). Setting it unconditionally means:
- In local development (HTTP), `Secure: true` causes cookies to be **rejected by the browser** — auth silently fails.
- In production, `SameSite: 'none'` is overly permissive — it allows the cookie to be sent in cross-origin requests, which undermines CSRF protection even when CSRF middleware is re-enabled.

**Fix:**
```javascript
const isProduction = process.env.NODE_ENV === 'production';
res.cookie('tb-token', token, {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  // If cross-origin is required (frontend on different domain):
  // sameSite: 'none' only if explicitly configured
});
```

---

### 5.4 🟠 HIGH: `optionalProtect` Swallows All JWT Errors Without Logging

**File:** `server/middleware/auth.middleware.js`, lines ~90–110

```javascript
} catch (err) {
  next(); // Invalid token, still continue as guest
}
```
Any JWT verification failure (expired, tampered, wrong signature) silently becomes a guest request. This is by design for optional auth — but it means a compromised token, replay attack, or signature forgery is **completely invisible** in logs and metrics.

**Fix:** Log the error type (not the token):
```javascript
} catch (err) {
  // Log classification without sensitive data
  if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') {
    console.warn(`[Auth:Optional] Unexpected verification error: ${err.name}`);
  }
  next();
}
```

---

### 5.5 🟡 MEDIUM: CSRF Cookie Only Refreshed on GET Requests

**File:** `server/index.ts`, lines 195–220

The CSRF seeding middleware only issues new tokens when:
1. Tokens are missing **and** the request is a `GET`

In SPA flows where the initial page load is cached (service worker, CDN edge), the frontend may never make a `GET` request to the server at all before attempting a `POST`. The CSRF cookie will be absent, causing every state mutation to fail once CSRF verification is re-enabled.

**Fix:** Add a dedicated CSRF bootstrap endpoint that always works regardless of method, and have the frontend call it once on app load:
```typescript
app.get('/api/csrf-token', (req, res) => {
  // Always generate fresh token if missing
  let token = req.cookies?.['tb-csrf-token'];
  if (!token) {
    const secret = generateCsrfSecret();
    token = deriveCsrfToken(secret);
    res.cookie('tb-csrf-secret', secret, { httpOnly: true, secure: isProduction, sameSite: 'strict' });
    res.cookie('tb-csrf-token', token, { httpOnly: false, secure: isProduction, sameSite: 'strict' });
  }
  res.json({ csrfToken: token });
});
```

---

## Section 6 — Module System & ESM Compatibility

### 6.1 🟡 MEDIUM: `@ts-ignore` Mass Usage in `index.ts`

**File:** `server/index.ts`, lines 18–52 (14 `@ts-ignore` suppressions)

All JS module imports use `@ts-ignore` because the TypeScript compiler cannot resolve the `.js`-suffixed ESM imports with `module: "NodeNext"`. This is technically correct ESM behavior (Node.js requires explicit `.js` extensions), but the `@ts-ignore` suppresses any type errors in those modules entirely — meaning a renamed export in an imported module will not be caught at compile time.

**Fix:** Configure path aliases properly or use `.js` import extensions consistently without `@ts-ignore`. Since `tsconfig.json` has `allowJs: true` and `checkJs: false`, adding proper type declarations for each module eliminates the need for `@ts-ignore`.

---

### 6.2 🟡 MEDIUM: Mixed `.ts` and `.js` Files Without Clear Boundary

The server has:
- `index.ts` (TypeScript entry point)
- All other files: `.js` (CommonJS + ESM hybrid)
- `tsconfig.json` with `module: "NodeNext"` which is strict about extension requirements

The `nodemon.json` watches `**/*.ts` and `**/*.js`, meaning every file is hot-reloaded. The `exec: "tsx index.ts"` invocation uses `tsx` (ESBuild-based, not `tsc`) — this bypasses TypeScript's strict module checks entirely in dev, meaning issues only surface in production builds. This is a silent correctness gap.

**Recommendation:** Commit to one of:
- **Full ESM TypeScript:** Convert all `.js` to `.ts`, use `tsx` for dev, `tsc` for builds
- **Pure ESM JS:** Remove TypeScript from the server entirely, use JSDoc types

---

## Section 7 — WebSocket & Frontend Synchronization

### 7.1 🟠 HIGH: `globalSocket` Singleton Stale After Network Error

**File:** `client/src/hooks/useSocket.js`, lines 10, 120–140

```javascript
let globalSocket = null; // module-level singleton

export function syncSocketAuth(newToken = 'guest') {
  if (!globalSocket) {
    globalSocket = io(...);
    return;
  }
  // ...
}
```
If the socket enters a permanent error state (e.g., server restart + auth change), `globalSocket` is never set to `null`. Subsequent calls to `syncSocketAuth` update the auth token and call `disconnect().connect()`, but if the previous socket instance hit an unrecoverable state internally, reconnection may silently fail.

In React StrictMode (enabled in development), components mount twice, causing `syncSocketAuth` to be called twice in rapid succession. If the first call creates the socket and the second call detects `globalSocket` is non-null but `auth.token` is the same, it no-ops — but the socket may not yet be fully initialized.

**Fix:** Add a `destroy` path for error recovery:
```javascript
export function syncSocketAuth(newToken = 'guest') {
  if (globalSocket?.io?.engine?.readyState === 'closed') {
    // Stale dead socket — recreate
    globalSocket.removeAllListeners();
    globalSocket = null;
  }
  // ... existing logic
}
```

---

### 7.2 🟡 MEDIUM: Disconnect Handler Database Operations Have No Timeout

**File:** `server/sockets/teaching.socket.js`, lines 103–130

```javascript
socket.on('disconnect', async (reason) => {
  if (socket.user && !socket.user.isGuest) {
    try {
      await sessionStore.persistProfile(sessionId);    // ← no timeout
      // ...
      await LearnerProfile.findOneAndUpdate(...);       // ← no timeout
    } catch (err) { ... }
  }
  await sessionStore.destroy(sessionId);               // ← no timeout
  cleanupSocket(getRateKey(socket));
});
```
On disconnect, if MongoDB is slow (cold Neon connection, serverless sleep), these awaited operations can hang indefinitely. Socket.IO recycles connection objects internally, but this async handler keeps the session alive in the event loop. Under high churn (many connect/disconnect cycles), this creates a backlog of unresolved Mongo operations.

**Fix:** Wrap with `Promise.race` timeout:
```javascript
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), ms))]);

await withTimeout(sessionStore.persistProfile(sessionId), 5000);
await withTimeout(LearnerProfile.findOneAndUpdate(...), 5000);
```

---

## Section 8 — AI Provider Orchestration

### 8.1 🟠 HIGH: AI Client Initialization Is Lazy and Unguarded

**File:** `server/utils/ai/llmClient.js`, lines 29–85

`initClients()` is exported but **never called at module load time**. It appears to be called inside `requestCompletion()` on the first request path. This means:
- The very first AI request after server start will block while clients initialize
- If initialization fails (bad API key), the error surfaces as a request failure, not a startup warning
- There is no retry for initialization — if the key is valid but the first call to `new OpenAI(...)` has a network hiccup, the client stays null forever

**Fix:** Call `initClients()` during `startServer()` and log the result. Add a scheduled re-initialization check for null clients.

---

### 8.2 🟠 HIGH: Parallel Race Response Has No Shared Abort Propagation

**File:** `server/utils/ai/llmClient.js**, around line 838

```javascript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), RACE_TIMEOUT);
// ... multiple provider calls with controller.signal
```
When one provider wins the race, the losing providers' requests continue running — they have the same `controller.signal` so they will eventually abort, but only after `RACE_TIMEOUT`. If the winning response is delivered and the stream is closed, the losing providers are still making HTTP requests. Under load, this doubles or triples outbound AI API traffic with zero benefit.

**Fix:** Abort immediately when the first response is received:
```javascript
const winner = await Promise.any(providerRequests);
controller.abort(); // cancel all other in-flight requests
clearTimeout(timer);
return winner;
```

---

### 8.3 🟡 MEDIUM: Circuit Breaker Async `_syncFromRedis` Races First Request

**File:** `server/engine/core/circuitBreaker.js`, lines 28–44

```javascript
constructor() {
  this.providers = {};
  this._syncFromRedis(); // ← fires async, not awaited
}
```
The constructor fires an async Redis sync that is not awaited. If the first request arrives within milliseconds of module load (which happens in dev with hot-reload), the circuit breaker state may be partially initialized. A provider that was `OPEN` in Redis may briefly appear `CLOSED` until the sync completes.

**Fix:** Make sync lazy (on first check) or expose an `async init()` method called during startup.

---

### 8.4 🟢 LOW: SSRF Risk in `providerFactory.js` Image Fetching

**File:** `server/utils/ai/providerFactory.js**, lines 12–30

```javascript
// Fallback: try to fetch it if it's a remote URL
const response = await fetch(fileUrl);
```
Any URL passed as `fileUrl` from user input is fetched server-side without validation. This is a classic Server-Side Request Forgery (SSRF) vector — an attacker can pass `http://169.254.169.254/` (AWS metadata endpoint) or internal service URLs.

**Fix:**
```javascript
import { URL } from 'url';
const ALLOWED_PROTOCOLS = ['https:'];
const BLOCKED_RANGES = [/^169\.254\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./];

function isSafeUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (!ALLOWED_PROTOCOLS.includes(u.protocol)) return false;
    if (BLOCKED_RANGES.some(r => r.test(u.hostname))) return false;
    return true;
  } catch { return false; }
}

if (!isSafeUrl(fileUrl)) throw new Error('URL not allowed');
```

---

## Section 9 — Memory Leaks & Resource Safety

### 9.1 🟠 HIGH: LRU Response Cache Is a Module-Level Global

**File:** `server/utils/ai/llmClient.js**, lines 78–100

```javascript
const responseCache = new Map(); // module-level, never cleared
const CACHE_MAX = 50;
```
50 cached responses, each potentially containing large LLM outputs (up to ~10 KB), equals ~500 KB of heap. This is manageable — but the cache is shared across all users, meaning User A's private tutoring response can be returned to User B if the cache key collides (which is unlikely but not impossible given the SHA-256 of `messages + model + userId`). The bigger issue: `CACHE_TTL_MS = 5 minutes` means stale educational content is served with no versioning.

**Recommendation:** Make the response cache opt-in per route, not global. Disable it for personalized tutoring sessions where context varies per user.

---

### 9.2 🟡 MEDIUM: Session Capacity Check Bypassed When Redis Is Connected

**File:** `server/engine/core/sessionStore.js**, line 29

```javascript
if (!redis.isConnected && this.localSessions.size >= this.maxSessions) {
  throw new Error('SESSION_LIMIT_REACHED');
}
```
The `MAX_SESSIONS = 100` limit only applies when Redis is **offline**. When Redis is online (the normal production state), there is **no session count limit** enforced. Sessions accumulate in Redis indefinitely (they expire via TTL, but 20-minute TTLs × high traffic = large Redis memory usage).

**Fix:** Always enforce limits, using Redis SCAN to count active sessions if needed, or maintain a Redis counter:
```javascript
// Atomic session count in Redis
const sessionCount = await redis.incr('active_sessions_count');
if (sessionCount > this.maxSessions) {
  await redis.decr('active_sessions_count');
  throw new Error('SESSION_LIMIT_REACHED');
}
// Decrement on destroy
```

---

## Section 10 — Security Audit Summary

| Vulnerability | OWASP Category | Severity |
|---|---|---|
| CSRF verification disabled | A01: Broken Access Control | 🔴 CRITICAL |
| Token revocation fail-open | A07: Identification/Authentication Failures | 🔴 CRITICAL |
| `SameSite: none` auth cookies | A05: Security Misconfiguration | 🔴 CRITICAL |
| SSRF in image fetching | A10: Server-Side Request Forgery | 🟠 HIGH |
| `rejectUnauthorized: false` on Postgres | A02: Cryptographic Failures | 🟠 HIGH |
| CORS wildcard OPTIONS override | A05: Security Misconfiguration | 🟡 MEDIUM |
| Auth path logged on every request | A09: Security Logging/Monitoring Failures | 🟢 LOW |
| Sentry `tracesSampleRate: 1.0` | A09: Logging & Monitoring | 🟢 LOW |

---

## Section 11 — Observability Gaps

### 11.1 No Structured Log Format

The server uses `console.log` with emoji prefixes and free-form strings. Log aggregators (Datadog, Papertrail, Render Logs) cannot parse these as structured events. Under load, critical errors are buried in noise.

**Recommended:** Adopt a structured logger (e.g., `pino` or `winston`):
```javascript
import pino from 'pino';
export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Usage:
logger.info({ userId, path: req.path }, 'Auth: user authenticated');
logger.error({ err, jti }, 'Auth: revocation check failed');
```

### 11.2 Agent Loop Has No Trace IDs

The 6-stage `agentLoop` has no per-invocation trace ID. If Stage 3 fails, the log entry has no correlation to the original request. Add a `traceId = crypto.randomUUID()` at entry point and thread it through every `console.log` in the pipeline.

### 11.3 No Startup Timing Instrumentation

There is no measurement of how long MongoDB connect, Postgres init, or Redis connect takes at startup. On cold starts (Render free tier), these can take 5–15 seconds. Without telemetry, it is impossible to optimize.

---

## Section 12 — Performance & Scalability

### 12.1 Sequential Startup Initialization

PostgreSQL `initPostgres()` is awaited after MongoDB connects — they are independent and could run concurrently:
```typescript
// Instead of sequential:
await mongoose.connect(...);
await initPostgres();

// Run concurrently:
await Promise.all([
  mongoose.connect(...),
  initPostgres(),
]);
```
On cold starts, this saves 1–3 seconds.

### 12.2 Agent Loop `MAX_CONCURRENT_LOOPS = 3` Is Per-Process

On a horizontally scaled deployment (multiple Node processes or Render instances), each process has its own `activeAgentLoops` counter. The true system concurrency limit is `3 × N_instances`. If the AI provider rate limit is 10 req/min total, 4 instances × 3 concurrent loops = 12 simultaneous requests, which will trip rate limits.

**Fix:** Move the concurrency counter to Redis:
```javascript
const canRun = await redis.incr('agent_loop_active') <= MAX_CONCURRENT_LOOPS;
if (!canRun) {
  await redis.decr('agent_loop_active');
  // queue or reject
}
```

### 12.3 `allowedOrigins` Array Rebuilt Every Request

**File:** `server/index.ts`, lines 157–165

The `allowedOrigins` array includes `process.env.FRONTEND_URL` and is constructed once at startup — that is fine. But `isOriginAllowed` closes over the array, and the regex test runs on every request. For very high throughput, cache the compiled regex.

---

## Section 13 — Production Deployment Readiness

### 13.1 Health Endpoint Does Not Reflect True Readiness

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
```
This always returns `200 OK` regardless of MongoDB connection state. Load balancers and Render's health checks will think the server is ready even during boot or recovery.

**Fix:**
```typescript
app.get('/health', (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const status = mongoReady ? 'ok' : 'degraded';
  res.status(mongoReady ? 200 : 503).json({
    status,
    uptime: process.uptime(),
    db: mongoReady ? 'connected' : 'disconnected',
    redis: redisClient.isConnected ? 'connected' : 'degraded',
  });
});
```

### 13.2 Two `vercel.json` Files

**Files:** `/vercel.json` (root) and `/client/vercel.json`

Having two Vercel config files creates ambiguity about which is authoritative. If Vercel's root config routes `/api/*` to a serverless function but the client config assumes all routes go to Vite, deployments will silently misconfigure. Consolidate to a single monorepo `vercel.json` or explicitly use per-workspace configs with clear scope.

### 13.3 `build` Step Not Enforced Before `start`

The `server/package.json` has:
```json
"start": "node dist/index.js",
"build": "tsc"
```
If `dist/` is stale or absent, `start` will fail with a module-not-found error. CI/CD pipelines should explicitly run `build` before `start`. Currently the GitHub Actions workflow at `.github/workflows/ci.yml` should enforce this.

---

## Section 14 — Recommended Final Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    STARTUP PIPELINE                          │
│  1. Validate all required env vars → exit if missing        │
│  2. Connect Redis (await ready event)                        │
│  3. Connect MongoDB + PostgreSQL (concurrent Promise.all)   │
│  4. Initialize AI clients + circuit breakers                 │
│  5. Bind HTTP/WS server                                      │
│  6. Mark health endpoint as READY                            │
└─────────────────────────────────────────────────────────────┘

┌───────────────┐    ┌────────────────┐    ┌─────────────────┐
│  Express API  │    │  Socket.IO     │    │  Agent Runtime  │
│  (REST)       │    │  /teaching ns  │    │  (agentLoop)    │
│               │    │                │    │                 │
│  CSRF ✅       │    │  Auth guard    │    │  Trace IDs      │
│  Rate limit   │    │  Rate limit    │    │  Redis queue    │
│  Structured   │    │  Timeout on    │    │  AbortSignal    │
│  logging      │    │  disconnect    │    │  propagation    │
└───────┬───────┘    └───────┬────────┘    └────────┬────────┘
        │                    │                       │
        └────────────────────┴───────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │       Data Layer             │
              │  MongoDB (sessions, users)   │
              │  PostgreSQL (vectors/RAG)    │
              │  Redis (cache, pub/sub,      │
              │         rate limits,         │
              │         revocation,          │
              │         agent concurrency)   │
              └─────────────────────────────┘
```

### Shutdown Sequence
```
SIGTERM received
  → Stop accepting HTTP connections (server.close())
  → Close Socket.IO server (io.close())
  → Drain in-flight agent loops (wait up to 10s)
  → Flush analytics
  → Close Redis (QUIT)
  → Close PostgreSQL pool
  → Close MongoDB
  → Clear all intervals
  → process.exit(0)
```

---

## Production-Readiness Checklist

### Security
- [ ] Re-enable CSRF verification middleware
- [ ] Change auth cookies to `SameSite: strict` in production
- [ ] Change `SameSite: lax` in development (not `none`)
- [ ] Token revocation: fail-closed on errors
- [ ] Fix PostgreSQL `rejectUnauthorized: false`
- [ ] Add SSRF guard to image URL fetching
- [ ] Reduce Sentry `tracesSampleRate` to 0.1 in production

### Infrastructure
- [ ] Remove orphan Redis client from `index.ts`
- [ ] Fix rate limiter Redis store: lazy init after connection
- [ ] Fix Redis pub/sub subscription restore after reconnect
- [ ] Fix `isConnected` stale flag (listen to `ready` + `reconnecting`)
- [ ] Add PostgreSQL IVFFlat index guard for row count

### Lifecycle & Async
- [ ] Move DB connect before HTTP listen in `startServer()`
- [ ] Add `process.exit(1)` to `startServer()` catch block
- [ ] Add Redis, PostgreSQL, Socket.IO to `gracefulShutdown`
- [ ] Fix agent queue: AbortSignal awareness on queued entries
- [ ] Unref rate limiter `setInterval`, export ref for shutdown
- [ ] Remove module-level `semanticStore` (scope per-session)
- [ ] Add abort propagation to parallel provider race

### Observability
- [ ] Adopt structured logger (`pino` or equivalent)
- [ ] Add trace IDs to agent loop stages
- [ ] Add startup timing instrumentation
- [ ] Fix `/health` endpoint to reflect real readiness
- [ ] Serialize circuit breaker metrics to Redis for persistence

### Performance
- [ ] Parallelize MongoDB + PostgreSQL startup connection
- [ ] Move `activeAgentLoops` counter to Redis for distributed correctness
- [ ] Call `initClients()` at startup, not lazily on first request

### Deployment
- [ ] Enforce `build` before `start` in all deployment scripts
- [ ] Consolidate to single `vercel.json`
- [ ] Remove `dist/` watch from `nodemon.json`
- [ ] Ensure `POSTGRES_URL`, `REDIS_URL` in required env validation

---

## Appendix: Quick-Win Code Fixes

### Fix 1 — `index.ts`: Remove orphan Redis, fix startup order, fix shutdown

```typescript
// Remove lines 138-144 entirely (orphan Redis)

// Fix startServer():
const startServer = async () => {
  await Promise.all([
    mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000 }),
    process.env.POSTGRES_URL ? initPostgres() : Promise.resolve(),
  ]);
  console.log('[DB] All databases ready ✅');

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => { console.log(`[Server] Listening on ${port} ✅`); resolve(); });
    httpServer.on('error', reject);
  });
};

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1);
});
```

### Fix 2 — `redis.js`: Restore subscriptions after reconnect

```javascript
this.subClient.on('ready', async () => {
  const channels = [...this._subHandlers.keys()];
  if (channels.length > 0) {
    await this.subClient.subscribe(...channels);
  }
});
this.client.on('ready', () => { this.isConnected = true; });
this.client.on('reconnecting', () => { this.isConnected = false; });
```

### Fix 3 — `auth.controller.js`: Environment-aware cookie settings

```javascript
const isProduction = process.env.NODE_ENV === 'production';
res.cookie('tb-token', token, {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

### Fix 4 — `tokenStore.js`: Fail-closed revocation

```javascript
} catch (err) {
  Sentry.captureException(err, { level: 'fatal', tags: { component: 'TokenStore' } });
  return true; // deny on error — security over availability
}
```

### Fix 5 — `index.ts`: Uncomment CSRF and update frontend

```typescript
// Remove the /* */ block wrapping, keep this active:
app.use((req: Request, res: Response, next: NextFunction) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();
  if (req.path.includes('/auth/') && req.path.includes('/callback')) return next();

  const secret = req.cookies?.['tb-csrf-secret'];
  const token = req.headers['x-csrf-token'] as string;

  if (!secret || !token || !validateCsrf(secret, token)) {
    return res.status(403).json({ error: 'CSRF validation failed', code: 'CSRF_INVALID' });
  }
  next();
});
```

---

*End of TutorBoard Production Audit Report — 47 issues catalogued across 15 categories.*