/**
 * Logic circuits — shared by the validator, computed truth tables and the renderer.
 *
 * Inputs feed gates, gates feed gates and outputs. `checkLogic` refuses missing
 * references, wrong input counts and feedback loops (combinational circuits
 * only); `evalLogic` computes every signal for one input assignment; a table in
 * the scene whose columns name the inputs and an output is checked row by row
 * against it. `layoutLogic` places inputs, gates by depth and outputs in columns.
 */

export type GateOp = 'and' | 'or' | 'not' | 'nand' | 'nor' | 'xor' | 'xnor' | 'buf';
export type Logic = { id: string; inputs: string[]; gates: { id: string; op: GateOp; in: string[] }[]; outputs: { id: string; from: string }[] };

const ARITY: Record<GateOp, [number, number]> = { not: [1, 1], buf: [1, 1], and: [2, 4], or: [2, 4], nand: [2, 4], nor: [2, 4], xor: [2, 4], xnor: [2, 4] };

export function checkLogic(l: Logic): string[] {
  const out: string[] = [];
  const names = new Set<string>();
  for (const id of [...l.inputs, ...l.gates.map((g) => g.id), ...l.outputs.map((o) => o.id)]) {
    if (names.has(id)) out.push(`the name "${id}" is used twice`);
    names.add(id);
  }
  const sources = new Set([...l.inputs, ...l.gates.map((g) => g.id)]);
  for (const g of l.gates) {
    const [lo, hi] = ARITY[g.op];
    if (g.in.length < lo || g.in.length > hi) out.push(`${g.op.toUpperCase()} gate "${g.id}" takes ${lo === hi ? lo : `${lo}–${hi}`} input${hi > 1 ? 's' : ''}, not ${g.in.length}`);
    for (const s of g.in) if (!sources.has(s)) out.push(`gate "${g.id}" reads "${s}", which is not an input or a gate`);
  }
  for (const o of l.outputs) if (!sources.has(o.from)) out.push(`output "${o.id}" reads "${o.from}", which is not an input or a gate`);
  // feedback loops: a gate that (through others) reads itself
  const byId = new Map(l.gates.map((g) => [g.id, g]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 2 || !byId.has(id)) return;
    if (state.get(id) === 1) { out.push(`feedback loop ${[...path.slice(path.indexOf(id)), id].join(' → ')}: only combinational logic (no loops) is supported`); return; }
    state.set(id, 1);
    for (const s of byId.get(id)!.in) visit(s, [...path, id]);
    state.set(id, 2);
  };
  for (const g of l.gates) visit(g.id, []);
  const used = new Set([...l.gates.flatMap((g) => g.in), ...l.outputs.map((o) => o.from)]);
  for (const i of l.inputs) if (!used.has(i)) out.push(`input "${i}" isn't connected to anything`);
  if (!l.outputs.length) out.push('the circuit has no output');
  return out;
}

const OPS: Record<GateOp, (v: number[]) => number> = {
  and: (v) => +v.every(Boolean), or: (v) => +v.some(Boolean), not: (v) => +!v[0], buf: (v) => v[0],
  nand: (v) => +!v.every(Boolean), nor: (v) => +!v.some(Boolean),
  xor: (v) => v.reduce((a, b) => a ^ b, 0), xnor: (v) => +!v.reduce((a, b) => a ^ b, 0),
};

/** Every signal's value (inputs, gates, outputs) for one assignment of the inputs. */
export function evalLogic(l: Logic, inputs: Record<string, number>): Map<string, number> {
  const val = new Map<string, number>(l.inputs.map((i) => [i, inputs[i] ? 1 : 0]));
  const byId = new Map(l.gates.map((g) => [g.id, g]));
  const get = (id: string): number => {
    if (val.has(id)) return val.get(id)!;
    const g = byId.get(id)!;
    const v = OPS[g.op](g.in.map(get));
    val.set(id, v);
    return v;
  };
  for (const g of l.gates) get(g.id);
  for (const o of l.outputs) val.set(o.id, get(o.from));
  return val;
}

/** All 2ⁿ rows, inputs counting up in binary (first input most significant). */
export function truthRows(l: Logic): Map<string, number>[] {
  const n = l.inputs.length;
  return Array.from({ length: 2 ** n }, (_, r) => evalLogic(l, Object.fromEntries(l.inputs.map((name, k) => [name, (r >> (n - 1 - k)) & 1]))));
}

