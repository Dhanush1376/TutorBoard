/**
 * Computed engineering traces — the `compute` route for circuits, logic and beams.
 *
 *   circuit-solve  node voltages and branch currents by nodal analysis; Ohm's law per part, KCL, power balance
 *   rc-charging    the capacitor's Thévenin equivalent, τ = R·C, and v_C(t) drawn from it
 *   truth-table    every input row evaluated on the diagram and written into a table
 *   beam           a simply supported beam: reactions, shear-force and bending-moment diagrams
 */
import { solveDC, thevenin, groundOf, type Circuit } from './circuits.js';
import { hl, list, num, type Act, type Ctx, type Gen, type GenBeat, type Loose } from './computeKit.js';
import { truthRows, type Logic } from './logic.js';

const PREFIX: [number, string][] = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];
/** 0.0015 A → "1.5 mA", 2200 Ω → "2.2 kΩ". */
export function si(v: number, unit: string): string {
  if (!Number.isFinite(v)) return `∞ ${unit}`;
  if (v === 0) return `0 ${unit}`;
  const a = Math.abs(v);
  const [f, p] = PREFIX.find(([k]) => a >= k * 0.9999) ?? PREFIX[PREFIX.length - 1];
  return `${v < 0 ? '−' : ''}${Number((a / f).toPrecision(3))} ${p}${unit}`;
}
const UNIT: Record<string, string> = { battery: 'V', resistor: 'Ω', lamp: 'Ω', capacitor: 'F' };

const circuitOf = (ctx: Ctx): Circuit => {
  const e = ctx.entity;
  if (!e) ctx.fail(`"${ctx.target}" is not an entity in this scene — declare the circuit first`);
  if (e!.type !== 'circuit') ctx.fail(`this runs on a circuit; "${ctx.target}" is a ${e!.type}`);
  return e as unknown as Circuit;
};

