import { z } from 'zod';
import ChatSession from '../models/ChatSession.js';
import { routeConversation } from '../ai-router/router/aiRouter.js';
import { logActivity } from './session.controller.js';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  sessionId: z.string().optional().nullable(),
  userMessage: z.string().min(1).max(10000),
  mode: z.enum(['quick', 'deep', 'test_me', 'explain']).optional().default('quick'),
  teachingContext: z.object({
    currentTopic: z.string().optional(),
    explanationMode: z.enum(['basic', 'advanced']).optional(),
    learnerLevel: z.string().optional(),
  }).optional(),
}).passthrough();

const editMessageSchema = z.object({
  sessionId: z.string(),
  messageId: z.string(),
  newContent: z.string().min(1).max(10000),
}).passthrough();

const regenerateSchema = z.object({
  sessionId: z.string(),
}).passthrough();

const deleteMessageSchema = z.object({
  sessionId: z.string(),
  messageId: z.string(),
}).passthrough();

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(teachingContext = {}, mode = 'quick') {
  const { currentTopic, explanationMode = 'basic', learnerLevel = 'intermediate' } = teachingContext;

  const modeInstructions = {
    quick: 'Provide clear, concise answers. Use examples and analogies when helpful.',
    deep: 'Provide thorough, in-depth explanations with multiple examples, analogies, and visual descriptions. Break complex topics into digestible steps.',
    test_me: 'Quiz the student on the current topic. Ask one question at a time, provide feedback on their answers, and adapt difficulty based on their responses.',
    explain: 'Explain the concept step by step, building from fundamentals to advanced understanding.',
  };

  return `You are TutorBoard AI, an expert visual teaching assistant designed to help students learn any subject deeply and intuitively.

## Your Teaching Style
- Explain concepts clearly with examples, analogies, and step-by-step breakdowns
- Adapt your explanation depth based on the learner's questions and level
- Use markdown formatting for readability (headers, bold, lists, code blocks)
- When asked follow-up questions, build on your previous explanations — never restart from scratch
- If a student seems confused, simplify and provide a different angle
- Be encouraging but precise — never give incorrect information

## Current Context
${currentTopic ? `- **Topic**: ${currentTopic}` : '- No specific topic set yet'}
- **Learner Level**: ${learnerLevel}
- **Explanation Mode**: ${explanationMode}
- **Interaction Mode**: ${mode}

## Mode Instructions
${modeInstructions[mode] || modeInstructions.quick}

## Rules
- NEVER reset the conversation or re-explain something already covered unless explicitly asked
- ALWAYS reference previous context when answering follow-ups
- Keep responses focused and avoid unnecessary repetition
- Use code blocks for any code examples
- Use LaTeX notation (wrapped in $..$ or $$..$$) for mathematical expressions`;
}

// ─── Helper: Build LLM Messages Array ─────────────────────────────────────────

function buildLLMMessages(sessionMessages, systemPrompt, maxMessages = 20) {
  // Always include the system prompt first
  const llmMessages = [{ role: 'system', content: systemPrompt }];

  // Take the last N messages for context window management
  const recentMessages = sessionMessages.slice(-maxMessages);

  for (const msg of recentMessages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      llmMessages.push({ role: msg.role, content: msg.content });
    }
  }

  return llmMessages;
}

// ─── Helper: Generate Message ID ──────────────────────────────────────────────

function generateMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ─── Helper: Detect Topic from First Message ─────────────────────────────────

