import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { latexToPlain, mathToPlain } from '../engine/scene/plainMath.js';
import { validateScene } from '../engine/scene/index.js';

const golden = (name: string) => JSON.parse(readFileSync(new URL(`../engine/scene/fixtures/${name}`, import.meta.url), 'utf8'));

describe('LaTeX in plain-text fields', () => {
  it('turns delimited math into readable Unicode (docs/eval/runs/flash36-low-v2/math-2 title)', () => {
    expect(latexToPlain('Roots of \\(x^2-4x+3\\)')).toBe('Roots of x²−4x+3');
    expect(latexToPlain('Energy: $E = mc^2$')).toBe('Energy: E = mc²');
    expect(latexToPlain('The angle is \\(\\theta = 30^\\circ\\)')).toBe('The angle is θ = 30°');
    expect(latexToPlain('so \\[v = \\sqrt{2gh}\\]')).toBe('so v = √(2gh)');
  });

  it('writes bare powers as superscripts (docs/eval/runs/full-48-part3/ml-2: a title read "f(x) = (x-2)^2")', () => {
    expect(latexToPlain('f(x) = (x-2)^2')).toBe('f(x) = (x-2)²');
    expect(latexToPlain('x^2 grows fast')).toBe('x² grows fast');
    expect(latexToPlain('error ~ 10^{-3}, cost 2^n')).toBe('error ~ 10⁻³, cost 2ⁿ');
  });

  it('handles fractions, functions, subscripts', () => {
    expect(mathToPlain('\\frac{1}{2}mv^2')).toBe('1/2mv²');
    expect(mathToPlain('F_{net} = mg\\sin\\theta - F_f')).toBe('Fₙₑₜ = mg sin θ − F_f');
    expect(mathToPlain('a_1 + a_2')).toBe('a₁ + a₂');
    expect(mathToPlain('x^{n+1}')).toBe('xⁿ⁺¹');
  });

  it('leaves prose, money and identifiers alone', () => {
    for (const s of ['Swap 5 and 3', 'It costs $5 and $10 later', 'max_heap stores the max at the top', 'a ^ b is XOR', 'ok ^_^']) {
      expect(latexToPlain(s)).toBe(s);
    }
  });

  it('is applied to titles, narration and callouts, but not to code', () => {
    const s = golden('bubble-sort.json');
    s.title = 'Sorting in \\(O(n^2)\\)';
    s.beats[0].narration = 'Bubble sort takes \\(O(n^2)\\) comparisons.';
    s.entities.push({ id: 'snippet', type: 'text', role: 'code', text: 'print("\\(x\\)")' });
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scene.title).toBe('Sorting in O(n²)');
      expect(r.scene.beats[0].narration).toBe('Bubble sort takes O(n²) comparisons.');
      expect((r.scene.entities.find((e) => e.id === 'snippet') as { text: string }).text).toBe('print("\\(x\\)")');
    }
  });
});

describe('spaces', () => {
  it('fixes an unknown space kind and adopts entities missing their only space', () => {
    const s = golden('projectile-45.json');
    s.spaces[0].kind = 'cartesian2d';
    for (const e of s.entities) delete e.space;
    const r = validateScene(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scene.spaces[0].kind).toBe('cartesian');
      expect(r.warnings.some((w) => /placed in the only space/.test(w.message))).toBe(true);
    }
  });
});