function circuitSolve(ctx: Ctx): Gen {
  const c = circuitOf(ctx);
  let dc: ReturnType<typeof solveDC>;
  try { dc = solveDC(c); } catch (err) { ctx.fail((err as Error).message); }
  const T = ctx.target;
  const ref = (id: string) => `${T}.${id}`;
  const bats = c.components.filter((x) => x.kind === 'battery');
  const loads = c.components.filter((x) => x.kind === 'resistor' || x.kind === 'lamp');
  const meters = c.components.filter((x) => x.kind === 'ammeter' || x.kind === 'voltmeter');
  const beats: GenBeat[] = [];
  const b0 = bats[0];
  const Ib = dc!.i.get(b0.id)!;
  const req = Ib !== 0 ? Math.abs(b0.value! / Ib) : Infinity;
  beats.push({
    title: 'What the battery sees',
    narration: bats.length === 1 && Number.isFinite(req)
      ? `The ${si(b0.value!, 'V')} battery pushes ${si(Math.abs(Ib), 'A')} round the circuit, so together the parts act like one resistance of ${si(b0.value!, 'V')} ÷ ${si(Math.abs(Ib), 'A')} = ${si(req, 'Ω')}.`
      : `Solving the whole circuit at once (nodal analysis): every junction's currents must balance, and every battery fixes the voltage across it.`,
    actions: [{ do: 'highlight', target: bats.map((b) => ref(b.id)), state: 'active' }, ...bats.map((b) => ({ do: 'annotate', target: ref(b.id), text: `${si(Math.abs(dc!.i.get(b.id)!), 'A')} out`, side: 'left' }))],
  });
  // Ohm's law, a few parts per beat
  for (let k = 0; k < loads.length; k += 3) {
    const group = loads.slice(k, k + 3);
    beats.push({
      title: group.length === 1 ? `Through ${group[0].id}` : `Through ${group.map((g) => g.id).join(', ')}`,
      narration: group.map((g) => `${g.id}: ${si(Math.abs(dc!.drop.get(g.id)!), 'V')} across ${si(g.value!, 'Ω')}, so I = V ÷ R = ${si(Math.abs(dc!.i.get(g.id)!), 'A')}`).join('. ') + '.',
      actions: [{ do: 'clear', target: T }, ...hl(group.map((g) => ref(g.id)), 'comparing'), ...group.map((g) => ({ do: 'annotate', target: ref(g.id), text: `${si(Math.abs(dc!.i.get(g.id)!), 'A')}, ${si(Math.abs(dc!.drop.get(g.id)!), 'V')}`, side: 'right' as const }))],
    });
  }
  // KCL at the busiest junction
  const touching = new Map<string, string[]>();
  for (const x of c.components) for (const n of [x.from, x.to]) touching.set(n, [...(touching.get(n) ?? []), x.id]);
  const G = groundOf(c);
  const junction = [...touching].filter(([n, ids]) => n !== G && ids.length >= 3).sort((a, b) => b[1].length - a[1].length)[0];
  if (junction) {
    const [net, ids] = junction;
    const flows = ids.map((id) => {
      const comp = c.components.find((x) => x.id === id)!;
      const iv = dc!.i.get(id)!;
      if (!Number.isFinite(iv)) return null;
      // positive from→to; into this net when the part's "to" is this net
      const into = comp.to === net ? iv : -iv;
      return { id, into };
    }).filter((f): f is { id: string; into: number } => !!f && Math.abs(f.into) > 1e-12);
    const ins = flows.filter((f) => f.into > 0), outs = flows.filter((f) => f.into < 0);
    const sum = (fs: typeof flows) => fs.reduce((s, f) => s + Math.abs(f.into), 0);
    if (ins.length && outs.length) beats.push({
      title: `Junction ${net}: in = out`,
      narration: `At junction ${net}, ${ins.map((f) => `${si(f.into, 'A')} (${f.id})`).join(' + ')} flows in and ${outs.map((f) => `${si(-f.into, 'A')} (${f.id})`).join(' + ')} flows out: ${si(sum(ins), 'A')} = ${si(sum(outs), 'A')}. Charge doesn't pile up.`,
      actions: [{ do: 'clear', target: T }, { do: 'highlight', target: ref(net), state: 'insight' }, ...hl(flows.map((f) => ref(f.id)), 'active')],
    });
  }
  if (meters.length) beats.push({
    title: 'The meters',
    narration: meters.map((m) => (m.kind === 'ammeter' ? `${m.id} reads ${si(Math.abs(dc!.i.get(m.id)!), 'A')}` : `${m.id} reads ${si(Math.abs(dc!.drop.get(m.id)!), 'V')}`)).join('; ') + '.',
    actions: [{ do: 'clear', target: T }, ...meters.map((m) => ({ do: 'annotate', target: ref(m.id), text: m.kind === 'ammeter' ? si(Math.abs(dc!.i.get(m.id)!), 'A') : si(Math.abs(dc!.drop.get(m.id)!), 'V'), side: 'above' as const }))],
  });
  const pIn = bats.reduce((s, b) => s + b.value! * dc!.i.get(b.id)!, 0);
  const pOut = loads.reduce((s, r) => s + dc!.i.get(r.id)! ** 2 * r.value!, 0);
  beats.push({
    title: 'Energy balance',
    narration: `The battery supplies P = V × I = ${si(pIn, 'W')}; the parts use ${loads.map((r) => si(dc!.i.get(r.id)! ** 2 * r.value!, 'W')).join(' + ')} = ${si(pOut, 'W')} as I²R. Power in equals power out.`,
    actions: [{ do: 'clear', target: T }, ...hl(loads.map((r) => ref(r.id)), 'found')],
  });
  return { beats, data: 'given' };
}

