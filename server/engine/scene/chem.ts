/**
 * Chemistry facts for molecule entities — shared by the validator and the client layout.
 *
 * The model names atoms and bonds; nothing here trusts it on chemistry:
 * valence is counted from the bonds and formal charges, rings are found from
 * the connectivity, and the molecular formula is computed (Hill order) so a
 * label that disagrees with the drawn structure is caught.
 */

export type MolAtom = { id?: string; el: string; charge?: number };
export type BondStyle = 'wedge' | 'dash';
export type MolBond = [number, number, number] | [number, number, number, BondStyle];
export type Mol = { atoms: MolAtom[]; bonds: MolBond[]; lonePairs?: { atom: number; count: number }[] };

/** Valence electrons of main-group elements (period ≤ 5) — enough to derive allowed bond counts. */
const VALENCE_ELECTRONS: Record<string, number> = {
  H: 1, Li: 1, Na: 1, K: 1, Rb: 1,
  Be: 2, Mg: 2, Ca: 2, Sr: 2,
  B: 3, Al: 3, Ga: 3,
  C: 4, Si: 4, Ge: 4, Sn: 4,
  N: 5, P: 5, As: 5, Sb: 5,
  O: 6, S: 6, Se: 6, Te: 6,
  F: 7, Cl: 7, Br: 7, I: 7,
  He: 8, Ne: 8, Ar: 8, Kr: 8, Xe: 8,
};
/** Second-row atoms keep a strict octet; heavier ones may expand it (PCl₅, SF₆, ClO₄⁻). */
const STRICT_OCTET = new Set(['H', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F']);
/** Typical (uncharged) bond counts, for the "missing hydrogens" hint. */
const TYPICAL: Record<string, number[]> = {
  H: [1], B: [3], C: [4], N: [3], O: [2], F: [1], Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1], Br: [1], I: [1],
};

export const isKnownElement = (el: string) => el in VALENCE_ELECTRONS || TRANSITION_METALS.has(el);
const TRANSITION_METALS = new Set(['Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Y', 'Zr', 'Nb', 'Mo', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'Pt', 'Au', 'Hg', 'W', 'Os', 'Ir', 'Pb', 'Bi', 'Cs', 'Ba', 'Fr', 'Ra', 'Rn', 'Tl', 'In', 'Po', 'At']);

/**
 * The most bonds (sum of bond orders) an atom can carry with this formal charge,
 * or null when the element has no simple rule (transition metals: coordination varies).
 * Rule: an atom with e valence electrons after the charge (e = group − charge)
 * forms up to e bonds if e ≤ 4, else 8 − e (octet); heavier p-block atoms may use all e.
 */
export function maxBonds(el: string, charge = 0): number | null {
  const v = VALENCE_ELECTRONS[el];
  if (v === undefined) return null;
  if (el === 'H') return charge === 0 ? 1 : 0; // H⁺ and H⁻ (hydride) carry no bonds
  const e = v - charge;
  if (e <= 0) return 0;
  if (e >= 8) return v === 8 && charge === 0 && (el === 'Kr' || el === 'Xe') ? 8 : 0; // XeF₄; Cl⁻, O²⁻ carry no bonds
  if (e <= 4) return e;
  return STRICT_OCTET.has(el) ? 8 - e : e;
}

export function bondSums(m: Mol): number[] {
  const sum = m.atoms.map(() => 0);
  for (const [a, b, o] of m.bonds) {
    if (a < sum.length && b < sum.length && a !== b) { sum[a] += o; sum[b] += o; }
  }
  return sum;
}

export type ChemIssue = { path: string; message: string; severity: 'error' | 'warning' };

/**
 * Structural checks: bonds point at real atoms, no duplicate bonds, every atom
 * within its valence for its formal charge. `path` is the molecule's JSON path.
 */
export function checkMolecule(m: Mol, path: string): ChemIssue[] {
  const out: ChemIssue[] = [];
  const name = (i: number) => `atom ${i} (${m.atoms[i]?.el}${m.atoms[i]?.id ? ` "${m.atoms[i].id}"` : ''})`;
  const seen = new Map<string, number>();
  m.bonds.forEach(([a, b], k) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) out.push({ path: `${path}.bonds[${k}]`, severity: 'error', message: `atoms ${a} and ${b} are already bonded by bonds[${seen.get(key)}] — use one bond with order 2 or 3 for a multiple bond` });
    else seen.set(key, k);
  });
  m.atoms.forEach((a, i) => {
    if (!isKnownElement(a.el)) out.push({ path: `${path}.atoms[${i}].el`, severity: 'error', message: `"${a.el}" is not an element symbol` });
  });
  // stereo bonds: a wedge/dash is a single bond whose narrow end is a stereocentre (3–4 neighbours)
  const degree = m.atoms.map(() => 0);
  for (const [a, b] of m.bonds) if (a < degree.length && b < degree.length && a !== b) { degree[a]++; degree[b]++; }
  m.bonds.forEach((bd, k) => {
    const style = bd[3];
    if (!style) return;
    if (bd[2] !== 1) out.push({ path: `${path}.bonds[${k}]`, severity: 'error', message: `a ${style} bond shows a single bond pointing out of the page — bond ${k} has order ${bd[2]}` });
    else if ((degree[bd[0]] ?? 0) < 3) out.push({ path: `${path}.bonds[${k}]`, severity: 'warning', message: `the narrow end of a ${style} is the stereocentre (the first atom), but ${name(bd[0])} has only ${degree[bd[0]]} bond(s) — list the stereocentre first` });
  });
  const sums = bondSums(m);
  const hasExplicitH = m.atoms.some((a) => a.el === 'H');
  sums.forEach((s, i) => {
    const a = m.atoms[i];
    const max = maxBonds(a.el, a.charge ?? 0);
    if (max === null) return;
    const charge = a.charge ? ` with charge ${a.charge > 0 ? '+' : ''}${a.charge}` : '';
    if (s > max) {
      out.push({
        path: `${path}.atoms[${i}]`, severity: 'error',
        message: `${name(i)}${charge} has ${s} bonds (counting double = 2, triple = 3) but can have at most ${max}`
          + (a.el === 'C' || a.el === 'N' ? ' — check for a misplaced double bond; in an aromatic ring alternate single and double bonds (Kekulé form)' : '')
          + (a.el === 'N' && !a.charge && s === 4 ? ' — or give it "charge": 1 (ammonium-type N)' : ''),
      });
    } else if (hasExplicitH && !a.charge && s > 0 && TYPICAL[a.el] && !TYPICAL[a.el].includes(s) && s < Math.max(...TYPICAL[a.el])) {
      out.push({
        path: `${path}.atoms[${i}]`, severity: 'warning',
        message: `${name(i)} has ${s} bonds; neutral ${a.el} usually has ${TYPICAL[a.el].join(' or ')} — add the missing hydrogens, or set "charge" if it is an ion or intermediate`,
      });
    }
  });
  return out;
}

