import { Request, Response } from 'express';
import { z } from 'zod';
import chatService from '../services/chat/chat.service.js';
import { StreamLifecycleManager } from '../services/chat/stream.service.js';
import { resolveUserConfig } from '../sockets/utils.js';
import messageRepository from '../repositories/message.repository.js';
import { requestCompletion, getTextModel } from '../utils/ai/llmClient.js';

const sendMessageSchema = z.object({
  sessionId: z.string().optional().nullable(),
  userMessage: z.string().min(1).max(10000),
  requestId: z.string().optional(),
  isRegenerate: z.boolean().optional(),
  originalMessageId: z.string().optional(),
  teachingContext: z.object({
    currentTopic: z.string().optional(),
    explanationMode: z.enum(['basic', 'advanced']).optional(),
    learnerLevel: z.string().optional(),
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
      requestId: validation.requestId || `req-${Date.now()}`,
      isRegenerate: validation.isRegenerate,
      originalMessageId: validation.originalMessageId,
    });
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

/**
 * POST /api/chat/stream
 */

export const streamMessage = async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id']?.toString() || `req-${Date.now()}`;
  let validation;
  try {
    validation = sendMessageSchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Invalid request body' });
  }
  const streamManager = new StreamLifecycleManager(res, requestId, validation.sessionId || undefined);
  try {
    const userConfig = await resolveUserConfig(req, (req as any).user, validation.userMessage);

    await chatService.processMessage({
      userId: (req as any).user?._id?.toString(),
      sessionId: validation.sessionId || undefined,
      title: validation.title,
      userMessage: validation.userMessage,
      mode: 'explain',
      teachingContext: validation.teachingContext,
      userConfig,
      requestId,
      streamManager,
      isRegenerate: validation.isRegenerate,
      originalMessageId: validation.originalMessageId,
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
    
    const message = await messageRepository.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Branching: Delete all messages after this one to maintain logical flow
    await messageRepository.deleteMessagesAfter(sessionId, message.timestamp);
    
    // Update the message itself
    await messageRepository.updateById(messageId, { content: newContent, 'metadata.edited': true });

    req.body.userMessage = newContent;
    return sendMessage(req, res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.body;
    await messageRepository.deleteMessage(messageId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateMessageFeedback = async (req: Request, res: Response) => {
  try {
    const { messageId, feedback } = req.body;
    await messageRepository.updateMetadata(messageId, { feedback });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const switchMessageVersion = async (req: Request, res: Response) => {
  try {
    const { messageId, versionIndex } = req.body;
    if (!messageId || versionIndex === undefined) {
      return res.status(400).json({ error: 'messageId and versionIndex are required' });
    }

    const result = await chatService.switchMessageVersion(messageId, versionIndex);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function detectTopic(text: string) {
  if (!text) return 'General';
  let clean = text.trim();
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
