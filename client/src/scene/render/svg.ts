/** Small SVG helpers shared by the primitive builders. */
import { FONT_MONO, FONT_SANS, INK } from '../tokens';
import type { Pt } from '../types';

export const SVGNS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number | undefined> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return node;
}

export function text(parent: Element, str: string, attrs: {
  x?: number; y?: number; size?: number; weight?: number; mono?: boolean; fill?: string; anchor?: 'start' | 'middle' | 'end'; italic?: boolean; opacity?: number;
} = {}): SVGTextElement {
  const t = el('text', {
    x: attrs.x ?? 0,
    y: attrs.y ?? 0,
    'font-family': attrs.mono ? FONT_MONO : FONT_SANS,
    'font-size': attrs.size ?? 18,
    'font-weight': attrs.weight ?? 500,
    'font-style': attrs.italic ? 'italic' : undefined,
    fill: attrs.fill ?? INK,
    'text-anchor': attrs.anchor ?? 'middle',
    'dominant-baseline': 'central',
    opacity: attrs.opacity,
  }, parent);
  t.textContent = str;
  return t;
}

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', Theta: 'Θ', kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', Pi: 'Π', rho: 'ρ',
  sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', varphi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω',
  circ: '°', degree: '°', cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠',
  approx: '≈', sim: '∼', equiv: '≡', propto: '∝', infty: '∞', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
  nabla: '∇', partial: '∂', sum: 'Σ', prod: 'Π', int: '∫', perp: '⊥', parallel: '∥', angle: '∠', triangle: '△', in: '∈',
  ldots: '…', cdots: '⋯', prime: '′', hbar: 'ℏ', ell: 'ℓ',
};
const FUNCS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'max', 'min', 'lim', 'det', 'arg']);
/** commands whose {argument} is shown as is */
const WRAPPERS = new Set(['text', 'mathrm', 'mathbf', 'mathit', 'operatorname', 'vec', 'hat', 'bar', 'overline', 'boldsymbol', 'mathbb', 'mathcal']);

type Run = { text: string; shift: 0 | 1 | -1 };

/** A short label as written by a model ("F_N", "mg \sin\theta", "\theta = 30^\circ") → text runs. */
export function mathRuns(src: string): Run[] {
  const runs: Run[] = [];
  const push = (text: string, shift: Run['shift']) => {
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && last.shift === shift) last.text += text; else runs.push({ text, shift });
  };
  const s = src.replace(/\$/g, '');
  let i = 0;
  const group = (): string => {
    // {…} or a single token, flattened to plain text
    if (s[i] === '{') {
      let depth = 0, j = i;
      for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}' && --depth === 0) break; }
      const inner = s.slice(i + 1, j);
      i = j + 1;
      return flat(inner);
    }
    if (s[i] === '\\') {
      const m = /^\\\\?([a-zA-Z]+)/.exec(s.slice(i));
      if (m) { i += m[0].length; return SYMBOLS[m[1]] ?? m[1]; }
    }
    return s[i++] ?? '';
  };
  const flat = (t: string) => mathRuns(t).map((r) => r.text).join('');
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') {
      // "\\mathbf" (over-escaped by the model) is meant as "\mathbf"
      const m = /^\\\\?([a-zA-Z]+)/.exec(s.slice(i));
      if (!m) {
        // \( \) \[ \] are delimiters; \, \; \  are spaces; \{ is a brace
        const next = s[i + 1] ?? '';
        i += 2;
        if (!'()[]'.includes(next)) push(' ,;:!'.includes(next) ? ' ' : next, 0);
        continue;
      }
      i += m[0].length;
      const name = m[1];
      if (name === 'left' || name === 'right') continue;
      if (name === 'frac') { const a = group(), b = group(); push(`${a.length > 1 ? `(${a})` : a}/${b.length > 1 ? `(${b})` : b}`, 0); continue; }
      if (name === 'sqrt') { const a = group(); push(`√${a.length > 1 ? `(${a})` : a}`, 0); continue; }
      if (WRAPPERS.has(name)) { if (s[i] === '{') push(group(), 0); continue; }
      if (FUNCS.has(name)) { push(name, 0); if (/[a-zA-Z\\]/.test(s[i] ?? '')) push(' ', 0); continue; }
      push(SYMBOLS[name] ?? name, 0);
      continue;
    }
    if (ch === '^' || ch === '_') {
      i++;
      const g = group();
      if (ch === '^' && (g === '°' || g === '′')) push(g, 0);
      else push(g, ch === '^' ? 1 : -1);
      continue;
    }
    if (ch === '{' || ch === '}') { i++; continue; }
    push(ch, 0);
    i++;
  }
  return runs;
}

const looksMath = (s: string) => /\\[a-zA-Z]|[_^]/.test(s);

/**
 * Text for a label in a mathematical figure: LaTeX-ish input ("F_N",
 * "mg \sin\theta") becomes Unicode with real sub/superscripts, plain text
 * passes through unchanged.
 */
export function mathText(parent: Element, str: string, attrs: Parameters<typeof text>[2] = {}): SVGTextElement {
  if (!looksMath(str)) return text(parent, str, attrs);
  const t = text(parent, '', attrs);
  const size = attrs.size ?? 18;
  let level = 0;
  for (const r of mathRuns(str)) {
    const span = el('tspan', {}, t);
    const dy = (r.shift - level) * -size * 0.32;
    if (dy) span.setAttribute('dy', dy.toFixed(1));
    if (r.shift) span.setAttribute('font-size', (size * 0.72).toFixed(1));
    span.textContent = r.text;
    level = r.shift;
  }
  return t;
}

export const translate = (g: Element, x: number, y: number) => g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);

/** Shared <defs>: glow filter, arrowheads, atom shading. Call once per <svg>. */
export function installDefs(svg: SVGSVGElement, uid: string) {
  const defs = el('defs', {}, svg);
  const glow = el('filter', { id: `${uid}-glow`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: 0 }, glow);
  const soft = el('filter', { id: `${uid}-shadow`, x: '-30%', y: '-30%', width: '160%', height: '180%' }, defs);
  el('feDropShadow', { dx: 0, dy: 8, stdDeviation: 9, 'flood-color': '#000', 'flood-opacity': 0.5 }, soft);
  const shade = el('radialGradient', { id: `${uid}-atom`, cx: '35%', cy: '30%', r: '75%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0.45 }, shade);
  el('stop', { offset: '55%', 'stop-color': '#fff', 'stop-opacity': 0 }, shade);
  el('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0.35 }, shade);
  const cell = el('linearGradient', { id: `${uid}-cell`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: '0%', 'stop-color': '#282725' }, cell);
  el('stop', { offset: '55%', 'stop-color': '#1C1B19' }, cell);
  el('stop', { offset: '100%', 'stop-color': '#151412' }, cell);
  return defs;
}

const markers = new Map<string, string>();
/** An arrowhead marker in `color`, created on demand. */
export function arrowMarker(svg: SVGSVGElement, uid: string, color: string): string {
  const key = `${uid}|${color}`;
  // our own ids ("tb3-arrow-2"): an attribute lookup needs no CSS.escape (absent outside browsers)
  if (markers.has(key) && svg.querySelector(`[id="${markers.get(key)!}"]`)) return markers.get(key)!;
  const id = `${uid}-arrow-${markers.size}`;
  const defs = svg.querySelector('defs')!;
  const m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m);
  markers.set(key, id);
  return id;
}

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
export const angleOf = (from: Pt, to: Pt) => Math.atan2(to.y - from.y, to.x - from.x);
export const along = (p: Pt, ang: number, d: number): Pt => ({ x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d });
