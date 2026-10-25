/**
 * ChatService.ts — TutorBoard Enterprise v7.0
 * 
 * Centralizes chat business logic with a Planner-First orchestration strategy.
 * Integrates Strategic Planning, Intelligence Gathering, and Agent Orchestration.
 */

import { AppError, ErrorCode } from '../../shared/errors.js';
import sessionRepository from '../../repositories/session.repository.js';
import messageRepository from '../../repositories/message.repository.js';
import { requestCompletion, getTextModel, resolveModelId } from '../../utils/ai/llmClient.js';
import PlannerService from './planner.service.js';
import Orchestrator from './orchestrator.js';
import BudgetService from './budget.service.js';
import VectorStoreService from '../../engine/core/vectorStore.js';
import { searchWeb } from '../../utils/ai/webSearchService.js';
import { formatForPrompt, extractSources } from '../../utils/ai/searchContextFormatter.js';
import { buildSystemPrompt, buildLLMMessages } from '../../engine/agents/BuildSystemPrompt.js';
import { processCritiqueAsync } from './critique.service.js';
import { StreamLifecycleManager } from './stream.service.js';
import { generateFallbackVisualScript } from '../../engine/core/utils/fallbackVisualizer.js';
import { engineV2Enabled, lessonFailure, sceneToTimeline, type SceneTimeline } from '../../engine/scene/lesson.js';
import { answerOnBoard, toBranch, type DoubtResult, type SceneBranch } from '../../engine/scene/doubt.js';
import ChatSession from '../../models/ChatSession.js';
import SessionLedger from '../../models/SessionLedger.js';
import Artifact from '../../models/Artifact.js';
import userRepository from '../../repositories/user.repository.js';
import { childLogger } from '../../core/logger.js';
import { ChatError, classifyChatError } from './chatErrors.js';

const log = childLogger({ subsystem: 'chat-service' });

/** Message metadata for an Engine v2 lesson (the chat card and history read `visuals`). */
const sceneV2Visuals = (t: SceneTimeline) => ({ renderer: 'scene-v2', rendererType: 'scene-v2', title: t.title, sceneV2: t.sceneV2, steps: t.steps, script: [] });

/** A doubt answered on the board: the lesson up to that beat plus the answer's beats. */
const branchVisuals = (b: SceneBranch) => ({ ...sceneV2Visuals(sceneToTimeline(b.scene)), branchFrom: b.from, branchBeats: b.beats });

/** The lesson step a question was asked at (for the text answer's context). */
const lessonStep = (ctx: { scene: unknown; beatIndex: number }) => {
  const beats = (ctx.scene as { beats?: { title?: string }[] })?.beats;
  const beat = Array.isArray(beats) ? beats[ctx.beatIndex] : undefined;
  return beat ? { n: ctx.beatIndex + 1, title: String(beat.title ?? '').slice(0, 80) } : null;
};

/** Canvas snapshot so reopening the message replays the lesson. */
const sceneV2Canvas = (t: SceneTimeline) => ({
  hasCanvas: true,
  canvasType: 'scene-v2',
  canvasSnapshot: { title: t.title, domain: t.domain, renderer: 'scene-v2', sceneV2: t.sceneV2, canvasSteps: t.steps, totalSteps: t.steps.length, canvasObjects: [] },
});

/**
 * Time budgets for the steps that run before the first token. A learner should
 * see the answer start within a couple of seconds, so a slow planner or search
 * degrades to its default instead of holding the whole answer back.
 */
const PLANNER_BUDGET_MS = Number(process.env.CHAT_PLANNER_BUDGET_MS) || 4000;
const RETRIEVAL_BUDGET_MS = Number(process.env.CHAT_RETRIEVAL_BUDGET_MS) || 3000;

/** Resolve with `promise`, or with `fallback()` once `ms` have passed (the promise keeps running). */
function withBudget<T>(promise: Promise<T>, ms: number, fallback: () => T, onTimeout?: () => void): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => { onTimeout?.(); resolve(fallback()); }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** A request still `requesting`/`streaming` this long after its last update is treated as dead. */
const STALE_REQUEST_MS = 3 * 60 * 1000;

type LedgerClaim =
  | { kind: 'new'; ledger: any }
  | { kind: 'retry'; ledger: any }
  | { kind: 'completed'; ledger: any }
  | { kind: 'in_progress'; ledger: any };

/** Only finished answers (and the learner's own turns) go back to the model as context. */
const isContextMessage = (m: any, excludeId?: string) =>
  (!excludeId || m?._id?.toString() !== excludeId) &&
  (m?.role !== 'assistant' || !m.status || m.status === 'completed');

export class ChatService {
  /**
   * Atomically claim (sessionId, requestId). The unique index on the ledger makes
   * exactly one concurrent caller the owner; everyone else sees the existing row.
   */
  async claimRequest(sessionId: any, requestId: string, depth = 0): Promise<LedgerClaim> {
    try {
      const ledger = await SessionLedger.create({ sessionId, requestId, status: 'requesting', attempts: 1 });
      return { kind: 'new', ledger };
    } catch (err: any) {
      if (err.code !== 11000) throw err;
    }

    const existing: any = await SessionLedger.findOne({ sessionId, requestId }).lean();
    if (!existing) {
      if (depth > 2) throw new ChatError('INTERNAL', 'Could not claim request');
      return this.claimRequest(sessionId, requestId, depth + 1); // evicted between calls
    }
    if (existing.status === 'completed') return { kind: 'completed', ledger: existing };

    const age = Date.now() - new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const live = (existing.status === 'requesting' || existing.status === 'streaming') && age < STALE_REQUEST_MS;
    if (live) return { kind: 'in_progress', ledger: existing };

    // failed / aborted / stale: take it over, but only if nobody else did first
    const taken = await SessionLedger.findOneAndUpdate(
      { _id: existing._id, status: existing.status, updatedAt: existing.updatedAt },
      { $set: { status: 'requesting', errorCode: null, updatedAt: new Date() }, $inc: { attempts: 1 } },
      { returnDocument: 'after' }
    ).lean();
    if (!taken) return { kind: 'in_progress', ledger: existing };
    return { kind: 'retry', ledger: taken };
  }

