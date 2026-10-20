/**
 * Planner: question → Scene Language v1, validated.
 *
 * The model writes a scene; `validateScene` checks shape and meaning; any
 * errors go back to the model as a precise repair list (at most `maxRepairs`
 * rounds). Only a valid scene ever leaves this function.
 */
import { requestCompletion, type LLMMessage } from '../../utils/ai/llmClient.js';
import { strictParseJSON } from '../core/utils/jsonUtils.js';
import { parseModelJSON } from './coerce.js';
import { readPartialScene } from './progressive.js';
import { buildPlannerMessages, guessDomain, type LearnerLevel } from './prompt.js';
import type { SceneT } from './schema.js';
import { formatIssuesForRepair, type Issue, validateScene } from './validate.js';

export type PlanResult =
  | { ok: true; scene: SceneT; warnings: Issue[]; attempts: number; repairs: Issue[][]; ms: number; model: string; domain: string; firstBeatMs?: number; drafts?: string[]; accepted?: string }
  | { ok: false; errors: Issue[]; attempts: number; repairs: Issue[][]; ms: number; model: string; domain: string; raw?: string; drafts?: string[]; accepted?: string };

/** Provider errors that mean "the reply hit the output limit" (JSON mode rejects the cut-off JSON). */
const CUT_OFF_ERROR = /failed to validate json|failed_generation|max_tokens|maximum context|output limit/i;

export type PlanOptions = {
  model?: string;
  maxRepairs?: number;
  temperature?: number;
  userConfig?: unknown;
  signal?: AbortSignal;
  /** Thinking budget for the model (reasoning models think before writing; that is most of the wait). */
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  /** progress events for streaming UIs */
  onStage?: (stage: 'generating' | 'validating' | 'repairing', attempt: number) => void;
  /**
   * Stream the first attempt and hand over each valid partial scene (header +
   * the beats finished so far) as soon as a new beat closes.
   */
  onPartial?: (scene: SceneT, info: { beats: number; ms: number }) => void;
  /** Who the lesson is for: shapes the number and size of the steps (5.2). */
  learner?: LearnerLevel;
  /** Return the raw output of every rejected attempt and the accepted one (evals: what forced each repair, what the model wrote). */
  keepDrafts?: boolean;
};

export async function planScene(question: string, opts: PlanOptions = {}): Promise<PlanResult> {
  const started = Date.now();
  const maxRepairs = opts.maxRepairs ?? 2;
  const domain = guessDomain(question);
  const messages: LLMMessage[] = buildPlannerMessages(question, opts.learner);
  const repairs: Issue[][] = [];
  let model = opts.model ?? '';
  let raw = '';
  let firstBeatMs: number | undefined;
  const drafts: string[] = [];
  const extra = () => (opts.keepDrafts ? { drafts, accepted: raw } : {});

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    opts.onStage?.(attempt === 1 ? 'generating' : 'repairing', attempt);
    let streamed = '';
    let sent = 0;
    let lastCheck = 0;
    const onStream = attempt === 1 && opts.onPartial ? (token: string) => {
      streamed += token;
      // a beat can only have closed if a "}" arrived; don't re-parse more than ~6×/s
      if (!token.includes('}') || Date.now() - lastCheck < 150) return;
      lastCheck = Date.now();
      const partial = readPartialScene(streamed);
      if (!partial || partial.beats.length <= sent) return;
      const check = validateScene({ ...partial.header, beats: partial.beats });
      if (!check.ok) return; // wait for more text; the final validation reports real problems
      sent = partial.beats.length;
      firstBeatMs ??= Date.now() - started;
      opts.onPartial!(check.scene, { beats: sent, ms: Date.now() - started });
    } : undefined;
    let res: Awaited<ReturnType<typeof requestCompletion>>;
    try {
      res = await requestCompletion({
        model: opts.model,
        messages,
        temperature: opts.temperature ?? 0.35,
        maxTokens: 8000,
        responseMimeType: 'application/json',
        taskType: 'scene',
        userConfig: opts.userConfig,
        signal: opts.signal,
        skipRacing: true,
        onStream,
        reasoningEffort: opts.reasoningEffort,
      });
    } catch (err) {
      // JSON mode refuses a reply that hit the output limit (Groq: 400 "Failed to validate JSON")
      if (opts.signal?.aborted || !CUT_OFF_ERROR.test(String((err as Error)?.message))) throw err;
      res = { content: '', finishReason: 'length' } as typeof res;
    }
    model = res._meta?.model_used ?? model;
    raw = res.content || streamed;
    if (res.error && !raw) {
      return { ok: false, errors: [{ path: '(model)', message: res.error }], attempts: attempt, repairs, ms: Date.now() - started, model, domain };
    }

    opts.onStage?.('validating', attempt);
    const parsed = parseModelJSON(raw, strictParseJSON);
    const result = parsed ? validateScene(parsed) : { ok: false as const, errors: [{ path: '(root)', message: 'response was not a JSON object' }], warnings: [] };
    // A reply cut off at the output limit can still parse (brackets are closed for it) and pass —
    // as a lesson that stops after a beat or two (docs/eval/runs/full-48-part3/bio-2). Start
    // over, shorter: repairing it would re-send the draft and leave even less room for the answer.
    const cutOff = /^(length|max_tokens)$/i.test(res.finishReason ?? '');
    if (cutOff && !(result.ok && attempt > maxRepairs && result.scene.beats.length >= 3)) {
      const issue: Issue = { path: '(root)', message: 'the answer was cut off at the output limit' };
      repairs.push([issue]);
      drafts.push(raw);
      if (attempt > maxRepairs) return { ok: false, errors: [issue], attempts: attempt, repairs, ms: Date.now() - started, model, domain, raw, ...extra() };
      messages.splice(1, messages.length - 1, {
        ...messages[1],
        content: `${messages[1].content}\nKEEP IT COMPACT: a previous answer ran out of room. At most 5 beats, at most 12 entities, one-sentence narration, no optional fields.`,
      });
      continue;
    }
    if (result.ok) {
      return { ok: true, scene: result.scene, warnings: result.warnings, attempts: attempt, repairs, ms: Date.now() - started, model, domain, firstBeatMs, ...extra() };
    }
    repairs.push(result.errors);
    drafts.push(raw);
    if (attempt > maxRepairs) {
      return { ok: false, errors: result.errors, attempts: attempt, repairs, ms: Date.now() - started, model, domain, raw, ...extra() };
    }
    messages.push(
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content: `The scene failed validation. Fix exactly these issues (paths point into your JSON) and return the complete corrected JSON object:\n${formatIssuesForRepair(result.errors)}`,
      },
    );
  }
  // unreachable
  return { ok: false, errors: [], attempts: maxRepairs + 1, repairs, ms: Date.now() - started, model, domain, raw };
}