/** Molecular formula in Hill order (C, H, then alphabetical; alphabetical when there is no C), with net charge. */
export function formulaOf(m: Mol): string {
  const count = new Map<string, number>();
  for (const a of m.atoms) count.set(a.el, (count.get(a.el) ?? 0) + 1);
  const els = [...count.keys()];
  const order = count.has('C')
    ? ['C', ...(count.has('H') ? ['H'] : []), ...els.filter((e) => e !== 'C' && e !== 'H').sort()]
    : els.sort();
  const charge = m.atoms.reduce((s, a) => s + (a.charge ?? 0), 0);
  const body = order.map((e) => `${e}${count.get(e)! > 1 ? count.get(e) : ''}`).join('');
  return charge ? `${body}${Math.abs(charge) > 1 ? Math.abs(charge) : ''}${charge > 0 ? '+' : '-'}` : body;
}

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '⁺': '+', '⁻': '-', '−': '-' };

/**
 * Parse a label that is purely a molecular formula ("H₂O", "C6H5CH3", "NH4+", "SO4^2-")
 * into element counts and charge. Returns null for anything else (names, prose).
 */
export function parseFormula(label: string): { counts: Map<string, number>; charge: number } | null {
  let s = label.trim();
  let charge = 0;
  // charge first: "^2-" / "^{2-}" / "²⁻" carry a magnitude; a bare trailing sign ("NH4+") is ±1 — its digits are a count
  const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  const ch = /\^\{?(\d*)([+-])\}?$|([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$|([+\-−])$/.exec(s);
  if (ch) {
    const digits = ch[1] ?? (ch[3] ? [...ch[3]].map((c) => SUP[c]).join('') : '');
    const sign = ch[2] ?? (ch[4] ? (ch[4] === '⁺' ? '+' : '-') : ch[5] === '+' ? '+' : '-');
    charge = (digits ? Number(digits) : 1) * (sign === '+' ? 1 : -1);
    s = s.slice(0, ch.index);
  }
  s = s.replace(/[₀-₉]/g, (c) => SUB[c]).replace(/[{}\s]/g, '').replace(/\\?_/g, ''); // LaTeX "C_6H_6"
  if (!/^(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+$/.test(s)) return null;
  const counts = new Map<string, number>();
  const add = (el: string, n: number) => counts.set(el, (counts.get(el) ?? 0) + n);
  for (const g of s.matchAll(/\(((?:[A-Z][a-z]?\d*)+)\)(\d*)|([A-Z][a-z]?)(\d*)/g)) {
    if (g[1]) {
      const mult = g[2] ? Number(g[2]) : 1;
      for (const inner of g[1].matchAll(/([A-Z][a-z]?)(\d*)/g)) add(inner[1], (inner[2] ? Number(inner[2]) : 1) * mult);
    } else add(g[3], g[4] ? Number(g[4]) : 1);
  }
  if ([...counts.keys()].some((e) => !isKnownElement(e))) return null;
  return { counts, charge };
}

/** Does a formula label agree with the drawn atoms? Only meaningful when every atom (hydrogens too) is drawn. */
export function formulaMismatch(m: Mol, label: string): string | null {
  const f = parseFormula(label);
  if (!f) return null;
  const drawn = new Map<string, number>();
  for (const a of m.atoms) drawn.set(a.el, (drawn.get(a.el) ?? 0) + 1);
  const els = new Set([...drawn.keys(), ...f.counts.keys()]);
  const diff = [...els].filter((e) => (drawn.get(e) ?? 0) !== (f.counts.get(e) ?? 0));
  const charge = m.atoms.reduce((s, a) => s + (a.charge ?? 0), 0);
  if (!diff.length && charge === f.charge) return null;
  const parts = diff.map((e) => `${e}: label ${f.counts.get(e) ?? 0}, drawn ${drawn.get(e) ?? 0}`);
  if (charge !== f.charge) parts.push(`charge: label ${f.charge}, drawn ${charge}`);
  return `the label "${label}" says ${parts.join('; ')} — the drawn structure is ${formulaOf(m)}`;
}

/**
 * Smallest rings (each a cycle of atom indices in ring order), one per
 * independent cycle — enough to draw fused and isolated rings as polygons.
 */
export function findRings(n: number, bonds: MolBond[], maxSize = 8): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of bonds) if (a < n && b < n && a !== b && !adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); }
  const rings: number[][] = [];
  const keys = new Set<string>();
  // for every bond, the shortest cycle through it = shortest path between its ends without using it
  for (const [a, b] of bonds) {
    if (a >= n || b >= n || a === b) continue;
    const prev = new Map<number, number>([[a, -1]]);
    const queue = [a];
    while (queue.length && !prev.has(b)) {
      const u = queue.shift()!;
      for (const v of adj[u]) {
        if (prev.has(v) || (u === a && v === b)) continue;
        prev.set(v, u);
        queue.push(v);
      }
    }
    if (!prev.has(b)) continue;
    const ring: number[] = [];
    for (let v = b; v !== -1; v = prev.get(v)!) ring.push(v);
    if (ring.length < 3 || ring.length > maxSize) continue;
    const key = [...ring].sort((x, y) => x - y).join(',');
    if (keys.has(key)) continue;
    keys.add(key);
    rings.push(ring);
  }
  // keep only rings that add a new bond (drop the envelope of fused systems, e.g. naphthalene's 10-ring)
  rings.sort((x, y) => x.length - y.length);
  const used = new Set<string>();
  const bondKey = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);
  return rings.filter((r) => {
    const ks = r.map((v, i) => bondKey(v, r[(i + 1) % r.length]));
    if (ks.every((k) => used.has(k))) return false;
    ks.forEach((k) => used.add(k));
    return true;
  });
}

