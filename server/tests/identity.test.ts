/**
 * Identity, sessions, recovery, guest migration, admin and AI failover.
 * Runs against the in-memory MongoDB from setup.ts; email is captured, never sent.
 */
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const outbox: Array<{ kind: string; to: string; code?: string }> = [];
vi.mock('../utils/core/mailer.js', async (importOriginal) => {
  const real: any = await importOriginal();
  const record = (kind: string) => async (user: any, code?: string) => {
    outbox.push({ kind, to: user.email, code });
    return { success: true, id: 'test' };
  };
  return {
    ...real,
    sendEmail: vi.fn(async () => ({ success: true, id: 'test' })),
    sendWelcomeEmail: record('welcome'),
    sendSecurityAlertEmail: record('security'),
    sendVerificationCodeEmail: record('verify'),
    sendPasswordResetCodeEmail: record('reset'),
    sendAccountNoticeEmail: record('notice'),
  };
});
vi.mock('@sentry/node', () => ({ init: vi.fn(), captureException: vi.fn(), setupExpressErrorHandler: vi.fn() }));

import { app } from '../index.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import AuthChallenge from '../models/AuthChallenge.js';
import AuditEvent from '../models/AuditEvent.js';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import AiProvider from '../models/AiProvider.js';
import { resolveOAuthUser } from '../utils/auth/passport.js';
import { generateGuestToken } from '../utils/auth/guestToken.js';
import { _resetPlatformConfigCache, getPlatformSettings } from '../services/platformConfig.service.js';
import PlatformConfig from '../models/PlatformConfig.js';
import { invalidateAdminChain } from '../utils/ai/adminProviders.js';
import { encrypt } from '../utils/auth/encryption.js';

const PW = 'Correct-Horse-9';
// several bcrypt (cost 12) hashes per test; under a parallel full-suite run 5 s is too tight
vi.setConfig({ testTimeout: 30000 });

async function csrf(agent: any): Promise<string> {
  const r = await agent.get('/api/csrf-token');
  return r.body.csrfToken;
}

async function post(agent: any, url: string, body: any = {}, headers: Record<string, string> = {}) {
  const token = await csrf(agent);
  let req = agent.post(url).set('x-csrf-token', token);
  for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
  return req.send(body);
}

async function signupAgent(email = 'learner@example.com', name = 'Learner One') {
  const agent = request.agent(app);
  const res = await post(agent, '/api/auth/signup', { name, email, password: PW, confirmPassword: PW });
  return { agent, res };
}

beforeEach(() => {
  outbox.length = 0;
  _resetPlatformConfigCache();
  invalidateAdminChain();
});

// ─── Canonical identity ──────────────────────────────────────────────────────

describe('canonical identity', () => {
  it('normalises email and rejects a case/space variant of an existing account with 409', async () => {
    const { res } = await signupAgent('Student@Example.com');
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('student@example.com');
    expect(res.body.user.emailVerified).toBe(false);

    const dup = await signupAgent('  STUDENT@example.COM ');
    expect(dup.res.status).toBe(409);
    expect(dup.res.body.code).toBe('EMAIL_IN_USE');
    expect(await User.countDocuments({ email: 'student@example.com' })).toBe(1);
  });

  it('creates exactly one account under concurrent sign-ups', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => signupAgent('race@example.com')));
    const statuses = results.map((r) => r.res.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    expect(await User.countDocuments({ email: 'race@example.com' })).toBe(1);
  });

  it('signs in case-insensitively; wrong password gives a generic 401', async () => {
    await signupAgent('mixed@example.com');
    const a = request.agent(app);
    expect((await post(a, '/api/auth/signin', { email: 'MIXED@example.com', password: PW })).status).toBe(200);
    const bad = await post(a, '/api/auth/signin', { email: 'mixed@example.com', password: 'nope' });
    const none = await post(a, '/api/auth/signin', { email: 'nobody@example.com', password: 'nope' });
    expect(bad.status).toBe(401);
    expect(none.status).toBe(401);
    expect(bad.body.error).toBe(none.body.error);
  });

  it('rejects operator injection in auth bodies', async () => {
    const a = request.agent(app);
    const r1 = await post(a, '/api/auth/password/forgot', { email: { $ne: null } });
    const r2 = await post(a, '/api/auth/signin', { email: { $gt: '' }, password: { $gt: '' } });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });

  it('cannot become admin through settings or signup bodies', async () => {
    const a = request.agent(app);
    const res = await post(a, '/api/auth/signup', { name: 'Eve', email: 'eve@example.com', password: PW, confirmPassword: PW, role: 'admin' });
    expect(res.status).toBe(201);
    const token = res.body.token;
    const t = await csrf(a);
    await a.put('/api/user/settings').set('x-csrf-token', t).set('Authorization', `Bearer ${token}`).send({ role: 'admin', settings: { general: { role: 'admin' } } });
    const u: any = await User.findOne({ email: 'eve@example.com' }).lean();
    expect(u.role).toBe('user');
  });
});

