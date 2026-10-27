import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import AuditEvent from '../models/AuditEvent.js';
import AiProvider from '../models/AiProvider.js';
import ChatSession from '../models/ChatSession.js';
import UsageLog from '../models/UsageLog.js';
import { encrypt, decrypt, maskApiKey } from '../utils/auth/encryption.js';
import { revokeAllSessions } from '../services/auth/session.service.js';
import { audit } from '../services/audit.service.js';
import {
  getPlatformSettings,
  getCachedVersion,
  updatePlatformSettings,
  rollbackPlatformSettings,
  listPlatformVersions,
  SettingsSchema,
} from '../services/platformConfig.service.js';
import {
  ADAPTER_BASE_URLS,
  assertSafeBaseUrl,
  testProviderConfig,
  invalidateAdminChain,
} from '../utils/ai/adminProviders.js';
import { container } from '../core/container.js';
import { mailConfig, sendEmail, describeMailError, templates } from '../utils/core/mailer.js';

/**
 * Admin control center API. Mounted behind protect + requireAdmin; nothing here
 * returns passwords, codes, tokens or decrypted provider keys.
 */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isId = (id) => mongoose.isValidObjectId(id);
const DAY = 24 * 60 * 60 * 1000;

async function invalidateUserCache(userId) {
  if (!container.has('redis-main')) return;
  try { await container.resolve('redis-main').del(`user:${userId}`); } catch { /* cache only */ }
}

const safeUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role || 'user',
  emailVerified: !!u.emailVerifiedAt,
  providers: { password: !!u.hasPassword, google: !!u.googleId, github: !!u.githubId },
  disabled: !!u.disabledAt,
  disabledReason: u.disabledReason || '',
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt || null,
});

// ─── Overview ────────────────────────────────────────────────────────────────

export const getOverview = async (_req, res) => {
  const since = new Date(Date.now() - DAY);
  const week = new Date(Date.now() - 7 * DAY);
  const [total, verified, disabled, admins, newWeek, activeSessions, guestConvos, aiFailures, providers, authFailures, emailFailures] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ emailVerifiedAt: { $ne: null } }),
    User.countDocuments({ disabledAt: { $ne: null } }),
    User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
    User.countDocuments({ createdAt: { $gte: week } }),
    AuthSession.countDocuments({ revokedAt: null, expiresAt: { $gt: new Date() }, lastUsedAt: { $gte: since } }),
    ChatSession.countDocuments({ guestId: { $nin: [null, ''] }, lastUpdated: { $gte: week } }),
    UsageLog.countDocuments({ success: false, timestamp: { $gte: since } }),
    AiProvider.find().select('name enabled priority health').sort({ priority: 1 }).lean(),
    AuditEvent.countDocuments({ type: { $in: ['auth.signin', 'oauth.google', 'oauth.github'] }, outcome: 'failure', createdAt: { $gte: since } }),
    AuditEvent.countDocuments({ type: 'email.delivery_failed', createdAt: { $gte: since } }),
  ]);
  res.json({
    accounts: { total, verified, unverified: total - verified, disabled, admins, newLast7d: newWeek },
    sessions: { activeLast24h: activeSessions },
    guests: { conversationsActiveLast7d: guestConvos },
    ai: { failedRequestsLast24h: aiFailures, providers },
    security: { failedSignInsLast24h: authFailures, emailDeliveryFailuresLast24h: emailFailures },
    notes: {
      sessions: 'Signed-in sessions used in the last 24 h (exact).',
      guests: 'Guest conversations updated in the last 7 days (exact count of conversations, not people).',
      ai: 'Failed AI calls are logged per request; successful calls are not counted here.',
    },
  });
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const listUsers = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ email: rx }, { name: rx }];
  }
  if (req.query.status === 'disabled') filter.disabledAt = { $ne: null };
  if (req.query.status === 'unverified') filter.emailVerifiedAt = null;
  if (req.query.status === 'admins') filter.role = { $in: ['admin', 'superadmin'] };

  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('name email role emailVerifiedAt googleId githubId disabledAt disabledReason createdAt lastLoginAt +password').lean(),
    User.countDocuments(filter),
  ]);
  res.json({
    users: rows.map((u) => safeUser({ ...u, hasPassword: !!u.password })),
    page, limit, total,
  });
};

