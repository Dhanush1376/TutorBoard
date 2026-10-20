/**
 * orchestrator.ts — Enterprise Agent Orchestrator v7.0
 * 
 * Orchestrates multiple specialized agents (Narrator, Visualizer, Critic)
 * using a resilient, parallel-first state machine.
 */

import { StrategicPlan } from './planner.service.js';
import BudgetService from './budget.service.js';
import { requestCompletion, resolveModelId } from '../../utils/ai/llmClient.js';
import promptRegistry from '../../engine/config/promptRegistry.js';
import PromptDefender from '../../utils/ai/promptDefender.js';
import { AppError, ErrorCode } from '../../shared/errors.js';
import { extractJSON, strictParseJSON } from '../../engine/core/utils/jsonUtils.js';
import { VisualScriptSchema } from '../../engine/core/utils/visualizerSchemas.js';
import { generateFallbackVisualScript, getHardcodedPythagorasLesson } from '../../engine/core/utils/fallbackVisualizer.js';
import { engineV2Enabled, learnerLevelOf, lessonFailure, planLesson, sceneModel, type SceneTimeline } from '../../engine/scene/lesson.js';
import { toBranch, type DoubtResult, type SceneBranch } from '../../engine/scene/doubt.js';

export interface OrchestrationResult {
  narration: any;
  visualScript?: any;
  /** Engine v2 lesson (Scene Language) — replaces visualScript when ENGINE_V2=1 */
  sceneV2?: SceneTimeline | null;
  /** Engine v2 doubt answered on the lesson's board */
  sceneBranch?: SceneBranch | null;
  /** Engine v2 couldn't draw the lesson: what to tell the learner */
  sceneFailure?: string;
  criticScore: number;
  metadata: {
    stages: Record<string, { duration: number; model: string; success: boolean; tokens?: number }>;
    totalTokens: number;
  };
}

type VisualResult = { script: any; sceneV2?: SceneTimeline | null; sceneBranch?: SceneBranch | null; sceneFailure?: string; tokens: number; duration: number; model: string };

export class AgentOrchestrator {
  /**
   * Executes the full multi-agent loop based on a strategic plan.
   */
  async execute(plan: StrategicPlan, context: {
    sessionId: string; requestId: string; topic: string; userMessage: string; signal?: AbortSignal; userConfig?: any; userTier?: 'free' | 'pro' | 'enterprise';
    /** Engine v2: the lesson so far, each time another beat is ready (streamed to the client) */
    onScenePartial?: (timeline: SceneTimeline) => void;
    /** Engine v2: the whole lesson, validated — sent at once, not after the text answer */
    onSceneReady?: (timeline: SceneTimeline) => void;
    /** Engine v2: a question about the lesson on screen, already being drawn on its board */
    lessonDoubt?: Promise<DoubtResult>;
    /** beginner | intermediate | advanced — shapes the lesson (5.2) */
    learnerLevel?: string;
  }): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const stages: Record<string, any> = {};
    let totalTokens = 0;

    console.log(`[Orchestrator] 🚀 Executing plan for ${context.requestId} (Topic: ${context.topic})`);

    // 1. Security: Protect User Input
    const protectedUserMessage = PromptDefender.protect(context.userMessage);

    // 2. Budget Verification
    try {
      const hasBudget = await BudgetService.checkBudget(context.sessionId, context.userTier || 'free');
      if (!hasBudget) {
        throw new AppError(ErrorCode.AI_BUDGET_EXCEEDED, 'Token budget exceeded.');
      }
    } catch (err) {
      if (err instanceof AppError) throw err; // Strictly enforce quota limits (Audit v3 #56)
      console.warn('[Orchestrator] Budget service unavailable. Proceeding...', (err as Error).message);
    }

    // Prepare planSummary to eliminate redundant query injection and token cost (Audit v3 #69)
    const planSummary = { ...plan, educational_intent: undefined };

