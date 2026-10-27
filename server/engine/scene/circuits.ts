/**
 * Circuits — shared by the validator, the computed traces and the client renderer.
 *
 * A circuit is two-terminal components joined at named nets. Nothing the model
 * writes about voltages or currents is trusted: `checkCircuit` refuses circuits
 * that aren't closed, short a battery or can't be solved, `solveDC` runs
 * modified nodal analysis (capacitors open at steady state; ammeters, wires and
 * closed switches carry the currents they must), and `thevenin` gives the
 * equivalent a capacitor sees, for RC charging. `layoutCircuit` draws it as a
 * ladder: the source upright on the left, ground as the bottom rail, series
 * parts along the top and parts to ground as rungs — how textbooks draw
 * dividers, parallel branches and RC circuits.
 */

export type CompKind = 'battery' | 'resistor' | 'lamp' | 'capacitor' | 'switch' | 'wire' | 'ammeter' | 'voltmeter';
export type Comp = { id: string; kind: CompKind; from: string; to: string; value?: number; closed?: boolean; label?: string };
export type Circuit = { id: string; components: Comp[]; ground?: string };
type Issue = { message: string; comp?: string };

const NEEDS_VALUE: Partial<Record<CompKind, string>> = { battery: 'volts', resistor: 'ohms', lamp: 'ohms', capacitor: 'farads' };

/** The ground net: given, else the − terminal of the first battery, else the first net. */
export const groundOf = (c: Circuit) => c.ground ?? c.components.find((x) => x.kind === 'battery')?.from ?? c.components[0]?.from ?? '';

/** Union–find over nets joined by wires (no resistance, no meter). */
function unionWires(c: Circuit) {
  const parent = new Map<string, string>();
  const find = (n: string): string => { if (!parent.has(n)) parent.set(n, n); const p = parent.get(n)!; if (p === n) return n; const r = find(p); parent.set(n, r); return r; };
  for (const x of c.components) { find(x.from); find(x.to); if (x.kind === 'wire') parent.set(find(x.from), find(x.to)); }
  return find;
}

/** Structural problems (before any solving). */
export function checkCircuit(c: Circuit): Issue[] {
  const out: Issue[] = [];
  const ids = new Set<string>();
  const touches = new Map<string, string[]>();
  for (const x of c.components) {
    if (ids.has(x.id)) out.push({ comp: x.id, message: `two components are called "${x.id}"` });
    ids.add(x.id);
    const unit = NEEDS_VALUE[x.kind];
    if (unit && !(typeof x.value === 'number' && Number.isFinite(x.value) && (x.kind === 'battery' ? x.value !== 0 : x.value > 0))) out.push({ comp: x.id, message: `${x.kind} "${x.id}" needs a ${x.kind === 'battery' ? 'non-zero' : 'positive'} "value" in ${unit}` });
    if (x.from === x.to) out.push({ comp: x.id, message: `both ends of "${x.id}" are on net "${x.from}", so it does nothing — connect it between two different nets` });
    for (const n of [x.from, x.to]) touches.set(n, [...(touches.get(n) ?? []), x.id]);
  }
  for (const [net, on] of touches) if (on.length < 2) out.push({ comp: on[0], message: `net "${net}" only touches "${on[0]}": that terminal is dangling and the circuit isn't closed there` });
  if (!c.components.some((x) => x.kind === 'battery')) out.push({ message: 'there is no battery (source) — nothing drives a current' });
  // connected?
  const nets = [...touches.keys()];
  const seen = new Set([nets[0]]);
  for (let grew = true; grew;) {
    grew = false;
    for (const x of c.components) if (seen.has(x.from) !== seen.has(x.to)) { seen.add(x.from); seen.add(x.to); grew = true; }
  }
  const apart = nets.filter((n) => !seen.has(n));
  if (apart.length) out.push({ message: `nets ${apart.map((n) => `"${n}"`).join(', ')} aren't connected to the rest of the circuit` });
  // a battery shorted by wires
  const find = unionWires(c);
  for (const x of c.components) if (x.kind === 'battery' && x.from !== x.to && find(x.from) === find(x.to)) out.push({ comp: x.id, message: `"${x.id}" is short-circuited: wires join its two terminals directly, so no current is limited` });
  if (c.ground !== undefined && !touches.has(c.ground)) out.push({ message: `"ground" is "${c.ground}", which isn't a net of this circuit` });
  return out;
}

export type DC = {
  /** volts at each net (ground = 0) */
  v: Map<string, number>;
  /** current through each component, positive from its "from" terminal to its "to" terminal (batteries: out of +) */
  i: Map<string, number>;
  /** voltage across each component, V(from) − V(to) */
  drop: Map<string, number>;
};

