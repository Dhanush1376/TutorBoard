/**
 * Scene Language v1 types for the client engine.
 *
 * Type-only re-exports of the server's zod schema (the single source of
 * truth): esbuild strips them, so no server code reaches the bundle.
 */
export type {
  SceneT as Scene,
  EntityT as Entity,
  ActionT as Action,
  BeatT as Beat,
  RelationT as Relation,
  SpaceT as Space,
} from '../../../server/engine/scene/schema';

import type { EntityT } from '../../../server/engine/scene/schema';

export type EntityOf<T extends EntityT['type']> = Extract<EntityT, { type: T }>;

export type Box = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

export const INDEXED = new Set(['array', 'stack', 'queue', 'linkedlist']);
export const SPATIAL = new Set(['point', 'polygon', 'path', 'plot', 'vector', 'body', 'scatter']);

/** `arr[2]` → { base: 'arr', index: 2 }; `tri.A` → { base: 'tri', part: 'A' }. */
export type Ref = { base: string; index?: number; part?: string };
export const parseRef = (ref: string): Ref => {
  const m = /^([A-Za-z][A-Za-z0-9_-]*)(?:\[(\d+)\]|\.([A-Za-z0-9_-]+))?$/.exec(ref);
  if (!m) return { base: ref };
  return { base: m[1], index: m[2] !== undefined ? Number(m[2]) : undefined, part: m[3] };
};