function detectTopic(content) {
  // Simple heuristic: use first 60 chars of first user message as topic
  return content.substring(0, 60).replace(/[?\n]/g, '').trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat
 * Send a message and get an AI response with full conversation context.
 */
export const sendMessage = async (req, res) => {
  try {
    const validation = sendMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.format() });
    }

    const { sessionId, userMessage, mode, teachingContext } = validation.data;
    const userId = req.user?._id || req.user?.id;
    const isGuest = !userId || req.user?.isGuest;

    // ── 1. Load or Create Session ──
    let session;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId || '');

    if (sessionId && isMongoId && !isGuest) {
      session = await ChatSession.findOne({ _id: sessionId, userId });
    }

    if (!session && !isGuest) {
      session = await ChatSession.create({
        userId,
        title: detectTopic(userMessage),
        messages: [],
        currentTopic: teachingContext?.currentTopic || detectTopic(userMessage),
        explanationMode: teachingContext?.explanationMode || 'basic',
      });
      console.log(`[Chat] ✨ Created new session: ${session._id}`);
    }

    // ── 2. Build User Message Object ──
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata: { edited: false, regenerated: false, feedback: null },
    };

    // For guests without DB sessions, work with in-memory messages
    const existingMessages = session?.messages || [];
    const allMessages = [...existingMessages, userMsg];

    // ── 3. Build LLM Context ──
    const effectiveContext = {
      currentTopic: session?.currentTopic || teachingContext?.currentTopic || detectTopic(userMessage),
      explanationMode: session?.explanationMode || teachingContext?.explanationMode || 'basic',
      learnerLevel: teachingContext?.learnerLevel || 'intermediate',
    };

    const systemPrompt = buildSystemPrompt(effectiveContext, mode);
    const llmMessages = buildLLMMessages(allMessages, systemPrompt, 20);

    // ── 4. Call AI Router ──
    let aiResponse;
    let retryCount = 0;
    const MAX_RETRIES = 1;

    while (retryCount <= MAX_RETRIES) {
      try {
        aiResponse = await routeConversation(llmMessages, {
          timeout: 30000,
          maxRetries: 2,
        });
        break;
      } catch (err) {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.error('[Chat] All AI attempts failed:', err.message);
          return res.status(503).json({
            error: 'AI service temporarily unavailable',
            fallbackMessage: "I'm having trouble connecting right now. Please try again in a moment.",
          });
        }
        console.warn(`[Chat] Retry ${retryCount}/${MAX_RETRIES}...`);
      }
    }

    // ── 5. Build Assistant Message ──
    const assistantMsg = {
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date(),
      metadata: { edited: false, regenerated: false, feedback: null },
    };

    // ── 6. Persist to DB ──
    let savedSessionId = sessionId;

    if (session) {
      session.messages.push(userMsg);
      session.messages.push(assistantMsg);

      // Auto-detect topic on first message
      if (!session.currentTopic && session.messages.length <= 2) {
        session.currentTopic = detectTopic(userMessage);
        session.title = detectTopic(userMessage);
      }

      session.lastUpdated = Date.now();
      await session.save();
      savedSessionId = session._id.toString();

      logActivity({
        userId,
        sessionId: savedSessionId,
        eventType: 'chat_message',
        eventData: { mode, messageCount: session.messages.length },
      });
    }

    // ── 7. Return Response ──
    res.json({
      response: aiResponse.content,
      sessionId: savedSessionId || null,
      userMessageId: generateMessageId('user'),
      assistantMessageId: generateMessageId('assistant'),
      provider: aiResponse.provider,
      model: aiResponse.model,
      latency: aiResponse.latency,
    });
  } catch (err) {
    console.error('[Chat] sendMessage error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

/**
 * POST /api/chat/edit
 * Edit a message and cascade-delete everything after it, then regenerate.
 */
export const editMessage = async (req, res) => {
  try {
    const validation = editMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.format() });
    }

    const { sessionId, messageId, newContent } = validation.data;
    const userId = req.user?._id || req.user?.id;

    // ── 1. Load Session ──
    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // ── 2. Find Message Index ──
    const msgIndex = session.messages.findIndex(
      (m) => m._id?.toString() === messageId || m.id === messageId
    );

    if (msgIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // ── 3. Replace Content & Cascade Delete ──
    session.messages[msgIndex].content = newContent;
    session.messages[msgIndex].metadata = {
      ...session.messages[msgIndex].metadata,
      edited: true,
    };

    // Delete all messages AFTER the edited one
    session.messages = session.messages.slice(0, msgIndex + 1);

    // ── 4. Regenerate AI Response ──
    const systemPrompt = buildSystemPrompt({
      currentTopic: session.currentTopic,
      explanationMode: session.explanationMode,
    });
    const llmMessages = buildLLMMessages(session.messages, systemPrompt, 20);

    let aiResponse;
    try {
      aiResponse = await routeConversation(llmMessages, { timeout: 30000, maxRetries: 2 });
    } catch (err) {
      // Still save the edit even if AI fails
      await session.save();
      return res.status(503).json({
        error: 'AI service unavailable after edit',
        sessionId: session._id.toString(),
        messagesAfterEdit: session.messages,
      });
    }

    // ── 5. Append New Assistant Response ──
    const assistantMsg = {
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date(),
      metadata: { edited: false, regenerated: false, feedback: null },
    };
    session.messages.push(assistantMsg);
    session.lastUpdated = Date.now();
    await session.save();

    res.json({
      response: aiResponse.content,
      sessionId: session._id.toString(),
      assistantMessageId: generateMessageId('assistant'),
      messagesAfterEdit: session.messages,
      provider: aiResponse.provider,
    });
  } catch (err) {
    console.error('[Chat] editMessage error:', err);
    res.status(500).json({ error: 'Failed to edit message' });
  }
};

