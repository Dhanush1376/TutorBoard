/**
 * adminProviders.ts — platform AI providers configured in the admin portal.
 *
 * Every adapter here speaks the OpenAI chat-completions protocol; named
 * adapters pin a known base URL, `openai-compatible` accepts any endpoint that
 * passes the connection test (models list + a real completion). A protocol that
 * is not OpenAI-compatible needs its own adapter — it is never "supported" just
 * because a URL and key were pasted.
 *
 * Base URLs are checked against SSRF (https only, public addresses only, no
 * cloud metadata) when saved and again before every test.
 */
import OpenAI from 'openai';
import dns from 'dns/promises';
import net from 'net';
import AiProvider from '../../models/AiProvider.js';
import { decrypt } from '../auth/encryption.js';

export const ADAPTER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  together: 'https://api.together.xyz/v1',
};

// ── SSRF guard ──────────────────────────────────────────────────────────────

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('ff');
}

/** Throws a user-safe Error when `raw` is not an acceptable provider base URL. */
export async function assertSafeBaseUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Base URL is not a valid URL');
  }
  const allowPrivate = process.env.NODE_ENV !== 'production' && process.env.ALLOW_PRIVATE_AI_ENDPOINTS === 'true';
  if (url.protocol !== 'https:' && !(allowPrivate && url.protocol === 'http:')) throw new Error('Base URL must use https');
  if (url.username || url.password) throw new Error('Put credentials in the API key field, not the URL');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|metadata\.google\.internal|metadata)$/i.test(host) && !allowPrivate) throw new Error('Base URL must be a public address');
  if (!allowPrivate) {
    const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((a: any) => a.address);
    if (addrs.length === 0) throw new Error('Base URL host does not resolve');
    if (addrs.some(isPrivateAddress)) throw new Error('Base URL must be a public address');
  }
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

// ── Error normalisation ─────────────────────────────────────────────────────

export type ProviderErrorCode = 'auth_failed' | 'model_not_found' | 'rate_limited' | 'timeout' | 'upstream_error' | 'bad_request' | 'network' | 'unknown';

/** Map an SDK/HTTP error to a code + safe message (never the raw upstream body). */
export function normalizeProviderError(err: any): { code: ProviderErrorCode; message: string; permanent: boolean } {
  const status = err?.status ?? err?.response?.status;
  const msg = String(err?.message || '');
  if (status === 401 || status === 403) return { code: 'auth_failed', message: 'The provider rejected the API key (401/403).', permanent: true };
  if (status === 404) return { code: 'model_not_found', message: 'The model or endpoint was not found (404).', permanent: true };
  if (status === 429) return { code: 'rate_limited', message: 'The provider is rate limiting requests (429).', permanent: false };
  if (status === 400 || status === 422) return { code: 'bad_request', message: `The provider refused the request (${status}).`, permanent: true };
  if (typeof status === 'number' && status >= 500) return { code: 'upstream_error', message: `The provider had an internal error (${status}).`, permanent: false };
  if (/timeout|timed out|aborted/i.test(msg)) return { code: 'timeout', message: 'The provider did not answer in time.', permanent: false };
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed|network/i.test(msg)) return { code: 'network', message: 'Could not reach the provider.', permanent: false };
  return { code: 'unknown', message: 'The provider call failed.', permanent: false };
}

// ── Runtime chain ───────────────────────────────────────────────────────────

export interface AdminChainEntry {
  id: string; // `admin:<mongo id>` — also the circuit-breaker key
  name: string;
  client: OpenAI;
  model: string;
  capabilities: string[];
  dbId: string;
}

const CHAIN_TTL_MS = Number(process.env.PLATFORM_CONFIG_REFRESH_MS || 15000);
let chainCache: { at: number; entries: AdminChainEntry[] } = { at: 0, entries: [] };
let chainLoading: Promise<AdminChainEntry[]> | null = null;

export function buildClient(baseUrl: string, apiKey: string, timeoutMs: number): OpenAI {
  // retries are owned by the orchestrator (bounded, provider-aware), not the SDK
  return new OpenAI({ apiKey, baseURL: baseUrl, timeout: timeoutMs, maxRetries: 0 });
}

async function loadChain(): Promise<AdminChainEntry[]> {
  const rows: any[] = await AiProvider.find({ enabled: true }).sort({ priority: 1, createdAt: 1 }).lean();
  const out: AdminChainEntry[] = [];
  for (const p of rows) {
    try {
      const key = decrypt({ encrypted: p.encryptedKey, iv: p.iv, tag: p.tag });
      const model = (p.models || []).find((m: any) => m.id === p.defaultModel && m.enabled !== false);
      if (!model) continue;
      out.push({
        id: `admin:${p._id}`,
        name: p.name,
        client: buildClient(p.baseUrl, key, p.timeoutMs || 60000),
        model: model.id,
        capabilities: model.capabilities || ['text'],
        dbId: String(p._id),
      });
    } catch (err: any) {
      console.error(`[AI:Admin] provider ${p._id} skipped: ${err.message}`);
    }
  }
  return out;
}