export const getUser = async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'User not found' });
  const u = await User.findById(req.params.id)
    .select('name email role emailVerifiedAt googleId githubId disabledAt disabledReason createdAt lastLoginAt +password').lean();
  if (!u) return res.status(404).json({ error: 'User not found' });
  const [sessions, events, conversations] = await Promise.all([
    AuthSession.find({ userId: u._id, revokedAt: null, expiresAt: { $gt: new Date() } }).select('method userAgent createdAt lastUsedAt').sort({ lastUsedAt: -1 }).lean(),
    AuditEvent.find({ $or: [{ targetUserId: u._id }, { actorId: u._id }] }).sort({ createdAt: -1 }).limit(50).select('-ip').lean(),
    ChatSession.countDocuments({ userId: u._id, isDeleted: { $ne: true } }),
  ]);
  res.json({
    user: safeUser({ ...u, hasPassword: !!u.password }),
    conversations,
    sessions: sessions.map((s) => ({ id: s._id, method: s.method, userAgent: s.userAgent, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt })),
    events,
  });
};

async function loadTarget(req, res) {
  if (!isId(req.params.id)) { res.status(404).json({ error: 'User not found' }); return null; }
  const target = await User.findById(req.params.id).select('name email role disabledAt');
  if (!target) { res.status(404).json({ error: 'User not found' }); return null; }
  if (String(target._id) === String(req.user._id)) { res.status(400).json({ error: 'You cannot do this to your own account here.' }); return null; }
  // only a super-admin may act on another administrator
  if (target.role !== 'user' && req.user.role !== 'superadmin') { res.status(403).json({ error: 'Only a super-admin can change another administrator.' }); return null; }
  return target;
}

export const disableUser = async (req, res) => {
  const target = await loadTarget(req, res);
  if (!target) return;
  const reason = String(req.body?.reason || '').slice(0, 200);
  await User.updateOne({ _id: target._id }, { $set: { disabledAt: new Date(), disabledReason: reason } });
  const revoked = await revokeAllSessions(target._id, 'account_disabled');
  await invalidateUserCache(target._id);
  await audit(req, 'admin.user_disabled', { targetUserId: target._id, meta: { reason, sessionsRevoked: revoked } });
  res.json({ success: true, sessionsRevoked: revoked });
};

export const enableUser = async (req, res) => {
  const target = await loadTarget(req, res);
  if (!target) return;
  await User.updateOne({ _id: target._id }, { $set: { disabledAt: null, disabledReason: '' } });
  await invalidateUserCache(target._id);
  await audit(req, 'admin.user_enabled', { targetUserId: target._id });
  res.json({ success: true });
};

export const revokeUserSessions = async (req, res) => {
  const target = await loadTarget(req, res);
  if (!target) return;
  const revoked = await revokeAllSessions(target._id, 'admin_revoked');
  await audit(req, 'admin.sessions_revoked', { targetUserId: target._id, meta: { count: revoked } });
  res.json({ success: true, sessionsRevoked: revoked });
};

export const setUserRole = async (req, res) => {
  const role = req.body?.role;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be "user" or "admin". Super-admins are granted only by the server script.' });
  const target = await loadTarget(req, res);
  if (!target) return;
  if (target.role === 'superadmin') return res.status(403).json({ error: 'Super-admin roles are managed by the server script.' });
  await User.updateOne({ _id: target._id }, { $set: { role } });
  await revokeAllSessions(target._id, 'role_changed'); // privilege change → new sessions
  await invalidateUserCache(target._id);
  await audit(req, 'admin.role_changed', { targetUserId: target._id, meta: { from: target.role, to: role } });
  res.json({ success: true });
};

// ─── Platform settings ───────────────────────────────────────────────────────

export const getSettings = async (_req, res) => {
  const settings = await getPlatformSettings({ fresh: true });
  res.json({ version: getCachedVersion(), settings, versions: await listPlatformVersions(20) });
};