  /** Answer a repeated request for an already-completed generation from the ledger, without calling the model. */
  private async replayCompleted(ledger: any, session: any, streamManager?: StreamLifecycleManager) {
    const assistant = ledger.assistantMessageId ? await messageRepository.findById(ledger.assistantMessageId) : null;
    const content = assistant?.content ?? ledger.response ?? '';
    log.info('Replaying completed request', { requestId: ledger.requestId, sessionId: session._id.toString() });
    if (streamManager) {
      if (content) streamManager.send({ type: 'chunk', content });
      streamManager.send({
        type: 'message_ids',
        userMessageId: ledger.userMessageId,
        assistantMessageId: ledger.assistantMessageId,
        data: { userMessageId: ledger.userMessageId, assistantMessageId: ledger.assistantMessageId },
      });
      streamManager.close({ replayed: true, metadata: assistant?.metadata });
      return;
    }
    return {
      response: content,
      sessionId: session._id.toString(),
      userMessageId: ledger.userMessageId,
      assistantMessageId: ledger.assistantMessageId,
      sources: assistant?.metadata?.sources || [],
      replayed: true,
      metadata: assistant?.metadata,
    };
  }

  /**
   * Processes a standard chat message with Strategic Orchestration.
   */
  async processMessage(params: {
    userId?: string;
    guestId?: string;
    sessionId?: string;
    title?: string;
    userMessage: string;
    mode: string;
    teachingContext?: any;
    /** Engine v2 lesson on screen: the question is answered on that board */
    lessonContext?: { scene: unknown; beatIndex: number };
    userConfig?: any;
    requestId: string;
    streamManager?: StreamLifecycleManager;
    isRegenerate?: boolean;
    originalMessageId?: string;
    /** Edit flow: the (already updated) user message to answer instead of saving a new one */
    existingUserMessageId?: string;
  }) {
    const { userId, guestId, sessionId, title, userMessage, userConfig, requestId, streamManager } = params;
    const reqLog = childLogger({ subsystem: 'chat-service', requestId });
    reqLog.info('Chat request received', { hasSessionKey: !!sessionId, regenerate: !!params.isRegenerate, edit: !!params.existingUserMessageId });

    // 1. Resolve Session (find by id, or find-or-create by the client's conversation key)
    const session = await sessionRepository.findOrCreate(userId || null, sessionId || '', {
      title: title || 'New Session',
      currentTopic: params.teachingContext?.currentTopic || 'General',
      explanationMode: params.teachingContext?.explanationMode || 'basic'
    }, true, guestId || null);

    if (!session) throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to resolve session');
    const sessionIdStr = session._id.toString();
    reqLog.info('Conversation resolved', { sessionId: sessionIdStr });

    // Tell the client the canonical conversation id before anything else, so a
    // follow-up (or a retry after a failure) targets this same conversation.
    if (streamManager) {
      streamManager.setSessionId(sessionIdStr);
      streamManager.send({ type: 'meta', sessionId: sessionIdStr, requestId, title: session.title } as any);
    }

    // Update title if it's currently generic and a real one was provided
    if (title && (session.title === 'Untitled Session' || session.title === 'New Session' || session.title === 'Canvas Session' || !session.title)) {
      await sessionRepository.updateById(session._id, { title });
      session.title = title;
    }

    // 1.1 Idempotency: one generation per (conversation, requestId)
    const claim = await this.claimRequest(session._id, requestId);
    if (claim.kind === 'in_progress') {
      reqLog.warn('Duplicate request rejected while original is in progress', { sessionId: sessionIdStr, status: claim.ledger.status });
      throw new ChatError('DUPLICATE_IN_PROGRESS');
    }
    if (claim.kind === 'completed') {
      return this.replayCompleted(claim.ledger, session, streamManager);
    }

    // 1.2 Never trust a client message id: it must be an assistant message of THIS conversation
    if (params.originalMessageId) {
      const owned = /^[0-9a-fA-F]{24}$/.test(params.originalMessageId)
        ? await messageRepository.findInSession(params.originalMessageId, sessionIdStr)
        : null;
      if (!owned || owned.role !== 'assistant') params.originalMessageId = undefined;
    }

    // Auto-detect originalMessageId for regeneration if missing
    if (params.isRegenerate && !params.originalMessageId) {
      const lastAssistantMsg = (session.messages || []).slice().reverse().find((m: any) => m.role === 'assistant');
      if (lastAssistantMsg) {
        params.originalMessageId = lastAssistantMsg._id.toString();
      }
    }

    // 1.5. Resolve User Tier
    let userTier: 'free' | 'pro' | 'enterprise' = 'free';
    if (userId) {
      const user = await userRepository.findById(userId);
      userTier = user?.tier || 'free';
    }

    // 2. USER MESSAGE PERSISTENCE (durability first, exactly once per request)
    //  - retry of a failed request: reuse the user message it already saved
    //  - edit: the edited message was updated in place by the controller
    //  - regenerate: answer the last user message again
    let userMsgId: string;
    try {
      if (claim.kind === 'retry' && claim.ledger.userMessageId) {
        userMsgId = claim.ledger.userMessageId;
      } else if (params.existingUserMessageId) {
        userMsgId = params.existingUserMessageId;
      } else if (params.isRegenerate) {
        const lastUserMsg = (session.messages || []).slice().reverse().find((m: any) => m.role === 'user');
        userMsgId = lastUserMsg ? lastUserMsg._id.toString() : `ref-${Date.now()}`;
      } else {
        userMsgId = await sessionRepository.pushMessage(session._id, {
          role: 'user',
          content: userMessage,
          requestId,
          ...(userId ? { userId } : guestId ? { guestId } : {}),
        });
      }
    } catch (err) {
      await this.updateLedger(session._id, requestId, { status: 'failed', errorCode: classifyChatError(err) });
      throw err;
    }
    reqLog.info('User message persisted', { sessionId: sessionIdStr, userMessageId: userMsgId, reused: claim.kind === 'retry' });

    // A retry that only failed to SAVE its answer: save the stored answer, don't regenerate.
    if (claim.kind === 'retry' && claim.ledger.response && !claim.ledger.assistantMessageId && !params.isRegenerate) {
      reqLog.info('Recovering generated-but-unsaved answer', { sessionId: sessionIdStr });
      try {
        const assistantMsgId = await sessionRepository.addMessage(session._id, {
          role: 'assistant', content: claim.ledger.response, requestId, status: 'completed',
        });
        await this.updateLedger(session._id, requestId, { status: 'completed', userMessageId: userMsgId, assistantMessageId: assistantMsgId });
        return this.replayCompleted({ ...claim.ledger, userMessageId: userMsgId, assistantMessageId: assistantMsgId }, session, streamManager);
      } catch (err) {
        await this.updateLedger(session._id, requestId, { status: 'failed', errorCode: 'PERSISTENCE_FAILED' });
        throw new ChatError('PERSISTENCE_FAILED', undefined, { cause: err });
      }
    }

    // History sent to the model: earlier finished turns only (the current user
    // message is appended explicitly below, so it must not appear twice).
    session.messages = (session.messages || []).filter((m: any) => isContextMessage(m, userMsgId));

    // Update ledger to 'requesting'
    await this.updateLedger(session._id, requestId, {
      status: 'requesting',
      userMessageId: userMsgId
    });

    // ASYNC: Add to Long-Term Memory (Postgres)
    VectorStoreService.addMemory({
      ownerId: userId || 'anonymous',
      namespace: 'session',
      referenceId: session._id.toString(),
      content: userMessage,
      metadata: { role: 'user', topic: session.currentTopic }
    }).catch(e => log.warn('User memory storage failed:', { error: e.message }));

    try {
      // A question asked while an Engine v2 lesson is on screen is answered on that
      // board, as a branch of the lesson. We already know it will be drawn, so start
      // it now, alongside planning.
      const lessonContext = engineV2Enabled() ? params.lessonContext : undefined;
      let lessonDoubt: Promise<DoubtResult> | undefined;
      if (lessonContext) {
        // custom API keys use the user's model; otherwise the fast doubt model (main model as fallback)
        const model = userConfig?.useCustomApi
          ? await BudgetService.resolveOptimizedModel('visualization', session._id.toString(), userTier)
          : undefined;
        lessonDoubt = answerOnBoard(userMessage, lessonContext.scene, lessonContext.beatIndex, { model, userConfig, signal: streamManager?.signal })
          .catch((err): DoubtResult => ({ ok: false, errors: [{ path: '(model)', message: (err as Error).message }], ms: 0, attempts: 0, model: model ?? '' }));
        lessonDoubt.then((d) => {
          console.log(`[Chat] doubt on the board → ${d.ok ? d.kind : 'FAILED'} in ${d.ms} ms, ${d.attempts} attempt(s)`);
          if (d.ok && d.kind === 'branch') streamManager?.send({ type: 'scene_branch', branch: toBranch(d) } as any);
        });
      }

      const planStarted = Date.now();
      const plan = await withBudget(
        PlannerService.generatePlan(userMessage, userConfig, requestId),
        PLANNER_BUDGET_MS,
        () => PlannerService.getFallbackPlan(userMessage),
        () => reqLog.warn('Planner exceeded its budget; answering with the default plan', { budgetMs: PLANNER_BUDGET_MS }),
      );
      reqLog.info('Plan ready', { ms: Date.now() - planStarted, visual: !!plan.visualization?.generate });
      
      // Enrich plan schema to support frontend UI layout triggers and BuildSystemPrompt instructions
      if (plan.artifacts) {
        (plan as any).generate_artifact = plan.artifacts.generate;
        (plan as any).artifact_type = plan.artifacts.type;
      }
      if (plan.visualization) {
        (plan as any).suggest_canvas = plan.visualization.generate;
        (plan as any).canvas_type = plan.visualization.type;
      }
      // Explicitly check if user requested a visual canvas or visual explanation
      if (/(visual|canvas|draw|diagram|plot|simulate|animate|node|map|graph|hierarchy|network)/i.test(userMessage)) {
        plan.visualization = plan.visualization || { generate: true, type: 'd3', necessity: 'required' };
        plan.visualization.generate = true;
        plan.visualization.type = plan.visualization.type === 'none' ? 'd3' : (plan.visualization.type || 'd3');
        (plan as any).suggest_canvas = true;
        (plan as any).canvas_type = plan.visualization.type;
        // Suppress the text-based artifact card to let the Neural Canvas take full control
        (plan as any).generate_artifact = false;
      }

      if (lessonDoubt) {
        // drawn on the lesson's board: no new canvas (a skeleton would clear the board)
        plan.visualization = { ...(plan.visualization || {}), generate: true, type: 'd3', necessity: 'required' } as any;
        (plan as any).suggest_canvas = false;
        (plan as any).generate_artifact = false;
      }

      streamManager?.send({ type: 'status', content: 'Strategy generated', data: { plan } });
      streamManager?.send({ type: 'plan', plan } as any);

      // Pre-emptively signal canvas layout splitting if visual generation is enabled
      if ((plan as any).suggest_canvas) {
        streamManager?.send({
          type: 'canvas_skeleton',
          layout: 'split',
          rendererType: (plan as any).canvas_type || 'd3'
        } as any);
      }

      // 4. CONTEXT GATHERING (Planner-First optimization)
      const topic = session.currentTopic || 'General';
      // Retrieval is optional context: if it fails the answer is still generated,
      // just without that context (and without sources it never received).
      const [pastContext, webResults] = await Promise.all([
        (plan.tools.rag && userId)
          ? withBudget(
              Promise.resolve((VectorStoreService as any).getContextForTopic(topic, 3, userId)).catch((e: any) => {
                reqLog.warn('Retrieval failed; answering without memory context', { error: e?.message });
                return '';
              }),
              RETRIEVAL_BUDGET_MS, () => '',
              () => reqLog.warn('Memory retrieval exceeded its budget; answering without it'),
            )
          : Promise.resolve(''),
        plan.tools.web_search
          ? withBudget(
              searchWeb(userMessage, { count: 5 }).catch((e: any) => {
                reqLog.warn('Web search failed; answering without web sources', { error: e?.message });
                return [];
              }),
              RETRIEVAL_BUDGET_MS, () => [] as any[],
              () => reqLog.warn('Web search exceeded its budget; answering without web sources'),
            )
          : Promise.resolve([])
      ]);

      const webContextStr = formatForPrompt(webResults);
      const sources = extractSources(webResults);

      // 5. AGENT ORCHESTRATION (Parallel execution of Narrator/Visualizer)
      // We start this now but don't await it yet to allow the main LLM call to start immediately.
      const orchestrationPromise = Orchestrator.execute(plan, {
        sessionId: session._id.toString(),
        requestId,
        topic,
        userMessage,
        userConfig,
        userTier,
        signal: streamManager?.signal,
        lessonDoubt,
        learnerLevel: params.teachingContext?.learnerLevel,
        onScenePartial: streamManager
          ? (timeline) => streamManager.send({ type: 'scene_v2', timeline, partial: true } as any)
          : undefined,
        // complete: the client stops waiting for more beats (questions can now refer to it)
        onSceneReady: streamManager
          ? (timeline) => streamManager.send({ type: 'scene_v2', timeline, partial: false } as any)
          : undefined,
      }).catch(err => {
        log.warn(`Orchestration failed for ${requestId}:`, { error: err.message });
        return { narration: { narrations: [] }, visualScript: { script: [] }, sceneV2: null as SceneTimeline | null, sceneBranch: null as SceneBranch | null, criticScore: 1, metadata: { stages: {}, totalTokens: 0 } };
      });
      
      // Notify client that background agents are starting
      streamManager?.send({ type: 'status', content: 'Orchestrating agents...' });

      // 6. BUILD SYSTEM PROMPT (Context Injection)
      const systemPrompt = buildSystemPrompt({
        currentTopic: topic,
        explanationMode: session.explanationMode || 'basic',
        learnerLevel: params.teachingContext?.learnerLevel || 'intermediate',
        mode: plan.teaching_mode,
        webContext: webContextStr,
        pastContext,
        planner: plan,
        memorySummary: '',
        userName: userConfig?.name || null,
      });

      // SEC-09: Context Window Management (Last 20 messages)
      const llmMessages = buildLLMMessages(session.messages || [], systemPrompt, 20);
      const onScreen = lessonContext ? lessonStep(lessonContext) : null;
      llmMessages.push({
        role: 'user',
        content: onScreen
          ? `${userMessage}\n\n[Asked while watching step ${onScreen.n} ("${onScreen.title}") of the visual lesson on screen; the board will show the answer.]`
          : userMessage,
      });

      // Handle Streaming vs Blocking
      if (streamManager) {
        return await this.handleStreamingResponse(
          llmMessages, 
          plan, 
          sources, 
          session._id, 
          userId || null, 
          streamManager, 
          requestId, 
          userMsgId, 
          userTier, 
          orchestrationPromise,
          params.isRegenerate,
          params.originalMessageId,
          userConfig,
          guestId
        );
      }
 
      // 6.5 RESOLVE OPTIMIZED MODEL (Tier-Aware)
      const model = await BudgetService.resolveOptimizedModel('final_answer', session._id.toString(), userTier);
 
      // Blocking Response
      const [aiResponse, orchestrationResult] = await Promise.all([
        requestCompletion({
          model: resolveModelId(model),
          messages: llmMessages,
          temperature: 0.7,
          maxTokens: 4000,
          userConfig,
          sessionContext: topic,
          requestId, // TRACING
          taskType: 'final_answer',
        }),
        orchestrationPromise
      ]);
 
      if (aiResponse.error) throw new AppError(ErrorCode.AI_GENERATION_FAILED, aiResponse.error);
      if (!aiResponse.content || !aiResponse.content.trim()) throw new ChatError('EMPTY_RESPONSE');

      // SEC-BUDGET: Record final response usage (never fails an answer that was produced)
      const tokens = (aiResponse._meta?.tokens_in || 0) + (aiResponse._meta?.tokens_out || 0);
      await BudgetService.recordUsage(session._id.toString(), tokens, userTier).catch((e: any) => log.warn('Usage recording failed', { error: e.message }));
 
      // Persist visual artifact if generated
      const { savedArtifactId, artifactPayload } = await this.persistOrchestratedArtifact({
        sessionId: session._id.toString(),
        userId: userId || null,
        guestId: guestId || null,
        topic: (plan as any).topic || topic,
        orchestrationResult
      });

      // 7. ATOMIC PERSISTENCE
      const assistantMsg = { 
        role: 'assistant', 
        content: aiResponse.content, 
        metadata: { 
          sources, 
          orchestration: orchestrationResult.metadata,
          narration: orchestrationResult.narration,
          visuals: orchestrationResult.sceneBranch ? branchVisuals(orchestrationResult.sceneBranch)
            : orchestrationResult.sceneV2 ? sceneV2Visuals(orchestrationResult.sceneV2) : orchestrationResult.visualScript,
          plan: { mode: plan.teaching_mode, complexity: plan.complexity },
          hasVisualArtifact: !!(orchestrationResult.sceneBranch || orchestrationResult.sceneV2 || orchestrationResult?.visualScript?.script?.length || (plan as any).suggest_canvas),
          rendererType: orchestrationResult.sceneBranch || orchestrationResult.sceneV2 ? 'scene-v2' : orchestrationResult?.visualScript?.renderer || (plan as any).canvas_type,
          artifactId: savedArtifactId,
          artifactData: artifactPayload
        } 
      };

      let assistantMsgId: string;
      if (params.isRegenerate && params.originalMessageId) {
        await messageRepository.addVersion(params.originalMessageId, aiResponse.content, assistantMsg.metadata);
        assistantMsgId = params.originalMessageId;
      } else {
        assistantMsgId = await sessionRepository.addMessage(session._id, {
          ...assistantMsg,
          requestId,
          status: 'completed',
          ...(userId ? { userId } : guestId ? { guestId } : {}),
          ...(orchestrationResult.sceneBranch ? sceneV2Canvas(sceneToTimeline(orchestrationResult.sceneBranch.scene))
            : orchestrationResult.sceneV2 ? sceneV2Canvas(orchestrationResult.sceneV2) : {}),
        });
      }

      if (savedArtifactId) {
        await Artifact.findByIdAndUpdate(savedArtifactId, { messageId: assistantMsgId }).catch(e =>
          log.warn('Failed to update artifact messageId:', { error: e.message })
        );
      }

      // ASYNC: Add to Long-Term Memory (Postgres)
      VectorStoreService.addMemory({
        ownerId: userId || 'anonymous',
        namespace: 'session',
        referenceId: session._id.toString(),
        content: aiResponse.content,
        metadata: { role: 'assistant', topic }
      }).catch(e => log.warn('Assistant memory storage failed:', { error: e.message }));

      // 9. ASYNC BACKGROUND WORK (Enrichment/Analysis)
      // Fire-and-forget pedagogical critique. It writes `pedagogicalAudit` into
      // the message metadata, but nothing currently reads that field, so the LLM
      // call is pure cost. Gated off by default (Phase 8 simplification); flip
      // ENABLE_PEDAGOGICAL_CRITIQUE=true once a UI actually surfaces the audit.
      if (process.env.ENABLE_PEDAGOGICAL_CRITIQUE === 'true') {
        processCritiqueAsync({
          sessionId: session._id.toString(),
          requestId,
          payload: {
            topic,
            message: aiResponse.content,
            narration: orchestrationResult.narration,
            visuals: orchestrationResult.visualScript
          }
        });
      }

      await this.updateLedger(session._id, requestId, {
        status: 'completed',
        userMessageId: userMsgId,
        assistantMessageId: assistantMsgId,
        response: aiResponse.content,
      });

      return {
        response: aiResponse.content,
        sessionId: session._id.toString(),
        userMessageId: userMsgId,
        assistantMessageId: assistantMsgId,
        sources,
        plan,
        isRegenerate: !!params.isRegenerate,
        metadata: params.isRegenerate ? (await messageRepository.findById(assistantMsgId))?.metadata : assistantMsg.metadata
      };
    } catch (err) {
      const category = classifyChatError(err);
      // cancelled -> 'aborted'; anything else -> 'failed' (a retry with the same requestId may take it over)
      await this.updateLedger(session._id, requestId, {
        status: category === 'CANCELLED' ? 'aborted' : 'failed',
        errorCode: category,
      });
      reqLog.warn('Generation did not complete', { sessionId: sessionIdStr, category, error: (err as Error)?.message });
      throw err;
    }
  }

