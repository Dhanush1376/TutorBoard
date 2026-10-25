import crypto from 'node:crypto';

/**
 * Proof that a trace is exactly what TutorBoard's sandbox run produced.
 *
 * C, C++ and Java traces are made on the server (traceService.ts), handed to the
 * browser, and sent back when the learner's walkthrough is saved. The server signs
 * each one when it is made, and only a trace whose signature still matches can be
 * saved as a real run — a client can't submit made-up steps as authoritative.
 * (Python and JavaScript are traced in the learner's own browser; those are saved
 * marked as browser-recorded, since no server saw the run.)
 *
 * The signature covers a canonical JSON form (object keys sorted), so it survives
 * the trip through JSON.parse/stringify on both ends.
 */

const VERSION = 'v1';

function secret(): string {
  return process.env.VISUALIZER_TRACE_SECRET || process.env.JWT_SECRET || '';
}

/** JSON with every object's keys sorted, `undefined` dropped as JSON.stringify does; the top-level `proof` is left out. */
export function canonicalJSON(value: unknown, top = true): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined || typeof v === 'function' ? 'null' : canonicalJSON(v, false))).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && typeof obj[k] !== 'function' && !(top && k === 'proof')).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k], false)}`).join(',')}}`;
}

const mac = (text: string, key: string) => crypto.createHmac('sha256', key).update(text).digest('hex');

/** The proof for a trace the server just produced, or null when no signing secret is configured. */
export function signTrace(trace: unknown): string | null {
  const key = secret();
  if (!key) return null;
  return `${VERSION}.${mac(canonicalJSON(trace), key)}`;
}

/** Whether `proof` was made by this server for exactly this trace. */
export function verifyTrace(trace: unknown, proof: unknown): boolean {
  const key = secret();
  if (!key || typeof proof !== 'string' || !proof.startsWith(`${VERSION}.`)) return false;
  const expected = Buffer.from(mac(canonicalJSON(trace), key), 'hex');
  const given = Buffer.from(proof.slice(VERSION.length + 1), 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
