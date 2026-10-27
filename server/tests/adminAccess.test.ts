/**
 * Super-admin from SUPERADMIN_EMAILS, and the request → approve/decline → revoke
 * flow for admin access. In-memory MongoDB (setup.ts); email is captured.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';

const outbox: Array<{ kind: string; to: string; extra?: any }> = [];
vi.mock('../utils/core/mailer.js', async (importOriginal) => {
  const real: any = await importOriginal();
  const rec = (kind: string) => async (user: any, extra?: any) => { outbox.push({ kind, to: user.email, extra }); return { success: true }; };
  return {
    ...real,
    sendEmail: vi.fn(async () => ({ success: true })),
    sendWelcomeEmail: rec('welcome'),
    sendVerificationCodeEmail: rec('verify'),
    sendNewSignInEmail: rec('signin'),
    sendAdminRequestReceivedEmail: rec('request-received'),
    sendAdminRequestDecisionEmail: rec('decision'),
    sendAdminAccessRevokedEmail: rec('revoked'),
  };
});
vi.mock('@sentry/node', () => ({ init: vi.fn(), captureException: vi.fn(), setupExpressErrorHandler: vi.fn() }));

import { app } from '../index.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import AdminAccessRequest from '../models/AdminAccessRequest.js';
import AuditEvent from '../models/AuditEvent.js';
import { syncConfiguredSuperadmins } from '../services/adminAccess.service.js';
import { _resetPlatformConfigCache } from '../services/platformConfig.service.js';

vi.setConfig({ testTimeout: 30000 });
const PW = 'Correct-Horse-9';
const BOSS = 'boss@example.com';

async function csrf(agent: any) { return (await agent.get('/api/csrf-token')).body.csrfToken; }
async function post(agent: any, url: string, body: any = {}) {
  const token = await csrf(agent); // before creating the POST: the agent attaches cookies at creation
  return agent.post(url).set('x-csrf-token', token).send(body);
}
async function signup(email: string, name = 'Some Person') {
  const a = request.agent(app);
  const r = await post(a, '/api/auth/signup', { name, email, password: PW, confirmPassword: PW });
  return { agent: a, token: r.body.token as string, id: r.body.user?.id as string };
}
async function signin(email: string) {
  const a = request.agent(app);
  const r = await post(a, '/api/auth/signin', { email, password: PW });
  return { agent: a, token: r.body.token as string, role: r.body.user?.role as string, status: r.status };
}
const verify = (email: string) => User.updateOne({ email }, { $set: { emailVerifiedAt: new Date() } });
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** A signed-in super-admin (from SUPERADMIN_EMAILS) with a fresh session. */
async function boss() {
  await signup(BOSS, 'The Boss');
  await verify(BOSS);
  const s = await signin(BOSS);
  expect(s.role).toBe('superadmin');
  return s.token;
}
/** A verified regular user with a pending request. */
async function requester(email = 'asker@example.com') {
  const u = await signup(email, 'Asker Person');
  await verify(email);
  const r = await request(app).post('/api/admin-access/request').set(auth(u.token)).send({ reason: 'I run the AI providers' });
  expect(r.status).toBe(201);
  return { ...u, requestId: r.body.request.id as string };
}

beforeEach(() => {
  outbox.length = 0;
  process.env.SUPERADMIN_EMAILS = BOSS;
  _resetPlatformConfigCache();
});
afterAll(() => { delete process.env.SUPERADMIN_EMAILS; });

describe('SUPERADMIN_EMAILS', () => {
  it('gives the role only after the listed email is verified', async () => {
    await signup(BOSS, 'Impostor');
    const before = await signin(BOSS);
    expect(before.role).toBe('user'); // unverified: someone else may have registered the address
    await verify(BOSS);
    expect((await signin(BOSS)).role).toBe('superadmin');
  });

  it('startup sync promotes listed verified accounts and demotes unlisted super-admins', async () => {
    await User.create({ name: 'Listed', email: BOSS, password: PW, emailVerifiedAt: new Date() });
    await User.create({ name: 'Old Super', email: 'old@example.com', password: PW, role: 'superadmin' });
    await syncConfiguredSuperadmins({ info: () => {}, warn: () => {} });
    expect((await User.findOne({ email: BOSS }).lean() as any).role).toBe('superadmin');
    expect((await User.findOne({ email: 'old@example.com' }).lean() as any).role).toBe('admin');
  });

  it('the shell script can no longer create a super-admin, and no API can', async () => {
    const t = await boss();
    const { id } = await signup('x@example.com');
    const r = await request(app).put(`/api/admin/users/${id}/role`).set(auth(t)).send({ role: 'superadmin' });
    expect(r.status).toBe(400);
  });
});

