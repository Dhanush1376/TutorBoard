/**
 * Intrinsic size of everything the layout solver positions (board entities
 * and spaces), plus geometry the renderer reuses. Sizes cover every state an
 * entity will reach in the scene (max data-structure length, longest text it
 * will be set to), so nothing reflows mid-lesson.
 */
import { layoutCompartment, type CompLayout } from '../../../server/engine/scene/compartments';
import { layoutCircuit, type CircuitLayout } from '../../../server/engine/scene/circuits';
import { layoutLogic, type LogicLayout } from '../../../server/engine/scene/logic';
import {
  graphLayout, moleculeLayout, MoleculeGeo, NodeGeo, spaceSize, textWidth, treeLayout,
} from './geometry';
import type { Sim } from './simulate';
import { CELL, FONT_MONO, REACTION, SIZE_PX } from './tokens';
import type { Entity, Scene } from './types';

export const TEXT_ROLE: Record<string, { size: number; weight: number; mono?: boolean }> = {
  title: { size: 22, weight: 650 },
  body: { size: 15, weight: 500 },
  caption: { size: 16, weight: 650 },
  label: { size: 13, weight: 600 },
  code: { size: 14, weight: 500, mono: true },
};
export const LABEL_H = 30; // entity label above its body
export const MAX_TEXT_W = 720;
/** `gutter`: room left of the walls for the "top" pointer. */
export const STACK = { w: 150, itemH: 56, gap: 8, pad: 14, gutter: 92 };
export const QUEUE = { itemW: 100, itemH: 56, gap: 10, pad: 16 };
export const LIST = { nodeW: 92, nodeH: 56, link: 50 };
export const NET = { layerGap: 170, nodeGap: 58, r: 15 };

export type Measured = {
  w: number;
  h: number;
  /** vertical offset of the entity's body below its label */
  bodyY: number;
  mol?: MoleculeGeo;
  comp?: CompLayout;
  circuit?: CircuitLayout;
  logic?: LogicLayout;
  nodes?: NodeGeo;
  lines?: string[];
  colW?: number[];
  cell?: number;
};

const labelOf = (e: Entity) => (e.label ? LABEL_H : 0);

/** Every text a text entity will show (initial + later `set`s). */
const textsFor = (scene: Scene, id: string, initial: string) => {
  const out = [initial];
  for (const b of scene.beats) for (const a of b.actions) if (a.do === 'set' && a.target === id && a.text !== undefined) out.push(a.text);
  return out;
};
const latexFor = (scene: Scene, id: string, initial: string) => {
  const out = [initial];
  for (const b of scene.beats) for (const a of b.actions) if (a.do === 'set' && a.target === id && a.latex !== undefined) out.push(a.latex);
  return out;
};

/** Greedy word wrap to `max` px. */
export function wrap(text: string, size: number, weight: number, max = MAX_TEXT_W, family?: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && textWidth(next, size, weight, family) > max) { lines.push(cur); cur = w; } else cur = next;
  }
  lines.push(cur);
  return lines;
}

/** Rough KaTeX size: commands shrink, fractions stack. Replaced by a DOM measurement in the browser. */
export const estimateLatexSize = (latex: string) => {
  const visible = latex.replace(/\\(frac|mathrm|text|left|right|,|;|quad)/g, '').replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}^_]/g, '');
  const tall = /\\(frac|dfrac|sum|int|sqrt|lfloor|lceil|binom|begin)/.test(latex);
  return { w: Math.max(40, visible.length * 17), h: tall ? 64 : 40 };
};
export const estimateLatexWidth = (latex: string) => estimateLatexSize(latex).w;