    // 3. Parallel Stage Execution: Narration + Visualization
    const wantsVisual = plan.visualization.generate || plan.artifacts.generate;
    // Engine v2 beats carry their own narration — skip the separate narrator call then.
    const narrationPromise = wantsVisual && engineV2Enabled()
      ? Promise.resolve({ content: { narrations: [] }, tokens: 0, duration: 0, model: 'none' })
      : this.runNarrator(planSummary as any, context, protectedUserMessage);
    const visualizationPromise: Promise<VisualResult> = !wantsVisual
      ? Promise.resolve({ script: null, tokens: 0, duration: 0, model: 'none' })
      : engineV2Enabled()
        ? this.runSceneV2(planSummary as any, context)
        : this.runVisualizer(planSummary as any, context, protectedUserMessage);

    const [narrationResult, visualResult] = await Promise.all([
      narrationPromise,
      visualizationPromise
    ]);

    // SEC-BUDGET: Record usage for parallel stages
    await Promise.all([
      BudgetService.recordUsage(context.sessionId, narrationResult.tokens),
      BudgetService.recordUsage(context.sessionId, visualResult.tokens)
    ]);

    stages['narration'] = { duration: narrationResult.duration, model: narrationResult.model, success: true, tokens: narrationResult.tokens };
    stages['visualization'] = { duration: visualResult.duration, model: visualResult.model, success: true, tokens: visualResult.tokens };
    totalTokens += (narrationResult.tokens + visualResult.tokens);

    // NOTE: The inline critique stage was removed (Phase 8 simplification). It
    // fired a full extra LLM call on advanced-complexity queries, but its score
    // was never consumed by any caller — pure latency/token cost. Async quality
    // critique still runs separately via processCritiqueAsync in ChatService.
    // criticScore stays in the result shape (defaulted) for backward compatibility.
    const criticScore = 1.0;

    // 4. Finalize Results
    const duration = Date.now() - startTime;
    console.log(`[Orchestrator] ✅ Completed in ${duration}ms. Total Tokens: ~${totalTokens}`);