export type MolPart = { kind: 'atom'; i: number } | { kind: 'bond'; a: number; b: number; k: number } | { kind: 'lp'; i: number };

/**
 * What a part reference names inside a molecule: an atom ("C1"), a bond between
 * two atoms ("C1-Br", either order) or an atom's lone pairs ("lp-O"). Atom ids
 * win over the other readings; null if it names nothing.
 */
export function moleculePart(m: Mol, part: string): MolPart | null {
  const idx = new Map<string, number>();
  m.atoms.forEach((a, i) => { if (a.id) idx.set(a.id, i); });
  if (idx.has(part)) return { kind: 'atom', i: idx.get(part)! };
  if (part.startsWith('lp-') && idx.has(part.slice(3))) return { kind: 'lp', i: idx.get(part.slice(3))! };
  for (let cut = part.indexOf('-'); cut > 0; cut = part.indexOf('-', cut + 1)) {
    const a = idx.get(part.slice(0, cut)), b = idx.get(part.slice(cut + 1));
    if (a === undefined || b === undefined) continue;
    const k = m.bonds.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
    if (k >= 0) return { kind: 'bond', a, b, k };
  }
  return null;
}

/** Lone pairs on atom i: declared, or implied by a negative charge (an anion's pair). */
export const lonePairsOn = (m: Mol, i: number) =>
  (m.lonePairs ?? []).filter((l) => l.atom === i).reduce((s, l) => s + l.count, 0) || ((m.atoms[i]?.charge ?? 0) < 0 ? 1 : 0);

