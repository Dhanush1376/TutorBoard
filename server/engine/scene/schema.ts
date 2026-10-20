/**
 * Scene Language v1 — the one format the AI writes and the engine plays.
 *
 * A scene is a set of entities (general visual primitives), layout relations
 * (the AI never picks pixels), optional coordinate spaces (domain units for
 * maths/physics), and an ordered list of beats. Each beat is one step of the
 * lesson: a title, narration, and the actions that animate it.
 *
 * Spec: docs/SCENE_LANGUAGE.md · Semantic rules: ./validate.ts
 */
import { z } from 'zod';

export const SCENE_VERSION = '1';

export const LIMITS = {
  entities: 60,
  beats: 12,
  actionsPerBeat: 24,
  values: 64,
  title: 120,
  narration: 600,
} as const;

// ── Basics ──────────────────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
/** entity id, optionally with an element index (`arr[2]`) or a named part (`tri.A`, `g.n3`). */
const REF_RE = /^[A-Za-z][A-Za-z0-9_-]{0,39}(\[\d{1,3}\]|\.[A-Za-z0-9_-]{1,40})?$/;

export const Id = z.string().regex(ID_RE, 'must start with a letter and use only letters, digits, "_" or "-" (max 40 chars)');
export const Ref = z.string().regex(REF_RE, 'must be an id, an id with an index like "arr[2]", or an id with a part like "tri.A"');
const Num = z.number().finite();
export const Vec2 = z.tuple([Num, Num]);
export const Value = z.union([z.number().finite(), z.string().max(24)]);
const Values = z.array(Value).max(LIMITS.values);

/** Semantic colours — resolved by the engine's palette, never raw hex from the AI. */
export const Tone = z.enum(['default', 'primary', 'accent', 'success', 'warning', 'danger', 'info', 'muted']);
/** Algorithm/emphasis states (the app's ALGO_COLORS). */
export const EmphasisState = z.enum([
  'active', 'comparing', 'swapping', 'sorted', 'found', 'visited', 'eliminated', 'pivot', 'error', 'insight',
]);
export const Size = z.enum(['xs', 'sm', 'md', 'lg', 'xl']);
export const Gap = z.enum(['none', 'sm', 'md', 'lg', 'xl']);

export const Domain = z.enum([
  'algorithms', 'data-structures', 'math', 'geometry', 'physics', 'chemistry', 'biology', 'ml', 'general',
]);

// ── Spaces (domain units) ───────────────────────────────────────────────────

export const CartesianSpace = z.object({
  id: Id,
  kind: z.literal('cartesian'),
  x: z.tuple([Num, Num]).describe('visible x range in domain units, e.g. [0, 40] metres'),
  y: z.tuple([Num, Num]).describe('visible y range in domain units'),
  axes: z.boolean().default(true),
  grid: z.boolean().default(false),
  xLabel: z.string().max(24).optional(),
  yLabel: z.string().max(24).optional(),
  equalAspect: z.boolean().default(false).describe('true for geometry so circles stay round'),
});
export const Space = z.discriminatedUnion('kind', [CartesianSpace]);

// ── Entities (primitives) ───────────────────────────────────────────────────

const base = {
  id: Id,
  label: z.string().max(60).optional(),
  tone: Tone.optional(),
};
/** Entities placed in a cartesian space use domain units and must name the space. */
const spatial = { ...base, space: Id };

export const TextEntity = z.object({ ...base, type: z.literal('text'), text: z.string().max(200), role: z.enum(['title', 'body', 'caption', 'label', 'code']).default('body') });
export const MathEntity = z.object({ ...base, type: z.literal('math'), latex: z.string().max(240) });
export const RectEntity = z.object({ ...base, type: z.literal('rect'), size: Size.default('md'), text: z.string().max(60).optional() });
export const CircleEntity = z.object({ ...base, type: z.literal('circle'), size: Size.default('md'), text: z.string().max(24).optional() });
/** A circle cut into equal slices — fractions, percentages, probability. Slices are parts "p.s0"… clockwise from the top. */
export const PieEntity = z.object({
  ...base,
  type: z.literal('pie'),
  slices: z.number().int().min(2).max(24),
  shaded: z.union([z.number().int().min(0), z.array(z.number().int().min(0)).max(24)]).default(0).describe('how many slices (clockwise from the top) or which ones are shaded'),
  size: Size.default('lg'),
  sliceLabels: z.array(z.string().max(12)).max(24).optional(),
});