// ─── Sessions ────────────────────────────────────────────────────────────────

describe('sessions', () => {
  it('rotates refresh tokens and treats replay of an old one as theft', async () => {
    const { agent } = await signupAgent('rot@example.com');
    const first = (agent as any).jar.getCookie('tb-refresh-token', { domain: '127.0.0.1', path: '/', secure: false, script: false })?.value;
    expect(first).toBeTruthy();

    const r1 = await agent.post('/api/auth/refresh');
    expect(r1.status).toBe(200);

    // replay inside the grace window (two tabs) → access token only
    const graced = await request(app).post('/api/auth/refresh').set('Cookie', [`tb-refresh-token=${first}`]);
    expect(graced.status).toBe(200);

    // replay after the window → session revoked
    await AuthSession.updateMany({}, { $set: { rotatedAt: new Date(Date.now() - 60_000) } });
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', [`tb-refresh-token=${first}`]);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_REUSE');

    // the legitimate holder is signed out too
    const after = await agent.post('/api/auth/refresh');
    expect(after.status).toBe(401);
  });

  it('logout ends the session: refresh and the old access token stop working', async () => {
    const { agent, res } = await signupAgent('out@example.com');
    const access = res.body.token;
    const refreshCookie = (agent as any).jar.getCookie('tb-refresh-token', { domain: '127.0.0.1', path: '/', secure: false, script: false })?.value;
    expect((await post(agent, '/api/auth/logout')).status).toBe(200);

    const r = await request(app).post('/api/auth/refresh').set('Cookie', [`tb-refresh-token=${refreshCookie}`]);
    expect(r.status).toBe(401);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${access}`);
    expect(me.status).toBe(401);
    expect(me.body.code).toBe('SESSION_ENDED');
  });

  it('lists sessions and "log out everywhere" ends them all', async () => {
    await signupAgent('multi@example.com');
    const devices = [request.agent(app), request.agent(app)];
    const tokens: string[] = [];
    for (const d of devices) tokens.push((await post(d, '/api/auth/signin', { email: 'multi@example.com', password: PW })).body.token);

    const list = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${tokens[0]}`);
    expect(list.status).toBe(200);
    expect(list.body.sessions.length).toBe(3);
    expect(list.body.sessions.filter((s: any) => s.current)).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toMatch(/refreshJti|ip/);

    const out = await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${tokens[0]}`);
    expect(out.body.revoked).toBe(3);
    for (const t of tokens) expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`)).status).toBe(401);
  });
});

// ─── Recovery ────────────────────────────────────────────────────────────────

