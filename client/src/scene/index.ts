/**
 * Engine v2 — plays Scene Language v1 scenes (docs/SCENE_LANGUAGE.md).
 * Not yet wired into the lesson flow; try it in /scene-lab.html.
 */
export { SceneEngine } from './engine';
export type { EngineOptions } from './engine';
export type { BeatTiming } from './compile';
export { solveLayout, fitTransform, overlapping } from './layout';
export { simulate } from './simulate';
export { normalizeScene } from './normalize';
export { measureScene } from './measure';
export type { Scene, Entity, Action, Beat } from './types';
