# Identity, Auth, AI Infra & Admin — Implementation Report (2026-10-26)

Companion to [AUDIT.md](AUDIT.md) (baseline findings and plan). Nothing was committed, pushed or deployed. No production data was touched: every live check ran against an in-memory MongoDB.

## 1. Executive summary

The two critical account-takeover paths in OAuth are closed: the invented `<username>@github.com` email and email-only Google linking. Sessions are now real and revocable. Logout, "sign out everywhere", password reset and admin actions end refresh tokens, not only the 15-minute access token. Password recovery is a server-enforced 3-step OTP flow, replacing the fake "Demo mode" message. Email verification exists. Guest work moves into the account at sign-up. There is now a backend-enforced admin control center with versioned runtime settings, user management, an audit log, and admin-configured AI providers. Those providers are encrypted at rest, guarded against SSRF, must pass a real test before they can be enabled, and feed the existing failover chain.

## 2. Architecture (final)

```
Browser ──cookies (HttpOnly access/refresh, CSRF pair)──▶ Express
  /api/auth/*   auth.controller ─▶ session.service ─▶ AuthSession (sid per sign-in, rotating refresh jti)
                                ─▶ challenge.service ─▶ AuthChallenge (HMAC'd 6-digit codes, attempts, grant)
                                ─▶ guestMigration.service (ChatMessage/Artifact/ChatSession guestId → userId)
                passport.js (Google/GitHub, PKCE + browser-bound state ─▶ OAuthState)
                OauthCode handoff (userId only, bound to the browser by a handoff cookie)
  protect / optionalProtect ─▶ JWT verify ─▶ AuthSession live? ─▶ disabled? ─▶ platform policy
  /api/admin/*  protect + requireAdmin (role read from DB) + admin rate limit ─▶ admin.controller
  platformConfig.service ── PlatformConfig (append-only versions; 15 s bounded refresh per instance)
  llmClient system chain = [enabled AiProvider rows by priority] + [env-keyed google/openrouter/groq]
  audit.service ─▶ AuditEvent (no secrets; 1-year TTL)
```

Identities stay on `User` (`googleId`, `githubId`, `password`, plus the new `emailVerifiedAt`, `role`, `disabledAt`, `lastLoginAt`). No second user collection or auth system was added.

## 3. What changed, by area

### Identity and duplicate prevention
- `normalizeEmail` (NFKC + trim + lowercase) on every auth path. The unique index on `email` decides concurrent sign-ups: exactly one wins, the rest get `409 EMAIL_IN_USE`.
- Linking policy (`resolveOAuthUser`):
  - A provider identity is matched by its subject id first.
  - It links to an existing account by email only when the provider asserts the email is verified **and** that account has already proven the email.
  - Otherwise: `account_exists_unverified` (the user signs in with their existing method and links from Settings, or resets their password, which proves the mailbox).
  - Without a verified provider email, no account is created or linked.
  - GitHub uses `/user/emails` with GitHub's own `primary`/`verified` flags.
  - Concurrent or retried callbacks resolve to one row.
- Linking while signed in uses a 5-minute HttpOnly link ticket set by `POST /api/auth/link/:provider` (requires a recent sign-in).
- Unlinking refuses to remove the last sign-in method. The check is a conditional update, so a race cannot leave an account with zero methods.
- OAuth `state` is stored server-side, single-use, and bound to the browser by a nonce cookie. PKCE (S256) is enabled for both providers.
- The `?code=` handoff carries no token and is bound to the browser by a handoff cookie.

### Sessions
- One `AuthSession` per sign-in. Access and refresh JWTs carry `sid`.
- Refresh rotates the jti with an atomic compare-and-set. A 20-second grace window covers two tabs refreshing at once. Replaying an older refresh token after that window revokes the session (`REFRESH_REUSE`).
- `protect`, `optionalProtect` and socket auth all reject ended sessions and disabled accounts.
- New endpoints: `logout` (works with an expired access token), `logout-all`, `GET /sessions`, `DELETE /sessions/:sid`.
- Password change and reset revoke all sessions; a change then starts a fresh one for the current browser.
- Legacy refresh tokens issued before this change still work once and are converted into a session.