    return {
      narration: narrationResult.content,
      visualScript: visualResult.script,
      sceneV2: visualResult.sceneV2 ?? null,
      sceneBranch: visualResult.sceneBranch ?? null,
      sceneFailure: visualResult.sceneFailure,
      criticScore,
      metadata: {
        stages,
        totalTokens
      }
    };
  }

  private async runNarrator(plan: StrategicPlan, context: any, userMessage: string) {
    const start = Date.now();
    const model = await BudgetService.resolveOptimizedModel('narration', context.sessionId, context.userTier || 'free');

    let res: any;
    try {
      res = await requestCompletion({
        model,
        messages: [
          { role: 'system', content: promptRegistry.getPrompt('narrator') },
          { role: 'user', content: `PLAN: ${JSON.stringify(plan)}\nUSER: ${userMessage}` }
        ],
        temperature: 0.2,
        maxTokens: 8000, // multi-step narration JSON regularly exceeds the old 1000-token default and got truncated mid-array
        responseMimeType: 'application/json',
        userConfig: context.userConfig,
        signal: context.signal
      });
    } catch (err) {
      // Never let a narrator provider failure reject the whole orchestration —
      // the visualizer runs in the same Promise.all and would be lost with it.
      console.error(`[Orchestrator] Narrator request failed for all providers (${(err as Error).message?.slice(0, 160)}).`);
      return { content: { narrations: [] }, tokens: 0, duration: Date.now() - start, model };
    }

    console.log("RAW AI RESPONSE (NARRATOR):", res.content);

    return {
      content: extractJSON(res.content) || { narrations: [] },
      tokens: (res._meta?.tokens_in || 0) + (res._meta?.tokens_out || 0),
      duration: Date.now() - start,
      model
    };
  }

  /**
   * Engine v2: plan a Scene Language lesson, streaming beats as they are ready.
   * When planning fails, `sceneFailure` says why (the text answer still stands).
   */
  private async runSceneV2(plan: StrategicPlan, context: any): Promise<VisualResult> {
    const start = Date.now();
    if (context.lessonDoubt) {
      const d: DoubtResult = await context.lessonDoubt;
      if (d.ok && d.kind === 'branch') return { script: null, sceneBranch: toBranch(d), tokens: 0, duration: Date.now() - start, model: d.model };
      // couldn't draw it on the board: the chat answer stands on its own (never replace the lesson with a v1 scene)
      if (!(d.ok && d.kind === 'new-topic')) return { script: null, tokens: 0, duration: Date.now() - start, model: d.model };
      // a different subject: a new lesson, below
    }
    const model = context.userConfig?.useCustomApi
      ? await BudgetService.resolveOptimizedModel('visualization', context.sessionId, context.userTier || 'free')
      : sceneModel();
    const topic = (plan as any).topic || context.topic;
    // follow-ups ("now do it for 7") need the conversation's subject
    const question = topic && topic !== 'General' && context.userMessage.length < 80
      ? `${context.userMessage}\n(The conversation is about: ${topic})`
      : context.userMessage;
    try {
      const { timeline, result } = await planLesson(question, {
        model,
        userConfig: context.userConfig,
        signal: context.signal,
        learner: learnerLevelOf({ level: context.learnerLevel }),
        onPartial: context.onScenePartial,
      });
      if (!timeline) return { script: null, sceneFailure: lessonFailure(result), tokens: 0, duration: Date.now() - start, model: result.model || model };
      // the whole lesson now, not after the text answer finishes streaming
      context.onSceneReady?.(timeline);
      return { script: null, sceneV2: timeline, tokens: 0, duration: Date.now() - start, model: result.model || model };
    } catch (err) {
      if (context.signal?.aborted) throw err;
      console.error(`[Orchestrator] Engine v2 failed (${(err as Error).message?.slice(0, 160)}).`);
      return { script: null, sceneFailure: lessonFailure(null, err), tokens: 0, duration: Date.now() - start, model };
    }
  }

  private async runVisualizer(plan: StrategicPlan, context: any, userMessage: string) {
    const start = Date.now();
    const model = await BudgetService.resolveOptimizedModel('visualization', context.sessionId, context.userTier || 'free');
    const fallbackTopic = (plan as any).topic || context.topic || userMessage?.slice(0, 60) || "Topic";

    // ─── 4. RUN VISUALIZER ──────────────────────────────────────────────────
    let res: any;
    try {
      res = await requestCompletion({
        model,
        messages: [
          { role: 'system', content: promptRegistry.getPrompt('visualizer') },
          { role: 'user', content: `PLAN: ${JSON.stringify(plan)}\nUSER: ${userMessage}` }
        ],
        temperature: 0,
        maxTokens: 8000, // rich scenes (8+ nodes with edges/callouts) exceed the old 1000-token default
        responseMimeType: 'application/json',
        userConfig: context.userConfig,
        signal: context.signal
      });
    } catch (err) {
      // Total provider failure (all providers rate-limited / over-quota / token-capped).
      // Degrade to the fallback concept map so the canvas ALWAYS gets a scene
      // instead of a blank 0-node event. This is the reliability guarantee for
      // "every explanation is accompanied by a diagram".
      console.error(`[Orchestrator] Visualizer request failed for all providers (${(err as Error).message?.slice(0, 160)}). Using fallback scene.`);
      return {
        script: generateFallbackVisualScript(fallbackTopic),
        tokens: 0,
        duration: Date.now() - start,
        model
      };
    }

    console.log("RAW AI RESPONSE (VISUALIZER):", res.content);

    let script;
    const extractedJson = strictParseJSON(res.content);

    if (!extractedJson) {
      console.error("[Orchestrator] Visualizer JSON Extraction Failed. Using fallback.");
      script = generateFallbackVisualScript(fallbackTopic);
    } else {
      const validation = VisualScriptSchema.safeParse(extractedJson);
      console.log("[Orchestrator] SCHEMA VALIDATION RESULT:", validation.success ? "SUCCESS" : "FAILED", validation.error?.issues);

      if (!validation.success) {
        console.error("[Orchestrator] Visualizer Schema Validation Failed. Using fallback.");
        script = generateFallbackVisualScript(fallbackTopic);
      } else {
        script = validation.data;
        // Even a schema-valid response can be empty (e.g. `{ "script": [] }`).
        // An empty script paints a blank canvas — fall back so a scene always renders.
        if (!Array.isArray(script.script) || script.script.length === 0) {
          console.error("[Orchestrator] Visualizer returned an empty script. Using fallback.");
          script = generateFallbackVisualScript(fallbackTopic);
        }
      }
    }

    return {
      script,
      tokens: (res._meta?.tokens_in || 0) + (res._meta?.tokens_out || 0),
      duration: Date.now() - start,
      model
    };
  }
}

export default new AgentOrchestrator();
