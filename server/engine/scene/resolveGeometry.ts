/**
 * Geometry by intent (checklist 3.1).
 *
 * Models are poor at mental trigonometry: asked for "a 30° ramp" they write
 * coordinates that make 27.4°, and force components that point off the slope.
 * So a scene may describe spatial geometry by what it means; this pass turns
 * it into plain coordinates before validation (server) and before drawing
 * (client — golden scenes are loaded raw):
 *
 *   line|arrow  { "from": [0,0], "angleDeg": 30, "length": 10 }      → "to"
 *   any point   [x, y]
 *               "<point|body id>" | "poly.A"                         where that entity is
 *               { "from": <point>, "angleDeg": θ, "length": r }      polar, from another point
 *               { "along": "<line|vector id>", "t": 0.5 }           on a segment (0 = its from, 1 = its to)
 *   vector      "along": "<line|vector id>", "toward": "to"|"from"  parallel to it
 *               "perp": "<line|vector id>", "side": "left"|"right"  perpendicular (left = counter-clockwise)
 *               "angleDeg" (0 = +x, 90 = +y), "magnitude" = length in space units
 *   angle       "degrees": 30 — the value the lesson states; the drawing must agree (±1°)
 *
 * Pure functions, no imports: shared by the server validator and the client engine.
 */
export type GeometryIssue = { path: string; message: string };

type Loose = Record<string, any>;
type P = [number, number];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec = (v: unknown): v is P => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
const round = (n: number) => Math.round(n * 1000) / 1000;
const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (o: P, deg: number, len: number): P => [round(o[0] + len * Math.cos(rad(deg))), round(o[1] + len * Math.sin(rad(deg)))];
const unit = ([a, b]: [P, P]): P | null => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  return l > 1e-9 ? [dx / l, dy / l] : null;
};

/** Unsigned angle at `v` between the rays to `a` and `b`, in degrees (0–180). */
export function angleAt(v: P, a: P, b: P): number {
  const d = Math.abs(Math.atan2(a[1] - v[1], a[0] - v[0]) - Math.atan2(b[1] - v[1], b[0] - v[0])) * (180 / Math.PI);
  return d > 180 ? 360 - d : d;
}

/** A stated angle: "degrees", else a number with ° in the label ("30°", "θ = 30°"). */
const declaredDegrees = (e: Loose): { value: number; key: string } | null => {
  if (isNum(e.degrees)) return { value: e.degrees, key: 'degrees' };
  const m = typeof e.label === 'string' ? /(-?\d+(?:\.\d+)?)\s*(?:°|\^\\circ|\\circ|deg)/.exec(e.label) : null;
  return m ? { value: Number(m[1]), key: 'label' } : null;
};

