/**
 * Scene Language v1 — public surface.
 * The AI writes a Scene; `validateScene` checks (and lightly repairs) it before
 * it is sent to the client engine. See docs/SCENE_LANGUAGE.md.
 */
export * from './schema.js';
export { validateScene, formatIssuesForRepair } from './validate.js';
export type { Issue, ValidationResult, ValidateOptions } from './validate.js';