/**
 * POST /api/chat/regenerate
 * Remove the last assistant message and generate a new one.
 */
export const regenerate = async (req, res) => {
  try {
    const validation = regenerateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.format() });
    }

    const { sessionId } = validation.data;
    const userId = req.user?._id || req.user?.id;

    // ── 1. Load Session ──
    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // ── 2. Remove Last Assistant Message ──
    if (session.messages.length > 0) {
      const lastMsg = session.messages[session.messages.length - 1];
      if (lastMsg.role === 'assistant') {
        session.messages.pop();
      }
    }

    // ── 3. Regenerate ──
    const systemPrompt = buildSystemPrompt({
      currentTopic: session.currentTopic,
      explanationMode: session.explanationMode,
    });
    const llmMessages = buildLLMMessages(session.messages, systemPrompt, 20);

    let aiResponse;
    try {
      aiResponse = await routeConversation(llmMessages, { timeout: 30000, maxRetries: 2 });
    } catch (err) {
      await session.save();
      return res.status(503).json({
        error: 'AI service unavailable for regeneration',
        sessionId: session._id.toString(),
      });
    }

    // ── 4. Append New Response ──
    const assistantMsg = {
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date(),
      metadata: { edited: false, regenerated: true, feedback: null },
    };
    session.messages.push(assistantMsg);
    session.lastUpdated = Date.now();
    await session.save();

    res.json({
      response: aiResponse.content,
      sessionId: session._id.toString(),
      assistantMessageId: generateMessageId('assistant'),
      provider: aiResponse.provider,
    });
  } catch (err) {
    console.error('[Chat] regenerate error:', err);
    res.status(500).json({ error: 'Failed to regenerate response' });
  }
};

/**
 * DELETE /api/chat/message
 * Delete a single message from a session.
 */
export const deleteMessage = async (req, res) => {
  try {
    const validation = deleteMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.format() });
    }

    const { sessionId, messageId } = validation.data;
    const userId = req.user?._id || req.user?.id;

    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const originalLength = session.messages.length;
    session.messages = session.messages.filter(
      (m) => m._id?.toString() !== messageId && m.id !== messageId
    );

    if (session.messages.length === originalLength) {
      return res.status(404).json({ error: 'Message not found' });
    }

    session.lastUpdated = Date.now();
    await session.save();

    res.json({
      sessionId: session._id.toString(),
      deletedMessageId: messageId,
      remainingCount: session.messages.length,
    });
  } catch (err) {
    console.error('[Chat] deleteMessage error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};
