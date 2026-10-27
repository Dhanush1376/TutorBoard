# Identity, Auth, AI Infra & Admin — Baseline Audit (2026-10-26)

Scope: Phase 0 of the identity/admin master plan. Everything below was read from the
code on `main` (with the uncommitted working tree as found), not inferred.

## 1. Architecture as found

```
React (Vite, client/) ──axios (withCredentials, x-csrf-token)──▶ Express (server/index.ts)
  AuthProvider.jsx                                               helmet → CORS allowlist → JSON → cookies
  AuthLanding.jsx (login/signup/OAuth buttons)                   → requestId → httpRateLimiter → global CSRF
                                                                 → passport.initialize → routes
Auth:   routes/auth.ts → controllers/auth.controller.ts
        JWT access (15m, cookie tb-access-token + returned in JSON) and refresh (30d, cookie)
        Revocation: RevokedToken {jti, TTL}; OAuth handoff: OauthCode (60s, Mongo)
OAuth:  utils/auth/passport.js (passport-google-oauth20, passport-github2), session:false
Guest:  utils/auth/guestToken.js — signed JWT guest id (gst_*), 400-day cookie, no expiry on use
Mail:   utils/core/mailer.js — Resend HTTP API (not SMTP). RESEND_API_KEY + MAIL_FROM.
AI:     utils/ai/llmClient.ts — env-keyed system chain google → openrouter → groq (hardcoded),
        per-user BYO keys (User.apiKeys, AES-256-GCM via ENCRYPTION_KEY), circuit breaker,
        stream-safety via __noFallback (no provider switch after tokens were streamed).
Admin:  none. No role field, no admin routes, no runtime config store.
DB:     MongoDB (Atlas in .env; in-memory mongod for tests — standalone, so no multi-doc txns).
```

## 2. Baseline test/build results (before any change)

| Suite | Result |
|---|---|
| server `vitest run` (excl. `*.live.test.ts`) | 28 files, **269/269 passed** |
| client `vitest run` | 29 files, 210 tests — run 1: 2 timeouts (`traceModel` CPython tracer, one canvas test) while the server suite ran in parallel; run 2: **all passed**. Treat as load-flaky, pre-existing. |
| server `tsc --noEmit` | clean |

## 3. Bugs and vulnerabilities found (severity-ordered)