/**
 * Steady-state DC solution by modified nodal analysis. Wires join nets;
 * ammeters and closed switches are 0 V sources (their currents are unknowns);
 * capacitors, open switches and voltmeters carry no current. Extra
 * `sources` (current sources between nets) are for Thévenin tests.
 * Throws with a reason when the circuit has no consistent solution.
 */
export function solveDC(c: Circuit, extra: { shortBatteries?: boolean; inject?: { from: string; to: string; amps: number }; openCaps?: boolean } = {}): DC {
  const find = unionWires(c);
  const g = find(groundOf(c));
  const nodes = [...new Set(c.components.flatMap((x) => [find(x.from), find(x.to)]))].filter((n) => n !== g);
  const idx = new Map(nodes.map((n, k) => [n, k]));
  const vsrc = c.components.filter((x) => x.kind === 'battery' || x.kind === 'ammeter' || (x.kind === 'switch' && x.closed !== false));
  const n = nodes.length, m = vsrc.length, N = n + m;
  const A = Array.from({ length: N }, () => Array(N + 1).fill(0));
  const at = (net: string) => idx.get(find(net));
  const stampG = (a: string, b: string, gv: number) => {
    const ia = at(a), ib = at(b);
    if (ia !== undefined) A[ia][ia] += gv;
    if (ib !== undefined) A[ib][ib] += gv;
    if (ia !== undefined && ib !== undefined) { A[ia][ib] -= gv; A[ib][ia] -= gv; }
  };
  // a node joined to ground only through capacitors (or open switches, voltmeters) has no DC value of its own:
  // give just those a tiny path to ground, so the rest of the circuit solves exactly
  const conducts = (x: Comp) => x.kind === 'resistor' || x.kind === 'lamp' || x.kind === 'battery' || x.kind === 'ammeter' || (x.kind === 'switch' && x.closed !== false);
  const reach = new Set([g]);
  for (let grew = true; grew;) {
    grew = false;
    for (const x of c.components) if (conducts(x) && reach.has(find(x.from)) !== reach.has(find(x.to))) { reach.add(find(x.from)); reach.add(find(x.to)); grew = true; }
  }
  nodes.forEach((nd, k) => { if (!reach.has(nd)) A[k][k] += 1e-9; });
  for (const x of c.components) if (x.kind === 'resistor' || x.kind === 'lamp') stampG(x.from, x.to, 1 / x.value!);
  vsrc.forEach((x, k) => {
    // V(to) − V(from) = value  (batteries: "to" is +; meters and switches: 0)
    const ia = at(x.from), ib = at(x.to);
    if (ib !== undefined) { A[ib][n + k] += 1; A[n + k][ib] += 1; }
    if (ia !== undefined) { A[ia][n + k] -= 1; A[n + k][ia] -= 1; }
    A[n + k][N] = x.kind === 'battery' && !extra.shortBatteries ? x.value! : 0;
  });
  if (extra.inject) {
    const ia = at(extra.inject.from), ib = at(extra.inject.to);
    if (ia !== undefined) A[ia][N] -= extra.inject.amps;
    if (ib !== undefined) A[ib][N] += extra.inject.amps;
  }
  // Gaussian elimination with partial pivoting
  for (let col = 0; col < N; col++) {
    let piv = col;
    for (let r = col + 1; r < N; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) throw new Error('the circuit has no consistent solution — two sources (batteries, ammeters or closed switches) form a loop with no resistance');
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < N; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      if (f) for (let k = col; k <= N; k++) A[r][k] -= f * A[col][k];
    }
  }
  const x = A.map((row, r) => row[N] / row[r]);
  const volt = (net: string) => { const k = at(net); return k === undefined ? 0 : x[k]; };
  const v = new Map<string, number>();
  for (const comp of c.components) for (const net of [comp.from, comp.to]) v.set(net, clean(volt(net)));
  const i = new Map<string, number>(), drop = new Map<string, number>();
  for (const comp of c.components) {
    drop.set(comp.id, clean(volt(comp.from) - volt(comp.to)));
    if (comp.kind === 'resistor' || comp.kind === 'lamp') i.set(comp.id, clean((volt(comp.from) - volt(comp.to)) / comp.value!));
    else if (vsrc.includes(comp)) {
      // MNA's unknown is the current entering the source at "to"; flowing from→to inside means out of "to" into the circuit
      const k = vsrc.indexOf(comp);
      i.set(comp.id, clean(comp.kind === 'battery' ? -x[n + k] : -x[n + k]));
    } else if (comp.kind === 'wire') i.set(comp.id, NaN); // not tracked: wires are merged
    else i.set(comp.id, 0);
  }
  return { v, i, drop };
}
const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Number(v.toPrecision(10)));