  /**
   * Switches the active version of a message.
   */
  async switchMessageVersion(messageId: string, versionIndex: number) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new AppError(ErrorCode.NOT_FOUND, 'Message not found');

    const versions = message.metadata?.versions || [];
    if (versionIndex < 0 || versionIndex >= versions.length) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, `Invalid version index: ${versionIndex}. Max: ${versions.length - 1}`);
    }

    const targetVersion = versions[versionIndex];
    const resolvedContent = targetVersion.content || targetVersion.text || '';
    
    // Update the message content and active index
    await messageRepository.updateById(messageId, {
      content: resolvedContent,
      'metadata.activeVersionIndex': versionIndex,
      // If the version has its own canvas state, restore it
      ...(targetVersion.canvasSnapshot ? { 
        hasCanvas: true, 
        canvasSnapshot: targetVersion.canvasSnapshot 
      } : {})
    });

    return { 
      success: true, 
      content: resolvedContent,
      metadata: { activeVersionIndex: versionIndex }
    };
  }

  private async handleStreamingResponse(
    messages: any[], 
    plan: any, 
    sources: any[], 
    sessionId: any, 
    userId: string | null,
    streamManager: StreamLifecycleManager,
    requestId: string,
    userMessageId: string,
    userTier: 'free' | 'pro' | 'enterprise' = 'free',
    orchestrationPromise?: Promise<any>,
    isRegenerate?: boolean,
    originalMessageId?: string,
    userConfig?: any,
    guestId?: string | null
  ) {
    let fullContent = '';
    
    // DL-07: Update ledger to 'streaming' to refresh updatedAt and prevent eviction
    await this.updateLedger(sessionId, requestId, { status: 'streaming' });

    const model = await BudgetService.resolveOptimizedModel('final_answer', sessionId.toString(), userTier);
    const reqLog = childLogger({ subsystem: 'chat-service', requestId, sessionId: sessionId.toString() });
    const genStarted = Date.now();
    let firstTokenMs: number | null = null;
    reqLog.info('Generation started', { model: resolveModelId(model) });

    let aiResponse: any;
    try {
      aiResponse = await requestCompletion({
        model: resolveModelId(model),
        messages,
        onStream: (token) => {
          if (streamManager.signal.aborted) return; // late tokens after Stop are dropped
          if (firstTokenMs === null) {
            firstTokenMs = Date.now() - genStarted;
            reqLog.info('First token received', { ms: firstTokenMs });
          }
          fullContent += token;
          streamManager.send({ type: 'chunk', content: token });
        },
        signal: streamManager.signal,
        requestId, // TRACING
        taskType: 'final_answer',
        userConfig,
      });
    } catch (err) {
      if (streamManager.signal.aborted) {
        await this.persistCancelled(sessionId, requestId, userMessageId, fullContent, isRegenerate, userId, guestId);
      }
      throw err;
    }

    if (streamManager.signal.aborted) {
      // The client left (Stop / closed tab) after the provider finished.
      await this.persistCancelled(sessionId, requestId, userMessageId, fullContent, isRegenerate, userId, guestId);
      throw new ChatError('CANCELLED');
    }
    if (aiResponse?.error) throw new AppError(ErrorCode.AI_GENERATION_FAILED, aiResponse.error);
    // Providers that return the whole answer without streaming it (cache hit, some fallbacks)
    if (!fullContent && aiResponse?.content) {
      fullContent = aiResponse.content;
      streamManager.send({ type: 'chunk', content: fullContent });
    }
    if (!fullContent.trim()) throw new ChatError('EMPTY_RESPONSE');
    reqLog.info('Generation completed', {
      ms: Date.now() - genStarted,
      chars: fullContent.length,
      provider: aiResponse?._meta?.provider_used,
      fallback: !!aiResponse?._meta?.fallback_triggered,
    });

    // Await orchestration while the stream finishes — but bound the wait. Under
    // severe provider rate-limiting the visualizer can retry for many seconds;
    // rather than hold the stream open (and risk the client giving up before the
    // scene arrives), cap it and fall back to a guaranteed scene. The real
    // orchestration keeps running in the background and still persists to metadata.
    // An Engine v2 lesson streams its beats as they are ready, so the client is
    // never left waiting blind: give it longer before falling back.
    const ORCHESTRATION_STREAM_BUDGET_MS = engineV2Enabled() ? 150000 : 25000;
    let orchestrationTimedOut = false;
    const orchestrationResult: any = orchestrationPromise
      ? await Promise.race([
          orchestrationPromise,
          new Promise((resolve) => setTimeout(() => {
            orchestrationTimedOut = true;
            resolve({
              narration: { narrations: [] },
              // Engine v2 says it ran out of time; v1 draws its placeholder concept map
              visualScript: (plan as any).suggest_canvas && !engineV2Enabled()
                ? generateFallbackVisualScript((plan as any).topic || (plan as any).educational_intent || 'Lesson')
                : null,
              sceneFailure: engineV2Enabled() && (plan?.visualization?.generate || plan?.artifacts?.generate)
                ? lessonFailure(null, new Error('timed out')) : undefined,
              metadata: { stages: {}, totalTokens: 0, timedOut: true },
            });
          }, ORCHESTRATION_STREAM_BUDGET_MS)),
        ])
      : { narration: null, visualScript: null, metadata: {} };

    if (orchestrationTimedOut) {
      log.warn(`Orchestration exceeded ${ORCHESTRATION_STREAM_BUDGET_MS}ms for ${requestId}; streamed a fallback scene.`);
    }

    // Explicitly dispatch the generated visual simulation nodes to the frontend canvas UI
    const sceneV2: SceneTimeline | null = orchestrationResult?.sceneV2 ?? null;
    const sceneBranch: SceneBranch | null = orchestrationResult?.sceneBranch ?? null;
    if (sceneBranch || sceneV2) {
      // Engine v2: already sent the moment it was ready (scene_branch / scene_v2)
    } else if (orchestrationResult?.sceneFailure) {
      // no lesson could be drawn: say so (the text answer above still stands)
      streamManager.send({ type: 'scene_failed', message: orchestrationResult.sceneFailure } as any);
    } else if (orchestrationResult?.visualScript?.script && Array.isArray(orchestrationResult.visualScript.script)) {
      const rendererType = orchestrationResult.visualScript.renderer || (plan as any).canvas_type || 'd3';
      
      // Send realtime rendering nodes
      streamManager.send({
        type: 'scene_nodes',
        nodes: orchestrationResult.visualScript.script,
        renderer: rendererType
      } as any);
    }

    // Persist complete, renderable visual artifact (Engine v2, scene branch, or visual script)
    const { savedArtifactId, artifactPayload } = await this.persistOrchestratedArtifact({
      sessionId: sessionId.toString(),
      userId: userId || null,
      guestId: guestId || null,
      topic: (plan as any).topic || (plan as any).educational_intent,
      orchestrationResult,
      streamManager
    });

    // SEC-BUDGET: Record streaming usage (bookkeeping never fails a produced answer)
    const tokens = (aiResponse._meta?.tokens_in || 0) + (aiResponse._meta?.tokens_out || 0);
    await BudgetService.recordUsage(sessionId.toString(), tokens, userTier).catch((e: any) => log.warn('Usage recording failed', { error: e.message }));

    // Post-stream persistence
    const metadata = { 
      sources, 
      plan: { mode: plan.teaching_mode },
      orchestration: orchestrationResult.metadata,
      narration: orchestrationResult.narration,
      visuals: sceneBranch ? branchVisuals(sceneBranch) : sceneV2 ? sceneV2Visuals(sceneV2) : orchestrationResult.visualScript,
      hasVisualArtifact: !!(sceneBranch || sceneV2 || orchestrationResult?.visualScript?.script?.length || (plan as any).suggest_canvas),
      rendererType: sceneBranch || sceneV2 ? 'scene-v2' : orchestrationResult?.visualScript?.renderer || (plan as any).canvas_type,
      artifactId: savedArtifactId,
      artifactData: artifactPayload
    };

    // Final persistence. If it fails, the answer is kept in the ledger so a retry
    // with the same requestId saves it instead of generating a second one.
    let assistantMsgId: string;
    try {
      if (isRegenerate && originalMessageId) {
        await messageRepository.addVersion(originalMessageId, fullContent, metadata);
        assistantMsgId = originalMessageId;
      } else {
        assistantMsgId = await sessionRepository.addMessage(sessionId, {
          role: 'assistant',
          content: fullContent,
          metadata,
          requestId,
          status: 'completed',
          ...(userId ? { userId } : guestId ? { guestId } : {}),
          ...(sceneBranch ? sceneV2Canvas(sceneToTimeline(sceneBranch.scene)) : sceneV2 ? sceneV2Canvas(sceneV2) : {}),
        });
      }
    } catch (err) {
      reqLog.error('Assistant message persistence failed', { error: (err as Error).message });
      await this.updateLedger(sessionId, requestId, { status: 'failed', errorCode: 'PERSISTENCE_FAILED', userMessageId, response: fullContent });
      throw new ChatError('PERSISTENCE_FAILED', undefined, { cause: err });
    }
    reqLog.info('Assistant message persisted', { assistantMessageId: assistantMsgId });

    // Now that we have assistantMsgId, if we created an artifact, update its messageId
    if (savedArtifactId) {
      try {
        await Artifact.findByIdAndUpdate(savedArtifactId, { messageId: assistantMsgId });
      } catch (err) {
        log.warn('Failed to update artifact with messageId:', { error: (err as Error).message });
      }
    }

    // Sync IDs to client so it can replace ephemeral IDs
    streamManager.send({ 
      type: 'message_ids', 
      userMessageId,
      assistantMessageId: assistantMsgId,
      data: { userMessageId, assistantMessageId: assistantMsgId } 
    });

    // ASYNC: Add to Long-Term Memory (Postgres)
    VectorStoreService.addMemory({
      ownerId: userId || 'anonymous',
      namespace: 'session',
      referenceId: sessionId.toString(),
      content: fullContent,
      metadata: { role: 'assistant', topic: plan.topic || 'General' }
    }).catch(e => log.warn('Assistant memory storage failed:', { error: e.message }));

    await this.updateLedger(sessionId, requestId, {
      status: 'completed',
      userMessageId,
      assistantMessageId: assistantMsgId,
      response: fullContent
    });

    const finalMessage = await messageRepository.findById(assistantMsgId);

    streamManager.close({ 
      sources, 
      plan, 
      narration: orchestrationResult.narration,
      visuals: sceneBranch ? branchVisuals(sceneBranch) : sceneV2 ? sceneV2Visuals(sceneV2) : orchestrationResult.visualScript,
      artifactId: savedArtifactId,
      rendererType: metadata.rendererType,
      isRegenerate: !!isRegenerate,
      metadata: finalMessage?.metadata
    });
  }

  /**
   * Stop pressed (or connection lost) mid-answer: keep what the learner already
   * saw as a `cancelled` message so a refresh shows the same thing. Never marked
   * completed, never sent back to the model as context.
   */
  private async persistCancelled(sessionId: any, requestId: string, userMessageId: string, partial: string, isRegenerate?: boolean, userId?: string | null, guestId?: string | null) {
    try {
      let assistantMessageId: string | null = null;
      if (partial.trim() && !isRegenerate) {
        assistantMessageId = await sessionRepository.addMessage(sessionId, {
          role: 'assistant',
          content: partial,
          requestId,
          status: 'cancelled',
          ...(userId ? { userId } : guestId ? { guestId } : {}),
        });
      }
      await this.updateLedger(sessionId, requestId, { status: 'aborted', errorCode: 'CANCELLED', userMessageId, assistantMessageId });
      log.info('Generation cancelled by client', { requestId, keptChars: partial.length });
    } catch (err) {
      log.warn('Could not persist cancelled partial answer', { requestId, error: (err as Error).message });
    }
  }

  private async updateLedger(sessionId: any, requestId: string, payload: any) {
    try {
      await SessionLedger.findOneAndUpdate(
        { sessionId, requestId },
        { $set: { ...payload, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      log.warn('Ledger update failed:', { error: (err as Error).message });
    }
  }

  private async persistOrchestratedArtifact(params: {
    sessionId: string;
    userId?: string | null;
    guestId?: string | null;
    topic?: string;
    orchestrationResult: any;
    streamManager?: StreamLifecycleManager;
  }): Promise<{ savedArtifactId: string | null; artifactTitle: string | null; rendererType: string | null; artifactPayload: any | null }> {
    const sceneV2: SceneTimeline | null = params.orchestrationResult?.sceneV2 ?? null;
    const sceneBranch: SceneBranch | null = params.orchestrationResult?.sceneBranch ?? null;
    const visualScript = params.orchestrationResult?.visualScript ?? null;

    let title = (params.topic && params.topic !== 'General' ? params.topic : '') || 'Interactive Visualization';
    let rendererType = 'cinematic';
    let content = '';
    let sceneGraph: any = null;
    let artifactPayload: any = null;

    if (sceneBranch) {
      const branchTimeline = sceneToTimeline(sceneBranch.scene);
      title = (params.topic && params.topic !== 'General' ? params.topic : sceneBranch.title) || branchTimeline.title || 'Interactive Lesson';
      rendererType = 'scene-v2';
      artifactPayload = {
        renderer: 'scene-v2',
        rendererType: 'scene-v2',
        title,
        domain: branchTimeline.domain || 'general',
        sceneV2: branchTimeline.sceneV2,
        steps: branchTimeline.steps,
        branchFrom: sceneBranch.from,
        branchBeats: sceneBranch.beats
      };
      sceneGraph = {
        sceneV2: branchTimeline.sceneV2,
        steps: branchTimeline.steps,
        branchFrom: sceneBranch.from,
        branchBeats: sceneBranch.beats
      };
      content = JSON.stringify(artifactPayload);
    } else if (sceneV2) {
      title = (params.topic && params.topic !== 'General' ? params.topic : sceneV2.title) || 'Interactive Lesson';
      rendererType = 'scene-v2';
      artifactPayload = {
        renderer: 'scene-v2',
        rendererType: 'scene-v2',
        title,
        domain: sceneV2.domain || 'general',
        sceneV2: sceneV2.sceneV2,
        steps: sceneV2.steps
      };
      sceneGraph = {
        sceneV2: sceneV2.sceneV2,
        steps: sceneV2.steps
      };
      content = JSON.stringify(artifactPayload);
    } else if (visualScript?.script && Array.isArray(visualScript.script) && visualScript.script.length > 0) {
      title = params.topic || 'Generated Visualization';
      rendererType = visualScript.renderer || 'd3';
      const connections = visualScript.script.filter((n: any) => n.cmd === 'edge' || n.type === 'edge');
      artifactPayload = {
        renderer: rendererType,
        rendererType,
        title,
        script: visualScript.script,
        nodes: visualScript.script,
        elements: visualScript.script,
        connections
      };
      sceneGraph = {
        elements: visualScript.script,
        connections
      };
      content = JSON.stringify(artifactPayload);
    }

    if (!content) {
      return { savedArtifactId: null, artifactTitle: null, rendererType: null, artifactPayload: null };
    }

    try {
      const newArtifact = new Artifact({
        userId: params.userId || null,
        guestId: params.userId ? null : (params.guestId || null),
        sessionId: params.sessionId.toString(),
        messageId: null, // Will be updated after assistant message is created
        type: 'visual',
        artifactClass: 'whiteboard',
        title: title.slice(0, 200),
        content,
        sceneGraph,
        metadata: {
          rendererType,
          generator: 'ChatService',
          hasVisualArtifact: true,
          ...(sceneV2 ? { sceneV2: sceneV2.sceneV2 } : {}),
          ...(sceneBranch ? { sceneV2: artifactPayload?.sceneV2 } : {}),
        }
      });
      await newArtifact.save();
      const savedArtifactId = newArtifact._id.toString();

      // Send SSE notification to client if streaming
      if (params.streamManager) {
        params.streamManager.send({
          type: 'artifact_saved',
          artifactId: savedArtifactId,
          title,
          rendererType
        });
      }

      // Keep ChatSession canvasSteps in sync with the latest visualization
      const stepsToPersist = sceneBranch
        ? artifactPayload?.steps
        : sceneV2
        ? sceneV2.steps
        : (visualScript?.script || []);
      
      if (stepsToPersist && stepsToPersist.length > 0) {
        await ChatSession.findByIdAndUpdate(params.sessionId, {
          $set: {
            canvasSteps: stepsToPersist,
            lastUpdated: new Date()
          }
        }).catch((e: any) => log.warn('Failed to update session canvasSteps:', { error: e.message }));
      }

      return { savedArtifactId, artifactTitle: title, rendererType, artifactPayload };
    } catch (err) {
      log.warn('Failed to persist visual artifact:', { error: (err as Error).message });
      return { savedArtifactId: null, artifactTitle: title, rendererType, artifactPayload };
    }
  }
}

export default new ChatService();