export function resolveGeometry(input: unknown): { value: unknown; issues: GeometryIssue[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { value: input, issues: [] };
  const scene: Loose = structuredClone(input);
  const entities: Loose[] = Array.isArray(scene.entities) ? scene.entities.filter((e: unknown) => e && typeof e === 'object') : [];
  const pos = new Map<string, P>();
  const seg = new Map<string, [P, P]>();
  let pending: GeometryIssue[] = [];

  /** A point in any accepted form → [x, y]; undefined when it can't be resolved (yet). */
  const point = (v: unknown, path: string): P | undefined => {
    if (isVec(v)) return v;
    if (typeof v === 'string') {
      const p = pos.get(v);
      if (!p) pending.push({ path, message: `"${v}" is not a point, body or polygon vertex of this scene` });
      return p;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Loose;
      if (typeof o.along === 'string') {
        const s = seg.get(o.along);
        if (!s) { pending.push({ path: `${path}.along`, message: `"${o.along}" is not a line or vector of this scene` }); return undefined; }
        const t = isNum(o.t) ? o.t : 0.5;
        return [round(s[0][0] + (s[1][0] - s[0][0]) * t), round(s[0][1] + (s[1][1] - s[0][1]) * t)];
      }
      if (o.from !== undefined && isNum(o.angleDeg) && isNum(o.length)) {
        const base = point(o.from, `${path}.from`);
        return base && polar(base, o.angleDeg, o.length);
      }
    }
    pending.push({ path, message: 'a point is [x, y], an entity id, {"from", "angleDeg", "length"} or {"along": "<line id>", "t"}' });
    return undefined;
  };
  /** Line endpoints may also be refs the client resolves ("tri.A", a box id): keep those as they are. */
  const endpoint = (v: unknown, path: string): { keep: unknown; at?: P } => {
    if (typeof v === 'string') return { keep: v, at: pos.get(v) };
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const at = point(v, path);
      return { keep: at ?? v, at };
    }
    return { keep: v, at: isVec(v) ? v : undefined };
  };

  const resolveEntity = (e: Loose, p: string): boolean => {
    switch (e.type) {
      case 'point':
      case 'body': {
        const at = point(e.at, `${p}.at`);
        if (!at) return false;
        e.at = at;
        pos.set(e.id, at);
        return true;
      }
      case 'polygon': {
        if (!Array.isArray(e.points)) return true;
        const pts = e.points.map((q: unknown, i: number) => point(q, `${p}.points[${i}]`));
        if (pts.some((q: P | undefined) => !q)) return false;
        e.points = pts;
        (Array.isArray(e.vertexLabels) ? e.vertexLabels : []).forEach((l: unknown, i: number) => {
          if (typeof l === 'string' && pts[i]) pos.set(`${e.id}.${l}`, pts[i]);
        });
        return true;
      }
      case 'path':
      case 'scatter': {
        if (!Array.isArray(e.points)) return true;
        let ok = true;
        e.points = e.points.map((q: unknown, i: number) => {
          if (e.type === 'scatter' && q && typeof q === 'object' && !Array.isArray(q)) {
            const at = point((q as Loose).at, `${p}.points[${i}].at`);
            if (!at) { ok = false; return q; }
            return { ...(q as Loose), at };
          }
          const at = point(q, `${p}.points[${i}]`);
          if (!at) { ok = false; return q; }
          return at;
        });
        return ok;
      }
      case 'line':
      case 'arrow': {
        const a = endpoint(e.from, `${p}.from`);
        e.from = a.keep;
        if (e.to === undefined && isNum(e.angleDeg) && isNum(e.length)) {
          if (!a.at) { if (typeof e.from === 'string') pending.push({ path: `${p}.from`, message: `"${e.from}" has no position to measure "angleDeg"/"length" from` }); return false; }
          e.to = polar(a.at, e.angleDeg, e.length);
        }
        const b = endpoint(e.to, `${p}.to`);
        e.to = b.keep;
        if (a.at && b.at) seg.set(e.id, [a.at, b.at]);
        const unresolved = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
        // a spatial line naming a vertex declared further down waits for it (so "along" this line works)
        const waiting = e.space !== undefined && [a, b].some((x) => typeof x.keep === 'string' && !x.at);
        return !waiting && !unresolved(e.from) && !unresolved(e.to);
      }
      case 'vector': {
        const from = point(e.from, `${p}.from`);
        if (!from) return false;
        e.from = from;
        let to: P | undefined;
        if (e.to !== undefined) {
          to = point(e.to, `${p}.to`);
          if (!to) return false;
        } else if (typeof e.along === 'string' || typeof e.perp === 'string') {
          const ref = (e.along ?? e.perp) as string;
          const s = seg.get(ref);
          if (!s) { pending.push({ path: `${p}.${e.along ? 'along' : 'perp'}`, message: `"${ref}" is not a line or vector of this scene` }); return false; }
          const u = unit(s);
          if (!u) { pending.push({ path: `${p}.${e.along ? 'along' : 'perp'}`, message: `"${ref}" has zero length` }); return false; }
          let d: P = u;
          if (e.along) { if (e.toward === 'from') d = [-u[0], -u[1]]; }
          else d = e.side === 'right' ? [u[1], -u[0]] : [-u[1], u[0]];
          const m = isNum(e.magnitude) ? e.magnitude : Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
          to = [round(from[0] + d[0] * m), round(from[1] + d[1] * m)];
        } else if (isNum(e.angleDeg)) {
          to = polar(from, e.angleDeg, isNum(e.magnitude) ? e.magnitude : 1);
        }
        if (to) { e.to = to; seg.set(e.id, [from, to]); }
        delete e.along; delete e.perp; delete e.toward; delete e.side;
        return true;
      }
      case 'angle': {
        for (const k of ['vertex', 'from', 'to']) {
          if (e[k] && typeof e[k] === 'object' && !Array.isArray(e[k])) {
            const at = point(e[k], `${p}.${k}`);
            if (!at) return false;
            e[k] = at;
          }
        }
        return true;
      }
      default:
        return true;
    }
  };

  // entities may refer to ones declared later: resolve in passes until nothing changes
  const todo = new Set(entities.map((_, i) => i));
  for (let pass = 0; pass < 6 && todo.size; pass++) {
    pending = [];
    let progressed = false;
    for (const i of [...todo]) {
      if (resolveEntity(entities[i], `entities[${scene.entities.indexOf(entities[i])}]`)) { todo.delete(i); progressed = true; }
    }
    if (!progressed) break;
  }
  const issues: GeometryIssue[] = todo.size ? pending : [];

  // Forces drawn at their value in newtons can dwarf the space (N = 17 in a 10-unit scene): keep
  // one common scale per space, the longest vector ≈ 30% of the space's diagonal. Directions and
  // ratios are unchanged — the real values live in the labels.
  for (const sp of Array.isArray(scene.spaces) ? scene.spaces : []) {
    if (!sp || !isVec(sp.x) || !isVec(sp.y)) continue;
    const diag = Math.hypot(sp.x[1] - sp.x[0], sp.y[1] - sp.y[0]);
    const vecs = entities.filter((e) => e.type === 'vector' && e.space === sp.id && isVec(e.from) && isVec(e.to));
    const longest = Math.max(0, ...vecs.map((e) => Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1])));
    if (!(diag > 0) || longest <= 0.5 * diag) continue;
    const k = (0.3 * diag) / longest;
    for (const e of vecs) {
      e.to = [round(e.from[0] + (e.to[0] - e.from[0]) * k), round(e.from[1] + (e.to[1] - e.from[1]) * k)];
      if (isNum(e.magnitude)) e.magnitude = round(e.magnitude * k);
    }
  }

  // a stated angle must match the drawing
  entities.forEach((e) => {
    if (e.type !== 'angle') return;
    const decl = declaredDegrees(e);
    if (!decl) return;
    const at = (v: unknown) => (isVec(v) ? v : typeof v === 'string' ? pos.get(v) : undefined);
    const v = at(e.vertex), a = at(e.from), b = at(e.to);
    if (!v || !a || !b) return;
    const drawn = angleAt(v, a, b);
    if (Math.abs(drawn - decl.value) > 1) {
      issues.push({
        path: `entities[${scene.entities.indexOf(e)}].${decl.key}`,
        message: `the drawing makes this angle ${Math.round(drawn * 10) / 10}°, but the lesson says ${decl.value}°: don't compute coordinates by hand — build the sides by intent, e.g. a line {"from": [0, 0], "angleDeg": ${decl.value}, "length": 10}, points {"along": "<line id>", "t": 0.5}, vectors "along"/"perp" a line`,
      });
    }
  });
  return { value: scene, issues };
}
