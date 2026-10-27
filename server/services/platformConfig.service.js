import { z } from 'zod';
import PlatformConfig from '../models/PlatformConfig.js';

/**
 * Runtime platform settings, editable from the admin portal.
 *
 * Source of truth is the newest PlatformConfig version in MongoDB. Each app
 * instance caches it and re-reads at most every REFRESH_MS, so a change made on
 * one instance reaches every instance within that bound — no browser state, no
 * .env edit, no restart. Every key has a schema and a safe default; an invalid
 * stored document falls back to the last valid one instead of breaking requests.
 */

export const SettingsSchema = z.object({
  maintenance: z.object({
    enabled: z.boolean(),
    message: z.string().max(300),
  }).strict(),
  auth: z.object({
    registrationEnabled: z.boolean(),
    requireEmailVerification: z.boolean(),
    providers: z.object({
      password: z.boolean(),
      google: z.boolean(),
      github: z.boolean(),
    }).strict(),
  }).strict(),
  guest: z.object({
    enabled: z.boolean(),
  }).strict(),
  ai: z.object({
    // admin-configured providers run before the environment-keyed ones
    useAdminProviders: z.boolean(),
    // keep the env providers (GEMINI/OPENROUTER/GROQ keys) as the final fallback
    envFallback: z.boolean(),
  }).strict(),
}).strict();

export const DEFAULT_SETTINGS = Object.freeze({
  maintenance: { enabled: false, message: '' },
  auth: {
    registrationEnabled: true,
    requireEmailVerification: false,
    providers: { password: true, google: true, github: true },
  },
  guest: { enabled: true },
  ai: { useAdminProviders: true, envFallback: true },
});

const REFRESH_MS = Number(process.env.PLATFORM_CONFIG_REFRESH_MS || 15000);

let cache = { version: 0, settings: DEFAULT_SETTINGS, loadedAt: 0 };
let inflight = null;

function merge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

async function load() {
  // newest version that still validates (a bad write never takes the platform down)
  const rows = await PlatformConfig.find().sort({ version: -1 }).limit(5).lean();
  for (const row of rows) {
    const parsed = SettingsSchema.safeParse(merge(DEFAULT_SETTINGS, row.settings));
    if (parsed.success) return { version: row.version, settings: parsed.data, loadedAt: Date.now() };
    console.error(`[PlatformConfig] version ${row.version} is invalid, skipping`);
  }
  return { version: rows[0]?.version ?? 0, settings: DEFAULT_SETTINGS, loadedAt: Date.now() };
}

/** Current settings, refreshed from the database when the cache is older than REFRESH_MS. */
export async function getPlatformSettings({ fresh = false } = {}) {
  if (!fresh && Date.now() - cache.loadedAt < REFRESH_MS) return cache.settings;
  if (!inflight) {
    inflight = load()
      .then((c) => { cache = c; })
      .catch((err) => {
        // keep serving the last good settings; retry on the next call after a short pause
        console.warn(`[PlatformConfig] refresh failed: ${err.message}`);
        cache = { ...cache, loadedAt: Date.now() - REFRESH_MS + 2000 };
      })
      .finally(() => { inflight = null; });
  }
  await inflight;
  return cache.settings;
}

export function getCachedVersion() {
  return cache.version;
}

/**
 * Apply a partial update as a new version. `expectedVersion` (optimistic
 * concurrency) rejects a save made from a stale admin screen.
 */
export async function updatePlatformSettings(patch, { actorId, note = '', expectedVersion } = {}) {
  await getPlatformSettings({ fresh: true });
  if (expectedVersion !== undefined && expectedVersion !== cache.version) {
    const err = new Error('Settings changed since you loaded them. Reload and try again.');
    err.status = 409;
    err.code = 'CONFIG_VERSION_CONFLICT';
    throw err;
  }
  const next = SettingsSchema.safeParse(merge(cache.settings, patch));
  if (!next.success) {
    const err = new Error('Invalid settings: ' + next.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    err.status = 400;
    err.code = 'CONFIG_INVALID';
    throw err;
  }
  const version = cache.version + 1;
  try {
    await PlatformConfig.create({ version, settings: next.data, changedBy: actorId, note });
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('Another administrator saved settings at the same time. Reload and try again.');
      err.status = 409;
      err.code = 'CONFIG_VERSION_CONFLICT';
      throw err;
    }
    throw e;
  }
  cache = { version, settings: next.data, loadedAt: Date.now() };
  return cache;
}

export async function rollbackPlatformSettings(toVersion, { actorId } = {}) {
  const row = await PlatformConfig.findOne({ version: toVersion }).lean();
  if (!row) {
    const err = new Error('No such settings version');
    err.status = 404;
    throw err;
  }
  await getPlatformSettings({ fresh: true });
  const parsed = SettingsSchema.safeParse(merge(DEFAULT_SETTINGS, row.settings));
  if (!parsed.success) {
    const err = new Error('That version is not valid under the current schema');
    err.status = 400;
    throw err;
  }
  const version = cache.version + 1;
  await PlatformConfig.create({ version, settings: parsed.data, changedBy: actorId, note: `Rollback to v${toVersion}`, rolledBackFrom: toVersion });
  cache = { version, settings: parsed.data, loadedAt: Date.now() };
  return cache;
}

export async function listPlatformVersions(limit = 20) {
  return PlatformConfig.find().sort({ version: -1 }).limit(limit).select('version changedBy note rolledBackFrom createdAt').lean();
}

/** test hook */
export function _resetPlatformConfigCache() {
  cache = { version: 0, settings: DEFAULT_SETTINGS, loadedAt: 0 };
}