export const PointEntity = z.object({ ...spatial, type: z.literal('point'), at: Vec2 });
export const PolygonEntity = z.object({
  ...spatial,
  type: z.literal('polygon'),
  points: z.array(Vec2).min(3).max(12),
  vertexLabels: z.array(z.string().max(4)).max(12).optional().describe('names the vertices so actions can target "tri.A"'),
  fill: z.boolean().default(true),
});
const Endpoint = z.union([Vec2, Ref]);
export const LineEntity = z.object({ ...base, space: Id.optional(), type: z.enum(['line', 'arrow']), from: Endpoint, to: Endpoint, dashed: z.boolean().default(false) });
export const PathEntity = z.object({ ...spatial, type: z.literal('path'), points: z.array(Vec2).min(2).max(200), smooth: z.boolean().default(true) });
export const AngleEntity = z.object({
  ...base,
  space: Id.optional(),
  type: z.literal('angle'),
  vertex: Endpoint,
  from: Endpoint,
  to: Endpoint,
  showValue: z.boolean().default(true),
  degrees: Num.optional().describe('the value the lesson states; the drawing must agree'),
});
export const PlotEntity = z.object({
  ...spatial,
  type: z.literal('plot'),
  expr: z.string().max(120).describe('function of x, e.g. "x*tan(45deg) - 9.8*x^2/(2*20^2*cos(45deg)^2)"'),
  domain: z.tuple([Num, Num]).optional(),
});
export const VectorEntity = z.object({
  ...spatial,
  type: z.literal('vector'),
  from: Vec2,
  to: Vec2.optional(),
  angleDeg: Num.optional(),
  magnitude: Num.optional(),
});
export const BodyEntity = z.object({ ...spatial, type: z.literal('body'), at: Vec2, size: Size.default('sm') });
export const ScatterEntity = z.object({
  ...spatial,
  type: z.literal('scatter'),
  points: z.array(z.object({ at: Vec2, cls: z.string().max(16).optional() })).min(1).max(200),
});

export const ArrayEntity = z.object({ ...base, type: z.literal('array'), values: Values, indices: z.boolean().default(true) });
export const StackEntity = z.object({ ...base, type: z.literal('stack'), values: Values.describe('bottom → top') });
export const QueueEntity = z.object({ ...base, type: z.literal('queue'), values: Values.describe('front → rear') });
export const LinkedListEntity = z.object({ ...base, type: z.literal('linkedlist'), values: Values, doubly: z.boolean().default(false) });
export const TreeEntity = z.object({
  ...base,
  type: z.literal('tree'),
  nodes: z.array(z.object({ id: Id, value: Value, parent: Id.optional() })).min(1).max(40),
});
export const GraphEntity = z.object({
  ...base,
  type: z.literal('graph'),
  nodes: z.array(z.object({ id: Id, value: Value.optional() })).min(1).max(30),
  edges: z.array(z.object({ from: Id, to: Id, weight: Value.optional() })).max(80),
  directed: z.boolean().default(false),
  arrangement: z.enum(['auto', 'circle', 'grid', 'layered']).default('auto'),
});
export const TableEntity = z.object({
  ...base,
  type: z.literal('table'),
  columns: z.array(z.string().max(24)).max(12).optional(),
  rows: z.array(z.array(Value).max(12)).min(1).max(16),
});
export const MoleculeEntity = z.object({
  ...base,
  type: z.literal('molecule'),
  atoms: z.array(z.object({ id: Id.optional(), el: z.string().regex(/^[A-Z][a-z]?$/, 'element symbol, e.g. "O", "Cl"') })).min(1).max(30),
  bonds: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(1).max(3)])).max(40)
    .describe('[atomIndex, atomIndex, order]'),
  lonePairs: z.array(z.object({ atom: z.number().int().min(0), count: z.number().int().min(1).max(4) })).max(10).optional(),
});
export const NetworkEntity = z.object({
  ...base,
  type: z.literal('network'),
  layers: z.array(z.number().int().min(1).max(12)).min(2).max(8),
  inputLabels: z.array(z.string().max(16)).max(12).optional(),
  outputLabels: z.array(z.string().max(16)).max(12).optional(),
});
export const PixelsEntity = z.object({
  ...base,
  type: z.literal('pixels'),
  grid: z.array(z.array(z.number().min(0).max(1)).min(1).max(32)).min(1).max(32),
});
export const GroupEntity = z.object({ ...base, type: z.literal('group'), children: z.array(Id).min(1).max(20) });