function rcCharging(ctx: Ctx): Gen {
  const c = circuitOf(ctx);
  const caps = c.components.filter((x) => x.kind === 'capacitor');
  if (caps.length !== 1) ctx.fail(`RC charging needs exactly one capacitor; "${ctx.target}" has ${caps.length}`);
  const cap = caps[0];
  let th: { voc: number; rth: number };
  // v_C = V(from) − V(to), like every component's voltage
  try { th = thevenin(c, cap.to, cap.from); } catch (err) { ctx.fail((err as Error).message); }
  if (!(th!.rth > 0)) ctx.fail('the capacitor has no resistance in its path, so τ = R·C is zero: add a resistor in series');
  const tau = th!.rth * cap.value!;
  const v0 = num(ctx.args.v0 ?? 0) || 0, vf = th!.voc;
  // pick a time unit so the axis reads in plain numbers
  const [scale, tu] = tau >= 1 ? [1, 's'] : tau >= 1e-3 ? [1e3, 'ms'] : [1e6, 'µs'];
  const T = ctx.target, S = `${T}-vc`, F = `${T}-curve`;
  const tauU = tau * scale;
  const span = 5 * tauU;
  const lo = Math.min(0, v0, vf), hi = Math.max(0, v0, vf);
  const pad = (hi - lo) * 0.15 || 1;
  const expr = `${vf} + (${v0 - vf})*exp(-x/${tauU})`;
  const vTau = vf + (v0 - vf) * Math.exp(-1);
  const space = { id: S, kind: 'cartesian', x: [0, Number((span * 1.05).toPrecision(3))], y: [Number((lo - pad).toPrecision(3)), Number((hi + pad).toPrecision(3))], axes: true, grid: true, xLabel: `t (${tu})`, yLabel: 'v_C (V)' };
  const beats: GenBeat[] = [
    {
      title: 'What the capacitor sees',
      narration: `Seen from the capacitor, the rest of the circuit behaves like ${si(vf, 'V')} behind ${si(th!.rth, 'Ω')} (its Thévenin equivalent). So τ = R × C = ${si(th!.rth, 'Ω')} × ${si(cap.value!, 'F')} = ${si(tau, 's')}.`,
      actions: [{ do: 'highlight', target: `${T}.${cap.id}`, state: 'active' }],
    },
    {
      title: 'Charging',
      narration: `Starting from ${si(v0, 'V')}, the capacitor's voltage climbs towards ${si(vf, 'V')} fast at first, then ever more slowly, because the current through ${si(th!.rth, 'Ω')} shrinks as the gap closes: v_C = ${si(vf, 'V')} + (${si(v0 - vf, 'V')})·e^(−t/τ).`,
      actions: [{ do: 'create', target: F, effect: 'draw' }],
    },
    {
      title: 'One time constant',
      narration: `After one τ (${si(tau, 's')}) it has covered 63% of the way: ${si(vTau, 'V')}. After 5τ it is within 1% of ${si(vf, 'V')} — charged, and the current has stopped.`,
      actions: [{ do: 'create', target: [`${T}-tau`, `${T}-p63`], effect: 'draw' }, { do: 'create', target: `${T}-final`, effect: 'draw', with: 'previous' }],
    },
  ];
  return {
    beats,
    spaces: [space],
    entities: [
      { id: F, type: 'plot', space: S, expr, domain: [0, span], label: 'v_C(t)', tone: 'info' },
      { id: `${T}-tau`, type: 'refline', space: S, x: Number(tauU.toPrecision(6)), label: 't = τ' },
      { id: `${T}-final`, type: 'refline', space: S, y: vf, label: `${si(vf, 'V')}`, tone: 'muted' },
      { id: `${T}-p63`, type: 'point', space: S, at: [Number(tauU.toPrecision(8)), Number(vTau.toPrecision(8))], on: F, label: '63%' },
    ],
    layout: [{ rel: 'below', id: S, of: T, gap: 'lg' }],
    data: 'given',
  };
}

function truthTable(ctx: Ctx): Gen {
  const e = ctx.entity;
  if (!e || e.type !== 'logic') ctx.fail(`a truth table needs a logic circuit; "${ctx.target}" is ${e ? `a ${e.type}` : 'not an entity'}`);
  const l = e as unknown as Logic;
  const rows = truthRows(l);
  const T = ctx.target, TT = `${T}-table`;
  const cols = [...l.inputs, ...l.outputs.map((o) => o.id)];
  const table = { id: TT, type: 'table', columns: cols, rows: rows.map(() => cols.map(() => '·')), label: 'truth table' };
  const beats: GenBeat[] = [{ title: `${rows.length} input combinations`, narration: `${l.inputs.length} input${l.inputs.length > 1 ? 's' : ''} give ${rows.length} combinations. Feed each one through the gates, left to right, and record the output.`, actions: [{ do: 'create', target: TT, effect: 'fade' }] }];
  rows.forEach((v, r) => {
    const acts: Act[] = [
      ...l.inputs.map((i) => ({ do: 'set', target: `${T}.${i}`, value: v.get(i)! })),
      ...l.gates.map((g) => ({ do: 'set', target: `${T}.${g.id}`, value: v.get(g.id)! })),
      ...l.outputs.map((o) => ({ do: 'set', target: `${T}.${o.id}`, value: v.get(o.id)! })),
      ...cols.map((name, k) => ({ do: 'set', target: `${TT}.r${r}c${k}`, value: v.get(name)! })),
    ];
    const gateText = l.gates.map((g) => `${g.id} = ${g.op.toUpperCase()}(${g.in.map((s) => v.get(s)).join(', ')}) = ${v.get(g.id)}`).join('; ');
    beats.push({ title: `${l.inputs.map((i) => `${i}=${v.get(i)}`).join(' ')}`, narration: `${l.inputs.map((i) => `${i} = ${v.get(i)}`).join(', ')}: ${gateText}. ${l.outputs.map((o) => `${o.id} = ${v.get(o.id)}`).join(', ')}.`, actions: acts });
  });
  const o = l.outputs[0];
  const ones = rows.map((v, r) => (v.get(o.id) ? r : -1)).filter((r) => r >= 0);
  beats.push({
    title: `${o.id} is 1 in ${ones.length} row${ones.length === 1 ? '' : 's'}`,
    narration: ones.length ? `${o.id} = 1 exactly when ${ones.map((r) => l.inputs.map((i) => `${i}=${rows[r].get(i)}`).join(' ')).join(', or ')} — rows ${list(ones.map((r) => String(r + 1)))}.` : `${o.id} is never 1.`,
    actions: hl(ones.map((r) => `${TT}.r${r}c${cols.indexOf(o.id)}`), 'found'),
  });
  return { beats, entities: [table], layout: [{ rel: 'right-of', id: TT, of: T, gap: 'xl' }], data: 'given' };
}

