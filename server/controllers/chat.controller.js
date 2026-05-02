import { z } from 'zod';
import ChatSession from '../models/ChatSession.js';
import { routeConversation, routeConversationStream } from '../ai-router/router/aiRouter.js';
import { logActivity } from './session.controller.js';
import { searchWeb } from '../utils/ai/webSearchService.js';
import { shouldSearch, detectTools } from '../utils/ai/searchGate.js';
import { formatForPrompt, extractSources } from '../utils/ai/searchContextFormatter.js';
import VectorStoreService from '../engine/core/vectorStore.js';

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

function buildSystemPrompt(teachingContext = {}, mode = 'quick', webContext = '', pastContext = '', recentMessages = '', memorySummary = '') {
  const { currentTopic, explanationMode = 'basic', learnerLevel = 'intermediate' } = teachingContext;

  // Determine learner style string
  const learnerStyleMap = {
    beginner: 'Visual learner, prefers simple analogies and step-by-step breakdowns',
    intermediate: 'Balanced learner, comfortable with concepts and code examples',
    advanced: 'Deep learner, prefers edge cases, performance analysis, and architectural patterns',
  };
  const learnerStyle = learnerStyleMap[learnerLevel] || learnerStyleMap.intermediate;

  return `You are TutorBoard AI — an advanced intelligent tutor.

Your job is to generate high-quality, professional, well-structured notes that adapt to the user's query.

You combine:
- Your own LLM knowledge
- Retrieved context (RAG memory)
- Live web data (if available)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

User Query:
(Will be provided as the latest user message)

Past Context (RAG):
${pastContext || 'No prior sessions found for this topic.'}

Web Data:
${webContext || 'No web data available for this query.'}

Memory Summary:
${memorySummary || 'No memory summary available.'}

Recent Messages:
${recentMessages || 'This is the start of the conversation.'}

User Style:
${learnerStyle}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO NOT follow a fixed template.

Instead:
→ Dynamically decide the best structure based on the query.

Each response must feel:
- Natural
- Clean
- Professionally written
- Not repetitive or robotic

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLE RULES (STRICT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- No emojis
- No forced labels like: "Topic Overview", "Key Points", etc.
- No unnecessary sections
- No repeated structure across different answers

Write like:
→ A professor explaining clearly
→ A well-written notebook
→ A structured article

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURE INTELLIGENCE (VERY IMPORTANT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

You must decide structure based on query type:

1. If concept-based (e.g., "What is linear regression?")
→ Use:
- Title
- Explanation flow
- Formula (if needed)
- Example

2. If informational/topic-based (e.g., "Kelley Blue Book")
→ Use:
- Title
- What it is
- How it works
- Real-world usage

3. If comparison-based
→ Use table

4. If mathematical
→ Use formula box

5. If coding
→ Use code block + explanation

6. If no formula/code needed
→ DO NOT create those sections artificially

❗ NEVER include sections that are not relevant

━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Always start with a clean title (e.g., # **Topic Name**)

2. Use short paragraphs (not long walls)

3. Use spacing between sections

4. Use these only when needed:

[ Formula ]
(for math)

[ Code ]
(for programming)

Tables → only if useful

━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPLANATION STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Smooth storytelling flow
- Each paragraph builds on the previous one
- Explain "why" and "how", not just "what"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Include examples ONLY when helpful

Make them:
- Natural
- Real-world
- Not forced

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEB + RAG USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- If web data exists → include latest insights naturally
- If RAG exists → maintain continuity
- Do NOT mention "web context" or "RAG"

━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAIL-SAFE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

If some elements are not relevant:
→ Skip them

Do NOT force:
- formulas
- tables
- code
- sections

- Custom-written for THIS query
- Not reusable template
- Clean, structured, and easy to read

━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKING PROCESS (INTERNAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the query is complex, requires web search, or involves visual generation (Canvas), wrap your internal planning and reasoning in <thought>...</thought> tags before your final response. 
- Keep thoughts concise but insightful.
- Final response should be direct, clean, and not mention the internal thoughts.

The user should feel:
“This was written specifically for my question.”`;
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

/**
 * Generate a clean, summarized title for the session using AI output.
 * Tries to extract the bolded heading first, then falls back to AI summarization.
 */
async function generateSessionTitle(userMessage, aiResponse = '') {
  try {
    // 1. Try to extract from the AI's bolded heading (as enforced in system prompt)
    const headingMatch = aiResponse.match(/# \*\*([^*]+)\*\*/);
    if (headingMatch && headingMatch[1]) {
      let title = headingMatch[1].trim();
      if (title.length > 5 && title.length < 50) return title;
    }

    // 2. Fallback to AI summarization if heading extraction fails
    const prompt = `Based on this AI response, provide a professional 2-4 word title for the session. No emojis, no quotes. 
AI Response: "${aiResponse.substring(0, 500)}"
Title:`;

    const response = await routeConversation([{ role: 'user', content: prompt }], { 
      timeout: 4000, 
      maxRetries: 0 
    });
    
    let title = response.content.trim().replace(/^["']|["']$/g, '');
    if (title.length > 60) title = title.substring(0, 57) + '...';
    return title;
  } catch (err) {
    return detectTopic(userMessage);
  }
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
      session = await ChatSession.findOne({ _id: sessionId, userId: userId.toString() });
    }

    if (!session && !isGuest) {
      const initialTopic = detectTopic(userMessage);
      session = await ChatSession.create({
        userId,
        title: initialTopic, // Temporary title
        messages: [],
        currentTopic: teachingContext?.currentTopic || initialTopic,
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

    // ── 3. RAG + Web Search Fusion (Parallel Execution) ──
    const topic = session?.currentTopic || teachingContext?.currentTopic || detectTopic(userMessage);

    const toolDecision = detectTools(userMessage);
    const doSearch = toolDecision.useWebSearch || shouldSearch(userMessage);

    const [pastContext, webResults] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      doSearch ? searchWeb(userMessage, { count: 5 }) : Promise.resolve([]),
    ]);

    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

    if (sources.length > 0) {
      console.log(`[Chat] 🌐 Web search returned ${sources.length} sources for: "${userMessage.substring(0, 40)}..."`);
    }

    // ── 4. Build LLM Context with Fusion ──
    const effectiveContext = {
      currentTopic: topic,
      explanationMode: session?.explanationMode || teachingContext?.explanationMode || 'basic',
      learnerLevel: teachingContext?.learnerLevel || 'intermediate',
    };

    // Build recent messages summary for prompt context
    const recentMsgsSummary = allMessages.slice(-6).map(m =>
      `[${m.role.toUpperCase()}]: ${m.content.substring(0, 200)}`
    ).join('\n');

    // Build memory summary from session history
    const memorySummary = session?.messages?.length > 2
      ? `Session has ${session.messages.length} messages. Topic: ${session.currentTopic || 'General'}.`
      : '';

    const systemPrompt = buildSystemPrompt(effectiveContext, mode, webContextStr, pastContext, recentMsgsSummary, memorySummary);
    const llmMessages = buildLLMMessages(allMessages, systemPrompt, 20);

    // ── 5. Call AI Router ──
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

    // ── 6. Build Assistant Message ──
    const assistantMsg = {
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date(),
      metadata: { edited: false, regenerated: false, feedback: null },
    };

    // ── 7. Persist to DB ──
    let savedSessionId = sessionId;

    if (session) {
      session.messages.push(userMsg);
      session.messages.push(assistantMsg);

      // Update title using AI output if it's the first message
      if (session.messages.length <= 2) {
        generateSessionTitle(userMessage, aiResponse.content).then(async (aiTitle) => {
          try {
            await ChatSession.updateOne({ _id: session._id }, { title: aiTitle });
            console.log(`[Chat] 🏷️ AI generated title from output: "${aiTitle}"`);
          } catch (e) {
            console.error('[Chat] Failed to update AI title:', e.message);
          }
        });
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

    // ── 8. Return Response with Sources ──
    res.json({
      response: aiResponse.content,
      sessionId: savedSessionId || null,
      userMessageId: generateMessageId('user'),
      assistantMessageId: generateMessageId('assistant'),
      provider: aiResponse.provider,
      model: aiResponse.model,
      latency: aiResponse.latency,
      sources: sources.length > 0 ? sources : undefined,
    });
  } catch (err) {
    console.error('[Chat] sendMessage error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

/**
 * POST /api/chat/stream
 * Send a message and get a real-time SSE streaming AI response.
 */
export const streamMessage = async (req, res) => {
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
      session = await ChatSession.findOne({ _id: sessionId, userId: userId.toString() });
    }

    if (!session && !isGuest) {
      const initialTopic = detectTopic(userMessage);
      session = await ChatSession.create({
        userId,
        title: initialTopic,
        messages: [],
        currentTopic: teachingContext?.currentTopic || initialTopic,
        explanationMode: teachingContext?.explanationMode || 'basic',
      });
    }

    // ── 2. Build User Message ──
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata: { edited: false, regenerated: false, feedback: null },
    };

    const existingMessages = session?.messages || [];
    const allMessages = [...existingMessages, userMsg];

    // ── 3. RAG + Web Search Fusion (Parallel) ──
    const topic = session?.currentTopic || teachingContext?.currentTopic || detectTopic(userMessage);

    const toolDecision = detectTools(userMessage);
    const doSearch = toolDecision.useWebSearch || shouldSearch(userMessage);

    const [pastContext, webResults] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      doSearch ? searchWeb(userMessage, { count: 5 }) : Promise.resolve([]),
    ]);

    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

    // ── 4. Build LLM Context ──
    const effectiveContext = {
      currentTopic: topic,
      explanationMode: session?.explanationMode || teachingContext?.explanationMode || 'basic',
      learnerLevel: teachingContext?.learnerLevel || 'intermediate',
    };

    // Build recent messages summary for prompt context
    const recentMsgsSummary = allMessages.slice(-6).map(m =>
      `[${m.role.toUpperCase()}]: ${m.content.substring(0, 200)}`
    ).join('\n');

    // Build memory summary from session history
    const memorySummary = session?.messages?.length > 2
      ? `Session has ${session.messages.length} messages. Topic: ${session.currentTopic || 'General'}.`
      : '';

    const systemPrompt = buildSystemPrompt(effectiveContext, mode, webContextStr, pastContext, recentMsgsSummary, memorySummary);
    const llmMessages = buildLLMMessages(allMessages, systemPrompt, 20);

    // ── 5. Set SSE Headers ──
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send sources immediately if available
    if (sources.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
    }

    // Send session ID
    const savedSessionId = session?._id?.toString() || sessionId;
    res.write(`data: ${JSON.stringify({ type: 'meta', sessionId: savedSessionId })}\n\n`);

    // ── 6. Stream AI Response ──
    let fullContent = '';
    let streamProvider = null;
    let clientDisconnected = false;

    req.on('close', () => {
      clientDisconnected = true;
    });

    try {
      const stream = routeConversationStream(llmMessages, { timeout: 60000 });
      let isThinking = false;
      let thoughtContent = '';
      let cleanContent = '';

      for await (const { chunk, provider } of stream) {
        if (clientDisconnected) break;

        fullContent += chunk;
        streamProvider = provider;

        // ── Chain of Thought Extraction ──
        let remainingChunk = chunk;
        
        // Handle start of thought
        if (remainingChunk.includes('<thought>')) {
          const parts = remainingChunk.split('<thought>');
          if (parts[0]) {
            cleanContent += parts[0];
            res.write(`data: ${JSON.stringify({ type: 'chunk', chunk: parts[0] })}\n\n`);
          }
          isThinking = true;
          remainingChunk = parts[1] || '';
        }

        // Handle end of thought
        if (isThinking && remainingChunk.includes('</thought>')) {
          const parts = remainingChunk.split('</thought>');
          thoughtContent += parts[0];
          res.write(`data: ${JSON.stringify({ type: 'thought', thought: parts[0] })}\n\n`);
          isThinking = false;
          remainingChunk = parts[1] || '';
          if (remainingChunk) {
            cleanContent += remainingChunk;
            res.write(`data: ${JSON.stringify({ type: 'chunk', chunk: remainingChunk })}\n\n`);
          }
          continue;
        }

        // Route content based on current state
        if (isThinking) {
          thoughtContent += remainingChunk;
          res.write(`data: ${JSON.stringify({ type: 'thought', thought: remainingChunk })}\n\n`);
        } else {
          cleanContent += remainingChunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', chunk: remainingChunk })}\n\n`);
        }
      }
    } catch (streamErr) {
      console.error('[Chat:Stream] Streaming failed:', streamErr.message);
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming failed. Please try again.' })}\n\n`);
      }
    }

    // ── 7. Finalize ──
    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ type: 'done', provider: streamProvider })}\n\n`);
      res.end();
    }

    // ── 8. Persist to DB (background, after stream ends) ──
    if (session && fullContent) {
      const assistantMsg = {
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
        metadata: { 
          edited: false, 
          regenerated: false, 
          feedback: null,
          sources: sources || []
        },
      };

      // Update title using AI output if it's the first message
      if (session.messages.length <= 2) {
        generateSessionTitle(userMessage, fullContent).then(async (aiTitle) => {
          try {
            await ChatSession.updateOne({ _id: session._id }, { title: aiTitle });
          } catch (e) {
            console.error('[Chat:Stream] Failed to update AI title:', e.message);
          }
        });
      }

      session.lastUpdated = Date.now();
      session.save().catch(err => console.error('[Chat:Stream] DB persist failed:', err.message));

      logActivity({
        userId,
        sessionId: session._id.toString(),
        eventType: 'chat_message_stream',
        eventData: { mode, messageCount: session.messages.length, provider: streamProvider },
      });
    }
  } catch (err) {
    console.error('[Chat:Stream] streamMessage error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process streaming message' });
    }
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
