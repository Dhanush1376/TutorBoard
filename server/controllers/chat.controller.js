import { z } from 'zod';
import ChatSession from '../models/ChatSession.js';
import User from '../models/User.js';
import { routeConversation, routeConversationStream } from '../ai-router/router/aiRouter.js';
import { logActivity } from './session.controller.js';
import { searchWeb } from '../utils/ai/webSearchService.js';
import { shouldSearch, detectTools, applyPlannerOverride } from '../utils/ai/searchGate.js';
import { formatForPrompt, extractSources } from '../utils/ai/searchContextFormatter.js';
import VectorStoreService from '../engine/core/vectorStore.js';
import { runChatPlanner } from '../engine/agents/chatPlannerAgent.js';

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

    if (sessionId && isMongoId) {
      // For guests, we don't check userId ownership since sessions are essentially public/ephemeral-but-stored
      const query = isGuest ? { _id: sessionId } : { _id: sessionId, userId: userId.toString() };
      session = await ChatSession.findOne(query);
    }

    if (!session) {
      const initialTopic = detectTopic(userMessage);
      session = await ChatSession.create({
        userId: isGuest ? null : userId,
        title: initialTopic, // Temporary title
        messages: [],
        currentTopic: teachingContext?.currentTopic || initialTopic,
        explanationMode: teachingContext?.explanationMode || 'basic',
      });
      console.log(`[Chat] ✨ Created new session: ${session._id} (Guest: ${isGuest})`);
    }

    // ── 1.5 Update User Last Active Session ──
    if (!isGuest && userId) {
      User.updateOne({ _id: userId }, { lastActiveSessionId: session._id }).catch(e => 
        console.error('[Chat] Failed to update lastActiveSessionId:', e.message)
      );
    }

    // ── 2. Build User Message Object ──
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata: { 
        edited: false, 
        regenerated: false, 
        feedback: null,
        versions: [{ text: userMessage, subsequentMessages: [] }],
        activeVersionIndex: 0
      },
    };

    // For guests without DB sessions, work with in-memory messages
    const existingMessages = session?.messages || [];
    const allMessages = [...existingMessages, userMsg];

    // ── 3. RAG + Web Search + Planner Fusion (Parallel Execution) ──
    const topic = session?.currentTopic || teachingContext?.currentTopic || detectTopic(userMessage);

    const toolDecision = detectTools(userMessage);
    const gateSearch = toolDecision.useWebSearch || shouldSearch(userMessage);

    // Run planner, RAG, and initial web search in parallel
    const [pastContext, initialWebResults, plannerPlan] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      gateSearch ? searchWeb(userMessage, { count: 5 }) : Promise.resolve([]),
      runChatPlanner(userMessage, '', '', null).catch(err => {
        console.warn(`[Chat] Planner failed: ${err.message}`);
        return null;
      }),
    ]);

    // Apply planner override to search decision
    const finalSearchNeeded = applyPlannerOverride(plannerPlan, gateSearch);

    // If planner wants search but gate didn't trigger it, do a late search
    let webResults = initialWebResults;
    if (finalSearchNeeded && (!initialWebResults || initialWebResults.length === 0)) {
      console.log('[Chat] Planner requested web search — executing late search...');
      webResults = await searchWeb(userMessage, { count: 5 });
    }

    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

    if (sources.length > 0) {
      console.log(`[Chat] 🌐 Web search returned ${sources.length} sources for: "${userMessage.substring(0, 40)}..."`);
    }
    if (plannerPlan) {
      console.log(`[Chat] 🧠 Planner: ${plannerPlan.content_type}/${plannerPlan.complexity} | tone: ${plannerPlan.tone}`);
    }

    // ── 4. Build LLM Context with Fusion + Planner ──
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

    const systemPrompt = buildSystemPrompt(effectiveContext, mode, webContextStr, pastContext, recentMsgsSummary, memorySummary, plannerPlan);
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

    // ── 6. Build Assistant Message (extract thought if present) ──
    let cleanContent = aiResponse.content;
    let thoughtContent = '';
    
    if (cleanContent.includes('<thought>')) {
      const parts = cleanContent.split(/<\/?thought>/);
      if (parts.length >= 3) {
        thoughtContent = parts[1].trim();
        cleanContent = (parts[0] + parts[2]).trim();
      }
    }

    const assistantMsg = {
      role: 'assistant',
      content: cleanContent,
      timestamp: new Date(),
      metadata: { 
        edited: false, 
        regenerated: false, 
        feedback: null,
        sources: sources || [],
        thought: thoughtContent || undefined,
        versions: [{ text: cleanContent, subsequentMessages: [] }],
        activeVersionIndex: 0
      },
    };

    // ── 7. Persist to DB ──
    let savedSessionId = sessionId;

    if (session) {
      session.messages.push(userMsg);
      session.messages.push(assistantMsg);

      // Update title using AI output if it's the first message
      if (session.messages.length <= 2) {
        try {
          const aiTitle = await generateSessionTitle(userMessage, cleanContent);
          session.title = aiTitle;
          console.log(`[Chat] 🏷️ AI generated title: "${aiTitle}"`);
        } catch (e) {
          console.error('[Chat] Failed to generate AI title:', e.message);
        }
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
    const userMessageId = session?.messages[session.messages.length - 2]?._id?.toString() || generateMessageId('user');
    const assistantMessageId = session?.messages[session.messages.length - 1]?._id?.toString() || generateMessageId('assistant');

    res.json({
      response: aiResponse.content,
      sessionId: savedSessionId || null,
      userMessageId,
      assistantMessageId,
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

    if (sessionId && isMongoId) {
      const query = isGuest ? { _id: sessionId } : { _id: sessionId, userId: userId.toString() };
      session = await ChatSession.findOne(query);
    }

    if (!session) {
      const initialTopic = detectTopic(userMessage);
      session = await ChatSession.create({
        userId: isGuest ? null : userId,
        title: initialTopic,
        messages: [],
        currentTopic: teachingContext?.currentTopic || initialTopic,
        explanationMode: teachingContext?.explanationMode || 'basic',
      });
      console.log(`[Chat:Stream] ✨ Created new session: ${session._id} (Guest: ${isGuest})`);
    }

    // ── 1.5 Update User Last Active Session ──
    if (!isGuest && userId) {
      User.updateOne({ _id: userId }, { lastActiveSessionId: session._id }).catch(e => 
        console.error('[Chat:Stream] Failed to update lastActiveSessionId:', e.message)
      );
    }

    // ── 2. Build User Message ──
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata: { 
        edited: false, 
        regenerated: false, 
        feedback: null,
        versions: [{ text: userMessage, subsequentMessages: [] }],
        activeVersionIndex: 0
      },
    };

    const existingMessages = session?.messages || [];
    const allMessages = [...existingMessages, userMsg];

    // ── 3. RAG + Web Search + Planner Fusion (Parallel) ──
    const topic = session?.currentTopic || teachingContext?.currentTopic || detectTopic(userMessage);

    const toolDecision = detectTools(userMessage);
    const gateSearch = toolDecision.useWebSearch || shouldSearch(userMessage);

    // Run planner, RAG, and initial web search in parallel
    const [pastContext, initialWebResults, plannerPlan] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      gateSearch ? searchWeb(userMessage, { count: 5 }) : Promise.resolve([]),
      runChatPlanner(userMessage, '', '', null).catch(err => {
        console.warn(`[Chat:Stream] Planner failed: ${err.message}`);
        return null;
      }),
    ]);

    // Apply planner override to search decision
    const finalSearchNeeded = applyPlannerOverride(plannerPlan, gateSearch);

    // If planner wants search but gate didn't trigger it, do a late search
    let webResults = initialWebResults;
    if (finalSearchNeeded && (!initialWebResults || initialWebResults.length === 0)) {
      console.log('[Chat:Stream] Planner requested web search — executing late search...');
      webResults = await searchWeb(userMessage, { count: 5 });
    }

    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

    if (plannerPlan) {
      console.log(`[Chat:Stream] 🧠 Planner: ${plannerPlan.content_type}/${plannerPlan.complexity} | tone: ${plannerPlan.tone}`);
    }

    // ── 4. Build LLM Context with Planner ──
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

    const systemPrompt = buildSystemPrompt({
      currentTopic: topic,
      explanationMode: effectiveContext.explanationMode,
      learnerLevel: effectiveContext.learnerLevel,
      mode,
      webContext: webContextStr,
      pastContext,
      planner: plannerPlan
    });
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

    // Send planner result so frontend can show classification/planning state
    if (plannerPlan) {
      res.write(`data: ${JSON.stringify({ type: 'plan', plan: plannerPlan })}\n\n`);
    }

    // Send session ID
    const savedSessionId = session?._id?.toString() || sessionId;
    res.write(`data: ${JSON.stringify({ type: 'meta', sessionId: savedSessionId })}\n\n`);

    // ── 6. Stream AI Response ──
    let fullContent = '';
    let streamProvider = null;
    let clientDisconnected = false;
    let tagBuffer = ''; // Buffer to handle tags split across chunks

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

        // ── Chain of Thought Extraction with split tag handling ──
        let remainingChunk = tagBuffer + chunk;
        tagBuffer = '';

        // If the chunk ends with a partial tag, buffer it
        const partialTagMatch = remainingChunk.match(/<[^>]*$/);
        if (partialTagMatch) {
          tagBuffer = partialTagMatch[0];
          remainingChunk = remainingChunk.substring(0, partialTagMatch.index);
        }

        // Processing remainingChunk which is now guaranteed to have complete tags (or no tags)
        while (remainingChunk.length > 0) {
          if (!isThinking) {
            const thoughtStartIdx = remainingChunk.indexOf('<thought>');
            if (thoughtStartIdx !== -1) {
              // Part before <thought>
              const before = remainingChunk.substring(0, thoughtStartIdx);
              if (before) {
                cleanContent += before;
                res.write(`data: ${JSON.stringify({ type: 'chunk', chunk: before })}\n\n`);
              }
              isThinking = true;
              remainingChunk = remainingChunk.substring(thoughtStartIdx + 9);
            } else {
              // No <thought> tag in this piece
              cleanContent += remainingChunk;
              res.write(`data: ${JSON.stringify({ type: 'chunk', chunk: remainingChunk })}\n\n`);
              remainingChunk = '';
            }
          } else {
            const thoughtEndIdx = remainingChunk.indexOf('</thought>');
            if (thoughtEndIdx !== -1) {
              // Part before </thought>
              const thought = remainingChunk.substring(0, thoughtEndIdx);
              if (thought) {
                thoughtContent += thought;
                res.write(`data: ${JSON.stringify({ type: 'thought', thought })}\n\n`);
              }
              isThinking = false;
              remainingChunk = remainingChunk.substring(thoughtEndIdx + 10);
            } else {
              // Still thinking
              thoughtContent += remainingChunk;
              res.write(`data: ${JSON.stringify({ type: 'thought', thought: remainingChunk })}\n\n`);
              remainingChunk = '';
            }
          }
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
      // PERSIST USER MESSAGE (Fixed: was being lost)
      session.messages.push(userMsg);

      const assistantMsg = {
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
        metadata: { 
          edited: false, 
          regenerated: false, 
          feedback: null,
          sources: sources || [],
          thought: thoughtContent || undefined,
          versions: [{ text: fullContent, subsequentMessages: [] }],
          activeVersionIndex: 0
        },
      };

      // PERSIST ASSISTANT MESSAGE
      session.messages.push(assistantMsg);

      // Update title using AI output if it's the first message
      if (session.messages.length <= 2) {
        try {
          const aiTitle = await generateSessionTitle(userMessage, fullContent);
          session.title = aiTitle;
          console.log(`[Chat:Stream] 🏷️ AI generated title: "${aiTitle}"`);
        } catch (e) {
          console.error('[Chat:Stream] Failed to generate AI title:', e.message);
        }
      }

      session.lastUpdated = Date.now();
      await session.save().catch(err => console.error('[Chat:Stream] DB persist failed:', err.message));

      // After saving, we have real MongoDB IDs — send them to client
      const userMessageId = session.messages[session.messages.length - 2]?._id?.toString();
      const assistantMessageId = session.messages[session.messages.length - 1]?._id?.toString();
      
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ type: 'message_ids', userMessageId, assistantMessageId })}\n\n`);
      }

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

    // ── 3. Branching Logic: Save current branch before editing ──
    const targetMsg = session.messages[msgIndex];
    const subsequentMessages = session.messages.slice(msgIndex + 1);
    
    const currentVersions = targetMsg.metadata.versions || [{ text: targetMsg.content, subsequentMessages: [] }];
    const activeIdx = targetMsg.metadata.activeVersionIndex || 0;
    
    // Update the active version with its subsequent branch
    const updatedVersions = currentVersions.map((v, i) => 
      i === activeIdx ? { ...v, subsequentMessages } : v
    );
    
    // Add the new edit as a new version
    const newVersion = { text: newContent, subsequentMessages: [] };
    updatedVersions.push(newVersion);
    
    targetMsg.content = newContent;
    targetMsg.metadata = {
      ...targetMsg.metadata,
      edited: true,
      versions: updatedVersions,
      activeVersionIndex: updatedVersions.length - 1
    };

    // Truncate the main messages array (the new branch starts empty)
    session.messages = session.messages.slice(0, msgIndex + 1);

    // ── 4. RAG + Web Search + Planner Fusion (Standard Intelligence Pipeline) ──
    const topic = session.currentTopic || detectTopic(newContent);
    const toolDecision = detectTools(newContent);
    const gateSearch = toolDecision.useWebSearch || shouldSearch(newContent);

    const [pastContext, initialWebResults, plannerPlan] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      gateSearch ? searchWeb(newContent, { count: 5 }) : Promise.resolve([]),
      runChatPlanner(newContent, '', '', null).catch(err => {
        console.warn(`[Chat:Edit] Planner failed: ${err.message}`);
        return null;
      }),
    ]);

    const finalSearchNeeded = applyPlannerOverride(plannerPlan, gateSearch);
    let webResults = initialWebResults;
    if (finalSearchNeeded && (!initialWebResults || initialWebResults.length === 0)) {
      webResults = await searchWeb(newContent, { count: 5 });
    }

    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

    // ── 5. Build Final Prompt & Regenerate AI Response ──
    const systemPrompt = buildSystemPrompt({
      currentTopic: session.currentTopic,
      explanationMode: session.explanationMode,
      pastContext,
      webContext: webContextStr,
      plan: plannerPlan,
    });
    const llmMessages = buildLLMMessages(session.messages, systemPrompt, 20);

    let aiResponse;
    try {
      aiResponse = await routeConversation(llmMessages, { timeout: 30000, maxRetries: 2 });
      // Attach metadata for the standard buildAssistantMsg helper if needed
      aiResponse.sources = sources; 
    } catch (err) {
      // Still save the edit even if AI fails
      await session.save();
      return res.status(503).json({
        error: 'AI service unavailable after edit',
        sessionId: session._id.toString(),
        messagesAfterEdit: session.messages,
      });
    }

    // ── 5. Append New Assistant Response (extract thought if present) ──
    let cleanContent = aiResponse.content;
    let thoughtContent = '';
    
    if (cleanContent.includes('<thought>')) {
      const parts = cleanContent.split(/<\/?thought>/);
      if (parts.length >= 3) {
        thoughtContent = parts[1].trim();
        cleanContent = (parts[0] + parts[2]).trim();
      }
    }

    const assistantMsg = {
      role: 'assistant',
      content: cleanContent,
      timestamp: new Date(),
      metadata: { 
        edited: false, 
        regenerated: false, 
        feedback: null,
        sources: aiResponse.sources || [],
        thought: thoughtContent || undefined,
        versions: [{ text: cleanContent, subsequentMessages: [] }],
        activeVersionIndex: 0
      },
    };
    session.messages.push(assistantMsg);
    session.lastUpdated = Date.now();
    await session.save();

    const finalMsg = session.messages[session.messages.length - 1];
    res.json({
      response: finalMsg.content,
      sessionId: session._id.toString(),
      assistantMessageId: finalMsg._id.toString(),
      activeVersionIndex: finalMsg.metadata.activeVersionIndex,
      versionCount: finalMsg.metadata.versions.length,
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

    // ── 2. Handle Non-Destructive Regeneration (Branching) ──
    let targetMsgId = null;
    let existingVersions = [];
    let activeIdx = 0;

    if (session.messages.length > 0) {
      const lastMsg = session.messages[session.messages.length - 1];
      if (lastMsg.role === 'assistant') {
        targetMsgId = lastMsg._id;
        existingVersions = lastMsg.metadata?.versions || [{ text: lastMsg.content, subsequentMessages: [] }];
        activeIdx = lastMsg.metadata?.activeVersionIndex || 0;
        
        // We don't pop() anymore. We will update this message in place or append to it.
        // Actually, to make it clean, we'll keep the message and update its metadata.
      }
    }

    // ── 3. RAG + Web Search + Planner Fusion (Standard Intelligence Pipeline) ──
    // Use the messages BEFORE the last assistant message if we are regenerating
    const messagesForContext = targetMsgId 
      ? session.messages.slice(0, -1) 
      : session.messages;

    const lastUserMsg = [...messagesForContext].reverse().find(m => m.role === 'user');
    const query = lastUserMsg?.content || session.currentTopic;
    
    const topic = session.currentTopic || detectTopic(query);
    const toolDecision = detectTools(query);
    const gateSearch = toolDecision.useWebSearch || shouldSearch(query);

    const [pastContext, initialWebResults, plannerPlan] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      gateSearch ? searchWeb(query, { count: 5 }) : Promise.resolve([]),
      runChatPlanner(query, '', '', null).catch(err => {
        console.warn(`[Chat:Regen] Planner failed: ${err.message}`);
        return null;
      }),
    ]);

    const finalSearchNeeded = applyPlannerOverride(plannerPlan, gateSearch);
    let webResults = initialWebResults;
    if (finalSearchNeeded && (!initialWebResults || initialWebResults.length === 0)) {
      webResults = await searchWeb(query, { count: 5 });
    }

    const webContextStr = formatForPrompt(webResults);
    const sources = extractSources(webResults);

    // ── 4. Build Final Prompt & Regenerate AI Response ──
    const systemPrompt = buildSystemPrompt({
      currentTopic: session.currentTopic,
      explanationMode: session.explanationMode,
      pastContext,
      webContext: webContextStr,
      plan: plannerPlan,
    });
    const llmMessages = buildLLMMessages(messagesForContext, systemPrompt, 20);

    let aiResponse;
    try {
      aiResponse = await routeConversation(llmMessages, { timeout: 30000, maxRetries: 2 });
      aiResponse.sources = sources;
    } catch (err) {
      return res.status(503).json({
        error: 'AI service unavailable for regeneration',
        sessionId: session._id.toString(),
      });
    }

    // ── 5. Append New Version or Create New Message ──
    let cleanContent = aiResponse.content;
    let thoughtContent = '';
    
    if (cleanContent.includes('<thought>')) {
      const parts = cleanContent.split(/<\/?thought>/);
      if (parts.length >= 3) {
        thoughtContent = parts[1].trim();
        cleanContent = (parts[0] + parts[2]).trim();
      }
    }

    if (targetMsgId) {
      // Update existing message with new version
      const targetMsg = session.messages[session.messages.length - 1];
      const newVersion = { text: cleanContent, subsequentMessages: [] };
      const updatedVersions = [...existingVersions, newVersion];

      targetMsg.content = cleanContent;
      targetMsg.metadata = {
        ...targetMsg.metadata,
        regenerated: true,
        sources: aiResponse.sources || [],
        thought: thoughtContent || undefined,
        versions: updatedVersions,
        activeVersionIndex: updatedVersions.length - 1
      };
    } else {
      // Create new assistant message if none existed
      const assistantMsg = {
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date(),
        metadata: { 
          edited: false, 
          regenerated: true, 
          feedback: null,
          sources: aiResponse.sources || [],
          thought: thoughtContent || undefined,
          versions: [{ text: cleanContent, subsequentMessages: [] }],
          activeVersionIndex: 0
        },
      };
      session.messages.push(assistantMsg);
    }

    session.lastUpdated = Date.now();
    await session.save();

    const finalMsg = session.messages[session.messages.length - 1];
    res.json({
      response: finalMsg.content,
      sessionId: session._id.toString(),
      assistantMessageId: finalMsg._id.toString(),
      activeVersionIndex: finalMsg.metadata.activeVersionIndex,
      versionCount: finalMsg.metadata.versions.length,
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

/**
 * POST /api/chat/feedback
 * Update feedback for a specific message.
 */
export const updateMessageFeedback = async (req, res) => {
  try {
    const { sessionId, messageId, feedback } = req.body;
    const userId = req.user?._id || req.user?.id;

    if (!sessionId || !messageId) {
      return res.status(400).json({ error: "Missing sessionId or messageId" });
    }

    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const message = session.messages.id(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    message.metadata = {
      ...(message.metadata || {}),
      feedback: (feedback === 'positive' || feedback === 'negative') ? feedback : null
    };

    await session.save();
    res.json({ success: true, messageId, feedback });
  } catch (err) {
    console.error('[Chat] updateFeedback error:', err);
    res.status(500).json({ error: "Failed to update feedback" });
  }
};

/**
 * generateSessionTitle: Use AI to create a short, relevant title for the session
 */
const generateSessionTitle = async (userMsg, aiMsg) => {
  try {
    const prompt = [
      { role: 'system', content: 'Generate a 2-4 word title for this chat based on the first exchange. Return ONLY the title text, no quotes or prefix.' },
      { role: 'user', content: `User: ${userMsg}\nAI: ${aiMsg}` }
    ];
    const res = await routeConversation(prompt, { timeout: 10000 });
    return res.content.trim() || 'New Session';
  } catch (err) {
    console.error('[TitleGen] Error:', err);
    return 'New Session';
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * detectTopic: Extracts a short topic from a message
 */
const detectTopic = (text) => {
  if (!text) return 'General';
  const clean = text.trim();
  // Simple heuristic: first 5 words or first sentence
  const sentence = clean.split(/[.!?]/)[0];
  const words = sentence.split(/\s+/).slice(0, 5).join(' ');
  return words.length > 3 ? words : 'General Chat';
};

/**
 * buildSystemPrompt: Construct the primary instructions for the AI
 */
const buildSystemPrompt = (args) => {
  // Support both object and positional (legacy-ish) arguments if needed, 
  // but object is safer for our multi-mode controller.
  const { 
    currentTopic, 
    explanationMode, 
    learnerLevel = 'Intermediate',
    mode, 
    webContext, 
    pastContext, 
    planner 
  } = args;
  
  let prompt = `You are TutorBoard AI, a professional tutor. 
Topic: ${currentTopic || 'General Education'}
Level: ${learnerLevel}
Mode: ${explanationMode || 'Standard'}

INSTRUCTIONS:
1. Provide visually structured learning notes.
2. Use bolding, bullet points, and clear sections.
3. Keep the tone professional but encouraging.
4. DO NOT use emojis.
5. If web context is provided, cite sources using [1], [2], etc.
`;

  if (planner) {
    prompt += `\nPLANNER GUIDANCE:
- Tone: ${planner.tone || 'Professional'}
- Depth: ${planner.complexity || 'Appropriate'}
- Focus: ${planner.focus_areas?.join(', ') || 'General'}
`;
  }

  if (webContext) {
    prompt += `\nWEB RESEARCH CONTEXT:\n${webContext}`;
  }

  if (pastContext) {
    prompt += `\nLONG-TERM MEMORY (RAG):\n${pastContext}`;
  }

  return prompt;
};

/**
 * buildLLMMessages: Format history for the AI Router
 */
const buildLLMMessages = (messages, systemPrompt, limit = 20) => {
  const history = messages.slice(-limit).map(m => ({
    role: m.role,
    content: m.content
  }));

  return [
    { role: 'system', content: systemPrompt },
    ...history
  ];
};