function beam(ctx: Ctx): Gen {
  const L = num(ctx.args.length ?? ctx.args.L);
  if (!(L > 0 && L <= 50)) ctx.fail('a beam needs "args": { "length": metres (≤ 50), "loads": [{ "at": m, "F": kN }], "udl"?: kN/m }');
  const loads = (Array.isArray(ctx.args.loads) ? ctx.args.loads : []).map((p: Loose, k: number) => {
    const at = num(p?.at), F = num(p?.F ?? p?.force);
    if (!(at >= 0 && at <= L) || !Number.isFinite(F)) ctx.fail(`load ${k} needs "at" between 0 and ${L} and a force "F" in kN`);
    return { at, F };
  }) as { at: number; F: number }[];
  const w = num(ctx.args.udl ?? 0) || 0;
  if (!loads.length && !w) ctx.fail('give at least one point load or a "udl"');
  if (loads.length > 4) ctx.fail('at most 4 point loads');
  // equilibrium: ΣM about A gives R_B, ΣF gives R_A
  const total = loads.reduce((s, p) => s + p.F, 0) + w * L;
  const RB = (loads.reduce((s, p) => s + p.F * p.at, 0) + (w * L * L) / 2) / L;
  const RA = total - RB;
  const H = (a: number) => `(sign(x-${a})+1)/2`;
  const Vexpr = [`${RA}`, ...loads.map((p) => `- ${p.F}*${H(p.at)}`), ...(w ? [`- ${w}*x`] : [])].join(' ');
  const Mexpr = [`${RA}*x`, ...loads.map((p) => `- ${p.F}*(x-${p.at})*${H(p.at)}`), ...(w ? [`- ${w / 2}*x^2`] : [])].join(' ');
  const V = (x: number) => RA - loads.reduce((s, p) => s + (x > p.at ? p.F : 0), 0) - w * x;
  const M = (x: number) => RA * x - loads.reduce((s, p) => s + (x > p.at ? p.F * (x - p.at) : 0), 0) - (w * x * x) / 2;
  // where the moment peaks: at a point load where V changes sign, or where V = 0 under the udl
  const xs = Array.from({ length: 2001 }, (_, i) => (L * i) / 2000);
  // the exact load positions first, so a peak under a point load lands on it rather than on a grid point beside it
  const xMax = [...loads.map((p) => p.at), ...xs].reduce((b, x) => (M(x) > M(b) + 1e-9 ? x : b), loads[0]?.at ?? 0);
  const Mmax = M(xMax);
  const Vabs = Math.max(...xs.map((x) => Math.abs(V(x))), Math.abs(RA), 1e-9);
  const r = (v: number) => Number(v.toPrecision(4));
  const T = ctx.target, B = `${T}-fbd`, SF = `${T}-sfd`, BM = `${T}-bmd`;
  const fmt = (v: number) => String(r(v));
  const spaces = [
    { id: B, kind: 'cartesian', x: [-0.1 * L, 1.1 * L], y: [-3, 3], axes: false, equalAspect: false },
    { id: SF, kind: 'cartesian', x: [0, L], y: [r(-Vabs * 1.3), r(Vabs * 1.3)], axes: true, grid: true, xLabel: 'x (m)', yLabel: 'V (kN)' },
    { id: BM, kind: 'cartesian', x: [0, L], y: [r(Math.min(0, ...xs.map(M)) * 1.2 - 0.05 * Mmax), r(Mmax * 1.3)], axes: true, grid: true, xLabel: 'x (m)', yLabel: 'M (kN·m)' },
  ];
  const loadVecs = loads.map((p, k) => ({ id: `${T}-P${k + 1}`, type: 'vector', space: B, from: [p.at, 2.6], to: [p.at, 0.2], label: `${fmt(p.F)} kN`, tone: 'danger' }));
  const entities: Loose[] = [
    { id: `${T}-beam`, type: 'line', space: B, from: [0, 0], to: [L, 0], tone: 'default' },
    ...loadVecs,
    ...(w ? [{ id: `${T}-w`, type: 'refline', space: B, y: 1.2, label: `${fmt(w)} kN/m`, tone: 'danger' }] : []),
    { id: `${T}-RA`, type: 'vector', space: B, from: [0, -2.6], to: [0, -0.2], label: `R_A = ${fmt(RA)} kN`, tone: 'success' },
    { id: `${T}-RB`, type: 'vector', space: B, from: [L, -2.6], to: [L, -0.2], label: `R_B = ${fmt(RB)} kN`, tone: 'success' },
    { id: `${T}-V`, type: 'plot', space: SF, expr: Vexpr, label: 'V(x)', tone: 'info' },
    { id: `${T}-V0`, type: 'refline', space: SF, y: 0, dashed: false, tone: 'muted' },
    // the vertical step of the shear diagram under each point load (the plot itself breaks there)
    ...loads.map((p, k) => ({ id: `${T}-jump${k + 1}`, type: 'line', space: SF, from: [p.at, r(V(p.at - 1e-9))], to: [p.at, r(V(p.at + 1e-9))], tone: 'info' })),
    { id: `${T}-M`, type: 'plot', space: BM, expr: Mexpr, label: 'M(x)', tone: 'accent' },
    { id: `${T}-Mmax`, type: 'point', space: BM, at: [r(xMax), r(Mmax)], on: `${T}-M`, label: `max ${fmt(Mmax)} kN·m` },
  ];
  const beats: GenBeat[] = [
    { title: 'The beam and its loads', narration: `A ${fmt(L)} m beam on two supports carries ${[...loads.map((p) => `${fmt(p.F)} kN at ${fmt(p.at)} m`), ...(w ? [`${fmt(w)} kN/m along its length`] : [])].join(' and ')}.`, actions: [{ do: 'create', target: [`${T}-beam`, ...loadVecs.map((v) => v.id), ...(w ? [`${T}-w`] : [])], effect: 'draw' }] },
    { title: 'Support reactions', narration: `Moments about A: R_B × ${fmt(L)} = ${[...loads.map((p) => `${fmt(p.F)} × ${fmt(p.at)}`), ...(w ? [`${fmt(w * L)} × ${fmt(L / 2)}`] : [])].join(' + ')}, so R_B = ${fmt(RB)} kN. Forces up = down: R_A = ${fmt(total)} − ${fmt(RB)} = ${fmt(RA)} kN.`, actions: [{ do: 'create', target: [`${T}-RA`, `${T}-RB`], effect: 'grow' }] },
    { title: 'Shear force', narration: `Walking left to right, the shear starts at R_A = ${fmt(RA)} kN${loads.length ? ` and drops by each point load where it acts` : ''}${w ? ', sloping down under the spread load' : ''}, ending at −R_B.`, actions: [{ do: 'create', target: [`${T}-V0`, `${T}-V`, ...loads.map((_, k) => `${T}-jump${k + 1}`)], effect: 'draw' }] },
    { title: 'Bending moment', narration: `The bending moment is the running area under the shear diagram. It is largest where the shear crosses zero: ${fmt(Mmax)} kN·m at x = ${fmt(xMax)} m — where the beam is most likely to fail.`, actions: [{ do: 'create', target: [`${T}-M`, `${T}-Mmax`], effect: 'draw' }] },
  ];
  return { beats, spaces, entities, layout: [{ rel: 'column', ids: [B, SF, BM], gap: 'md' }], data: 'given' };
}

export const ENG_ALGORITHMS: Record<string, (ctx: Ctx) => Gen> = {
  circuitsolve: circuitSolve, solvecircuit: circuitSolve, ohmslaw: circuitSolve, kirchhoff: circuitSolve,
  rccharging: rcCharging, rc: rcCharging, rccircuit: rcCharging,
  truthtable: truthTable,
  beam, beamdiagrams: beam, sfdbmd: beam,
};
export const ENG_NAMES = ['circuit-solve', 'rc-charging', 'truth-table', 'beam'];