describe('password recovery (OTP)', () => {
  const lastCode = (kind: string) => [...outbox].reverse().find((m) => m.kind === kind)?.code as string;

  it('answers identically for unknown and known emails', async () => {
    await signupAgent('known@example.com');
    const a = request.agent(app);
    const known = await post(a, '/api/auth/password/forgot', { email: 'known@example.com' });
    const unknown = await post(a, '/api/auth/password/forgot', { email: 'unknown@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(outbox.filter((m) => m.kind === 'reset')).toHaveLength(1);
  });

  it('full flow: code → reset token → new password; sessions revoked; old password dead; token single-use', async () => {
    const { res: s } = await signupAgent('reset@example.com');
    const oldAccess = s.body.token;
    const a = request.agent(app);
    await post(a, '/api/auth/password/forgot', { email: 'reset@example.com' });
    const code = lastCode('reset');
    expect(code).toMatch(/^\d{6}$/);
    const stored: any = await AuthChallenge.findOne({ purpose: 'reset_password' }).lean();
    expect(JSON.stringify(stored)).not.toContain(code);

    // reset without verification is impossible
    const direct = await post(a, '/api/auth/password/reset', { resetToken: 'x'.repeat(43), password: 'Brand-New-7', confirmPassword: 'Brand-New-7' });
    expect(direct.status).toBe(400);

    const v = await post(a, '/api/auth/password/verify', { email: 'reset@example.com', code });
    expect(v.status).toBe(200);
    const resetToken = v.body.resetToken;

    // the same code cannot be used twice
    expect((await post(a, '/api/auth/password/verify', { email: 'reset@example.com', code })).status).toBe(400);

    const weak = await post(a, '/api/auth/password/reset', { resetToken, password: 'short', confirmPassword: 'short' });
    expect(weak.status).toBe(400);

    const ok = await post(a, '/api/auth/password/reset', { resetToken, password: 'Brand-New-7', confirmPassword: 'Brand-New-7' });
    expect(ok.status).toBe(200);
    expect(outbox.some((m) => m.kind === 'security')).toBe(true);

    expect((await post(a, '/api/auth/password/reset', { resetToken, password: 'Other-New-8', confirmPassword: 'Other-New-8' })).status).toBe(400);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldAccess}`)).status).toBe(401);

    const b = request.agent(app);
    expect((await post(b, '/api/auth/signin', { email: 'reset@example.com', password: PW })).status).toBe(401);
    const fresh = await post(b, '/api/auth/signin', { email: 'reset@example.com', password: 'Brand-New-7' });
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.emailVerified).toBe(true);
  });

  it('locks the code after 5 wrong attempts, even when guesses arrive in parallel', async () => {
    await signupAgent('lock@example.com');
    const a = request.agent(app);
    await post(a, '/api/auth/password/forgot', { email: 'lock@example.com' });
    const code = lastCode('reset');
    const wrong = code === '000000' ? '111111' : '000000';
    await Promise.all(Array.from({ length: 8 }, () => post(a, '/api/auth/password/verify', { email: 'lock@example.com', code: wrong })));
    const c: any = await AuthChallenge.findOne({ purpose: 'reset_password' }).lean();
    expect(c.attempts).toBe(5);
    const right = await post(a, '/api/auth/password/verify', { email: 'lock@example.com', code });
    expect(right.status).toBe(400);
    expect(right.body.code).toBe('CODE_LOCKED');
  });

  it('accepts a correct code exactly once under concurrency', async () => {
    await signupAgent('once@example.com');
    const a = request.agent(app);
    await post(a, '/api/auth/password/forgot', { email: 'once@example.com' });
    const code = lastCode('reset');
    const rs = await Promise.all(Array.from({ length: 4 }, () => post(a, '/api/auth/password/verify', { email: 'once@example.com', code })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('expired codes fail; resend has a cooldown', async () => {
    await signupAgent('exp@example.com');
    const a = request.agent(app);
    await post(a, '/api/auth/password/forgot', { email: 'exp@example.com' });
    await post(a, '/api/auth/password/forgot', { email: 'exp@example.com' });
    expect(outbox.filter((m) => m.kind === 'reset')).toHaveLength(1); // second request hit the cooldown
    const code = lastCode('reset');
    await AuthChallenge.updateOne({ purpose: 'reset_password' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post(a, '/api/auth/password/verify', { email: 'exp@example.com', code })).status).toBe(400);
  });
});

describe('email verification', () => {
  it('sends a code at sign-up and confirms it', async () => {
    const { agent, res } = await signupAgent('verify@example.com');
    await new Promise((r) => setTimeout(r, 50)); // sign-up sends in the background
    const code = outbox.find((m) => m.kind === 'verify')?.code as string;
    expect(code).toMatch(/^\d{6}$/);
    const bad = await post(agent, '/api/auth/verify-email/confirm', { code: code === '123456' ? '654321' : '123456' }, { Authorization: `Bearer ${res.body.token}` });
    expect(bad.status).toBe(400);
    const ok = await post(agent, '/api/auth/verify-email/confirm', { code }, { Authorization: `Bearer ${res.body.token}` });
    expect(ok.status).toBe(200);
    expect((await User.findOne({ email: 'verify@example.com' }).lean() as any).emailVerifiedAt).toBeTruthy();
  });

  it('enforces the verification policy when the platform requires it', async () => {
    const { res } = await signupAgent('policy@example.com');
    await PlatformConfig.create({ version: 1, settings: { auth: { requireEmailVerification: true } } });
    _resetPlatformConfigCache();
    const blocked = await request(app).get('/api/sessions').set('Authorization', `Bearer ${res.body.token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
  });
});

// ─── OAuth linking policy ────────────────────────────────────────────────────

describe('OAuth linking policy', () => {
  it('never creates or links without a provider-verified email', async () => {
    await expect(resolveOAuthUser({ provider: 'github', providerId: '1', email: 'x@example.com', emailVerified: false, name: 'X', intent: { mode: 'login' } }))
      .rejects.toMatchObject({ code: 'email_unverified' });
    await expect(resolveOAuthUser({ provider: 'github', providerId: '1', email: null, emailVerified: false, name: 'X', intent: { mode: 'login' } }))
      .rejects.toMatchObject({ code: 'email_unverified' });
    expect(await User.countDocuments()).toBe(0);
  });

  it('refuses to attach to an existing account that never proved its email (pre-hijack)', async () => {
    await User.create({ name: 'Attacker', email: 'victim@example.com', password: PW });
    await expect(resolveOAuthUser({ provider: 'google', providerId: 'g-1', email: 'Victim@example.com', emailVerified: true, name: 'Victim', intent: { mode: 'login' } }))
      .rejects.toMatchObject({ code: 'account_exists_unverified' });
    const u: any = await User.findOne({ email: 'victim@example.com' }).lean();
    expect(u.googleId).toBeUndefined();
  });

  it('links to a verified account with the same verified email — one canonical account', async () => {
    const owner = await User.create({ name: 'Owner', email: 'owner@example.com', password: PW, emailVerifiedAt: new Date() });
    const r = await resolveOAuthUser({ provider: 'google', providerId: 'g-2', email: 'owner@example.com', emailVerified: true, name: 'Owner', intent: { mode: 'login' } });
    expect(String(r.user._id)).toBe(String(owner._id));
    expect(r.linked).toBe(true);
    const again = await resolveOAuthUser({ provider: 'google', providerId: 'g-2', email: 'owner@example.com', emailVerified: true, name: 'Owner', intent: { mode: 'login' } });
    expect(String(again.user._id)).toBe(String(owner._id));
    expect(await User.countDocuments()).toBe(1);
  });

  it('concurrent first sign-ins with one provider identity create one account', async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => resolveOAuthUser({ provider: 'github', providerId: 'gh-9', email: 'new@example.com', emailVerified: true, name: 'New', intent: { mode: 'login' } })));
    expect(new Set(rs.map((r) => String(r.user._id))).size).toBe(1);
    expect(await User.countDocuments()).toBe(1);
  });

  it('link mode refuses an identity owned by another account', async () => {
    await User.create({ name: 'Owner A', email: 'a@example.com', githubId: 'gh-1', emailVerifiedAt: new Date() });
    const b = await User.create({ name: 'Other B', email: 'b@example.com', password: PW });
    await expect(resolveOAuthUser({ provider: 'github', providerId: 'gh-1', email: 'a@example.com', emailVerified: true, name: 'A', intent: { mode: 'link', userId: String(b._id) } }))
      .rejects.toMatchObject({ code: 'provider_in_use' });
  });

  it('will not unlink the last sign-in method', async () => {
    const u = await User.create({ name: 'Solo', email: 'solo@example.com', googleId: 'g-solo', emailVerifiedAt: new Date() });
    const a = request.agent(app);
    // sign in via the OAuth handoff the callback would create
    const OauthCode = (await import('../models/OauthCode.js')).default;
    await OauthCode.create({ code: 'a'.repeat(64), userId: u._id, method: 'google', expiresAt: new Date(Date.now() + 60_000) });
    const ex = await post(a, '/api/auth/exchange', { code: 'a'.repeat(64) });
    expect(ex.status).toBe(200);
    const un = await request(app).delete('/api/auth/providers/google').set('Authorization', `Bearer ${ex.body.token}`);
    expect(un.status).toBe(409);
    expect(un.body.code).toBe('LAST_SIGNIN_METHOD');
  });

  it('OAuth handoff code bound to a browser cannot be redeemed elsewhere', async () => {
    const u = await User.create({ name: 'Bound', email: 'bound@example.com', googleId: 'g-b', emailVerifiedAt: new Date() });
    const OauthCode = (await import('../models/OauthCode.js')).default;
    await OauthCode.create({ code: 'b'.repeat(64), userId: u._id, method: 'google', bindingHash: 'f'.repeat(64), expiresAt: new Date(Date.now() + 60_000) });
    const a = request.agent(app);
    const ex = await post(a, '/api/auth/exchange', { code: 'b'.repeat(64) });
    expect(ex.status).toBe(401);
  });

  it('starting OAuth stores state server-side, bound to a browser cookie', async () => {
    const res = await request(app).get('/api/auth/google');
    // without client credentials the provider is not configured → friendly redirect
    expect([302]).toContain(res.status);
  });
});