export type Side = { mol: Mol; n: number; id: string }[];

/** Do the two sides of a reaction have the same atoms and the same total charge? Returns what differs, or null. */
export function reactionBalance(left: Side, right: Side): string | null {
  const tally = (side: Side) => {
    const c = new Map<string, number>();
    let q = 0;
    for (const { mol, n } of side) {
      for (const a of mol.atoms) { c.set(a.el, (c.get(a.el) ?? 0) + n); q += (a.charge ?? 0) * n; }
    }
    return { c, q };
  };
  const L = tally(left), R = tally(right);
  const els = [...new Set([...L.c.keys(), ...R.c.keys()])].sort();
  const diff = els.filter((e) => (L.c.get(e) ?? 0) !== (R.c.get(e) ?? 0)).map((e) => `${e}: ${L.c.get(e) ?? 0} on the left, ${R.c.get(e) ?? 0} on the right`);
  if (L.q !== R.q) diff.push(`charge: ${L.q} on the left, ${R.q} on the right`);
  if (!diff.length) return null;
  const show = (side: Side) => side.map(({ mol, n, id }) => `${n > 1 ? `${n} ` : ''}${formulaOf(mol)} (${id})`).join(' + ');
  return `${show(left)} → ${show(right)} doesn't balance — ${diff.join('; ')}. Fix the coefficients ("n") or the structures`;
}
