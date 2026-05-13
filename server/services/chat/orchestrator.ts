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
import { extractJSON } from '../../engine/core/utils/jsonUtils.js';

export interface OrchestrationResult {
  narration: any;
  visualScript?: any;
  criticScore: number;
  metadata: {
    stages: Record<string, { duration: number; model: string; success: boolean; tokens?: number }>;
    totalTokens: number;
  };
}

export class AgentOrchestrator {
  /**
   * Executes the full multi-agent loop based on a strategic plan.
   */
  async execute(plan: StrategicPlan, context: { sessionId: string; requestId: string; topic: string; userMessage: string; signal?: AbortSignal; userConfig?: any; userTier?: 'free' | 'pro' | 'enterprise' }): Promise<OrchestrationResult> {
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
    const narrationPromise = this.runNarrator(planSummary as any, context, protectedUserMessage);
    const visualizationPromise = plan.visualization.generate || plan.artifacts.generate
      ? this.runVisualizer(planSummary as any, context, protectedUserMessage)
      : Promise.resolve({ script: null, tokens: 0, duration: 0, model: 'none' });

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

    // 4. Optional: Critique Stage
    let criticScore = 1.0;
    if (plan.complexity === 'advanced') {
      const criticResult = await this.runCritic(narrationResult.content, visualResult.script, context);
      await BudgetService.recordUsage(context.sessionId, criticResult.tokens);
      criticScore = criticResult.score;
      stages['critique'] = { duration: criticResult.duration, model: criticResult.model, success: true, tokens: criticResult.tokens };
      totalTokens += criticResult.tokens;
    }

    // 4. Finalize Results
    const duration = Date.now() - startTime;
    console.log(`[Orchestrator] ✅ Completed in ${duration}ms. Total Tokens: ~${totalTokens}`);

    return {
      narration: narrationResult.content,
      visualScript: visualResult.script,
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
    
    const res = await requestCompletion({
      model,
      messages: [
        { role: 'system', content: promptRegistry.getPrompt('narrator') },
        { role: 'user', content: `PLAN: ${JSON.stringify(plan)}\nUSER: ${userMessage}` }
      ],
      temperature: 0.2,
      responseMimeType: 'application/json',
      userConfig: context.userConfig,
      signal: context.signal
    });

    return {
      content: extractJSON(res.content) || { narrations: [] },
      tokens: (res._meta?.tokens_in || 0) + (res._meta?.tokens_out || 0),
      duration: Date.now() - start,
      model
    };
  }

  private async runVisualizer(plan: StrategicPlan, context: any, userMessage: string) {
    const start = Date.now();
    const model = await BudgetService.resolveOptimizedModel('visualization', context.sessionId, context.userTier || 'free');
    
    const res = await requestCompletion({
      model,
      messages: [
        { role: 'system', content: promptRegistry.getPrompt('visualizer') },
        { role: 'user', content: `PLAN: ${JSON.stringify(plan)}\nUSER: ${userMessage}` }
      ],
      temperature: 0,
      responseMimeType: 'application/json',
      userConfig: context.userConfig,
      signal: context.signal
    });

    return {
      script: extractJSON(res.content) || { script: [] },
      tokens: (res._meta?.tokens_in || 0) + (res._meta?.tokens_out || 0),
      duration: Date.now() - start,
      model
    };
  }

  private async runCritic(narration: any, visualScript: any, context: any) {
    const start = Date.now();
    const model = await BudgetService.resolveOptimizedModel('critique', context.sessionId, context.userTier || 'free');
    
    const res = await requestCompletion({
      model,
      messages: [
        { role: 'system', content: promptRegistry.getPrompt('critic') },
        { role: 'user', content: `NARRATION: ${JSON.stringify(narration)}\nVISUALS: ${JSON.stringify(visualScript)}` }
      ],
      temperature: 0,
      responseMimeType: 'application/json',
      userConfig: context.userConfig,
      signal: context.signal
    });

    const data = extractJSON(res.content) || {};
    return {
      score: data.scores?.overall || 1.0,
      data,
      tokens: (res._meta?.tokens_in || 0) + (res._meta?.tokens_out || 0),
      duration: Date.now() - start,
      model
    };
  }
}

export default new AgentOrchestrator();
