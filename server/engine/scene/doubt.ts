/**
 * Doubts on an Engine v2 lesson.
 *
 * The learner pauses at beat N and asks a question. The answer is a *branch*
 * of the same lesson: new beats played on the board as it stands at beat N,
 * using the entities already there.
 *
 *   lesson beats 0..N  +  doubt beats  →  one scene, validated like any other
 *
 * so array/tree state, references and layout are checked exactly as for a
 * lesson, and "back to the lesson" is simply the original scene at beat N.
 */
import { requestCompletion, type LLMMessage } from '../../utils/ai/llmClient.js';
import { strictParseJSON } from '../core/utils/jsonUtils.js';
import { parseModelJSON } from './coerce.js';
import { sceneModel } from './lesson.js';
import { SCENE_RULES, SCENE_SPEC } from './prompt.js';
import type { SceneT } from './schema.js';
import { formatIssuesForRepair, type Issue, validateScene } from './validate.js';

export type DoubtResult =
  | { ok: true; kind: 'branch'; answer: string; scene: SceneT; from: number; beats: number; ms: number; attempts: number; model: string }
  | { ok: true; kind: 'new-topic'; answer: string; ms: number; attempts: number; model: string }
  | { ok: false; errors: Issue[]; ms: number; attempts: number; model: string };

/** What the client needs to play a doubt: the merged scene and where the branch starts. */
export type SceneBranch = {
  title: string;
  scene: SceneT;
  /** last lesson beat before the branch; the branch is beats from+1 … end */
  from: number;
  beats: number;
  answer: string;
  steps: { title: string; narration: string }[];
};

export const toBranch = (d: Extract<DoubtResult, { kind: 'branch' }>): SceneBranch => ({
  title: d.scene.title,
  scene: d.scene,
  from: d.from,
  beats: d.beats,
  answer: d.answer,
  steps: d.scene.beats.slice(d.from + 1).map((b) => ({ title: b.title, narration: b.narration })),
});

const DOUBT_RULES = `
DOUBT MODE — you are continuing an existing lesson on the same board, not starting a new one.
1. Pick the moment to explain with "from": the lesson beat number whose END state the board shows before your beats.
   Default: the learner's current beat. When the question is about an earlier or later moment, pick that beat
   (e.g. "why did 2 swap with 7?" → the beat where 2 was placed, just before that swap). The board jumps there exactly
   and the learner returns to their own beat afterwards — so never recreate a moment by hand with set/move.
2. Act on what is on the board at that moment, by id (and parts: "arr[2]", "tri.A", "heap.n3"): highlight, annotate,
   trace, connect, focus, and set/swap/move only to demonstrate a what-if. SHOW the answer: highlight the exact elements
   involved, mark what gets ruled out (state "eliminated"), annotate the one element that decides it.
   A text note alone is not an answer. Usually 2–3 beats, at most 4 — answer exactly what was asked, no recap.
3. Narration talks to the learner like a teacher pointing at the board ("Look at 16 at index 4 — it's smaller than 23, so…"),
   never a description of the beat ("Show why…").
4. Add new entities only when the answer needs something that is not on the board. Declare them in "entities"
   (new ids, never an existing one) and place them with "layout" relative to existing ids. Create them in a beat.
5. End on the frame that answers the question: leave the key highlights and notes up (the lesson restores its own board afterwards).
6. If the question is not about this lesson at all, don't draw: return {"kind":"new-topic","answer":"<one sentence>"}.
OUTPUT (JSON only, keys in this order):
{"kind":"branch","from":<lesson beat number>,"answer":"<2–3 sentences answering the question directly>","entities":[...],"layout":[...],"beats":[...]}
`;

/**
 * Doubt model. A doubt is a small job (pick the lesson moment, point at things), and the
 * fast model does it in ~3 s vs ~25 s with comparable answers (server/scripts/doubt-bench.mjs).
 */
export const doubtModel = () => process.env.SCENE_DOUBT_MODEL || process.env.SCENE_MODEL_FAST || 'gemini-3.5-flash-lite';

/** Answer on the board: the fast model first, the main scene model if it can't (or the model given). */
export async function answerOnBoard(question: string, lesson: unknown, from: number, opts: {
  model?: string;
  userConfig?: unknown;
  signal?: AbortSignal;
}): Promise<DoubtResult> {
  if (opts.model) return planDoubt(question, lesson, from, { ...opts, model: opts.model });
  const fast = await planDoubt(question, lesson, from, { ...opts, model: doubtModel(), maxRepairs: 1 });
  if (fast.ok || opts.signal?.aborted || fast.errors[0]?.path === '(lesson)') return fast;
  const strong = await planDoubt(question, lesson, from, { ...opts, model: sceneModel() });
  return { ...strong, ms: fast.ms + strong.ms, attempts: fast.attempts + strong.attempts };
}

type Ref = { type: string; id: string; label?: string };