describe('requesting access', () => {
  it('needs a verified email, only for your own account, one at a time', async () => {
    const u = await signup('new@example.com');
    const unverified = await request(app).post('/api/admin-access/request').set(auth(u.token)).send({});
    expect(unverified.status).toBe(403);
    expect(unverified.body.code).toBe('EMAIL_NOT_VERIFIED');

    await verify('new@example.com');
    const other = await request(app).post('/api/admin-access/request').set(auth(u.token)).send({ email: 'someone@else.com' });
    expect(other.status).toBe(400);
    expect(other.body.code).toBe('EMAIL_MISMATCH');

    await boss(); // so a super-admin exists to be notified
    outbox.length = 0;
    const ok = await request(app).post('/api/admin-access/request').set(auth(u.token)).send({ reason: '<b>please</b>' });
    expect(ok.status).toBe(201);
    expect(ok.body.request.email).toBe('new@example.com');
    expect(ok.body.request.reason).not.toContain('<');
    expect(outbox.filter((m) => m.kind === 'request-received').map((m) => m.to)).toEqual([BOSS]);

    const dup = await request(app).post('/api/admin-access/request').set(auth(u.token)).send({});
    expect(dup.status).toBe(409);
    expect((await request(app).get('/api/admin-access/me').set(auth(u.token))).body.request.status).toBe('pending');
  });

  it('anonymous users cannot request; admins are told they already have access', async () => {
    expect((await request(app).get('/api/admin-access/me')).status).toBe(401);
    const t = await boss();
    expect((await request(app).post('/api/admin-access/request').set(auth(t)).send({})).status).toBe(409);
  });
});

describe('deciding requests', () => {
  it('only the super-admin can see or decide requests', async () => {
    const r = await requester();
    // a regular admin (not super) is refused
    await signup('plainadmin@example.com');
    await User.updateOne({ email: 'plainadmin@example.com' }, { $set: { role: 'admin' } });
    const admin = await signin('plainadmin@example.com');
    expect((await request(app).get('/api/admin/access/requests').set(auth(admin.token))).status).toBe(403);
    expect((await request(app).post(`/api/admin/access/requests/${r.requestId}/approve`).set(auth(admin.token))).status).toBe(403);
    // the requester themself is refused
    expect((await request(app).post(`/api/admin/access/requests/${r.requestId}/approve`).set(auth(r.token))).status).toBe(403);
    expect((await AdminAccessRequest.findById(r.requestId).lean() as any).status).toBe('pending');
  });

  it('approving needs a recent sign-in; then grants admin, ends sessions, emails, and cannot run twice', async () => {
    const t = await boss();
    const r = await requester();
    // raw collection: mongoose treats timestamps.createdAt as immutable
    await AuthSession.collection.updateMany({ userId: (await User.findOne({ email: BOSS }))!._id }, { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } });
    const stale = await request(app).post(`/api/admin/access/requests/${r.requestId}/approve`).set(auth(t));
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('REAUTH_REQUIRED');

    const fresh = (await signin(BOSS)).token;
    const ok = await request(app).post(`/api/admin/access/requests/${r.requestId}/approve`).set(auth(fresh)).send({ note: 'Welcome' });
    expect(ok.status).toBe(200);
    expect((await User.findOne({ email: 'asker@example.com' }).lean() as any).role).toBe('admin');
    expect((await request(app).get('/api/auth/me').set(auth(r.token))).status).toBe(401); // signed out everywhere
    expect(outbox.find((m) => m.kind === 'decision')).toMatchObject({ to: 'asker@example.com', extra: true });
    expect((await request(app).post(`/api/admin/access/requests/${r.requestId}/approve`).set(auth(fresh))).status).toBe(409);
    expect(await AuditEvent.countDocuments({ type: 'admin_access.approved' })).toBe(1);

    const back = await signin('asker@example.com');
    expect(back.role).toBe('admin');
    expect((await request(app).get('/api/admin/overview').set(auth(back.token))).status).toBe(200);
  });

  it('two approvals at once decide the request exactly once', async () => {
    const t = await boss();
    const r = await requester();
    const rs = await Promise.all([1, 2, 3].map(() => request(app).post(`/api/admin/access/requests/${r.requestId}/approve`).set(auth(t))));
    expect(rs.filter((x) => x.status === 200)).toHaveLength(1);
    expect(await AuditEvent.countDocuments({ type: 'admin_access.approved' })).toBe(1);
  });

  it('a request whose account changed since asking is closed, not approved', async () => {
    const t = await boss();
    const r = await requester();
    await User.updateOne({ email: 'asker@example.com' }, { $set: { emailVerifiedAt: null } });
    const res = await request(app).post(`/api/admin/access/requests/${r.requestId}/approve`).set(auth(t));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACCOUNT_CHANGED');
    expect((await User.findOne({ email: 'asker@example.com' }).lean() as any).role).toBe('user');
  });

  it('declining emails the requester and blocks a new request for 24 hours', async () => {
    const t = await boss();
    const r = await requester();
    const res = await request(app).post(`/api/admin/access/requests/${r.requestId}/reject`).set(auth(t)).send({ note: 'Not now' });
    expect(res.status).toBe(200);
    expect(outbox.find((m) => m.kind === 'decision')).toMatchObject({ to: 'asker@example.com', extra: false });
    const again = await request(app).post('/api/admin-access/request').set(auth(r.token)).send({});
    expect(again.status).toBe(429);
    expect(again.body.code).toBe('REQUEST_COOLDOWN');
  });
});

