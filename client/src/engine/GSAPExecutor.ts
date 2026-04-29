/**
 * GSAPExecutor v2.0 — Thin compatibility shim.
 *
 * The execution logic now lives in VisualScriptInterpreter.
 * This module re-exports types so existing imports don't break.
 */

export type { Command, RendererSystem } from './VisualScriptInterpreter';
