/**
 * Engine v2 in the live lesson flow (on by default; ENGINE_V2=0 turns it off).
 *
 * question → streamed, validated Scene Language scene, delivered in the
 * timeline shape the lesson UI already plays: one step per beat, so step
 * navigation, narration, persistence and the chat reply keep working. The
 * client sees `renderer: 'scene-v2'` and plays `sceneV2` with Engine v2.
 * When planning fails the learner is told so (`lessonFailure`) — the v1
 * placeholder (one node holding the question) teaches nothing.
 */
import { planScene, type PlanResult } from './planner.js';
import type { LearnerLevel } from './prompt.js';
import type { SceneT } from './schema.js';

export const engineV2Enabled = () => process.env.ENGINE_V2 !== '0';

/** What to tell the learner when no lesson could be drawn. */
export function lessonFailure(result?: PlanResult | null, err?: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (/timed? ?out/i.test(msg)) return 'This lesson took too long to draw. Please try again.';
  const providerDown = (result && !result.ok && result.errors[0]?.path === '(model)') || (err && !result);
  return providerDown
    ? "The AI service is busy right now, so I couldn't draw this lesson. Please try again in a minute."
    : "I couldn't draw a clear lesson for this question. Try asking it a little differently.";
}

/**
 * The learner's level from whatever we know (5.2): an explicit level from the client
 * (it reflects how they did on "predict the next step" checks), else the stored profile.
 */
export function learnerLevelOf(opts: { level?: unknown; confusionIndex?: number; mastery?: number; style?: string }): LearnerLevel {
  if (opts.level === 'beginner' || opts.level === 'advanced') return opts.level;
  if ((opts.confusionIndex ?? 0) > 0.5 || opts.style === 'granular') return 'beginner';
  if ((opts.mastery ?? 0) > 0.7 || opts.style === 'high-level') return 'advanced';
  return 'intermediate';
}

/**
 * Scene model. Benchmarked on 7 eval questions (docs/eval/runs): gemini-3.8-flash
 * 19–216 s; gemini-3.6-flash 14–36 s, 7/7 valid, comparable lessons;
 * gemini-3.5-flash-lite 3–14 s but weaker lessons (physics errors, cramped layouts).
 */
export const sceneModel = (quality?: unknown, model?: unknown) =>
  typeof model === 'string' && model ? model
    : quality === 'fast' ? process.env.SCENE_MODEL_FAST || 'gemini-3.5-flash-lite'
      : process.env.SCENE_MODEL || 'gemini-3.6-flash';

export type SceneTimeline = {
  title: string;
  domain: string;
  renderer: 'scene-v2';
  sceneV2: SceneT;
  steps: { id: string; title: string; narration: string; explanation: string; check?: SceneT['beats'][number]['check'] }[];
  elements: never[];
  connections: never[];
};

/** A scene in the lesson UI's timeline shape (steps = beats). */
export function sceneToTimeline(scene: SceneT): SceneTimeline {
  return {
    title: scene.title,
    domain: scene.domain ?? 'general',
    renderer: 'scene-v2',
    sceneV2: scene,
    steps: scene.beats.map((b, i) => ({ id: `beat-${i}`, title: b.title, narration: b.narration, explanation: b.narration, ...(b.check ? { check: b.check } : {}) })),
    elements: [],
    connections: [],
  };
}

const STAGE_LABEL = {
  generating: 'Designing your visual lesson',
  validating: 'Checking the scene',
  repairing: 'Polishing the scene',
} as const;

export async function planLesson(question: string, opts: {
  model: string;
  userConfig?: unknown;
  signal?: AbortSignal;
  /** who the lesson is for (5.2) */
  learner?: LearnerLevel;
  /** progress text for the loading UI */
  onProgress?: (label: string) => void;
  /** the lesson so far, each time another beat is ready */
  onPartial?: (timeline: SceneTimeline, info: { beats: number; ms: number }) => void;
}): Promise<{ timeline: SceneTimeline | null; result: PlanResult }> {
  const result = await planScene(question, {
    model: opts.model,
    userConfig: opts.userConfig,
    signal: opts.signal,
    learner: opts.learner,
    onStage: (stage) => opts.onProgress?.(STAGE_LABEL[stage]),
    onPartial: opts.onPartial ? (scene, info) => opts.onPartial!(sceneToTimeline(scene), info) : undefined,
  });
  const first = result.ok && result.firstBeatMs ? `, first beat ${result.firstBeatMs} ms` : '';
  console.log(`[EngineV2] "${question.slice(0, 80)}" → ${result.ok ? 'ok' : 'FAILED'} in ${result.ms} ms${first}, ${result.attempts} attempt(s), ${result.model}`);
  return { timeline: result.ok ? sceneToTimeline(result.scene) : null, result };
}