/** Check a truth table (columns → rows) against the circuit: the rows it gets wrong, with the right value. */
export function checkTruthTable(l: Logic, columns: string[], rows: (string | number)[][]): string[] {
  const col = (name: string) => columns.findIndex((c) => c.trim().toLowerCase() === name.toLowerCase());
  const inIdx = l.inputs.map(col);
  const outs = l.outputs.map((o) => ({ id: o.id, k: col(o.id) })).filter((o) => o.k >= 0);
  if (inIdx.some((k) => k < 0) || !outs.length) return [];
  const bit = (v: unknown) => (String(v).trim() === '1' || String(v).toLowerCase() === 'true' ? 1 : String(v).trim() === '0' || String(v).toLowerCase() === 'false' ? 0 : NaN);
  const problems: string[] = [];
  rows.forEach((row, r) => {
    const ins = Object.fromEntries(l.inputs.map((name, k) => [name, bit(row[inIdx[k]])]));
    if (Object.values(ins).some(Number.isNaN)) return; // a heading or a non-binary row
    const v = evalLogic(l, ins);
    for (const o of outs) {
      const said = bit(row[o.k]);
      if (said !== v.get(o.id)) problems.push(`row ${r + 1} (${l.inputs.map((name) => `${name}=${ins[name]}`).join(', ')}): ${o.id} is ${v.get(o.id)}, the table says ${row[o.k]}`);
    }
  });
  return problems;
}

// ── layout ───────────────────────────────────────────────────────────────────

export type LPt = { x: number; y: number };
export type LogicLayout = { w: number; h: number; nodes: Map<string, { at: LPt; kind: 'input' | 'gate' | 'output'; op?: GateOp; pins: LPt[]; out: LPt }>; wires: { from: string; to: string; pin: number; path: LPt[] }[] };

const COL = 170, ROW = 92;

export function layoutLogic(l: Logic): LogicLayout {
  const byId = new Map(l.gates.map((g) => [g.id, g]));
  const depth = new Map<string, number>(l.inputs.map((i) => [i, 0]));
  const d = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    const g = byId.get(id);
    const v = g ? 1 + Math.max(0, ...g.in.map(d)) : 0;
    depth.set(id, v);
    return v;
  };
  l.gates.forEach((g) => d(g.id));
  const maxD = Math.max(1, ...l.gates.map((g) => d(g.id)));
  const cols = new Map<number, string[]>();
  const put = (id: string, c: number) => cols.set(c, [...(cols.get(c) ?? []), id]);
  l.inputs.forEach((i) => put(i, 0));
  l.gates.forEach((g) => put(g.id, d(g.id)));
  l.outputs.forEach((o) => put(o.id, maxD + 1));
  // order gates by the mean row of what feeds them, so wires stay short and mostly straight
  const rowOf = new Map<string, number>();
  for (let c = 0; c <= maxD + 1; c++) {
    const ids = cols.get(c) ?? [];
    if (c > 0) ids.sort((a, b) => feedRow(a) - feedRow(b));
    ids.forEach((id, k) => rowOf.set(id, k - (ids.length - 1) / 2));
  }
  function feedRow(id: string) {
    const srcs = byId.get(id)?.in ?? [l.outputs.find((o) => o.id === id)?.from ?? ''];
    const rs = srcs.map((s) => rowOf.get(s) ?? 0);
    return rs.reduce((s, v) => s + v, 0) / (rs.length || 1);
  }
  const maxRows = Math.max(...[...cols.values()].map((v) => v.length));
  const nodes: LogicLayout['nodes'] = new Map();
  const at = (id: string, c: number): LPt => ({ x: 60 + c * COL, y: 40 + ((maxRows - 1) / 2 + rowOf.get(id)!) * ROW });
  for (const i of l.inputs) { const p = at(i, 0); nodes.set(i, { at: p, kind: 'input', pins: [], out: { x: p.x + 18, y: p.y } }); }
  for (const g of l.gates) {
    const p = at(g.id, d(g.id));
    const n = g.in.length;
    nodes.set(g.id, { at: p, kind: 'gate', op: g.op, pins: g.in.map((_, k) => ({ x: p.x - 34, y: p.y + (n === 1 ? 0 : -14 + (28 * k) / (n - 1)) })), out: { x: p.x + 40 + (/^n|^xn/.test(g.op) ? 8 : 0), y: p.y } });
  }
  for (const o of l.outputs) { const p = at(o.id, maxD + 1); nodes.set(o.id, { at: p, kind: 'output', pins: [{ x: p.x - 18, y: p.y }], out: p }); }
  const wires: LogicLayout['wires'] = [];
  const dests = [...l.gates.map((g) => ({ id: g.id, ins: g.in })), ...l.outputs.map((o) => ({ id: o.id, ins: [o.from] }))];
  // each wire bends once, at its own x between the columns, so parallel wires don't overlap
  const bendsUsed = new Map<number, number>();
  for (const dst of dests) dst.ins.forEach((src, pin) => {
    const a = nodes.get(src)!.out, b = nodes.get(dst.id)!.pins[pin];
    const col = Math.round((b.x - 60) / COL);
    const k = bendsUsed.get(col) ?? 0;
    bendsUsed.set(col, k + 1);
    const bx = b.x - 20 - (k % 5) * 10;
    wires.push({ from: src, to: dst.id, pin, path: Math.abs(a.y - b.y) < 0.5 ? [a, b] : [a, { x: bx, y: a.y }, { x: bx, y: b.y }, b] });
  });
  return { w: 120 + (maxD + 1) * COL, h: 80 + (maxRows - 1) * ROW, nodes, wires };
}
