/**
 * Walks a scene's beats once to learn what data structures will do: every
 * value that will ever exist becomes an "item" with a stable key, every
 * index reference (`arr[2]`) is resolved to the item at that slot *at that
 * moment*, and every operation is recorded with the order it leaves behind.
 * Layout (max lengths) and the timeline compiler both read from this, so the
 * animation is deterministic and seekable.
 */
import type { Action, Entity, Scene } from './types';
import { INDEXED, parseRef } from './types';

/** `value` is the item's value when it first appears; later `set`s are timeline changes. */
export type Item = { key: string; value: string | number };

export type OpRecord =
  | { kind: 'swap'; id: string; a: string; b: string; order: string[] }
  | { kind: 'enter'; id: string; key: string; order: string[] }
  | { kind: 'exit'; id: string; key: string; order: string[]; from: 'top' | 'front' | 'end' | 'middle' }
  | { kind: 'morph'; id: string; order: string[]; entering: string[]; exiting: string[] }
  | { kind: 'set'; id: string; key: string; value: string | number };

export type Sim = {
  items: Map<string, Item[]>;
  initial: Map<string, string[]>;
  maxLen: Map<string, number>;
  op: (beat: number, action: number) => OpRecord | undefined;
  /** item key behind an index ref at the moment an action runs */
  keyAt: (beat: number, action: number, ref: string) => string | undefined;
  itemByKey: (key: string) => Item | undefined;
};

const valuesOf = (e: Entity): (string | number)[] => ('values' in e ? (e.values as (string | number)[]) : []);

export function simulate(scene: Scene): Sim {
  const items = new Map<string, Item[]>();
  const byKey = new Map<string, Item>();
  const initial = new Map<string, string[]>();
  const order = new Map<string, string[]>();
  const maxLen = new Map<string, number>();
  const ops = new Map<string, OpRecord>();
  const refs = new Map<string, string>();
  const counter = new Map<string, number>();
  const current = new Map<string, string | number>(); // value an item shows right now

  const newItem = (id: string, value: string | number) => {
    const n = counter.get(id) ?? 0;
    counter.set(id, n + 1);
    const it = { key: `${id}#${n}`, value };
    items.get(id)!.push(it);
    byKey.set(it.key, it);
    current.set(it.key, value);
    return it;
  };

  for (const e of scene.entities) {
    if (!INDEXED.has(e.type)) continue;
    items.set(e.id, []);
    const keys = valuesOf(e).map((v) => newItem(e.id, v).key);
    initial.set(e.id, [...keys]);
    order.set(e.id, [...keys]);
    maxLen.set(e.id, keys.length);
  }

  const note = (id: string) => maxLen.set(id, Math.max(maxLen.get(id) ?? 0, order.get(id)!.length));
  const refsIn = (a: Action): string[] => {
    const out: string[] = [];
    const add = (t: unknown) => {
      if (typeof t === 'string') out.push(t);
      else if (Array.isArray(t)) t.forEach(add);
    };
    if ('target' in a) add(a.target);
    if (a.do === 'connect') { add(a.from); add(a.to); }
    if (a.do === 'exchange') { add(a.a); add(a.b); }
    return out;
  };

  scene.beats.forEach((beat, b) => {
    beat.actions.forEach((a, k) => {
      // resolve index refs against the order *before* this action
      for (const r of refsIn(a)) {
        const { base, index } = parseRef(r);
        if (index !== undefined && order.has(base)) {
          const key = order.get(base)![index];
          if (key) refs.set(`${b}:${k}:${r}`, key);
        }
      }
      if (a.do === 'exchange') {
        const ra = parseRef(a.a), rb = parseRef(a.b);
        const cur = order.get(ra.base);
        if (cur && ra.base === rb.base && ra.index !== undefined && rb.index !== undefined && cur[ra.index] && cur[rb.index]) {
          const ka = cur[ra.index], kb = cur[rb.index];
          cur[ra.index] = kb;
          cur[rb.index] = ka;
          ops.set(`${b}:${k}`, { kind: 'swap', id: ra.base, a: ka, b: kb, order: [...cur] });
        }
        return;
      }
      const id = 'target' in a && typeof a.target === 'string' ? parseRef(a.target).base : '';
      const cur = order.get(id);
      if (!cur) return;
      const rec = (r: OpRecord) => ops.set(`${b}:${k}`, r);
      switch (a.do) {
        case 'swap': {
          const ka = cur[a.i];
          const kb = cur[a.j];
          if (!ka || !kb) break;
          cur[a.i] = kb;
          cur[a.j] = ka;
          rec({ kind: 'swap', id, a: ka, b: kb, order: [...cur] });
          break;
        }
        case 'push':
        case 'enqueue':
        case 'insert': {
          const it = newItem(id, a.value);
          const at = a.do === 'insert' ? Math.min(a.at, cur.length) : cur.length;
          cur.splice(at, 0, it.key);
          note(id);
          rec({ kind: 'enter', id, key: it.key, order: [...cur] });
          break;
        }
        case 'pop':
        case 'dequeue':
        case 'delete': {
          if (!cur.length) break;
          const at = a.do === 'pop' ? cur.length - 1 : a.do === 'dequeue' ? 0 : Math.min(a.at, cur.length - 1);
          const [key] = cur.splice(at, 1);
          const from = a.do === 'pop' ? 'top' : a.do === 'dequeue' ? 'front' : at === cur.length ? 'end' : 'middle';
          rec({ kind: 'exit', id, key, order: [...cur], from });
          break;
        }
        case 'morph': {
          const pool = cur.map((key) => ({ key, v: String(current.get(key)), used: false }));
          const next: string[] = [];
          const entering: string[] = [];
          for (const v of a.values) {
            const hit = pool.find((p) => !p.used && p.v === String(v));
            if (hit) { hit.used = true; next.push(hit.key); } else { const it = newItem(id, v); next.push(it.key); entering.push(it.key); }
          }
          const exiting = pool.filter((p) => !p.used).map((p) => p.key);
          order.set(id, next);
          note(id);
          rec({ kind: 'morph', id, order: [...next], entering, exiting });
          break;
        }
        case 'set': {
          const { index } = parseRef(a.target);
          if (index === undefined || a.value === undefined) break;
          const key = cur[index];
          if (!key) break;
          current.set(key, a.value);
          rec({ kind: 'set', id, key, value: a.value });
          break;
        }
        default:
          break;
      }
    });
  });

  return {
    items,
    initial,
    maxLen,
    op: (b, k) => ops.get(`${b}:${k}`),
    keyAt: (b, k, ref) => refs.get(`${b}:${k}:${ref}`),
    itemByKey: (key) => byKey.get(key),
  };
}
