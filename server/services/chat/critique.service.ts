import ChatMessage from '../../models/ChatMessage.js';
import sessionRepository from '../../repositories/session.repository.js';
import messageRepository from '../../repositories/message.repository.js';
import { requestCompletion, getFastModel } from '../../utils/ai/llmClient.js';
import { getPrompt } from '../../engine/config/promptRegistry.js';
import { extractJSON } from '../../engine/core/utils/jsonUtils.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger({ subsystem: 'critique-service' });

export async function processCritiqueAsync(params: {
  sessionId: string;
  requestId: string;
  payload: any;
}) {
  const { sessionId, requestId, payload } = params;

  try {
    log.info(`[Critique] ⚖️ Running pedagogical critique for session ${sessionId} [Req: ${requestId}]...`);

    const session = await sessionRepository.getByIdOrEngineId(sessionId);
    if (!session) {
      log.warn(`[Critique] Session ${sessionId} not found. Skipping.`);
      return;
    }

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
        log.info(`[Critique] Successfully updated metadata for message ${assistantMsg._id.toString()}`);
      }
    }
  } catch (err: any) {
    log.error(`[Critique] ❌ Critique failed for session ${sessionId}: ${err.message}`);
  }
}