export const Entity = z.discriminatedUnion('type', [
  TextEntity, MathEntity, RectEntity, CircleEntity, PieEntity,
  PointEntity, PolygonEntity, LineEntity, PathEntity, AngleEntity, PlotEntity, VectorEntity, BodyEntity, ScatterEntity,
  ArrayEntity, StackEntity, QueueEntity, LinkedListEntity, TreeEntity, GraphEntity, TableEntity,
  MoleculeEntity, NetworkEntity, PixelsEntity, GroupEntity,
]);

/** Types whose elements are addressed by index: `arr[2]`. */
export const INDEXED_TYPES = ['array', 'stack', 'queue', 'linkedlist'] as const;
/** Types that must live in a cartesian space. */
export const SPATIAL_TYPES = ['point', 'polygon', 'path', 'plot', 'vector', 'body', 'scatter'] as const;

// ── Layout (relations, never pixels) ────────────────────────────────────────

const Region = z.enum(['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);
export const Relation = z.discriminatedUnion('rel', [
  z.object({ rel: z.literal('place'), id: Id, region: Region }),
  z.object({ rel: z.literal('row'), ids: z.array(Id).min(2).max(8), gap: Gap.default('lg') }),
  z.object({ rel: z.literal('column'), ids: z.array(Id).min(2).max(8), gap: Gap.default('lg') }),
  z.object({ rel: z.literal('grid'), ids: z.array(Id).min(2).max(16), cols: z.number().int().min(2).max(6), gap: Gap.default('lg') }),
  z.object({ rel: z.enum(['above', 'below', 'left-of', 'right-of']), id: Id, of: Id, gap: Gap.default('md') }),
  z.object({ rel: z.literal('inside'), id: Id, of: Id }),
]);

// ── Actions ─────────────────────────────────────────────────────────────────

/** `with: "previous"` starts the action together with the one before it; otherwise actions run in sequence. */
const act = { with: z.literal('previous').optional() };
const Targets = z.union([Ref, z.array(Ref).min(1).max(12)]);

export const Action = z.discriminatedUnion('do', [
  z.object({ ...act, do: z.literal('create'), target: Targets, effect: z.enum(['fade', 'draw', 'pop', 'drop', 'grow', 'type']).optional() }),
  z.object({ ...act, do: z.literal('remove'), target: Targets, effect: z.enum(['fade', 'shrink', 'lift', 'slide-left']).optional() }),
  z.object({
    ...act, do: z.literal('move'), target: Id,
    to: Vec2.optional().describe('new position in space units (a shape: where its first point goes — the shape moves rigidly)'),
    by: Vec2.optional().describe('shift by [dx, dy] space units'),
    turn: Num.optional().describe('degrees counter-clockwise, about "about" (default: the shape\'s first point)'),
    about: Vec2.optional(),
  }),
  z.object({ ...act, do: z.literal('rearrange'), target: Id.describe('a pie'), into: z.enum(['strip', 'circle']).default('strip') }),
  z.object({ ...act, do: z.literal('swap'), target: Id, i: z.number().int().min(0), j: z.number().int().min(0) }),
  z.object({ ...act, do: z.literal('exchange'), a: Ref.describe('e.g. "heap.n5" or "arr[2]"'), b: Ref.describe('e.g. "heap.n2"') }),
  z.object({ ...act, do: z.literal('push'), target: Id, value: Value }),
  z.object({ ...act, do: z.literal('enqueue'), target: Id.describe('a queue — adds at the rear'), value: Value }),
  z.object({ ...act, do: z.literal('pop'), target: Id.describe('a stack — removes the top') }),
  z.object({ ...act, do: z.literal('dequeue'), target: Id }),
  z.object({ ...act, do: z.literal('insert'), target: Id, at: z.number().int().min(0), value: Value }),
  z.object({ ...act, do: z.literal('delete'), target: Id, at: z.number().int().min(0) }),
  z.object({ ...act, do: z.literal('set'), target: Ref, value: Value.optional(), text: z.string().max(200).optional(), latex: z.string().max(240).optional() }),
  z.object({ ...act, do: z.literal('morph'), target: Id, values: Values.describe('the new values; the engine animates each value to its new place') }),
  z.object({ ...act, do: z.literal('highlight'), target: Targets, state: EmphasisState, hold: z.boolean().default(true) }),
  z.object({ ...act, do: z.literal('clear'), target: Targets.optional() }),
  z.object({ ...act, do: z.literal('annotate'), target: Ref, text: z.string().max(80), side: z.enum(['above', 'below', 'left', 'right']).optional() }),
  z.object({ ...act, do: z.literal('unannotate'), target: Ref }),
  z.object({ ...act, do: z.literal('connect'), from: Ref, to: Ref, label: z.string().max(40).optional(), style: z.enum(['arrow', 'line', 'dashed']).default('arrow') }),
  z.object({ ...act, do: z.literal('trace'), target: Id.describe('a body'), along: Id.describe('a plot or path'), duration: z.enum(['short', 'normal', 'long']).default('normal') }),
  z.object({ ...act, do: z.literal('tween'), target: Id, prop: z.string().max(24), to: Num, from: Num.optional() }),
  z.object({ ...act, do: z.literal('focus'), target: Targets.optional(), zoom: z.enum(['close', 'medium', 'wide']).default('medium') }),
  z.object({ ...act, do: z.literal('wait'), beats: z.number().min(0.25).max(8).default(1) }),
]);

// ── Beats & scene ───────────────────────────────────────────────────────────

/** Pause after the beat and ask the learner to predict what the next beat shows. */
export const Check = z.object({
  question: z.string().min(3).max(140),
  choices: z.array(z.string().min(1).max(60)).min(2).max(4),
  answer: z.number().int().min(0).describe('index into choices'),
  explain: z.string().max(200).optional().describe('one sentence on why, shown after answering'),
});

export const Beat = z.object({
  id: Id.optional(),
  title: z.string().min(1).max(LIMITS.title),
  narration: z.string().min(1).max(LIMITS.narration),
  actions: z.array(Action).min(1).max(LIMITS.actionsPerBeat),
  pace: z.enum(['slow', 'normal', 'fast']).default('normal'),
  check: Check.optional(),
});

export const Scene = z.object({
  version: z.literal(SCENE_VERSION),
  title: z.string().min(1).max(LIMITS.title),
  domain: Domain,
  summary: z.string().max(400).optional(),
  spaces: z.array(Space).max(4).default([]),
  entities: z.array(Entity).min(1).max(LIMITS.entities),
  layout: z.array(Relation).max(40).default([]),
  beats: z.array(Beat).min(1).max(LIMITS.beats),
});

export type SceneT = z.infer<typeof Scene>;
export type EntityT = z.infer<typeof Entity>;
export type ActionT = z.infer<typeof Action>;
export type BeatT = z.infer<typeof Beat>;
export type RelationT = z.infer<typeof Relation>;
export type SpaceT = z.infer<typeof Space>;
