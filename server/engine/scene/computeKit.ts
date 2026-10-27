/**
 * Shared pieces of computed traces (algorithms.ts, ml.ts): the generator
 * contract, the error a generator throws for bad input, and small helpers.
 */
export type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Issue = { path: string; message: string };
export type Act = Loose;
export type GenBeat = { title: string; narration: string; actions: Act[] };
export type Gen = { beats: GenBeat[]; entities?: Loose[]; layout?: Loose[]; spaces?: Loose[]; data?: 'given' | 'illustrative' };
export type Ctx = { scene: Loose; target: string; entity?: Loose; args: Loose; fail: (msg: string) => never };

export class ComputeError extends Error {}

export const MAX_TARGETS = 12;
/** Highlight many refs: one action per 12 (the action's limit). */
export const hl = (refs: string[], state: string, hold = true): Act[] => {
  const out: Act[] = [];
  for (let i = 0; i < refs.length; i += MAX_TARGETS) out.push({ do: 'highlight', target: refs.slice(i, i + MAX_TARGETS), state, ...(hold ? {} : { hold: false }) });
  return out;
};
export const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
export const list = (xs: unknown[]) => (xs.length <= 1 ? String(xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
export const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN);

export const caption = (id: string, text: string, rel: Loose): { entity: Loose; layout: Loose } => ({
  entity: { id, type: 'text', text, role: 'caption' },
  layout: rel,
});
