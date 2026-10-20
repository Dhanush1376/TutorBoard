/**
 * LaTeX in places that show plain text — titles, narration, board text,
 * callouts — becomes readable Unicode: "Roots of \(x^2-4x+3\)" → "Roots of x²−4x+3".
 * Only text with math delimiters or backslash commands is touched, so plain
 * prose (and identifiers like max_heap) passes through unchanged.
 */

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', Theta: 'Θ', kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', Pi: 'Π', rho: 'ρ',
  sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', varphi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω',
  circ: '°', degree: '°', cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠',
  approx: '≈', sim: '∼', equiv: '≡', propto: '∝', infty: '∞', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
  nabla: '∇', partial: '∂', sum: 'Σ', prod: 'Π', int: '∫', perp: '⊥', parallel: '∥', angle: '∠', triangle: '△', in: '∈',
  ldots: '…', cdots: '⋯', prime: '′', hbar: 'ℏ', ell: 'ℓ', quad: ' ', qquad: '  ',
};
const FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'max', 'min', 'lim', 'det', 'arg'];
const SUP: Record<string, string> = {
  0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ', T: 'ᵀ',
};
const SUB: Record<string, string> = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', p: 'ₚ', s: 'ₛ', t: 'ₜ', i: 'ᵢ', j: 'ⱼ',
};

const script = (s: string, map: Record<string, string>, mark: string) => {
  if (s === '°' || s === '′') return s;
  const chars = [...s];
  if (chars.every((c) => map[c])) return chars.map((c) => map[c]).join('');
  return chars.length === 1 ? `${mark}${s}` : `${mark}(${s})`;
};
const wrap = (s: string) => (s.trim().length > 1 && /[^\w.]/.test(s.trim()) ? `(${s.trim()})` : s.trim());

/** The inside of a math span → plain Unicode. */
export function mathToPlain(m: string): string {
  let t = m;
  t = t.replace(/\\[,;:! ]/g, ' ').replace(/\\left|\\right/g, '');
  t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a: string, b: string) => `${wrap(a)}/${wrap(b)}`);
  t = t.replace(/\\sqrt\{([^{}]*)\}/g, (_, a: string) => `√${a.trim().length > 1 ? `(${a.trim()})` : a.trim()}`);
  t = t.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|vec|hat|bar|overline|boldsymbol)\{([^{}]*)\}/g, '$1');
  t = t.replace(new RegExp(`([\\p{L}\\p{N}])?\\\\(${FUNCS.join('|')})(?![a-zA-Z])\\s*`, 'gu'), (_, pre: string | undefined, fn: string) => `${pre ? `${pre} ` : ''}${fn} `);
  t = t.replace(/\\([a-zA-Z]+)/g, (raw, name: string) => SYMBOLS[name] ?? name);
  t = t.replace(/\^\{([^{}]*)\}|\^(.)/g, (_, a: string | undefined, b: string | undefined) => script(a ?? b ?? '', SUP, '^'));
  t = t.replace(/_\{([^{}]*)\}|_(.)/g, (_, a: string | undefined, b: string | undefined) => script(a ?? b ?? '', SUB, '_'));
  t = t.replace(/[{}]/g, '');
  // a minus sign, not a hyphen, between terms
  t = t.replace(/([\p{L}\p{N})²³¹⁰-⁹])(\s*)-(\s*)(?=[\p{L}\p{N}(√])/gu, '$1$2−$3').replace(/^-(?=[\p{L}\p{N}])/u, '−');
  return t.replace(/ {2,}/g, ' ').trim();
}

/** A bare power in plain text: "(x-2)^2", "10^{-3}", "x^n" (not "a ^ b" or "^_^"). */
const BARE_POWER = /([\p{L}\p{N})\]])\^(\{[-−]?[\p{N}a-zA-Z]{1,3}\}|[-−]?\p{N}{1,3}|[a-zA-Z](?![a-zA-Z]))/gu;

/** Text that may contain \( … \), \[ … \], $ … $, bare commands or bare powers → plain Unicode. */
export function latexToPlain(s: string): string {
  s = s.replace(BARE_POWER, (raw, base: string, exp: string) => {
    const sup = script(exp.replace(/[{}]/g, ''), SUP, '^');
    return sup.startsWith('^') ? raw : base + sup;
  });
  if (!/\\[([a-zA-Z]|\$[^$]+\$/.test(s)) return s;
  return s
    // "$…$" only when it is clearly maths, so "costs $5 and $10" survives
    .replace(/\\\((.+?)\\\)|\\\[(.+?)\\\]|\$\$(.+?)\$\$|\$(?=\S)([^$]*?[\\^_=][^$]*?)(?<=\S)\$/g, (_, a?: string, b?: string, c?: string, d?: string) => mathToPlain(a ?? b ?? c ?? d ?? ''))
    .replace(/\\([a-zA-Z]+)/g, (raw, name: string) => SYMBOLS[name] ?? (FUNCS.includes(name) ? name : raw));
}
