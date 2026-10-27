import type { Measured } from '../measure';
import type { SpaceMap } from '../geometry';
import type { Sim } from '../simulate';
import type { Box, Entity, Pt, Scene } from '../types';

/** The paintable parts of something that can be highlighted. */
export type Paint = {
  fill?: SVGElement;
  stroke?: SVGElement;
  text?: SVGElement;
  glow?: SVGElement;
  base: { fill?: string; stroke?: string; text?: string; glow?: string };
  /** a dot or tinted region in a space: a highlight fills it with the state's accent (the dark card fill would hide it) */
  accentFill?: boolean;
};

export type ItemHandle = { key: string; g: SVGGElement; paint: Paint; label: SVGTextElement };

export type PartRef = { paints: Paint[]; at: Pt; box: Box };

export type Built = {
  entity: Entity;
  /** positioned group (world space) */
  root: SVGGElement;
  /** inner group that create/remove effects animate */
  fx: SVGGElement;
  /** world box */
  box: Box;
  paint?: Paint;
  part?: (name: string) => PartRef | null;
  /** indexed structures: every item that will ever exist, hidden until it enters */
  items?: Map<string, ItemHandle>;
  /** local (fx) translate of an item sitting in `slot` */
  slotAt?: (slot: number) => Pt;
  /** where a new item comes from / an old one leaves to (local) */
  entryFrom?: (slot: number) => Pt;
  exitTo?: (slot: number, from: 'top' | 'front' | 'end' | 'middle') => Pt;
  /** static per-slot decorations that follow the length (index labels, links) */
  slotDecor?: SVGElement[];
  /** stroke elements revealed by the "draw" effect */
  draws?: SVGGeometryElement[];
  /** latex variants for `set latex` cross-fades */
  latex?: Map<string, SVGForeignObjectElement>;
  textEl?: SVGTextElement;
  extra?: Record<string, unknown>;
};

export type BuildCtx = {
  scene: Scene;
  svg: SVGSVGElement;
  uid: string;
  layer: SVGGElement;
  boxes: Map<string, Box>;
  sizes: Map<string, Measured>;
  spaces: Map<string, SpaceMap>;
  sim: Sim;
  /** world point for an endpoint ref like "tri.A" or "h2o.O" (available after its owner is built) */
  anchor: (ref: string) => Pt | null;
  /** labels already placed in spaces: later labels keep off them */
  labels?: Box[];
};