/** Thévenin equivalent across a capacitor (or any two nets): open-circuit voltage V(to) − V(from) and resistance. */
export function thevenin(c: Circuit, a: string, b: string): { voc: number; rth: number } {
  const open: Circuit = { ...c, components: c.components.filter((x) => x.kind !== 'capacitor') };
  const dc = solveDC(open);
  const voc = (dc.v.get(b) ?? 0) - (dc.v.get(a) ?? 0);
  const test = solveDC(open, { shortBatteries: true, inject: { from: a, to: b, amps: 1 } });
  const rth = (test.v.get(b) ?? 0) - (test.v.get(a) ?? 0);
  return { voc: clean(voc), rth: clean(rth) };
}

// ── layout ───────────────────────────────────────────────────────────────────

export type Pt = { x: number; y: number };
/** Where a component's symbol sits (between a and b) and the wires that lead to it. */
export type PlacedComp = { id: string; a: Pt; b: Pt; vertical: boolean; leads: Pt[][] };
export type CircuitLayout = { w: number; h: number; comps: Map<string, PlacedComp>; wires: Pt[][]; dots: Pt[]; nets: Map<string, Pt> };

const U = 150; // grid unit, px
const RAIL_GAP = 1.6;

export function layoutCircuit(c: Circuit): CircuitLayout {
  const G = groundOf(c);
  const comps = new Map<string, PlacedComp>();
  const wires: Pt[][] = [];
  const P = (x: number, y: number): Pt => ({ x: x * U, y: y * U });
  const src = c.components.find((x) => x.kind === 'battery' && (x.from === G || x.to === G)) ?? c.components.find((x) => x.kind === 'battery');
  const top = src ? (src.from === G ? src.to : src.from) : c.components[0]?.to ?? '';
  const spans = new Map<string, { x0: number; x1: number; row: number }>();
  const placed = new Set<string>(src ? [src.id] : []);
  let cursorMax = 0;
  const rowY = (row: number) => -row * 1.25;
  const yG = RAIL_GAP;

  // recursive ladder: a net's segment, its rungs, then the chain of series parts, extra branches one row up
  const place = (net: string, x: number, row: number): number => {
    let cur = x;
    spans.set(net, { x0: x, x1: x, row });
    const y = rowY(row);
    for (const r of c.components.filter((k) => !placed.has(k.id) && ((k.from === net && k.to === G) || (k.to === net && k.from === G)))) {
      cur += 1;
      placed.add(r.id);
      // the rung runs from this row down to the ground rail
      const flip = r.from === G; // keep "from" at the top when it is this net
      comps.set(r.id, { id: r.id, a: P(cur, flip ? yG - 0.3 : y + 0.3), b: P(cur, flip ? y + 0.3 : yG - 0.3), vertical: true, leads: [[P(cur, y), P(cur, y + 0.3)], [P(cur, yG - 0.3), P(cur, yG)]] });
    }
    const series = c.components.filter((k) => !placed.has(k.id) && (k.from === net || k.to === net) && k.from !== G && k.to !== G);
    let first = true;
    let end = cur;
    for (const s of series) {
      if (placed.has(s.id)) continue;
      const other = s.from === net ? s.to : s.from;
      if (spans.has(other)) continue; // closes a loop: drawn as a bridge below
      placed.add(s.id);
      const r2 = first ? row : row + 1 + Math.max(0, ...[...spans.values()].map((v) => v.row)) - row;
      const y2 = rowY(r2);
      const bx = first ? end : cur;
      const lead: Pt[][] = [];
      if (!first) lead.push([P(bx, y), P(bx, y2)]); // riser to the new row
      comps.set(s.id, { id: s.id, a: P(bx + 0.25, y2), b: P(bx + 0.75, y2), vertical: false, leads: [[P(bx, y2), P(bx + 0.25, y2)], [P(bx + 0.75, y2), P(bx + 1, y2)], ...lead] });
      if (s.from !== net) { const pc = comps.get(s.id)!; [pc.a, pc.b] = [pc.b, pc.a]; }
      const e2 = place(other, bx + 1, r2);
      if (first) end = e2;
      first = false;
      cursorMax = Math.max(cursorMax, e2);
    }
    const span = spans.get(net)!;
    span.x1 = Math.max(cur, x);
    cursorMax = Math.max(cursorMax, cur, end);
    return Math.max(cur, end);
  };
  if (src) {
    comps.set(src.id, { id: src.id, a: P(0, src.from === G ? yG - 0.3 : 0.3), b: P(0, src.from === G ? 0.3 : yG - 0.3), vertical: true, leads: [[P(0, 0), P(0, 0.3)], [P(0, yG - 0.3), P(0, yG)]] });
    place(top, 0, 0);
  }
  // anything not reached yet (bridges between placed nets, parts of unreached nets): arcs over the top
  let bridgeRow = Math.max(0, ...[...spans.values()].map((v) => v.row)) + 1;
  for (const k of c.components) {
    if (placed.has(k.id)) continue;
    const sa = spans.get(k.from) ?? (k.from === G ? { x0: 0, x1: cursorMax, row: -1 } : null);
    const sb = spans.get(k.to) ?? (k.to === G ? { x0: 0, x1: cursorMax, row: -1 } : null);
    placed.add(k.id);
    if (!sa || !sb) continue;
    const ax = sa.x1, bx = sb.x1 + (sa.x1 === sb.x1 ? 0.6 : 0);
    const ay = sa.row < 0 ? yG : rowY(sa.row), by = sb.row < 0 ? yG : rowY(sb.row);
    const yt = rowY(bridgeRow++);
    const lo = Math.min(ax, bx), hi = Math.max(ax, bx, lo + 1);
    const mid = (lo + hi) / 2;
    comps.set(k.id, {
      id: k.id, a: P(mid - 0.25, yt), b: P(mid + 0.25, yt), vertical: false,
      leads: [[P(ax, ay), P(ax, yt), P(mid - 0.25, yt)], [P(mid + 0.25, yt), P(bx, yt), P(bx, by)]],
    });
    cursorMax = Math.max(cursorMax, bx);
  }
  // net segments along each row, and the ground rail
  for (const [net, s] of spans) {
    const xs = [s.x0, s.x1];
    // only a lead's node end (on the grid, on this row) extends the net's wire — its other end is the symbol
    const onGrid = (p: Pt) => Math.abs(p.x / U - Math.round(p.x / U)) < 1e-6 && Math.abs(p.y - rowY(s.row) * U) < 1;
    for (const pc of comps.values()) for (const l of pc.leads) for (const p of [l[0], l[l.length - 1]]) if (onGrid(p) && netOfPoint(c, comps, pc.id, p) === net) xs.push(p.x / U);
    if (Math.max(...xs) > Math.min(...xs)) wires.push([P(Math.min(...xs), rowY(s.row)), P(Math.max(...xs), rowY(s.row))]);
  }
  wires.push([P(0, yG), P(cursorMax, yG)]);
  // junction dots: where three or more conductors meet (a wire passing through a point counts as two)
  const key = (p: Pt) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const segs: Pt[][] = [...wires, ...[...comps.values()].flatMap((pc) => pc.leads)];
  const meet = new Map<string, number>();
  for (const s of segs) for (const p of [s[0], s[s.length - 1]]) meet.set(key(p), (meet.get(key(p)) ?? 0) + 1);
  const dots: Pt[] = [];
  for (const [k, ends] of meet) {
    const [x, y] = k.split(',').map(Number);
    let through = 0;
    for (const s of segs) for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      const horizontal = Math.abs(a.y - b.y) < 1 && Math.abs(y - a.y) < 1 && x > Math.min(a.x, b.x) + 1 && x < Math.max(a.x, b.x) - 1;
      const vertical = Math.abs(a.x - b.x) < 1 && Math.abs(x - a.x) < 1 && y > Math.min(a.y, b.y) + 1 && y < Math.max(a.y, b.y) - 1;
      if (horizontal || vertical) through++;
    }
    if (ends + 2 * through >= 3) dots.push({ x, y });
  }
  const nets = new Map<string, Pt>();
  for (const [net, s] of spans) nets.set(net, P(s.x0, rowY(s.row)));
  nets.set(G, P(0, yG));
  // shift to positive coordinates with a margin for labels
  const all = [...wires.flat(), ...[...comps.values()].flatMap((p) => [p.a, p.b, ...p.leads.flat()])];
  const minX = Math.min(...all.map((p) => p.x)) - 70, minY = Math.min(...all.map((p) => p.y)) - 60;
  const maxX = Math.max(...all.map((p) => p.x)) + 110, maxY = Math.max(...all.map((p) => p.y)) + 40;
  const sh = (p: Pt) => ({ x: p.x - minX, y: p.y - minY });
  for (const pc of comps.values()) { pc.a = sh(pc.a); pc.b = sh(pc.b); pc.leads = pc.leads.map((l) => l.map(sh)); }
  return { w: maxX - minX, h: maxY - minY, comps, wires: wires.map((w) => w.map(sh)), dots: dots.map(sh), nets: new Map([...nets].map(([k, p]) => [k, sh(p)])) };
}

/** Which net a lead end belongs to (the component's terminal nearest that end). */
function netOfPoint(c: Circuit, comps: Map<string, PlacedComp>, id: string, p: Pt): string {
  const comp = c.components.find((x) => x.id === id)!;
  const pc = comps.get(id)!;
  const da = Math.hypot(p.x - pc.a.x, p.y - pc.a.y), db = Math.hypot(p.x - pc.b.x, p.y - pc.b.y);
  return da <= db ? comp.from : comp.to;
}