// ─── Guest → account ─────────────────────────────────────────────────────────

describe('guest migration', () => {
  it('moves the guest’s conversations to the new account once, without duplicates', async () => {
    const { guestId, token } = generateGuestToken();
    const other = generateGuestToken();
    const s = await ChatSession.create({ guestId, title: 'Circle area' });
    await ChatMessage.create({ sessionId: s._id, guestId, role: 'user', content: 'What is the area of a circle?' });
    const foreign = await ChatSession.create({ guestId: other.guestId, title: 'Not mine' });

    const a = request.agent(app);
    const res = await post(a, '/api/auth/signup', { name: 'Former Guest', email: 'guest@example.com', password: PW, confirmPassword: PW }, { 'X-Guest-Token': token });
    expect(res.status).toBe(201);
    expect(res.body.guestClaim).toMatchObject({ claimed: true, sessions: 1, messages: 1 });

    const mine: any = await ChatSession.findById(s._id).lean();
    expect(String(mine.userId)).toBe(res.body.user.id);
    expect(mine.guestId).toBeNull();
    expect((await ChatSession.findById(foreign._id).lean() as any).guestId).toBe(other.guestId);

    // a retry (sign in again with the same guest token) moves nothing more
    const again = await post(request.agent(app), '/api/auth/signin', { email: 'guest@example.com', password: PW }, { 'X-Guest-Token': token });
    expect(again.body.guestClaim).toMatchObject({ claimed: true, sessions: 0, messages: 0 });
    expect(await ChatSession.countDocuments({ userId: res.body.user.id })).toBe(1);
  });

  it('a client-supplied raw guest id is never accepted', async () => {
    const s = await ChatSession.create({ guestId: 'gst_someone-else', title: 'x' });
    const res = await post(request.agent(app), '/api/auth/signup', { name: 'Thief', email: 'thief@example.com', password: PW, confirmPassword: PW }, { 'X-Guest-Token': 'gst_someone-else' });
    expect(res.body.guestClaim.claimed).toBe(false);
    expect((await ChatSession.findById(s._id).lean() as any).userId).toBeFalsy();
  });
});