/** Enabled admin providers in priority order, refreshed from the DB at most every CHAIN_TTL_MS. */
export async function getAdminChain(): Promise<AdminChainEntry[]> {
  if (Date.now() - chainCache.at < CHAIN_TTL_MS) return chainCache.entries;
  if (!chainLoading) {
    chainLoading = loadChain()
      .then((entries) => { chainCache = { at: Date.now(), entries }; return entries; })
      .catch((err) => { console.warn(`[AI:Admin] chain load failed: ${err.message}`); chainCache = { ...chainCache, at: Date.now() }; return chainCache.entries; })
      .finally(() => { chainLoading = null; });
  }
  return chainLoading;
}

export function invalidateAdminChain() {
  chainCache = { at: 0, entries: [] };
}

const lastHealthWrite = new Map<string, number>();
/** Record live-traffic outcome on the provider row (throttled; never blocks the request). */
export function recordProviderOutcome(dbId: string, ok: boolean, err?: any, latencyMs?: number) {
  const now = Date.now();
  if (now - (lastHealthWrite.get(dbId) || 0) < 30_000) return;
  lastHealthWrite.set(dbId, now);
  const n = ok ? null : normalizeProviderError(err);
  AiProvider.updateOne({ _id: dbId }, {
    $set: {
      'health.status': ok ? 'healthy' : (n!.permanent ? 'failing' : 'degraded'),
      'health.checkedAt': new Date(),
      'health.latencyMs': latencyMs ?? null,
      'health.lastError': ok ? '' : `${n!.code}: ${n!.message}`,
    },
  }).catch(() => {});
}

// ── Connection test ─────────────────────────────────────────────────────────

export interface ProviderTestResult {
  ok: boolean;
  steps: Array<{ step: 'models' | 'completion' | 'stream'; ok: boolean; latencyMs: number; detail?: string; error?: { code: string; message: string } }>;
  models?: string[];
}

/** Validate a configuration with real calls: list models (if supported), one completion, optionally one stream. */
export async function testProviderConfig(cfg: { baseUrl: string; apiKey: string; model: string; timeoutMs?: number; stream?: boolean }): Promise<ProviderTestResult> {
  const baseUrl = await assertSafeBaseUrl(cfg.baseUrl);
  const client = buildClient(baseUrl, cfg.apiKey, Math.min(cfg.timeoutMs || 30000, 60000));
  const result: ProviderTestResult = { ok: false, steps: [] };

  let t = Date.now();
  try {
    const list = await client.models.list();
    const ids: string[] = [];
    for await (const m of list) { ids.push((m as any).id); if (ids.length >= 500) break; }
    result.models = ids;
    const listed = ids.length === 0 || ids.includes(cfg.model) || ids.some((id) => id.endsWith(`/${cfg.model}`) || cfg.model.endsWith(`/${id}`));
    result.steps.push({ step: 'models', ok: true, latencyMs: Date.now() - t, detail: listed ? `${ids.length} models listed` : `${ids.length} models listed; "${cfg.model}" is not among them` });
  } catch (err) {
    const n = normalizeProviderError(err);
    // some compatible servers do not implement /models; a key failure here is still fatal
    result.steps.push({ step: 'models', ok: n.code !== 'auth_failed', latencyMs: Date.now() - t, detail: n.code === 'auth_failed' ? undefined : 'Model listing not supported', error: n.code === 'auth_failed' ? n : undefined });
    if (n.code === 'auth_failed') return result;
  }

  t = Date.now();
  try {
    const r: any = await client.chat.completions.create({
      model: cfg.model,
      messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
      max_tokens: 16,
      temperature: 0,
    });
    const text = r?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw Object.assign(new Error('Response is not in chat-completions format'), { status: 422 });
    result.steps.push({ step: 'completion', ok: true, latencyMs: Date.now() - t, detail: `Answered "${text.trim().slice(0, 40)}"` });
  } catch (err) {
    result.steps.push({ step: 'completion', ok: false, latencyMs: Date.now() - t, error: normalizeProviderError(err) });
    return result;
  }

  if (cfg.stream) {
    t = Date.now();
    try {
      const s: any = await client.chat.completions.create({
        model: cfg.model,
        messages: [{ role: 'user', content: 'Count from 1 to 3.' }],
        max_tokens: 24,
        stream: true,
      });
      let chunks = 0;
      for await (const c of s) { if (c?.choices?.[0]?.delta?.content) chunks++; }
      if (chunks === 0) throw Object.assign(new Error('Stream produced no content'), { status: 422 });
      result.steps.push({ step: 'stream', ok: true, latencyMs: Date.now() - t, detail: `${chunks} chunks` });
    } catch (err) {
      result.steps.push({ step: 'stream', ok: false, latencyMs: Date.now() - t, error: normalizeProviderError(err) });
      return result;
    }
  }

  result.ok = result.steps.every((s) => s.ok);
  return result;
}
