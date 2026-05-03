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
import Artifact from '../models/Artifact.js';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  sessionId: z.string().optional().nullable(),
  userMessage: z.string().min(1).max(10000),
  userMessageId: z.string().optional(),
  assistantMessageId: z.string().optional(),
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

    // ── 3. Intelligence Pipeline: RAG + Web Search + Planner Fusion ──
    const topic = session?.currentTopic || teachingContext?.currentTopic || detectTopic(userMessage);
    const toolDecision = detectTools(userMessage);
    const gateSearch = toolDecision.useWebSearch || shouldSearch(userMessage);

    // Run RAG and Initial Search first to provide context for the planner
    const [pastContext, initialWebResults] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      gateSearch ? searchWeb(userMessage, { count: 5 }) : Promise.resolve([]),
    ]);

    let webContextStr = formatForPrompt(initialWebResults);

    // Run planner with actual context for deep understanding
    const plannerPlan = await runChatPlanner(userMessage, pastContext, webContextStr, null).catch(err => {
      console.warn(`[Chat] Planner failed: ${err.message}`);
      return null;
    });

    // Apply planner override to search decision
    const finalSearchNeeded = applyPlannerOverride(plannerPlan, gateSearch);

    // If planner wants search but gate didn't trigger it, do a late search
    let webResults = initialWebResults;
    if (finalSearchNeeded && (!initialWebResults || initialWebResults.length === 0)) {
      console.log('[Chat] Planner requested web search — executing late search...');
      webResults = await searchWeb(userMessage, { count: 5 });
    }

    webContextStr = formatForPrompt(webResults);
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

      // Background: Persist to long-term memory (RAG)
      if (cleanContent) {
        const memorySummary = summarizeForMemory(userMessage, cleanContent);
        VectorStoreService.addSession(savedSessionId, memorySummary, {
          userId,
          topic: topic || 'General'
        }).catch(err => console.error('[Memory] Background persistence failed:', err.message));
      }
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
      searchPerformed: gateSearch || finalSearchNeeded,
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

    // ── 5. Set SSE Headers IMMEDIATELY to prevent client-side timeouts ──
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); 
    res.flushHeaders();

    // Send session ID and "Thinking" state early
    const savedSessionId = session?._id?.toString() || sessionId;
    res.write(`data: ${JSON.stringify({ type: 'meta', sessionId: savedSessionId })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Planning lesson...' })}\n\n`);

    const toolDecision = detectTools(userMessage);
    const gateSearch = toolDecision.useWebSearch || shouldSearch(userMessage);

    // Run RAG and Initial Search first to provide context for the planner
    const [pastContext, initialWebResults] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      gateSearch ? searchWeb(userMessage, { count: 5 }) : Promise.resolve([]),
    ]);

    let webContextStr = formatForPrompt(initialWebResults);

    // Run planner with actual context
    const plannerPlan = await runChatPlanner(userMessage, pastContext, webContextStr, null).catch(err => {
      console.warn(`[Chat:Stream] Planner failed: ${err.message}`);
      return null;
    });

    // Apply planner override to search decision
    const finalSearchNeeded = applyPlannerOverride(plannerPlan, gateSearch);

    // If planner wants search but gate didn't trigger it, do a late search
    let webResults = initialWebResults;
    if (finalSearchNeeded && (!initialWebResults || initialWebResults.length === 0)) {
      console.log('[Chat:Stream] Planner requested web search — executing late search...');
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Searching web...' })}\n\n`);
      webResults = await searchWeb(userMessage, { count: 5 });
    }

    webContextStr = formatForPrompt(webResults);
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

    // Send sources and planner result
    if (sources.length > 0 || gateSearch || finalSearchNeeded) {
      res.write(`data: ${JSON.stringify({ 
        type: 'sources', 
        sources,
        searchPerformed: !!(gateSearch || finalSearchNeeded)
      })}\n\n`);
    }

    if (plannerPlan) {
      res.write(`data: ${JSON.stringify({ type: 'plan', plan: plannerPlan })}\n\n`);
    }

    const isArtifactExpected = !!(plannerPlan?.generate_artifact);
    if (isArtifactExpected) {
      res.write(`data: ${JSON.stringify({ type: 'status', message: `Generating ${plannerPlan.artifact_type} artifact...` })}\n\n`);
    }

    // ── 6. Stream AI Response ──
    let fullContent = '';
    let streamProvider = null;
    let clientDisconnected = false;
    let lastStreamProvider = '';
    let cleanContent = '';
    let thoughtContent = '';

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (!clientDisconnected) {
        res.write(': keep-alive\n\n');
      }
    }, 15000);

    req.on('close', () => {
      clientDisconnected = true;
      clearInterval(heartbeat);
    });

    try {
      const stream = routeConversationStream(llmMessages, { 
        timeout: 90000, 
        maxTokens: isArtifactExpected ? 4000 : 1500,
        responseMimeType: isArtifactExpected ? 'application/json' : 'text/plain'
      });

      for await (const streamChunk of stream) {
        if (clientDisconnected) break;

        const { chunk, provider } = streamChunk;
        if (chunk) {
          fullContent += chunk;
          lastStreamProvider = provider;

          // If NOT an artifact, stream chunks immediately
          if (!isArtifactExpected) {
            res.write(`event: message\n`);
            res.write(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`);
          }

          // Extract and send thoughts immediately even if buffering the rest
          const thoughtMatch = chunk.match(/<thought>([\s\S]*?)<\/thought>/) || 
                             chunk.match(/<thought>([\s\S]*)$/) ||
                             (fullContent.includes('<thought>') && !fullContent.includes('</thought>') ? { 1: chunk } : null);
          
          if (thoughtMatch) {
            const thought = thoughtMatch[1] || '';
            res.write(`event: thought\n`);
            res.write(`data: ${JSON.stringify({ thought })}\n\n`);
          }
        }
      }

      console.log("FULL RESPONSE:", fullContent);
      // For artifact parsing, we'll use fullContent.
      // We need to clean fullContent of thought tags for the robust parser if it's mixed
      cleanContent = fullContent.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
      thoughtContent = (fullContent.match(/<thought>([\s\S]*?)<\/thought>/g) || [])
        .map(t => t.replace(/<\/?thought>/g, '')).join('\n');

    } catch (streamErr) {
      console.error('[Chat:Stream] Streaming failed:', streamErr.message);
      if (!clientDisconnected) {
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming failed.' })}\n\n`);
      }
    }

    // ── 7. Finalize: Check for JSON artifact(s) in response ──
    let chatResponseText = cleanContent;
    let artifactsArray = []; // Unified array for both single and multi-artifact
    const planWantsArtifact = plannerPlan && plannerPlan.generate_artifact;

    if (planWantsArtifact && cleanContent) {
      const cleanArtifactContent = (content, title) => {
        if (typeof content !== 'string') return content;
        let cleaned = content.replace(/\r\n/g, '\n').trim();
        
        let lines = cleaned.split('\n');
        let linesToSkip = 0;

        for (let i = 0; i < Math.min(lines.length, 5); i++) {
          const stripped = lines[i].trim().replace(/[#\s\*_:]/g, '');
          if (stripped.toLowerCase() === 'title' || stripped.toLowerCase() === 'introduction') {
            linesToSkip = i + 1; 
            while (linesToSkip < lines.length && lines[linesToSkip].trim() === '') {
              linesToSkip++;
            }
            break;
          }
        }

        if (linesToSkip > 0) {
          cleaned = lines.slice(linesToSkip).join('\n').trim();
        }

        cleaned = cleaned.replace(/^(\s*(?:#+\s*|\*\*|__)?)\s*Title:?\s*/i, '$1');
        cleaned = cleaned.replace(/^(\s*(?:#+\s*|\*\*|__)?)\s*Introduction:?\s*/i, '$1');

        return cleaned;
      };

      const cleanChatResponse = (text) => {
        if (!text) return text;
        let cleaned = text.trim();
        cleaned = cleaned.replace(/^(\s*(?:#+\s*|\*\*|__)?)\s*Title:?\s*/i, '$1');
        cleaned = cleaned.replace(/^(\s*(?:#+\s*|\*\*|__)?)\s*Introduction:?\s*/i, '$1');
        return cleaned;
      };

      const robustParse = (str) => {
        try {
          return JSON.parse(str);
        } catch (e) {
          try {
            const sanitized = str.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, p1) => {
              return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
            });
            return JSON.parse(sanitized);
          } catch (e2) {
            return null;
          }
        }
      };

      /** Normalize parsed JSON into an array of artifacts */
      const extractArtifacts = (parsed) => {
        if (!parsed) return [];
        // Multi-artifact format: { artifacts: [...] }
        if (Array.isArray(parsed.artifacts) && parsed.artifacts.length > 0) {
          return parsed.artifacts.filter(a => a && a.type && a.content);
        }
        // Single artifact format: { artifact: {...} }
        if (parsed.artifact && parsed.artifact.type && parsed.artifact.content) {
          return [parsed.artifact];
        }
        return [];
      };

      const tryParse = (str) => {
        const jsonStr = str.replace(/^```json\s*|```\s*$/g, '').trim();
        let parsed = robustParse(jsonStr);
        let arts = extractArtifacts(parsed);

        // Fallback: try to extract embedded JSON
        if (arts.length === 0) {
          const jsonMatch = str.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = robustParse(jsonMatch[0]);
            arts = extractArtifacts(parsed);
          }
        }

        return { parsed, arts };
      };

      try {
        const { parsed, arts } = tryParse(cleanContent);

        if (arts.length > 0 && parsed) {
          chatResponseText = cleanChatResponse(parsed.chat_response || 'Here is what I created.');

          // Emit SSE events for each artifact
          arts.forEach((art, idx) => {
            art.content = cleanArtifactContent(art.content, art.title);
            const artLocalId = `art-${Date.now()}-${idx}`;

            if (!clientDisconnected) {
              res.write(`event: artifact\n`);
              res.write(`data: ${JSON.stringify({
                id: artLocalId,
                type: art.type,
                title: art.title || 'Untitled',
                content: art.content,
                language: art.language || null,
                metadata: art.metadata || {},
              })}\n\n`);
            }

            artifactsArray.push({ ...art, localId: artLocalId });
          });

          // Send clean chat override
          if (!clientDisconnected) {
            res.write(`event: message\n`);
            res.write(`data: ${JSON.stringify({ 
              type: 'chat_override',
              content: chatResponseText 
            })}\n\n`);
          }

          fullContent = chatResponseText;
          cleanContent = chatResponseText;
        } else {
          console.warn('[Chat:Stream] Parsed JSON missing required artifact fields');
        }
      } catch (parseErr) {
        console.warn('[Chat:Stream] Artifact JSON parse failed:', parseErr.message);
      }
    }

    if (!clientDisconnected) {
      clearInterval(heartbeat);
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
          searchPerformed: gateSearch || finalSearchNeeded,
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

      // Background: Persist to long-term memory (RAG)
      if (fullContent) {
        const memorySummary = summarizeForMemory(userMessage, fullContent);
        VectorStoreService.addSession(session._id.toString(), memorySummary, {
          userId,
          topic: topic || 'General'
        }).catch(err => console.error('[Memory] Background persistence failed:', err.message));
      }

      // Background: Persist artifact(s) to DB if any were generated
      if (artifactsArray.length > 0) {
        const savedArtifactIds = [];
        for (const artData of artifactsArray) {
          try {
            const savedArtifact = await Artifact.create({
              userId: userId || null,
              sessionId: session._id.toString(),
              messageId: assistantMessageId || null,
              type: artData.type,
              title: artData.title || 'Untitled',
              content: artData.content,
              language: artData.language || null,
              metadata: artData.metadata || {},
              version: 1,
            });

            savedArtifactIds.push(savedArtifact._id.toString());

            // Send artifact ID to client for future reference
            if (!clientDisconnected) {
              res.write(`data: ${JSON.stringify({
                type: 'artifact_saved',
                artifactId: savedArtifact._id.toString(),
                localId: artData.localId,
              })}\n\n`);
            }

            console.log(`[Chat:Stream] ✨ Artifact saved: ${savedArtifact._id} (${artData.type})`);
          } catch (artErr) {
            console.error('[Chat:Stream] Artifact persistence failed:', artErr.message);
          }
        }

        // CRITICAL: Link all artifact IDs back to the assistant message
        if (savedArtifactIds.length > 0 && session.messages.length > 0) {
          const lastMsg = session.messages[session.messages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.metadata = { 
              ...lastMsg.metadata, 
              artifactId: savedArtifactIds[0], // backward compat
              artifactIds: savedArtifactIds,    // new multi-artifact field
            };
            await session.save().catch(e => console.error('[Artifact] Failed to link to message:', e.message));
          }
        }
      }
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

    // Run RAG and Initial Search first to provide context for the planner
    const [pastContext, initialWebResults] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      gateSearch ? searchWeb(newContent, { count: 5 }) : Promise.resolve([]),
    ]);

    let webContextStr = formatForPrompt(initialWebResults);

    // Run planner with actual context
    const plannerPlan = await runChatPlanner(newContent, pastContext, webContextStr, null).catch(err => {
      console.warn(`[Chat:Edit] Planner failed: ${err.message}`);
      return null;
    });

    const finalSearchNeeded = applyPlannerOverride(plannerPlan, gateSearch);
    let webResults = initialWebResults;
    if (finalSearchNeeded && (!initialWebResults || initialWebResults.length === 0)) {
      webResults = await searchWeb(newContent, { count: 5 });
    }

    webContextStr = formatForPrompt(webResults);
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
        searchPerformed: gateSearch || finalSearchNeeded,
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

    // Run RAG and Initial Search first to provide context for the planner
    const [pastContext, initialWebResults] = await Promise.all([
      userId ? VectorStoreService.getContextForTopic(topic, 3, userId) : Promise.resolve(''),
      gateSearch ? searchWeb(query, { count: 5 }) : Promise.resolve([]),
    ]);

    let webContextStr = formatForPrompt(initialWebResults);

    // Run planner with actual context
    const plannerPlan = await runChatPlanner(query, pastContext, webContextStr, null).catch(err => {
      console.warn(`[Chat:Regen] Planner failed: ${err.message}`);
      return null;
    });

    const finalSearchNeeded = applyPlannerOverride(plannerPlan, gateSearch);
    let webResults = initialWebResults;
    if (finalSearchNeeded && (!initialWebResults || initialWebResults.length === 0)) {
      webResults = await searchWeb(query, { count: 5 });
    }

    webContextStr = formatForPrompt(webResults);
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
        searchPerformed: gateSearch || finalSearchNeeded,
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
          searchPerformed: gateSearch || finalSearchNeeded,
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
 * summarizeForMemory: Creates a concise summary for the VectorStore
 */
/**
 * summarizeForMemory: Creates a concise summary for the VectorStore
 */
function summarizeForMemory(userMsg, aiMsg) {
  const cleanAi = aiMsg.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
  const summary = `User asked about ${userMsg.slice(0, 100)}. AI explained: ${cleanAi.slice(0, 200)}...`;
  return summary;
}

/**
 * buildSystemPrompt: Construct the primary instructions for the AI
 */
function buildSystemPrompt(args) {
  const { 
    currentTopic, 
    explanationMode, 
    learnerLevel = 'Intermediate',
    mode, 
    webContext, 
    pastContext, 
    planner 
  } = args;
  
  // 1. Core Identity & Voice
  let prompt = `You are TutorBoard AI, a knowledgeable and engaging personal tutor. 
Your goal is to guide students through complex topics with clarity, patience, and a touch of intellectual curiosity.

TOPIC: ${currentTopic || 'General Education'}
LEARNER LEVEL: ${learnerLevel}
EXPLANATION STYLE: ${explanationMode || 'Standard'}
`;

  // 2. Structural Guidance (from Planner)
  if (planner && planner.sections && planner.sections.length > 0) {
    prompt += `\nRESPONSE SECTIONS (Include these in order): ${planner.sections.join(', ')}\n`;
  }

  // 3. Tool usage (from Planner)
  if (planner) {
    if (planner.use_table) prompt += `- Use a Markdown table for comparisons or structured data.\n`;
    if (planner.use_code) prompt += `- Include clear, commented code snippets where relevant.\n`;
    if (planner.use_diagram) prompt += `- Describe visual concepts clearly so they can be easily imagined or drawn.\n`;
  }

  // 4. Tone & Narrative Instructions
  prompt += `\nINSTRUCTIONS:
1. NARRATIVE FLOW: Do not provide dry, documentation-style notes. Write in natural prose that flows logically from one concept to the next.
2. VISUAL HIERARCHY: Use bolding for key terms and bullet points for lists, but embed them within a conversational narrative.
3. PEDAGOGY: Use "we" and "us" to make the learning feel like a shared journey (e.g., "Now, let's look at how this applies...").
4. EMOJI POLICY: Strictly NO emojis.
5. NO REDUNDANT LABELS: Strictly DO NOT start your response with labels like "Title:", "Introduction:", "Topic:", or "Subject:". Just start with the content or a bold heading.
`;

  // 5. Tone-Specific Blocks
  if (planner && planner.tone) {
    const tone = planner.tone.toLowerCase();
    if (tone.includes('storytelling')) {
      prompt += `\nTONE - STORYTELLING: Use metaphors, analogies, and a narrative arc to explain concepts. Make it immersive.\n`;
    } else if (tone.includes('technical') || tone.includes('rigorous')) {
      prompt += `\nTONE - TECHNICAL: Focus on precision, formal definitions, and underlying mechanisms. Prioritize accuracy over simplicity.\n`;
    } else if (tone.includes('intuitive') || tone.includes('simple')) {
      prompt += `\nTONE - INTUITIVE: Focus on "the vibe" and high-level concepts before diving into details. Use relatable everyday examples.\n`;
    } else if (tone.includes('encouraging') || tone.includes('supportive')) {
      prompt += `\nTONE - ENCOURAGING: Use positive reinforcement and break things down into very manageable steps to build confidence.\n`;
    } else {
      prompt += `\nTONE: ${planner.tone}. Maintain this specific personality throughout the response.\n`;
    }
  }

  // 6. Contextual Data
  if (webContext) {
    prompt += `\nWEB RESEARCH CONTEXT (Cite sources as [1], [2], etc.):\n${webContext}\n`;
  }

  if (pastContext) {
    prompt += `\nLONG-TERM MEMORY (Previous context about this student/topic):\n${pastContext}\n`;
  }

  // 7. Artifact Generation Instructions
  if (planner && planner.generate_artifact && planner.artifact_type) {
    const artifactCount = planner.artifact_count || 1;
    const artifactTypes = planner.artifact_types || [planner.artifact_type];

    prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARTIFACT GENERATION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST generate ${artifactCount > 1 ? artifactCount + ' interactive artifacts' : 'an interactive artifact'}. 
${artifactCount > 1 ? `Types: ${artifactTypes.join(', ')}` : `Type: ${planner.artifact_type}`}

Rules per artifact type:
- code: Content MUST be raw source code only. No markdown headers. No chat-style text inside.
- document: Content MUST be rich Markdown with headers, lists, and tables.
- ui: Content MUST be a single HTML file with Tailwind CSS and JS.
- table: Content MUST be Markdown table syntax.
- diagram: Content MUST be valid Mermaid syntax (e.g. graph TD; A-->B;).
`;

    if (artifactCount > 1) {
      prompt += `
You MUST return your response as valid JSON with this exact structure:
{
  "chat_response": "**Query Topic**\\n\\nA short, professional explanation of what you created.",
  "artifacts": [
${artifactTypes.map((t, i) => `    {
      "type": "${t}",
      "title": "Descriptive Title for artifact ${i + 1}",
      "content": "Full artifact content here...",
      "language": "${t === 'code' ? 'js' : t === 'ui' ? 'html' : ''}",
      "metadata": {}
    }`).join(',\n')}
  ]
}
`;
    } else {
      prompt += `
You MUST return your response as valid JSON with this exact structure:
{
  "chat_response": "**Query Topic**\\n\\nA short, professional explanation of what you created.",
  "artifact": {
    "type": "${planner.artifact_type}",
    "title": "Descriptive Title",
    "content": "Full artifact content here...",
    "language": "js/py/html/etc",
    "metadata": {}
  }
`;
    }

    prompt += `
STRICT RULE: Respond ONLY with the JSON. Do NOT add any text before or after the JSON.
IF AN ARTIFACT IS NEEDED:
1. DO NOT show JSON to the user directly in the chat.
2. Respond ONLY with a short explanation in plain text (the chat_response field).
3. The artifact data will be handled separately by the system.
4. DO NOT include any redundant labels or headers (like "Title:") inside the artifact content itself.
5. In your "chat_response", ALWAYS start with the topic of the query as a bold heading on its own line (e.g. **Introduction to DSA**).
`;
  }

  return prompt;
};


/**
 * buildLLMMessages: Format history for the AI Router
 */
/**
 * buildLLMMessages: Format history for the AI Router
 */
function buildLLMMessages(messages, systemPrompt, limit = 20) {
  const history = messages.slice(-limit).map(m => ({
    role: m.role,
    content: m.content
  }));

  return [
    { role: 'system', content: systemPrompt },
    ...history
  ];
}

/**
 * detectTopic: Extract a short topic label from user message
 */
/**
 * detectTopic: Extract a short topic label from user message
 */
function detectTopic(text) {
  if (!text) return 'General';
  // Strip common filler and extract first few significant words
  const clean = text.replace(/^(hi|hello|hey|can you help me with|tell me about|what is|how does|explain)\s+/i, '');
  const words = clean.split(/\s+/).slice(0, 4).join(' ');
  return words.length > 20 ? words.substring(0, 17) + '...' : words || 'General';
}

/**
 * generateSessionTitle: Use LLM to create a better title after first turn
 */
/**
 * generateSessionTitle: Use LLM to create a better title after first turn
 */
async function generateSessionTitle(userMsg, aiMsg) {
  try {
    const prompt = `Based on this first turn of conversation, generate a 2-4 word title for the chat.
User: ${userMsg.substring(0, 200)}
AI: ${aiMsg.substring(0, 200)}

Response ONLY with the title. No quotes.`;
    
    const response = await routeConversation([{ role: 'user', content: prompt }], { timeout: 10000 });
    return response.content.replace(/^["']|["']$/g, '').trim() || 'New Session';
  } catch (err) {
    console.warn('[Chat] Title generation failed:', err.message);
    return 'New Session';
  }
}

