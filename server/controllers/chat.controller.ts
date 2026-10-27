import { Request, Response } from 'express';
import { z } from 'zod';
import chatService from '../services/chat/chat.service.js';
import { StreamLifecycleManager } from '../services/chat/stream.service.js';
import { resolveUserConfig } from '../sockets/utils.js';
import messageRepository from '../repositories/message.repository.js';
import sessionRepository from '../repositories/session.repository.js';
import { requestCompletion, getTextModel } from '../utils/ai/llmClient.js';
import { toChatClientError } from '../services/chat/chatErrors.js';
import { generationRegistry } from '../services/chat/generationRegistry.js';

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
      guestId: (req as any).guestId,
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
  // Stoppable by its owner via POST /api/chat/stop, even after the connection drops
  const unregister = generationRegistry.register({
    requestId,
    userId: (req as any).user?._id?.toString() || null,
    guestId: (req as any).user?._id ? null : ((req as any).guestId || null),
    sessionKey: validation.sessionId || undefined,
    startedAt: Date.now(),
    stop: () => streamManager.stop(),
  });
  try {
    const baseConfig = await resolveUserConfig(req, (req as any).user, validation.userMessage);
    const userConfig: any = baseConfig ? { ...baseConfig } : { useCustomApi: false };
    
    // SECURITY: E2E Mock must ONLY be accessible in test environments
    if (req.headers['x-e2e-mock-ai'] && (process.env.NODE_ENV === 'test' || String(process.env.E2E_MODE) === 'true')) {
      userConfig.isE2EMock = true;
    }

    await chatService.processMessage({
      userId: (req as any).user?._id?.toString(),
      guestId: (req as any).guestId,
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
  } finally {
    unregister();
  }
};

const stopSchema = z.object({
  requestId: z.string().regex(KEY),
  sessionId: z.string().regex(KEY).optional(),
});

/**
 * POST /api/chat/stop — stop one of the caller's answers mid-generation.
 * Closing the connection alone no longer cancels (the answer finishes and is saved).
 */
export const stopGeneration = async (req: Request, res: Response) => {
  const parsed = stopSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request', code: 'INVALID_REQUEST', retryable: false });
  const result = await generationRegistry.requestStop(parsed.data.requestId, {
    userId: (req as any).user?._id?.toString() || null,
    guestId: (req as any).guestId || null,
    sessionId: parsed.data.sessionId,
  });
  if (result === 'forbidden') return res.status(403).json({ error: 'Not your generation', code: 'ACCESS_DENIED', retryable: false });
  // not_found: it already finished (or never started) — nothing left to stop
  res.json({ status: result });
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
    const guestId = (req as any).guestId;
    
    if (typeof newContent !== 'string' || !newContent.trim() || newContent.length > 10000) {
      return res.status(400).json({ error: 'Invalid request', code: 'INVALID_REQUEST', retryable: false });
    }
    const message = await assertMessageOwnership(messageId, userId, sessionId, guestId);
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
    const guestId = (req as any).guestId;
    
    if (typeof newContent !== 'string' || !newContent.trim() || newContent.length > 10000) {
      return res.status(400).json({ error: 'Invalid request', code: 'INVALID_REQUEST', retryable: false });
    }
    const message = await assertMessageOwnership(messageId, userId, sessionId, guestId);
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
    const { messageId, sessionId, startingFrom } = req.body;
    const userId = (req as any).user?._id?.toString();
    const guestId = (req as any).guestId;
    const message = await assertMessageOwnership(messageId, userId, sessionId, guestId);

    if (startingFrom) {
      const actualSessionId = message.sessionId.toString();
      await messageRepository.deleteMessagesStartingFrom(actualSessionId, message.timestamp);
    } else {
      await messageRepository.deleteMessage(messageId);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Request failed' });
  }
};

export const updateMessageFeedback = async (req: Request, res: Response) => {
  try {
    const { messageId, feedback, sessionId } = req.body;
    const userId = (req as any).user?._id?.toString();
    const guestId = (req as any).guestId;
    await assertMessageOwnership(messageId, userId, sessionId, guestId);

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
    const guestId = (req as any).guestId;
    await assertMessageOwnership(messageId, userId, sessionId, guestId);

    const result = await chatService.switchMessageVersion(messageId, versionIndex);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Request failed' });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertMessageOwnership(messageId: string, userId: string | undefined, sessionId?: string, guestId?: string) {
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
    if (userId) {
       throw { status: 403, message: 'Access denied: Registered users cannot modify guest sessions' };
    }
    
    // Check verified guestId if session has guestId
    if (session.guestId) {
      if (!guestId || session.guestId !== guestId) {
        throw { status: 403, message: 'Access denied: You do not own this guest session' };
      }
    }
    
    if (sessionId && msg.sessionId.toString() !== sessionId) {
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
    const cleanMsg = (userMsg || '').trim();
    if (!cleanMsg) return 'New Session';

    const response = await requestCompletion({
      model: getTextModel(),
      messages: [
        { 
          role: 'system', 
          content: 'You generate short, clean, grammatically correct conversation titles (3 to 6 words) based on the user request. Example: "How to Find Area of a Circle", "Implicit Heart Curve Formula", "Introduction to Calculus". Keep natural prepositions and proper grammar. Do NOT use quotation marks, trailing periods, or ellipses. Output ONLY the title.' 
        },
        { role: 'user', content: cleanMsg }
      ],
      temperature: 0.3,
      maxTokens: 20,
    });
    const title = (response.content || '').replace(/^["'`#]+|["'`#.]+$/g, '').trim();
    return title || (cleanMsg.length <= 40 ? cleanMsg.charAt(0).toUpperCase() + cleanMsg.slice(1) : 'New Session');
  } catch (err) {
    const fallback = (userMsg || '').trim();
    return fallback.length <= 40 && fallback.length > 0
      ? fallback.charAt(0).toUpperCase() + fallback.slice(1)
      : 'New Session';
  }
};
