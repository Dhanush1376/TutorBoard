import { Request, Response } from 'express';
import { z } from 'zod';
import chatService from '../services/chat/chat.service.js';
import { StreamLifecycleManager } from '../services/chat/stream.service.js';
import { resolveUserConfig } from '../sockets/utils.js';
import messageRepository from '../repositories/message.repository.js';
import sessionRepository from '../repositories/session.repository.js';
import { requestCompletion, getTextModel } from '../utils/ai/llmClient.js';
import { toChatClientError } from '../services/chat/chatErrors.js';

/** Client idempotency keys / conversation keys: short, printable, no operators. */
const KEY = /^[A-Za-z0-9_.:-]{1,128}$/;

const sendMessageSchema = z.object({
  sessionId: z.string().regex(KEY).optional().nullable(),
  title: z.string().max(200).optional(),
  userMessage: z.string().trim().min(1).max(10000),
  requestId: z.string().regex(KEY).optional(),
  isRegenerate: z.boolean().optional(),
  originalMessageId: z.string().optional(),
  teachingContext: z.object({
    currentTopic: z.string().optional(),
    explanationMode: z.enum(['basic', 'advanced']).optional(),
    learnerLevel: z.string().optional(),
  }).optional(),
  /** Engine v2 lesson on screen when the question was asked (re-validated server side) */
  lessonContext: z.object({
    scene: z.record(z.any()),
    beatIndex: z.number().int().min(0).max(500),
  }).optional(),
}).passthrough();

/**
 * POST /api/chat
 */
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const validation = sendMessageSchema.parse(req.body);
    const result = await chatService.processMessage({
      userId: (req as any).user?._id?.toString(),
      sessionId: validation.sessionId ?? undefined,
      userMessage: validation.userMessage,
      mode: 'explain',
      teachingContext: validation.teachingContext,
      requestId: validation.requestId || (req as any).requestId || `req-${Date.now()}`,
      isRegenerate: validation.isRegenerate,
      originalMessageId: validation.originalMessageId,
      existingUserMessageId: (req as any).editedUserMessageId,
    });
    res.json(result);
  } catch (err: any) {
    const clientError = toChatClientError(err);
    res.status(clientError.status).json({ error: clientError.message, code: clientError.code, retryable: clientError.retryable });
  }
};

/**
 * POST /api/chat/stream
 */

export const streamMessage = async (req: Request, res: Response) => {
  let validation;
  try {
    validation = sendMessageSchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: 'Invalid request', code: 'INVALID_REQUEST', retryable: false });
  }
  // The body requestId is the idempotency key: the client keeps it across
  // retries of the same logical message and makes a new one per submission.
  const requestId = validation.requestId || req.headers['x-request-id']?.toString() || `req-${Date.now()}`;
  const streamManager = new StreamLifecycleManager(res, requestId, validation.sessionId || undefined);
  try {
    const baseConfig = await resolveUserConfig(req, (req as any).user, validation.userMessage);
    const userConfig: any = baseConfig ? { ...baseConfig } : { useCustomApi: false };
    
    // SECURITY: E2E Mock must ONLY be accessible in test environments
    if (req.headers['x-e2e-mock-ai'] && (process.env.NODE_ENV === 'test' || String(process.env.E2E_MODE) === 'true')) {
      userConfig.isE2EMock = true;
    }

    await chatService.processMessage({
      userId: (req as any).user?._id?.toString(),
      sessionId: validation.sessionId || undefined,
      title: validation.title as string | undefined,
      userMessage: validation.userMessage,
      mode: 'explain',
      teachingContext: validation.teachingContext,
      lessonContext: validation.lessonContext,
      userConfig,
      requestId,
      streamManager,
      isRegenerate: validation.isRegenerate,
      originalMessageId: validation.originalMessageId,
      existingUserMessageId: (req as any).editedUserMessageId,
    });
  } catch (err: any) {
    streamManager.error(err);
  }
};

export const regenerate = async (req: Request, res: Response) => {
  req.body.isRegenerate = true;
  return sendMessage(req, res);
};

export const streamRegenerate = async (req: Request, res: Response) => {
  req.body.isRegenerate = true;
  return streamMessage(req, res);
};