/** Entities created by the end of beat `n` and not removed since. */
export function onBoardAt(scene: SceneT, n: number): Ref[] {
  const shown = new Set<string>();
  for (const beat of scene.beats.slice(0, n + 1)) {
    for (const a of beat.actions as { do: string; target?: unknown }[]) {
      const targets = (Array.isArray(a.target) ? a.target : [a.target]).filter((t): t is string => typeof t === 'string' && !/[.[]/.test(t));
      if (a.do === 'create') targets.forEach((t) => shown.add(t));
      if (a.do === 'remove') targets.forEach((t) => shown.delete(t));
    }
  }
  return scene.entities
    .filter((e) => shown.has(e.id))
    .map((e) => {
      const any = e as { label?: string; text?: string; latex?: string };
      return { type: e.type, id: e.id, label: any.label ?? any.text ?? any.latex };
    });
}

export function buildDoubtMessages(question: string, scene: SceneT, from: number): LLMMessage[] {
  const beat = scene.beats[from];
  const board = onBoardAt(scene, from)
    .map((r) => `  ${r.id} (${r.type}${r.label ? `: ${String(r.label).slice(0, 40)}` : ''})`)
    .join('\n');
  return [
    {
      role: 'system',
      content: `You are TutorBoard's visual lesson designer. A learner watching a lesson on the board has paused to ask a question; you answer it ON THE SAME BOARD.\n${SCENE_SPEC}\n${SCENE_RULES}\n${DOUBT_RULES}`,
    },
    {
      role: 'user',
      content: [
        `LESSON (Scene Language):\n${JSON.stringify(scene)}`,
        `LESSON BEATS:\n${scene.beats.map((b, i) => `  ${i + 1}. ${b.title} — ${b.narration}`).join('\n')}`,
        `The learner is at beat ${from + 1} of ${scene.beats.length}: "${beat.title}".`,
        `On the board at beat ${from + 1}:\n${board || '  (nothing yet)'}`,
        `QUESTION: ${question}`,
      ].join('\n\n'),
    },
  ];
}

/** Lesson prefix (beats 0..from) + the model's doubt beats and entities, as one scene. */
export function mergeBranch(scene: SceneT, from: number, delta: Record<string, unknown>) {
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    ...scene,
    entities: [...scene.entities, ...list(delta.entities)],
    layout: [...scene.layout, ...list(delta.layout)],
    beats: [...scene.beats.slice(0, from + 1), ...list(delta.beats)],
  };
}

/** Repair paths point into the merged scene; the model wrote only the delta. */
export function toDeltaPath(path: string, offsets: { beats: number; entities: number; layout: number }): string {
  return path.replace(/^(beats|entities|layout)\[(\d+)\]/, (whole, key: 'beats' | 'entities' | 'layout', k: string) => {
    const i = Number(k) - offsets[key];
    return i >= 0 ? `${key}[${i}]` : whole;
  });
}

export async function planDoubt(question: string, lesson: unknown, from: number, opts: {
  model: string;
  userConfig?: unknown;
  signal?: AbortSignal;
  maxRepairs?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}): Promise<DoubtResult> {
  const started = Date.now();
  const model = opts.model;
  const base = validateScene(lesson);
  if (!base.ok) return { ok: false, errors: [{ path: '(lesson)', message: 'the lesson scene is not valid' }, ...base.errors.slice(0, 3)], ms: 0, attempts: 0, model };
  const scene = base.scene;
  const clamp = (n: number) => Math.max(0, Math.min(n, scene.beats.length - 1));
  const learnerAt = clamp(from);
  const messages = buildDoubtMessages(question, scene, learnerAt);
  const maxRepairs = opts.maxRepairs ?? 2;

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const res = await requestCompletion({
      model,
      messages,
      temperature: 0.3,
      maxTokens: 5000,
      responseMimeType: 'application/json',
      taskType: 'scene-doubt',
      userConfig: opts.userConfig,
      signal: opts.signal,
      skipRacing: true,
      reasoningEffort: opts.reasoningEffort,
    });
    const raw = res.content || '';
    if (res.error && !raw) return { ok: false, errors: [{ path: '(model)', message: res.error }], ms: Date.now() - started, attempts: attempt, model };

    const delta = parseModelJSON(raw, strictParseJSON) as Record<string, unknown> | null;
    let errors: Issue[];
    if (!delta || typeof delta !== 'object') {
      errors = [{ path: '(root)', message: 'response was not a JSON object' }];
    } else if (delta.kind === 'new-topic') {
      return { ok: true, kind: 'new-topic', answer: String(delta.answer ?? ''), ms: Date.now() - started, attempts: attempt, model };
    } else if (!Array.isArray(delta.beats) || !delta.beats.length) {
      errors = [{ path: 'beats', message: 'write 1–4 beats that answer the question on the board' }];
    } else {
      // the moment the answer starts from: the beat the model chose ("from", 1-based), else the learner's
      const at = typeof delta.from === 'number' && Number.isFinite(delta.from) ? clamp(Math.round(delta.from) - 1) : learnerAt;
      const offsets = { beats: at + 1, entities: scene.entities.length, layout: scene.layout.length };
      const merged = validateScene(mergeBranch(scene, at, delta));
      if (merged.ok) {
        return {
          ok: true,
          kind: 'branch',
          answer: String(delta.answer ?? ''),
          scene: merged.scene,
          from: at,
          beats: merged.scene.beats.length - (at + 1),
          ms: Date.now() - started,
          attempts: attempt,
          model,
        };
      }
      errors = merged.errors.map((e) => ({ ...e, path: toDeltaPath(e.path, offsets) }));
    }
    if (attempt > maxRepairs) return { ok: false, errors, ms: Date.now() - started, attempts: attempt, model };
    messages.push(
      { role: 'assistant', content: raw },
      { role: 'user', content: `That doesn't work on the board yet. Fix exactly these issues (paths point into your JSON) and return the complete corrected JSON object:\n${formatIssuesForRepair(errors)}` },
    );
  }
  return { ok: false, errors: [], ms: Date.now() - started, attempts: maxRepairs + 1, model };
}