export const putSettings = async (req, res) => {
  const { patch, expectedVersion, note } = req.body || {};
  if (!patch || typeof patch !== 'object') return res.status(400).json({ error: 'Body must include a `patch` object' });
  try {
    const before = await getPlatformSettings({ fresh: true });
    const r = await updatePlatformSettings(patch, { actorId: req.user._id, expectedVersion, note: String(note || '').slice(0, 200) });
    await audit(req, 'admin.settings_changed', { meta: { version: r.version, patch, before } });
    res.json({ version: r.version, settings: r.settings });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
};

export const rollbackSettings = async (req, res) => {
  const v = Number(req.body?.version);
  if (!Number.isInteger(v) || v < 1) return res.status(400).json({ error: 'version must be a positive integer' });
  try {
    const r = await rollbackPlatformSettings(v, { actorId: req.user._id });
    await audit(req, 'admin.settings_rollback', { meta: { to: v, newVersion: r.version } });
    res.json({ version: r.version, settings: r.settings });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const getSettingsSchema = (_req, res) => {
  res.json({ keys: Object.keys(SettingsSchema.shape) });
};

// ─── Audit & diagnostics ─────────────────────────────────────────────────────

export const listAudit = async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  const filter = {};
  if (typeof req.query.type === 'string' && /^[a-z_.]{1,60}$/.test(req.query.type)) filter.type = new RegExp('^' + escapeRegex(req.query.type));
  if (req.query.outcome === 'failure') filter.outcome = 'failure';
  const [rows, total] = await Promise.all([
    AuditEvent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditEvent.countDocuments(filter),
  ]);
  res.json({ events: rows, page, limit, total });
};

export const getDiagnostics = async (_req, res) => {
  const since = new Date(Date.now() - DAY);
  const t = Date.now();
  let dbPingMs = null;
  try { await mongoose.connection.db.admin().ping(); dbPingMs = Date.now() - t; } catch { /* reported as null */ }
  const failuresByType = await AuditEvent.aggregate([
    { $match: { outcome: 'failure', createdAt: { $gte: since } } },
    { $group: { _id: '$type', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
    { $sort: { count: -1 } },
  ]);
  const aiErrors = await UsageLog.aggregate([
    { $match: { success: false, timestamp: { $gte: since } } },
    { $group: { _id: '$errorType', count: { $sum: 1 } } },
  ]);
  const providers = await AiProvider.find().select('name enabled priority health').sort({ priority: 1 }).lean();
  res.json({
    database: { connected: mongoose.connection.readyState === 1, pingMs: dbPingMs },
    configVersion: getCachedVersion(),
    instance: { pid: process.pid, uptimeS: Math.round(process.uptime()), node: process.version },
    mail: (({ configured, host, port, secure, from }) => ({ configured, host, port, secure, from }))(mailConfig()),
    oauth: { google: !!process.env.GOOGLE_CLIENT_ID, github: !!process.env.GITHUB_CLIENT_ID },
    failuresLast24h: failuresByType,
    aiErrorsLast24h: aiErrors,
    providers,
  });
};

// ─── AI providers ────────────────────────────────────────────────────────────

const ModelSchema = z.object({
  id: z.string().trim().min(1).max(200),
  label: z.string().max(80).optional().default(''),
  capabilities: z.array(z.enum(['text', 'stream', 'vision', 'json'])).min(1).default(['text']),
  enabled: z.boolean().default(true),
});
const ProviderBody = z.object({
  name: z.string().trim().min(1).max(60),
  adapter: z.enum(['openai-compatible', 'openai', 'google', 'groq', 'openrouter', 'deepseek', 'mistral', 'together']),
  baseUrl: z.string().trim().max(500).optional(),
  apiKey: z.string().trim().min(8).max(500).optional(),
  models: z.array(ModelSchema).min(1).max(50),
  defaultModel: z.string().trim().min(1).max(200),
  priority: z.number().int().min(0).max(10000).default(100),
  timeoutMs: z.number().int().min(2000).max(300000).default(60000),
  maxRetries: z.number().int().min(0).max(3).default(1),
}).strict();

const publicProvider = (p) => ({
  id: p._id,
  name: p.name,
  adapter: p.adapter,
  baseUrl: p.baseUrl,
  maskedKey: p.maskedKey,
  models: p.models,
  defaultModel: p.defaultModel,
  priority: p.priority,
  timeoutMs: p.timeoutMs,
  maxRetries: p.maxRetries,
  enabled: p.enabled,
  health: p.health,
  testedCurrentConfig: !!p.lastKnownGood && sameConfig(p.lastKnownGood, p),
  hasLastKnownGood: !!p.lastKnownGood,
  updatedAt: p.updatedAt,
});

// the config a successful test certified (the key is identified by its IV, which changes on every replacement)
const configSnapshot = (p) => ({ baseUrl: p.baseUrl, defaultModel: p.defaultModel, keyIv: p.iv, models: (p.models || []).map((m) => ({ id: m.id, label: m.label, capabilities: m.capabilities, enabled: m.enabled })) });
function sameConfig(snap, p) {
  return snap.baseUrl === p.baseUrl && snap.defaultModel === p.defaultModel && snap.keyIv === p.iv;
}

async function resolveBaseUrl(adapter, baseUrl) {
  if (adapter !== 'openai-compatible') return ADAPTER_BASE_URLS[adapter];
  if (!baseUrl) throw Object.assign(new Error('A base URL is required for an OpenAI-compatible endpoint'), { status: 400 });
  return assertSafeBaseUrl(baseUrl);
}

export const listProviders = async (_req, res) => {
  const rows = await AiProvider.find().sort({ priority: 1, createdAt: 1 }).lean();
  res.json({ providers: rows.map(publicProvider), adapters: { ...ADAPTER_BASE_URLS, 'openai-compatible': null } });
};

export const createProvider = async (req, res) => {
  const parsed = ProviderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  const b = parsed.data;
  if (!b.apiKey) return res.status(400).json({ error: 'apiKey is required' });
  if (!b.models.some((m) => m.id === b.defaultModel)) return res.status(400).json({ error: 'defaultModel must be one of the models' });
  try {
    const baseUrl = await resolveBaseUrl(b.adapter, b.baseUrl);
    const enc = encrypt(b.apiKey);
    const p = await AiProvider.create({
      name: b.name, adapter: b.adapter, baseUrl,
      encryptedKey: enc.encrypted, iv: enc.iv, tag: enc.tag, maskedKey: maskApiKey(b.apiKey),
      models: b.models, defaultModel: b.defaultModel, priority: b.priority, timeoutMs: b.timeoutMs, maxRetries: b.maxRetries,
      enabled: false, createdBy: req.user._id,
    });
    await audit(req, 'admin.provider_created', { target: String(p._id), meta: { name: b.name, adapter: b.adapter } });
    res.status(201).json({ provider: publicProvider(p.toObject()) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

export const updateProvider = async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Provider not found' });
  const p = await AiProvider.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  const parsed = ProviderBody.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  const b = parsed.data;
  try {
    if (b.adapter || b.baseUrl !== undefined) p.baseUrl = await resolveBaseUrl(b.adapter || p.adapter, b.baseUrl ?? p.baseUrl);
    for (const k of ['name', 'adapter', 'models', 'defaultModel', 'priority', 'timeoutMs', 'maxRetries']) if (b[k] !== undefined) p[k] = b[k];
    if (!p.models.some((m) => m.id === p.defaultModel)) return res.status(400).json({ error: 'defaultModel must be one of the models' });
    if (b.apiKey) {
      const enc = encrypt(b.apiKey);
      Object.assign(p, { encryptedKey: enc.encrypted, iv: enc.iv, tag: enc.tag, maskedKey: maskApiKey(b.apiKey) });
    }
    // an enabled provider whose certified config changed stops serving until re-tested
    if (p.enabled && !(p.lastKnownGood && sameConfig(p.lastKnownGood, p))) p.enabled = false;
    await p.save();
    invalidateAdminChain();
    await audit(req, 'admin.provider_updated', { target: String(p._id), meta: { fields: Object.keys(b).filter((k) => k !== 'apiKey'), keyReplaced: !!b.apiKey } });
    res.json({ provider: publicProvider(p.toObject()) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

export const deleteProvider = async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Provider not found' });
  const p = await AiProvider.findByIdAndDelete(req.params.id);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  invalidateAdminChain();
  await audit(req, 'admin.provider_deleted', { target: String(p._id), meta: { name: p.name } });
  res.json({ success: true });
};

/** Test the saved config (stored key). A full pass certifies it (lastKnownGood) and allows enabling. */
export const testProvider = async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Provider not found' });
  const p = await AiProvider.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  let result;
  try {
    const apiKey = decrypt({ encrypted: p.encryptedKey, iv: p.iv, tag: p.tag });
    result = await testProviderConfig({ baseUrl: p.baseUrl, apiKey, model: p.defaultModel, timeoutMs: p.timeoutMs, stream: req.body?.stream !== false });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const completion = result.steps.find((s) => s.step === 'completion');
  p.health = {
    status: result.ok ? 'healthy' : 'failing',
    checkedAt: new Date(),
    latencyMs: completion?.latencyMs ?? null,
    lastError: result.ok ? '' : (result.steps.find((s) => !s.ok)?.error?.message || 'Test failed'),
  };
  if (result.ok) p.lastKnownGood = configSnapshot(p);
  await p.save();
  invalidateAdminChain();
  await audit(req, 'admin.provider_tested', { target: String(p._id), outcome: result.ok ? 'success' : 'failure' });
  res.json({ result, provider: publicProvider(p.toObject()) });
};

/** Test a configuration before saving it (the key comes in the body and is not stored). */
export const testUnsavedProvider = async (req, res) => {
  const parsed = ProviderBody.pick({ adapter: true, baseUrl: true, apiKey: true, defaultModel: true, timeoutMs: true }).safeParse(req.body);
  if (!parsed.success || !parsed.data.apiKey) return res.status(400).json({ error: 'adapter, apiKey and defaultModel are required' });
  try {
    const baseUrl = await resolveBaseUrl(parsed.data.adapter, parsed.data.baseUrl);
    const result = await testProviderConfig({ baseUrl, apiKey: parsed.data.apiKey, model: parsed.data.defaultModel, timeoutMs: parsed.data.timeoutMs, stream: req.body?.stream !== false });
    await audit(req, 'admin.provider_tested', { target: 'unsaved', outcome: result.ok ? 'success' : 'failure', meta: { adapter: parsed.data.adapter } });
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const setProviderEnabled = async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Provider not found' });
  const p = await AiProvider.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  const enabled = req.body?.enabled === true;
  if (enabled && !(p.lastKnownGood && sameConfig(p.lastKnownGood, p))) {
    return res.status(409).json({ error: 'Run a successful test of the current configuration before enabling it.', code: 'TEST_REQUIRED' });
  }
  p.enabled = enabled;
  await p.save();
  invalidateAdminChain();
  await audit(req, enabled ? 'admin.provider_enabled' : 'admin.provider_disabled', { target: String(p._id) });
  res.json({ provider: publicProvider(p.toObject()) });
};

/** Restore the last tested configuration (base URL, models, default model). The key cannot be rolled back. */
export const rollbackProvider = async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Provider not found' });
  const p = await AiProvider.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  if (!p.lastKnownGood) return res.status(409).json({ error: 'This provider has never passed a test.' });
  if (p.lastKnownGood.keyIv !== p.iv) return res.status(409).json({ error: 'The API key was replaced after the last good test. Re-test with the new key, or replace it again.' });
  p.baseUrl = p.lastKnownGood.baseUrl;
  p.defaultModel = p.lastKnownGood.defaultModel;
  p.models = p.lastKnownGood.models;
  await p.save();
  invalidateAdminChain();
  await audit(req, 'admin.provider_rollback', { target: String(p._id) });
  res.json({ provider: publicProvider(p.toObject()) });
};

/** Send a test email to the signed-in admin's own address, to check the SMTP setup. */
export const sendTestEmail = async (req, res) => {
  const cfg = mailConfig();
  if (!cfg.configured) {
    return res.status(400).json({ error: 'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM on the server, then restart it.' });
  }
  const r = await sendEmail({ to: req.user.email, ...templates.smtpTest(req.user, cfg.host, cfg.port) });
  await audit(req, 'admin.mail_test', { outcome: r.success ? 'success' : 'failure' });
  if (r.success) return res.json({ success: true, to: req.user.email, messageId: r.id });
  res.status(502).json({ error: `Sending failed: ${describeMailError(r.error)}` });
};