export const editMessage = async (req: Request, res: Response) => {
  try {
    const { sessionId, messageId, newContent } = req.body;
    const userId = (req as any).user?._id?.toString();
    
    if (typeof newContent !== 'string' || !newContent.trim() || newContent.length > 10000) {
      return res.status(400).json({ error: 'Invalid request', code: 'INVALID_REQUEST', retryable: false });
    }
    const message = await assertMessageOwnership(messageId, userId, sessionId);
    if (message.role !== 'user') throw { status: 400, message: 'Only your own messages can be edited' };
    const actualSessionId = message.sessionId.toString();

    // Branching: Delete all messages after this one to maintain logical flow
    await messageRepository.deleteMessagesAfter(actualSessionId, message.timestamp);
    
    // Update the message itself
    await messageRepository.updateById(messageId, { content: newContent, 'metadata.edited': true });

    // SEC-28: If this was the first message, update session title
    const firstMsg = await messageRepository.findFirstInSession(actualSessionId);
    if (firstMsg && firstMsg._id.toString() === messageId) {
      const newTitle = await generateSessionTitle(newContent);
      await sessionRepository.updateById(actualSessionId, { title: newTitle });
    }

    req.body.sessionId = actualSessionId;
    req.body.userMessage = newContent;
    // answer the edited message itself — don't save the new text as a second user message
    (req as any).editedUserMessageId = messageId;
    return sendMessage(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Request failed' });
  }
};

export const streamEditMessage = async (req: Request, res: Response) => {
  try {
    const { sessionId, messageId, newContent } = req.body;
    const userId = (req as any).user?._id?.toString();
    
    if (typeof newContent !== 'string' || !newContent.trim() || newContent.length > 10000) {
      return res.status(400).json({ error: 'Invalid request', code: 'INVALID_REQUEST', retryable: false });
    }
    const message = await assertMessageOwnership(messageId, userId, sessionId);
    if (message.role !== 'user') throw { status: 400, message: 'Only your own messages can be edited' };
    const actualSessionId = message.sessionId.toString();

    await messageRepository.deleteMessagesAfter(actualSessionId, message.timestamp);
    await messageRepository.updateById(messageId, { content: newContent, 'metadata.edited': true });

    // SEC-28: If this was the first message, update session title
    const firstMsg = await messageRepository.findFirstInSession(actualSessionId);
    if (firstMsg && firstMsg._id.toString() === messageId) {
      const newTitle = await generateSessionTitle(newContent);
      await sessionRepository.updateById(actualSessionId, { title: newTitle });
    }

    req.body.sessionId = actualSessionId;
    req.body.userMessage = newContent;
    // answer the edited message itself — don't save the new text as a second user message
    (req as any).editedUserMessageId = messageId;
    return streamMessage(req, res);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Request failed' });
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const { messageId, sessionId } = req.body;
    const userId = (req as any).user?._id?.toString();
    await assertMessageOwnership(messageId, userId, sessionId);

    await messageRepository.deleteMessage(messageId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Request failed' });
  }
};

export const updateMessageFeedback = async (req: Request, res: Response) => {
  try {
    const { messageId, feedback, sessionId } = req.body;
    const userId = (req as any).user?._id?.toString();
    await assertMessageOwnership(messageId, userId, sessionId);

    await messageRepository.updateMetadata(messageId, { feedback });
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Request failed' });
  }
};

export const switchMessageVersion = async (req: Request, res: Response) => {
  try {
    const { messageId, versionIndex, sessionId } = req.body;
    if (!messageId || versionIndex === undefined) {
      return res.status(400).json({ error: 'messageId and versionIndex are required' });
    }

    const userId = (req as any).user?._id?.toString();
    await assertMessageOwnership(messageId, userId, sessionId);

    const result = await chatService.switchMessageVersion(messageId, versionIndex);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Request failed' });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertMessageOwnership(messageId: string, userId: string | undefined, sessionId?: string) {
  if (!messageId) throw { status: 400, message: 'messageId is required' };
  
  const msg = await messageRepository.findById(messageId);
  if (!msg) throw { status: 404, message: 'Message not found' };

  const session = await sessionRepository.findById(msg.sessionId.toString());
  if (!session) throw { status: 404, message: 'Session not found' };

  // 1. If it's a registered user session
  if (session.userId) {
    if (session.userId.toString() !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this message' };
    }
  } 
  // 2. If it's a guest session (userId: null)
  else {
    // If the requester is an authenticated user, they shouldn't be messing with guest sessions
    // unless they are explicitly authorized (e.g., admin or the session was just theirs before login)
    // For now, we enforce that guests must provide the sessionId.
    if (userId) {
       throw { status: 403, message: 'Access denied: Registered users cannot modify guest sessions' };
    }
    
    // For guests, they MUST provide the sessionId in the request body to prove they are the ones who created it.
    // This provides basic protection against messageId enumeration.
    if (!sessionId || msg.sessionId.toString() !== sessionId) {
       throw { status: 403, message: 'Access denied: Valid sessionId required for guest mutations' };
    }
  }
  
  return msg;
}

export function detectTopic(text: string) {
  if (!text) return 'General';
  const clean = text.trim();
  return clean.length > 50 ? clean.split(/\s+/).slice(0, 5).join(' ') + '...' : clean || 'General';
}

export const generateSessionTitle = async (userMsg: string) => {
  try {
    if (userMsg.length <= 40) return userMsg.charAt(0).toUpperCase() + userMsg.slice(1);
    const response = await requestCompletion({
      model: getTextModel(),
      messages: [
        { role: 'system', content: 'Generate a 5-word title for this message. Output ONLY the title.' },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.3,
      maxTokens: 15,
    });
    return (response.content || 'New Session').trim();
  } catch (err) {
    return 'New Session';
  }
};