export function measureEntity(e: Entity, scene: Scene, sim: Sim, latexSize = estimateLatexSize): Measured | null {
  const top = labelOf(e);
  switch (e.type) {
    case 'text': {
      const role = TEXT_ROLE[e.role] ?? TEXT_ROLE.body;
      const fam = role.mono ? FONT_MONO : undefined;
      const wrapped = textsFor(scene, e.id, e.text).map((t) => wrap(t, role.size, role.weight, MAX_TEXT_W, fam));
      const w = Math.max(24, ...wrapped.flat().map((l) => textWidth(l, role.size, role.weight, fam)));
      const rows = Math.max(...wrapped.map((l) => l.length));
      const padX = 22;
      const padY = 10;
      return { w: w + padX, h: rows * role.size * 1.32 + padY + top, bodyY: top, lines: wrapped[0] };
    }
    case 'math': {
      const sizes = latexFor(scene, e.id, e.latex).map((l) => latexSize(l));
      const w = Math.max(...sizes.map((s) => s.w));
      const h = Math.max(...sizes.map((s) => s.h));
      return { w: w + 64, h: Math.max(54, h + 22) + top, bodyY: top };
    }
    case 'rect': {
      const s = SIZE_PX[e.size] ?? 110;
      const w = Math.max(s * 1.6, e.text ? textWidth(e.text, 20, 600) + 36 : 0);
      return { w, h: s + top, bodyY: top };
    }
    case 'circle': {
      const s = Math.max(SIZE_PX[e.size] ?? 110, e.text ? textWidth(e.text, 20, 600) + 28 : 0);
      return { w: s, h: s + top, bodyY: top };
    }
    case 'pie': {
      const s = Math.max(120, (SIZE_PX[e.size] ?? 150) * 1.25);
      // laid out as a row of slices later: (n + 1) half-chords wide
      const rearranged = scene.beats.some((b) => b.actions.some((a) => a.do === 'rearrange' && a.target === e.id));
      const r = s / 2 - 3;
      const strip = rearranged ? (e.slices + 1) * r * Math.sin(Math.PI / e.slices) + 16 : 0;
      return { w: Math.max(s, strip), h: s + top, bodyY: top };
    }
    case 'array': {
      const n = Math.max(1, sim.maxLen.get(e.id) ?? 1);
      return { w: n * (CELL.size + CELL.gap) - CELL.gap, h: CELL.size + (e.indices ? 32 : 0) + top, bodyY: top };
    }
    case 'stack': {
      const n = Math.max(2, sim.maxLen.get(e.id) ?? 0);
      return { w: STACK.gutter + STACK.w, h: n * (STACK.itemH + STACK.gap) + STACK.pad * 2 + top, bodyY: top };
    }
    case 'queue': {
      const n = Math.max(3, sim.maxLen.get(e.id) ?? 0);
      return { w: n * (QUEUE.itemW + QUEUE.gap) + QUEUE.pad * 2 + 70, h: QUEUE.itemH + QUEUE.pad * 2 + 64 + top, bodyY: top };
    }
    case 'linkedlist': {
      const n = Math.max(1, sim.maxLen.get(e.id) ?? 1);
      return { w: n * LIST.nodeW + n * LIST.link + 40, h: LIST.nodeH + top, bodyY: top };
    }
    case 'tree': {
      const nodes = treeLayout(e);
      return { w: nodes.box.w, h: nodes.box.h + top, bodyY: top, nodes };
    }
    case 'graph': {
      const nodes = graphLayout(e);
      return { w: nodes.box.w, h: nodes.box.h + top, bodyY: top, nodes };
    }
    case 'table': {
      const cols = Math.max(e.columns?.length ?? 0, ...e.rows.map((r) => r.length));
      // values "set" into cells later in the lesson need room too
      const later = new Map<number, string[]>();
      for (const bt of scene.beats) for (const a of bt.actions) {
        if (a.do !== 'set' || a.value === undefined || typeof a.target !== 'string' || !a.target.startsWith(`${e.id}.r`)) continue;
        const m = /c(\d+)$/.exec(a.target);
        if (m) later.set(Number(m[1]), [...(later.get(Number(m[1])) ?? []), String(a.value)]);
      }
      const colW = Array.from({ length: cols }, (_, c) => {
        const cells = [e.columns?.[c] ?? '', ...e.rows.map((r) => String(r[c] ?? '')), ...(later.get(c) ?? [])];
        return Math.max(72, ...cells.map((t) => textWidth(t, 17, 500) + 36));
      });
      const rows = e.rows.length + (e.columns ? 1 : 0);
      return { w: colW.reduce((a, b) => a + b, 0), h: rows * 46 + top, bodyY: top, colW };
    }
    case 'molecule': {
      const mol = moleculeLayout(e);
      return { w: mol.box.w, h: mol.box.h + top, bodyY: top, mol };
    }
    case 'circuit': {
      const lay = layoutCircuit(e);
      return { w: lay.w, h: lay.h + top, bodyY: top, circuit: lay };
    }
    case 'logic': {
      const lay = layoutLogic(e);
      return { w: lay.w, h: lay.h + top, bodyY: top, logic: lay };
    }
    case 'compartment': {
      const lay = layoutCompartment(e);
      return { w: lay.w, h: lay.h + top, bodyY: top, comp: lay };
    }
    case 'reaction': {
      const w = Math.max(REACTION.minW, (e.conditions ? textWidth(e.conditions, 15, 600) : 0) + 48);
      return { w, h: REACTION.h + top, bodyY: top };
    }
    case 'network': {
      const maxN = Math.max(...e.layers);
      const left = e.inputLabels?.length ? 96 : 0;
      const right = e.outputLabels?.length ? 110 : 0;
      return { w: (e.layers.length - 1) * NET.layerGap + NET.r * 2 + left + right, h: (maxN - 1) * NET.nodeGap + NET.r * 2 + 20 + top, bodyY: top };
    }
    case 'pixels': {
      const rows = e.grid.length;
      const cols = Math.max(...e.grid.map((r) => r.length));
      const cell = Math.min(22, 300 / Math.max(rows, cols));
      return { w: cols * cell, h: rows * cell + top, bodyY: top, cell };
    }
    default:
      return null; // spatial, attached or group entities are not laid out on the board
  }
}

export function measureScene(scene: Scene, sim: Sim, latexSize?: (l: string) => { w: number; h: number }) {
  const out = new Map<string, Measured>();
  for (const s of scene.spaces) {
    const { w, h } = spaceSize(s);
    out.set(s.id, { w, h, bodyY: 0 });
  }
  for (const e of scene.entities) {
    if ('space' in e && e.space) continue;
    const m = measureEntity(e, scene, sim, latexSize);
    if (m) out.set(e.id, m);
  }
  return out;
}