| # | Sev | Finding | Where |
|---|---|---|---|
| 1 | Critical | **GitHub account takeover**: when GitHub returns no email the code invents `<username>@github.com` and links to any TutorBoard account with that email. Primary email is used without checking `verified`. | passport.js |
| 2 | Critical | **Google pre-hijack / takeover**: links to any existing account by email without checking `email_verified` or whether the existing account ever proved ownership (attacker pre-registers victim's email with a password, victim later signs in with Google and lands in the attacker-controlled account). | passport.js |
| 3 | High | **Logout does not end the session**: only the 15-min access-token jti is revoked; the 30-day refresh token keeps minting new access tokens. No "log out everywhere". | auth.controller.ts `logout` |
| 4 | High | **Password reset/change does not revoke sessions**: `/refresh` never checks `passwordChangedAt`, user existence, or account state, so a stolen refresh token survives a password reset. | `refresh` |
| 5 | High | **NoSQL operator injection**: `forgot-password`/`reset-password` have no validation; `{"email":{"$ne":null}}` reaches `User.findOne`. `reset-password` with a non-string token → 500. | auth routes |
| 6 | High | **No OAuth `state`** (login CSRF — attacker can sign a victim into the attacker's account). No PKCE. | routes/auth.ts |
| 7 | High | **Email enumeration** on forgot-password ("Reset email sent" vs generic message). | `forgotPassword` |
| 8 | High | **Forgot password in the UI is fake**: shows a "Demo mode" success message; no request is made. | AuthLanding.jsx:437 |
| 9 | Med | Reset is a 1-hour link token with no attempt limit/resend cooldown, not an OTP; reset email names no expiry consistent with policy; no email verification exists at all. | auth/mailer |
| 10 | Med | Signup race: concurrent signups hit the unique index and return a generic 500 instead of a clean conflict. Emails not normalized consistently (signin/forgot do not lowercase/trim explicitly). | `signup`/`signin` |
| 11 | Med | Guest → account: no migration. A guest who signs up loses access to their conversations. | none |
| 12 | Med | Hard-coded origins/URLs: OAuth redirect allowlist and CORS list are literals; `ALLOWED_ORIGINS` is documented in `.env.example` and set in `.env` but **never read**. Fallback callback URLs use port 5000. | index.ts, auth.controller.ts, passport.js |
| 13 | Med | `GET /api/auth/force-reset` is unauthenticated and CSRF-exempt (GET) — any page can log a user out. | routes/auth.ts |
| 14 | Low | `signin` timing-equaliser uses a malformed bcrypt hash, so the "no user" path is faster (enumeration by timing). | `signin` |
| 15 | Low | User-supplied/OAuth display names interpolated raw into email HTML. | mailer.js |
| 16 | Info | No RBAC, no admin APIs, no runtime platform settings, no audit log, no provider config outside `.env`. | — |

## 4. Data-integrity notes

- `User.email` has a unique index (lowercase+trim setters); `googleId`/`githubId` unique sparse. Good basis — identities stay on `User` (no new AuthIdentity collection).
- Legacy accounts have no `emailVerified` flag. Treat as unverified; OAuth-created accounts with a provider-verified email are backfilled lazily on next sign-in.
- Guest ownership lives in `guestId` on ChatSession, ChatMessage, Artifact.
- Test DB is a standalone mongod: designs must not depend on multi-document transactions. Use unique indexes + single-document atomic updates + idempotent re-runs.

## 5. Features that must be preserved

Email/password signup+signin, Google/GitHub sign-in, cookie+CSRF model, Bearer fallback, guest chat with 400-day guest id, refresh flow in `client/src/services/api.js`, per-user BYO API keys, system AI chain with circuit breaker and stream-safe fallback, settings/export/delete-account endpoints.

## 6. Plan (dependency order) and acceptance

1. **Sessions** — `AuthSession` model (sid per login). Refresh tokens carry `sid`, rotate on use, reuse of an old refresh token revokes the session. Logout revokes the session; logout-all; list/revoke sessions; password change/reset revoke all. Accept: refresh after logout/reset → 401.
2. **Identity** — `normalizeEmail`; validated inputs on every auth route; OAuth `state` via cookie-bound store; Google links only on `email_verified` + existing account verified; GitHub uses verified primary email from `/user/emails`; no invented emails; signed-in users can link/unlink providers (never the last method). Accept: unverified-email OAuth never attaches to an existing account; concurrent signup → exactly one user.
3. **Email verification + OTP reset** — `AuthChallenge` (hashed 6-digit code, purpose-bound, 10-min expiry, 5 attempts, 60s resend cooldown, atomic consume). Reset = request → verify (returns short-lived single-use reset grant) → reset with grant. Generic responses. Accept: reset API without a verified grant fails; reused/expired/over-attempt codes fail.
4. **Guest migration** — on signin/signup/OAuth exchange, claim the caller's guest conversations/messages/artifacts (idempotent `updateMany` on `guestId`+`userId:null`).
5. **Admin** — `role` on User (only settable by CLI script), `requireAdmin`, `AuditEvent`, versioned `PlatformConfig` with rollback and bounded cache refresh across instances, admin user management, admin AI providers (encrypted keys, SSRF-guarded base URLs, test endpoint, priority) feeding the system chain.
6. **Client** — real forgot-password (3 steps), verify-email, account security panel (providers, sessions), admin portal.
7. **Verification** — new server integration tests for each of the above + full suites + build + browser check against an isolated in-memory DB.