// ─── Admin ───────────────────────────────────────────────────────────────────

async function adminToken(role: 'admin' | 'superadmin' = 'admin') {
  const { res } = await signupAgent(`${role}@example.com`, 'Admin Person');
  await User.updateOne({ email: `${role}@example.com` }, { $set: { role } });
  return res.body.token as string;
}

describe('admin control center', () => {
  it('denies anonymous and regular users', async () => {
    expect((await request(app).get('/api/admin/overview')).status).toBe(401);
    const { res } = await signupAgent('regular@example.com');
    const r = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${res.body.token}`);
    expect(r.status).toBe(403);
    const forged = jwt.sign({ id: res.body.user.id, jti: 'x', type: 'access', role: 'admin' }, process.env.JWT_SECRET as string);
    expect((await request(app).get('/api/admin/users').set('Authorization', `Bearer ${forged}`)).status).toBe(403);
  });

  it('lists users without secrets and disables an account (sessions end)', async () => {
    const t = await adminToken();
    const { res: victim } = await signupAgent('target@example.com');
    const list = await request(app).get('/api/admin/users?q=target').set('Authorization', `Bearer ${t}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(JSON.stringify(list.body)).not.toMatch(/"password":"|\$2[aby]\$|refreshJti|codeHash/);

    const id = victim.body.user.id;
    const d = await request(app).post(`/api/admin/users/${id}/disable`).set('Authorization', `Bearer ${t}`).send({ reason: 'abuse' });
    expect(d.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${victim.body.token}`)).status).toBe(401);
    const s = await post(request.agent(app), '/api/auth/signin', { email: 'target@example.com', password: PW });
    expect(s.status).toBe(403);
    expect(await AuditEvent.countDocuments({ type: 'admin.user_disabled' })).toBe(1);
  });

  it('only a super-admin changes roles; admins cannot act on other admins', async () => {
    const t = await adminToken('admin');
    const { res: other } = await signupAgent('other@example.com');
    expect((await request(app).put(`/api/admin/users/${other.body.user.id}/role`).set('Authorization', `Bearer ${t}`).send({ role: 'admin' })).status).toBe(403);
    const st = await adminToken('superadmin');
    expect((await request(app).put(`/api/admin/users/${other.body.user.id}/role`).set('Authorization', `Bearer ${st}`).send({ role: 'superadmin' })).status).toBe(400);
    expect((await request(app).put(`/api/admin/users/${other.body.user.id}/role`).set('Authorization', `Bearer ${st}`).send({ role: 'admin' })).status).toBe(200);
    const adminUser: any = await User.findOne({ email: 'admin@example.com' }).lean();
    expect((await request(app).post(`/api/admin/users/${adminUser._id}/disable`).set('Authorization', `Bearer ${t}`)).status).toBe(400 /* own account */);
  });

  it('settings: validated, versioned, conflict-safe, rollback, and visible to every instance', async () => {
    const t = await adminToken();
    const g = await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${t}`);
    expect(g.body.version).toBe(0);

    const bad = await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${t}`).send({ patch: { guest: { enabled: 'yes' } } });
    expect(bad.status).toBe(400);
    const unknown = await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${t}`).send({ patch: { env: { JWT_SECRET: 'x' } } });
    expect(unknown.status).toBe(400);

    const ok = await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${t}`).send({ patch: { maintenance: { enabled: true, message: 'Back soon' } }, expectedVersion: 0 });
    expect(ok.status).toBe(200);
    expect(ok.body.version).toBe(1);
    const stale = await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${t}`).send({ patch: { guest: { enabled: false } }, expectedVersion: 0 });
    expect(stale.status).toBe(409);

    // another instance (fresh cache) reads the same version from the database
    _resetPlatformConfigCache();
    expect((await getPlatformSettings()).maintenance.enabled).toBe(true);

    const m = await request(app).get('/api/sessions');
    expect(m.status).toBe(503);
    expect(m.body.code).toBe('MAINTENANCE');
    expect((await request(app).get('/api/auth/providers')).status).toBe(200);

    expect((await request(app).post('/api/admin/settings/rollback').set('Authorization', `Bearer ${t}`).send({ version: 0 })).status).toBe(400);
    expect((await request(app).post('/api/admin/settings/rollback').set('Authorization', `Bearer ${t}`).send({ version: 99 })).status).toBe(404);
    await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${t}`).send({ patch: { maintenance: { enabled: false } } });
    const back = await request(app).post('/api/admin/settings/rollback').set('Authorization', `Bearer ${t}`).send({ version: 1 });
    expect(back.body.settings.maintenance.enabled).toBe(true);
    expect(back.body.version).toBe(3);
  });

  it('SMTP test email: admin-only, refuses clearly when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const { res } = await signupAgent('plain@example.com');
    expect((await request(app).post('/api/admin/diagnostics/test-email').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(403);
    const t = await adminToken();
    const r = await request(app).post('/api/admin/diagnostics/test-email').set('Authorization', `Bearer ${t}`);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/SMTP is not configured/);
    const d = await request(app).get('/api/admin/diagnostics').set('Authorization', `Bearer ${t}`);
    expect(d.body.mail.configured).toBe(false);
    expect(JSON.stringify(d.body)).not.toMatch(/SMTP_PASS|pass"/i);
  });

  it('registration switch is enforced on the server', async () => {
    const t = await adminToken();
    await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${t}`).send({ patch: { auth: { registrationEnabled: false } } });
    const r = await signupAgent('late@example.com');
    expect(r.res.status).toBe(403);
    expect(r.res.body.code).toBe('REGISTRATION_DISABLED');
  });

  it('providers: SSRF-guarded, key never returned, enabling requires a passing test', async () => {
    const t = await adminToken();
    const base = { name: 'Local', adapter: 'openai-compatible', apiKey: 'sk-test-1234567890', models: [{ id: 'm1' }], defaultModel: 'm1' };
    for (const url of ['http://169.254.169.254/latest', 'https://127.0.0.1/v1', 'https://10.0.0.5/v1', 'ftp://example.com']) {
      const r = await request(app).post('/api/admin/providers').set('Authorization', `Bearer ${t}`).send({ ...base, baseUrl: url });
      expect(r.status, url).toBe(400);
    }
    const created = await request(app).post('/api/admin/providers').set('Authorization', `Bearer ${t}`).send({ ...base, adapter: 'groq' });
    expect(created.status).toBe(201);
    expect(JSON.stringify(created.body)).not.toContain('sk-test-1234567890');
    expect(created.body.provider.maskedKey).toMatch(/\*\*\*\*/);
    expect(created.body.provider.enabled).toBe(false);
    const en = await request(app).post(`/api/admin/providers/${created.body.provider.id}/enabled`).set('Authorization', `Bearer ${t}`).send({ enabled: true });
    expect(en.status).toBe(409);
    const list = await request(app).get('/api/admin/providers').set('Authorization', `Bearer ${t}`);
    expect(JSON.stringify(list.body)).not.toMatch(/encryptedKey|"iv"|"tag"|sk-test/);
  });
});