### Email verification and password recovery
- A 6-digit CSPRNG code is stored only as an HMAC. It expires after 10 minutes and is locked after 5 wrong attempts.
- Each attempt is reserved atomically before comparing, so parallel guesses cannot exceed the limit. Success is a compare-and-set, so a code is accepted once.
- Resends have a 60-second cooldown and a cap of 5 per hour. A resend replaces the old code only after the mail provider accepted the new email.
- Reset flow is `forgot` → `verify` → `reset`:
  - `forgot` returns the same response whether or not the account exists.
  - `verify` returns a 15-minute single-use reset token.
  - `reset` consumes that token atomically. Without it, the reset API cannot change a password.
  - After a reset: all sessions are revoked, a security email is sent, and the user is not auto-signed-in.
- Mail is sent over SMTP with nodemailer (Resend was removed at the owner's request; target provider: Brevo). It uses STARTTLS on 587, refuses to send the password without TLS, has 10-second timeouts and one retry on network errors or SMTP 4xx, HTML-escapes names, and never logs message bodies. `MAIL_DEV_OUTBOX` is a development-only file outbox. Admin → Diagnostics shows the SMTP host and port and can send a test email to the admin. Tested against a real local SMTP server (STARTTLS + AUTH): delivery, wrong key (`EAUTH`, no retry), not configured, and a self-signed certificate refused in production.
- `requireEmailVerification` (platform setting, off by default) limits an unverified account to auth, settings, export and delete endpoints.

### Guest to account
On sign-up, sign-in or OAuth exchange, the guest's conversations, messages and artifacts move to the account. Ownership comes only from the signed guest token. The migration is idempotent `updateMany` calls: a retry moves nothing twice, and a crash midway is finished by the next sign-in. The guest cookie and the stored token are cleared only after success.

### Admin control center (`/admin`, `/api/admin/*`)
- **Roles:** `user` / `admin` / `superadmin`.
  - The first admin is created only by `node server/scripts/grant-admin.mjs <email> [admin|superadmin]`; no API or request body can set a role.
  - Only a super-admin changes roles. Admins cannot act on other admins or on themselves.
  - Any role change ends the target's sessions.
- **Modules:**
  - Overview: exact counts, each labelled with what it measures.
  - Users: search, pagination, details, disable/enable, sign out everywhere, roles.
  - AI providers: add, test, enable, priority, edit, roll back, delete.
  - Platform settings: switches, version history, restore.
  - Activity: the audit log.
  - Diagnostics: database ping, mail and OAuth configured, failures in the last 24 h, provider health.
- **Runtime settings:**
  - Every key has a zod schema (strict: unknown keys are rejected) and a safe default.
  - Every save is a new version with optimistic concurrency (`409` on a stale save) and an audit entry.
  - Rollback works by copying an older version forward.
  - Instances re-read settings within `PLATFORM_CONFIG_REFRESH_MS` (default 15 s); no `.env` edit or restart is needed.
  - If the newest stored version fails validation, the last valid one is used.
- **Enforced settings:** maintenance mode (503 everywhere except auth and admin), registration on/off, email-verification requirement, password/Google/GitHub sign-in on/off, guest access, admin providers on/off, env providers as fallback.

### AI providers
- Adapters: `openai`, `google`, `groq`, `openrouter`, `deepseek`, `mistral`, `together` (pinned base URLs) and `openai-compatible` (custom URL). Only the OpenAI chat-completions protocol is supported; anything else needs its own adapter. This is stated in the UI.
- Keys are encrypted with AES-256-GCM using `ENCRYPTION_KEY` from the environment, masked in every response, and never returned.
- SSRF guard: https only; public addresses only (private, loopback, link-local and metadata ranges are rejected after DNS resolution); no credentials in the URL. It runs on save and before each test.
- A test makes real calls: model list, a minimal completion, and a stream. Enabling requires a passing test of the current configuration (base URL, model and key). Editing an enabled provider disables it until it is re-tested. The last passing configuration can be restored.
- Failover:
  - Enabled providers run in priority order before the env providers.
  - Providers whose model lacks a capability the request needs (vision) are skipped.
  - The existing circuit breaker and bounded retry still apply.
  - The existing stream-safety rule (no switching providers after tokens were streamed) now also covers admin providers.
  - Live-traffic health is recorded on the provider row, throttled.

### Client
- **Sign-in page**
  - Real 3-step forgot-password dialog: focus trap, Escape to close, live region, resend countdown, password rules shown, phone bottom sheet.
  - OAuth error messages from `?error=`.
  - Provider buttons hidden when the server disables them.
  - Password rules aligned with the server. Before this, the client demanded a symbol and the server an uppercase letter, so valid-looking passwords were rejected.
- **Settings → Account**
  - Real verification status, where it previously always said "Verified". The code input is always shown, so the code from the sign-up email can be used directly.
  - Add or change password.
  - Connect and disconnect Google/GitHub.
  - Devices list with per-device sign-out, plus "Sign out everywhere".
  - Admin console link for admins.
- **Routing and API client**
  - `/settings` is now the landing route for OAuth link results.
  - The OAuth exchange handler had relied on a `success` flag that no longer exists; it now checks for a returned token.
  - Maintenance, unverified-email and disabled-account responses show as one throttled toast, not one per failing request.

## 4. Tests and builds (exact)

| Check | Before | After |
|---|---|---|
| server `vitest run` (excl. live) | 28 files, 269/269 | **30 files, 309/309** |
| new `tests/identity.test.ts` | — | **34/34** (part of the 303) |
| client `vitest run` | 210/210 (2 load-flaky timeouts on the first run) | **210/210** |
| server `tsc --noEmit` | clean | **clean** |
| server `tsc` build | — | **exit 0** |
| client `vite build` | — | **built** (existing >500 kB chunk warning) |
| eslint (server changed files / client `src`) | — | **0 errors** (warnings only, matching existing code) |

`tests/refresh.test.ts` was updated on purpose. Refresh now rejects deleted accounts, and its error messages became error codes.

The new suite covers:
- Normalisation and case conflicts; concurrent sign-up (6 parallel requests → 1 account); operator injection; role escalation through request bodies.
- Refresh rotation and reuse detection; logout ending refresh and access; logout-all.
- The full OTP reset flow: no reset without verification, single-use code and reset token, weak password rejected, old password dead.
- Attempt lock under 8 parallel guesses (exactly 5 counted); one success out of 4 concurrent correct submissions; expiry; resend cooldown.
- Email verification, and the verification policy.
- The OAuth linking policy (unverified email, pre-hijack, verified link, concurrent callbacks, link-mode conflict); last-method unlink refused; browser-bound handoff.
- Guest migration (idempotent; foreign guests untouched; raw guest ids refused).
- Admin denial: anonymous, regular user, and a forged role claim in the JWT.
- User disable and session end; the super-admin-only role rule.
- Settings validation, conflicts, cross-instance read, maintenance and rollback; the registration switch.
- Provider SSRF (metadata IP, loopback, RFC 1918, wrong scheme) and key redaction; enabling refused without a test.
- Real HTTP against a local OpenAI-compatible mock:
  - The provider test endpoint makes model-list, completion and stream calls, and does not echo the upstream body.
  - Failover from a provider returning 500 to the next one gives a single answer with bounded calls.
  - A stream that dies mid-answer is not restarted on another provider: no duplicate text, and the secondary provider is never called.

## 5. Live verification (browser, isolated in-memory DB, real email blanked)

These checks used the `identity-verify-backend` (port 5069) and `identity-verify-app` (port 5194) launch configs, with real email disabled and mail written to a local outbox:

- **Sign-up** → verification code in the outbox → Settings → Account showed "Verify email" → entered the code → "Verified". Devices showed "Chrome on Windows · This device".
- **Journey D:** "Forgot password?"
  - Step 1 → code.
  - Wrong code → "That code is invalid or has expired."
  - Correct code → step 3 (Save disabled until the rules pass) → "Password updated".
  - The old password returns 401. The new password signs in, and the email shows as verified.
- **Admin:**
  - `grant-admin.mjs` promoted the account and ended its session (`/me` → 401 `SESSION_ENDED`). After signing in again, `/admin` loaded with accurate counts.
  - The maintenance switch made `/api/sessions` return 503 `MAINTENANCE` within seconds; switching it off returned 200.
  - At 375 px width there is no horizontal page overflow.
- **Console:** only the HTTP statuses from these deliberate negative checks; no JavaScript exceptions.

## 6. Acceptance gates

| Criterion | Status |
|---|---|
| Canonical identity | **Verified** (tests) |
| Concurrent signup | **Verified** (tests) |
| Google OAuth | **Implemented, not externally verified.** Linking policy, state/PKCE store and handoff are tested; a real Google round-trip needs real credentials and a browser sign-in, which I must not perform. |
| GitHub OAuth | **Implemented, not externally verified** (same reason) |
| Password recovery | **Verified** (tests + live UI against the dev outbox). Delivery through Brevo SMTP: **not externally verified** (needs your SMTP key). |
| Session management | **Verified** |
| Guest access and conversion | **Verified** by integration tests; not exercised in the live browser run |
| Data continuity across refresh and devices | **Partially implemented / verified:** session restore, multi-device sessions and guest moves are tested. The pre-existing conversation persistence was not re-audited beyond its existing suites, which pass. |
| AI configuration without `.env` edits | **Verified** (tests with a real HTTP mock provider) |
| Dynamic models | **Verified** |
| AI failover without duplicates | **Verified** (tests) |
| Admin security | **Verified** |
| Runtime settings across instances | **Verified:** a cold cache reads the DB version (test), and the live maintenance switch worked |
| Responsive UX | **Partially verified:** the admin portal at 375 px and the dialogs at desktop width were checked live. A full matrix (320 / 768 / 1600) and zoom were not run. |
| Automated tests | **Verified** (numbers above) |
| Production build | **Verified** |
| Deployment | **Blocked:** no deployment access was used. See §7. |
| Regression safety | **Verified** by the full existing suites |

## 7. Required external configuration (before deploying)

1. **Google Cloud console** → OAuth client → Authorized redirect URI: exactly `${BACKEND_URL}/api/auth/google/callback`.
2. **GitHub** → OAuth App → Authorization callback URL: exactly `${BACKEND_URL}/api/auth/github/callback`. Scope `user:email` is requested.
3. Set `BACKEND_URL` and `FRONTEND_URL` in production. The old fallback pointed at `http://localhost:5000`.
4. Add any extra frontend origins to `ALLOWED_ORIGINS`. This variable is now honoured; before, it was ignored.
5. **SMTP (Brevo):** set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` (Brevo SMTP login), `SMTP_PASS` (Brevo SMTP key), and `MAIL_FROM` to a sender verified in Brevo. Then use Admin → Diagnostics → "Send test email to me".
6. Create the first admin from a shell with access to the production environment: `node server/scripts/grant-admin.mjs you@example.com superadmin`.
7. Optional, read-only: `node server/scripts/migrations/report-duplicate-accounts.mjs` lists case-collision emails, accounts with synthetic `@github.com` emails, and accounts without a sign-in method. It never merges or deletes.

Cross-site cookies: production already used `SameSite=None; Secure` cookies across the Vercel frontend and the API host. Browsers that block third-party cookies break that today, and the new OAuth handoff cookie has the same constraint. Serving the API on a subdomain of the frontend's domain removes it.

## 8. Known limitations and follow-ups

- The short-lived access token (15 min, now revocable through its session) is still returned in JSON and kept in `localStorage`, because sockets and several hooks send it as a Bearer header. Moving sockets to cookie-only auth would remove it from JS.
- No MFA. Recent sign-in (within 15 minutes) is required for linking, unlinking, adding a first password and deleting the account.
- Admin account deletion is not implemented. Self-service deletion exists, and admins can disable accounts.
- Provider SSRF checks resolve DNS when the config is saved and tested, not on every request (DNS rebinding remains a residual risk for `openai-compatible` URLs). Named adapters use fixed vendor URLs.
- Successful AI calls are not logged to `UsageLog` (pre-existing), so the admin overview reports failures only and says so.
- Anthropic's native API is not offered as an admin adapter (its protocol differs). The existing env and BYO-key Anthropic path is unchanged.
- Data export does not yet include linked-provider and session metadata.

## 9. Admin access: super-admin and requests (added 2026-10-26)

- **Super-admin** comes only from `SUPERADMIN_EMAILS` in `server/.env` (currently `tutorboard.team@gmail.com`). An account gets the role only once its email is **verified**, so registering the address first gains nothing. The role is applied at server start, at sign-in and on email verification. A super-admin whose address is removed from the list drops to admin. `grant-admin.mjs` can no longer create super-admins.
- **Request:** any signed-in user with a verified email opens `/admin` (or Settings → Account → Request admin access). They can ask only for their own account (the email comes from the session), with an optional reason. One request may be pending at a time, and there's a 24-hour wait after a decline. Super-admins are emailed about each request.
- **Decide (super-admin only, `/admin` → Admin access):**
  - Approve or decline, with an optional note.
  - Approving needs a sign-in in the last 15 minutes. It re-checks that the account still has the same verified email and isn't disabled. Each decision is a compare-and-set, so it happens exactly once.
  - Approving gives the `admin` role, signs the person out everywhere and emails them.
- **Revoke (super-admin only, recent sign-in):** admin → user, signed out everywhere, emailed, and the request is marked revoked. Super-admins and your own account can't be revoked from the website.
- Every step is audited (`admin_access.*`, `admin.role_changed`).
- Tests: `tests/adminAccess.test.ts` has 12 tests. The full server suite passes, 322/322. The flow was also run live in the browser on an isolated database: request, approve with email, then revoke with email.