describe('revoking access', () => {
  it('super-admin revokes an admin: role back to user, sessions ended, emailed, request marked revoked', async () => {
    const t = await boss();
    const r = await requester();
    await request(app).post(`/api/admin/access/requests/${r.requestId}/approve`).set(auth(t));
    const asAdmin = await signin('asker@example.com');
    const id = (await User.findOne({ email: 'asker@example.com' }))!._id;

    const res = await request(app).post(`/api/admin/access/admins/${id}/revoke`).set(auth(t));
    expect(res.status).toBe(200);
    expect((await User.findById(id).lean() as any).role).toBe('user');
    expect((await request(app).get('/api/admin/overview').set(auth(asAdmin.token))).status).toBe(401);
    expect((await AdminAccessRequest.findById(r.requestId).lean() as any).status).toBe('revoked');
    expect(outbox.some((m) => m.kind === 'revoked' && m.to === 'asker@example.com')).toBe(true);
  });

  it('cannot revoke a super-admin or yourself, and admins cannot revoke anyone', async () => {
    const t = await boss();
    const bossId = (await User.findOne({ email: BOSS }))!._id;
    expect((await request(app).post(`/api/admin/access/admins/${bossId}/revoke`).set(auth(t))).status).toBe(400);
    await User.create({ name: 'Other Super', email: 'super2@example.com', password: PW, role: 'superadmin', emailVerifiedAt: new Date() });
    process.env.SUPERADMIN_EMAILS = `${BOSS},super2@example.com`;
    const s2 = (await User.findOne({ email: 'super2@example.com' }))!._id;
    const r = await request(app).post(`/api/admin/access/admins/${s2}/revoke`).set(auth(t));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('SUPERADMIN_FROM_ENV');

    await signup('plainadmin@example.com');
    await User.updateOne({ email: 'plainadmin@example.com' }, { $set: { role: 'admin' } });
    const admin = await signin('plainadmin@example.com');
    const victim = await signup('victim@example.com');
    await User.updateOne({ email: 'victim@example.com' }, { $set: { role: 'admin' } });
    expect((await request(app).post(`/api/admin/access/admins/${victim.id}/revoke`).set(auth(admin.token))).status).toBe(403);
  });
});
