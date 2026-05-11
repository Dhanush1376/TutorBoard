/**
 * pipelineWorker.ts — TutorBoard Enterprise
 * 
 * Bridges BullMQ jobs to the AgentLoop execution engine.
 */

import { Job } from 'bullmq';
import ChatMessage from '../models/ChatMessage.js';
import LearnerProfile from '../models/LearnerProfile.js';
import { runAgentLoop } from '../engine/core/agentLoop.js';
import type { AgentJobData } from '../services/queue/queue.service.js';
import sessionRepository from '../repositories/session.repository.js';
import messageRepository from '../repositories/message.repository.js';
import { requestCompletion, getFastModel } from '../utils/ai/llmClient.js';
import { getPrompt } from '../engine/config/promptRegistry.js';
import { extractJSON } from '../engine/core/utils/jsonUtils.js';

export async function processAgentJob(job: Job<AgentJobData>) {
  const { type, sessionId, requestId, payload } = job.data;
  
  console.log(`[Worker] 🛠️ Processing ${type} for session ${sessionId} [Job: ${job.id}]`);

  try {
    // 1. Load context
    const session = await sessionRepository.getByIdOrEngineId(sessionId);
    if (!session) {
      console.warn(`[Worker] Session ${sessionId} not found. Skipping.`);
      return;
    }

    // 2. Execute the requested stage
    if (type === 'critique') {
      console.log(`[Worker] ⚖️ Running pedagogical critique for session ${sessionId}...`);
      
      const critiqueResponse = await requestCompletion({
        model: getFastModel(),
        messages: [
          { role: 'system', content: getPrompt('critic') },
          { role: 'user', content: JSON.stringify(payload) }
        ],
        temperature: 0.2,
        responseMimeType: 'application/json'
      });

      const auditResult = extractJSON(critiqueResponse.content);
      
      if (auditResult) {
        // Find the last assistant message from the ChatMessage collection
        const assistantMsg = await ChatMessage.findOne(
          { sessionId: session._id, role: 'assistant' }
        ).sort({ timestamp: -1 }).lean();
        
        if (assistantMsg) {
          await messageRepository.updateMetadata(assistantMsg._id.toString(), {
            pedagogicalAudit: {
              scores: auditResult.scores,
              feedback: auditResult.feedback,
              timestamp: new Date()
            }
          });
        }
      }
      
      return { success: true, audited: !!auditResult };
    }

    // Default: Run the full AgentLoop (legacy/fallback)
    // Resolve real LearnerProfile if user exists
    let learnerProfile: any = session.learnerProfile || {
      level: 'intermediate',
      learning_style: 'visual',
      topicsMastery: {}
    };

    if (session.userId) {
      const profileDoc = await LearnerProfile.findOne({ userId: session.userId }).lean() as any;
      if (profileDoc) {
        learnerProfile = {
          ...learnerProfile,
          level: profileDoc.level || 'intermediate',
          learning_style: profileDoc.learningStyle || 'visual',
          topicsMastery: profileDoc.topicsMastery || {},
          prior_mastery: profileDoc.topicsMastery || {}, // Map to the engine's preferred key
        };
      }
    }

    const result = await runAgentLoop({
      topic: payload.topic,
      domain: payload.domain || 'general',
      learnerProfile,
      userConfig: payload.userConfig || {},
      requestId: requestId,
      signal: payload.signal || new AbortController().signal,
      onProgress: (stage: string) => {
        console.log(`[Worker:${requestId}] Stage: ${stage}`);
      }
    });

    // 3. Persist results atomically
    if (type === 'visualization' && result) {
      await sessionRepository.updateById(session._id, {
        $set: { 
          canvasState: result.elements,
          canvasSteps: result.timeline,
          lastUpdated: new Date()
        }
      });
    }

    return { success: true, result: !!result };
  } catch (err: any) {
    console.error(`[Worker] ❌ Job ${job.id} failed: ${err.message}`);
    throw err; // BullMQ will handle retries based on defaultJobOptions
  }
}
