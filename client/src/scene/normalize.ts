/**
 * Client-side contract guard (checklist 1.4). Scenes from the server are
 * already validated, but the engine must never crash on a scene that skipped
 * validation (Scene Lab, cached payloads, older servers): apply the schema's
 * defaults and drop what the engine can't draw.
 */
import { resolveGeometry } from '../../../server/engine/scene/resolveGeometry';
import { resolveParams, type ParamValues } from '../../../server/engine/scene/params';
import { expandComputed } from '../../../server/engine/scene/algorithms';
import type { Scene } from './types';

const KNOWN_ENTITIES = new Set([
  'text', 'math', 'rect', 'circle', 'pie', 'point', 'polygon', 'line', 'arrow', 'path', 'angle', 'plot', 'curve', 'area', 'refline', 'vector', 'body', 'scatter',
  'array', 'stack', 'queue', 'linkedlist', 'tree', 'graph', 'table', 'molecule', 'reaction', 'curly', 'compartment', 'circuit', 'logic', 'network', 'pixels', 'group',
]);

const ENTITY_DEFAULTS: Record<string, Record<string, unknown>> = {
  text: { role: 'body', text: '' },
  rect: { size: 'md' },
  circle: { size: 'md' },
  pie: { size: 'lg', shaded: 0 },
  polygon: { fill: true },
  line: { dashed: false },
  arrow: { dashed: false },
  path: { smooth: true },
  angle: { showValue: true },
  body: { size: 'sm' },
  array: { indices: true, values: [] },
  stack: { values: [] },
  queue: { values: [] },
  linkedlist: { doubly: false, values: [] },
  graph: { directed: false, arrangement: 'auto', edges: [] },
};
const SPACE_DEFAULTS = { axes: true, grid: false, equalAspect: false };
const ACTION_DEFAULTS: Record<string, Record<string, unknown>> = {
  highlight: { hold: true },
  connect: { style: 'arrow' },
  trace: { duration: 'normal' },
  focus: { zoom: 'medium' },
  wait: { beats: 1 },
  rearrange: { into: 'strip' },
};

type Loose = Record<string, unknown>;

export function normalizeScene(input: unknown, params: ParamValues = {}): Scene {
  // parameters (sliders) written in, at the learner's values; then geometry written by intent becomes coordinates
  // computed algorithm traces (golden scenes are loaded raw; the server expands them for AI scenes), then parameters
  const traced = expandComputed(input).value;
  const withParams = traced && typeof traced === 'object' ? resolveParams(traced as Loose, params) : traced;
  const s = (resolveGeometry(withParams ?? {}).value ?? {}) as Loose;
  const entities = (Array.isArray(s.entities) ? s.entities : [])
    .filter((e: Loose) => e && typeof e.id === 'string' && KNOWN_ENTITIES.has(String(e.type)))
    .map((e: Loose): Loose => ({ ...ENTITY_DEFAULTS[String(e.type)], ...e }));
  const spaces = (Array.isArray(s.spaces) ? s.spaces : [])
    .filter((sp: Loose) => sp && sp.kind === 'cartesian' && Array.isArray(sp.x) && Array.isArray(sp.y))
    .map((sp: Loose): Loose => ({
      ...SPACE_DEFAULTS,
      // directions are the lesson when a space holds vectors or angles: true shape (as the server does)
      equalAspect: entities.some((e: Loose) => e.space === sp.id && (e.type === 'vector' || e.type === 'angle')),
      ...sp,
    }));
  const layout = (Array.isArray(s.layout) ? s.layout : [])
    .filter((r: Loose) => r && typeof r.rel === 'string')
    .map((r: Loose) => ({ gap: ['row', 'column', 'grid'].includes(String(r.rel)) ? 'lg' : 'md', ...r }));
  const beats = (Array.isArray(s.beats) ? s.beats : []).map((b: Loose, i: number) => ({
    title: typeof b.title === 'string' ? b.title : `Step ${i + 1}`,
    narration: typeof b.narration === 'string' ? b.narration : '',
    pace: 'normal',
    ...b,
    actions: (Array.isArray(b.actions) ? b.actions : [])
      .filter((a: Loose) => a && typeof a.do === 'string')
      .map((a: Loose) => ({ ...ACTION_DEFAULTS[String(a.do)], ...a })),
  }));
  return {
    version: '1',
    title: typeof s.title === 'string' ? s.title : 'Untitled',
    domain: (s.domain as Scene['domain']) ?? 'general',
    ...(s as object),
    spaces,
    entities,
    layout,
    beats,
  } as Scene;
}
