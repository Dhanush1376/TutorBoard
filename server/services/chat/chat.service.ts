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
import { queueService } from '../queue/queue.service.js';
import { StreamLifecycleManager } from './stream.service.js';
import ChatSession from '../../models/ChatSession.js';
import SessionLedger from '../../models/SessionLedger.js';
import userRepository from '../../repositories/user.repository.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger({ subsystem: 'chat-service' });

export class ChatService {
  /**
   * Processes a standard chat message with Strategic Orchestration.
   */
  async processMessage(params: {
    userId?: string;
    sessionId?: string;
    title?: string;
    userMessage: string;
    mode: string;
    teachingContext?: any;
    userConfig?: any;
    requestId: string;
    streamManager?: StreamLifecycleManager;
    isRegenerate?: boolean;
    originalMessageId?: string;
  }) {
    const { userId, sessionId, title, userMessage, userConfig, requestId, streamManager } = params;

    // 1. Resolve Session (Find or Create)
    const session = await sessionRepository.findOrCreate(userId || null, sessionId || '', {
      title: title || 'New Session',
      currentTopic: params.teachingContext?.currentTopic || 'General',
      explanationMode: params.teachingContext?.explanationMode || 'basic'
    });
    
    if (!session) throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to resolve session');

    // Update title if it's currently generic and a real one was provided
    if (title && (session.title === 'Untitled Session' || session.title === 'New Session' || session.title === 'Canvas Session' || !session.title)) {
      await sessionRepository.updateById(session._id, { title });
      session.title = title;
    }

    // 1.1 Global Idempotency Check
    // Prevent duplicate processing of the same request ID
    const ledgerEntry = await SessionLedger.findOne({ sessionId: session._id, requestId });
    if (ledgerEntry) {
      log.warn(`Idempotency rejection: Request ${requestId} already processed or in progress. Status: ${ledgerEntry.status}`);
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Duplicate request detected');
    }

    // 1.2 Auto-detect originalMessageId for regeneration if missing
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

    // 2. ATOMIC USER MESSAGE PERSISTENCE (Durability first)
    // If regenerating, we don't push a new user message, we just find the previous one
    let userMsgId: string;
    if (params.isRegenerate) {
      const lastUserMsg = (session.messages || []).slice().reverse().find((m: any) => m.role === 'user');
      userMsgId = lastUserMsg ? lastUserMsg._id.toString() : `ref-${Date.now()}`;
    } else {
      userMsgId = await sessionRepository.pushMessage(session._id, { role: 'user', content: userMessage });
    }
    
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
      const plan = await PlannerService.generatePlan(userMessage, userConfig, requestId);
      
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
      const [pastContext, webResults] = await Promise.all([
        (plan.tools.rag && userId) 
          ? (VectorStoreService as any).getContextForTopic(topic, 3, userId) 
          : Promise.resolve(''),
        plan.tools.web_search 
          ? searchWeb(userMessage, { count: 5 }) 
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
        signal: streamManager?.signal
      }).catch(err => {
        log.warn(`Orchestration failed for ${requestId}:`, { error: err.message });
        return { narration: { narrations: [] }, visualScript: { script: [] }, criticScore: 1, metadata: { stages: {}, totalTokens: 0 } };
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
      llmMessages.push({ role: 'user', content: userMessage });

      // Handle Streaming vs Blocking
      if (streamManager) {
        return this.handleStreamingResponse(
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
          params.originalMessageId
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
 
      // SEC-BUDGET: Record final response usage
      const tokens = (aiResponse._meta?.tokens_in || 0) + (aiResponse._meta?.tokens_out || 0);
      await BudgetService.recordUsage(session._id.toString(), tokens, userTier);
 
      // 7. ATOMIC PERSISTENCE
      const assistantMsg = { 
        role: 'assistant', 
        content: aiResponse.content, 
        metadata: { 
          sources, 
          orchestration: orchestrationResult.metadata,
          narration: orchestrationResult.narration,
          visuals: orchestrationResult.visualScript,
          plan: { mode: plan.teaching_mode, complexity: plan.complexity },
          hasVisualArtifact: !!(orchestrationResult?.visualScript?.script?.length || (plan as any).suggest_canvas),
          rendererType: orchestrationResult?.visualScript?.renderer || (plan as any).canvas_type
        } 
      };

      let assistantMsgId: string;
      if (params.isRegenerate && params.originalMessageId) {
        await messageRepository.addVersion(params.originalMessageId, aiResponse.content, assistantMsg.metadata);
        assistantMsgId = params.originalMessageId;
      } else {
        assistantMsgId = await sessionRepository.addMessage(session._id, assistantMsg);
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
      // Dead infrastructure fix: actually call the queue
      queueService.enqueueAgentTask({
        type: 'critique',
        sessionId: session._id.toString(),
        requestId,
        payload: { 
          topic, 
          message: aiResponse.content,
          narration: orchestrationResult.narration,
          visuals: orchestrationResult.visualScript
        }
      }).catch(err => log.warn('Failed to enqueue background task:', { error: (err as Error).message }));

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
      await this.updateLedger(session._id, requestId, { status: 'failed', error: (err as Error).message });
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
    originalMessageId?: string
  ) {
    let fullContent = '';
    
    // DL-07: Update ledger to 'streaming' to refresh updatedAt and prevent eviction
    await this.updateLedger(sessionId, requestId, { status: 'streaming' });

    const model = await BudgetService.resolveOptimizedModel('final_answer', sessionId.toString(), userTier);

    const aiResponse = await requestCompletion({
      model: resolveModelId(model),
      messages,
      onStream: (token) => {
        fullContent += token;
        streamManager.send({ type: 'chunk', content: token });
      },
      signal: streamManager.signal,
      requestId, // TRACING
      taskType: 'final_answer',
    });

    // Await orchestration in background while stream is finishing
    const orchestrationResult = orchestrationPromise 
      ? await orchestrationPromise 
      : { narration: null, visualScript: null, metadata: {} };

    // Explicitly dispatch the generated visual simulation nodes to the frontend canvas UI
    if (orchestrationResult?.visualScript?.script && Array.isArray(orchestrationResult.visualScript.script)) {
      streamManager.send({
        type: 'scene_nodes',
        nodes: orchestrationResult.visualScript.script,
        renderer: orchestrationResult.visualScript.renderer || (plan as any).canvas_type || 'd3'
      } as any);
    }

    // SEC-BUDGET: Record streaming usage
    const tokens = (aiResponse._meta?.tokens_in || 0) + (aiResponse._meta?.tokens_out || 0);
    await BudgetService.recordUsage(sessionId.toString(), tokens, userTier);

    // Post-stream persistence
    const metadata = { 
      sources, 
      plan: { mode: plan.teaching_mode },
      orchestration: orchestrationResult.metadata,
      narration: orchestrationResult.narration,
      visuals: orchestrationResult.visualScript,
      hasVisualArtifact: !!(orchestrationResult?.visualScript?.script?.length || (plan as any).suggest_canvas),
      rendererType: orchestrationResult?.visualScript?.renderer || (plan as any).canvas_type
    };

    let assistantMsgId: string;
    if (isRegenerate && originalMessageId) {
      await messageRepository.addVersion(originalMessageId, fullContent, metadata);
      assistantMsgId = originalMessageId;
    } else {
      assistantMsgId = await sessionRepository.addMessage(sessionId, {
        role: 'assistant',
        content: fullContent,
        metadata
      });
    }

    // Sync IDs to client so it can replace ephemeral IDs
    streamManager.send({ 
      type: 'message_ids', 
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
      visuals: orchestrationResult.visualScript,
      isRegenerate: !!isRegenerate,
      metadata: finalMessage?.metadata
    });
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
}

export default new ChatService();