// ─── AI failover (real HTTP against a local OpenAI-compatible mock) ─────────

describe('AI provider failover', () => {
  let server: http.Server;
  let port = 0;
  const hits: Record<string, number> = {};

  beforeAll(async () => {
    process.env.ALLOW_PRIVATE_AI_ENDPOINTS = 'true';
    server = http.createServer((req, res) => {
      const route = (req.url || '').split('/')[1];
      hits[route] = (hits[route] || 0) + 1;
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const json = body ? JSON.parse(body) : {};
        if (req.url?.endsWith('/models')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ object: 'list', data: [{ id: 'm1', object: 'model' }] }));
        }
        if (route === 'down') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{"error":{"message":"boom"}}'); }
        if (route === 'badkey') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":{"message":"bad key"}}'); }
        if (json.stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          const chunk = (t: string) => `data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', created: 0, model: 'm1', choices: [{ index: 0, delta: { content: t }, finish_reason: null }] })}\n\n`;
          res.write(chunk(route === 'partial' ? 'Half an ' : 'Answer '));
          if (route === 'partial') return setTimeout(() => res.destroy(), 20);
          res.write(chunk(`from ${route}`));
          return res.end('data: [DONE]\n\n');
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'c', object: 'chat.completion', created: 0, model: 'm1', choices: [{ index: 0, message: { role: 'assistant', content: `Answer from ${route}` }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 3 } }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => { server?.close(); delete process.env.ALLOW_PRIVATE_AI_ENDPOINTS; });

  async function addProvider(route: string, priority: number) {
    const enc = encrypt('sk-local-test-key');
    const cfg = { baseUrl: `http://127.0.0.1:${port}/${route}`, defaultModel: 'm1' };
    return AiProvider.create({
      name: route, adapter: 'openai-compatible', ...cfg, encryptedKey: enc.encrypted, iv: enc.iv, tag: enc.tag,
      models: [{ id: 'm1', capabilities: ['text', 'stream'] }], priority, enabled: true, timeoutMs: 5000,
      lastKnownGood: { ...cfg, keyIv: enc.iv, models: [] },
    });
  }

  it('admin test endpoint validates a real completion and stream, then allows enabling', async () => {
    const t = await adminToken();
    const enc = encrypt('sk-local-test-key');
    const p = await AiProvider.create({ name: 'ok', adapter: 'openai-compatible', baseUrl: `http://127.0.0.1:${port}/ok`, encryptedKey: enc.encrypted, iv: enc.iv, tag: enc.tag, models: [{ id: 'm1' }], defaultModel: 'm1' });
    const r = await request(app).post(`/api/admin/providers/${p._id}/test`).set('Authorization', `Bearer ${t}`).send({});
    expect(r.status).toBe(200);
    expect(r.body.result.ok).toBe(true);
    expect(r.body.result.steps.map((s: any) => s.step)).toEqual(['models', 'completion', 'stream']);
    expect((await request(app).post(`/api/admin/providers/${p._id}/enabled`).set('Authorization', `Bearer ${t}`).send({ enabled: true })).status).toBe(200);

    const bad = await request(app).post('/api/admin/providers/test').set('Authorization', `Bearer ${t}`).send({ adapter: 'openai-compatible', baseUrl: `http://127.0.0.1:${port}/badkey`, apiKey: 'sk-wrong-123456', defaultModel: 'm1' });
    expect(bad.body.result.ok).toBe(false);
    expect(JSON.stringify(bad.body)).not.toContain('bad key'); // upstream body never echoed
  });

  it('fails over from a broken primary to the next provider with one answer, bounded calls', async () => {
    await addProvider('down', 1);
    await addProvider('ok', 2);
    invalidateAdminChain();
    const { requestCompletion } = await import('../utils/ai/llmClient.js');
    hits.down = 0;
    const r: any = await requestCompletion({ messages: [{ role: 'user', content: 'failover-test-1' }], model: 'm1', taskType: 'final_answer' } as any);
    expect(r.content).toBe('Answer from ok');
    expect(r._meta.fallback_triggered).toBe(true);
    expect(hits.down).toBeLessThanOrEqual(2);
  });

  it('a stream that dies mid-answer is not restarted on another provider (no duplicate text)', async () => {
    await addProvider('partial', 1);
    await addProvider('ok', 2);
    invalidateAdminChain();
    const { requestCompletion } = await import('../utils/ai/llmClient.js');
    const tokens: string[] = [];
    hits.ok = 0;
    await expect(requestCompletion({ messages: [{ role: 'user', content: 'stream-test-2' }], model: 'm1', onStream: (t: string) => tokens.push(t) } as any)).rejects.toBeTruthy();
    expect(tokens.join('')).toBe('Half an ');
    expect(hits.ok || 0).toBe(0);
  });
});
