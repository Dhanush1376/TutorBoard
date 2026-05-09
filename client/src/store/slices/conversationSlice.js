/**
 * conversationSlice.js — TutorBoard v5.0 PRODUCTION UPGRADE
 *
 * FIXES:
 * ✓ Stream token validation on appendStreamChunk / appendStreamThought
 * ✓ addAssistantMessage no longer clears ALL sessions — scoped to current only
 * ✓ abortStreaming commits partial as a versioned entry with metadata flag
 * ✓ prepareRegeneration deferred — versions appended only in finishStreaming
 * ✓ switchMessageVersion fully resyncs normalized session store
 * ✓ Per-session AbortController references (stored externally — see useChatEngine)
 * ✓ finishStreaming validates streamToken before committing
 * ✓ State machine transitions enforced for all stream status changes
 */

const generateId = (prefix = 'msg') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

const extractJsonResponse = (text) => {
  if (!text || typeof text !== 'string') return { content: text };
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return { content: text };
  
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.chat_response) {
      return {
        content: parsed.chat_response,
        artifact: parsed.artifact || null,
        canvasType: parsed.canvasType || parsed.artifact?.type || null
      };
    }
    // If it's a generic JSON but has a text-like field
    if (parsed.text && typeof parsed.text === 'string') {
      return { content: parsed.text, artifact: parsed.artifact || null };
    }
  } catch (e) {
    // Not valid JSON or different structure, return as is
  }
  return { content: text };
};

const buildNormalizedSession = () => ({
  messagesById: {},
  orderedMessageIds: [],
  streamState: {
    status: 'idle',
    streamId: null,
    requestId: null,
    messageId: null,
    assistantMessageId: null,
    createdAt: null,
    latencyMs: null,
    aborted: false,
  },
  metadata: {},
});

const toUiMessage = (msg) => {
  const content = msg.content || '';
  const defaultMetadata = {
    edited: false,
    regenerated: false,
    feedback: null,
    aborted: false,
    error: null,
    versions: [{ text: content, subsequentMessages: [] }],
    activeVersionIndex: 0,
  };
  return {
    ...msg,
    metadata: {
      ...defaultMetadata,
      ...(msg.metadata || {}),
    },
  };
};

const ALLOWED_STREAM_TRANSITIONS = {
  idle:       new Set(['requesting']),
  requesting: new Set(['streaming', 'failed', 'aborted', 'completed']),
  streaming:  new Set(['completed', 'failed', 'aborted']),
  completed:  new Set(['requesting']),
  failed:     new Set(['requesting', 'completed']),
  aborted:    new Set(['requesting', 'completed']),
};

const canTransitionStream = (fromStatus = 'idle', toStatus = 'idle') =>
  !!ALLOWED_STREAM_TRANSITIONS[fromStatus]?.has(toStatus);

// ─── Resync helper: keeps normalized session in sync with conversationMessages ─
const resyncNormalizedSession = (state, sid, messages) => {
  if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
  const session = state.conversationSessions[sid];
  session.messagesById = {};
  session.orderedMessageIds = [];
  messages.forEach((m) => {
    session.messagesById[m.id] = toUiMessage(m);
    session.orderedMessageIds.push(m.id);
  });
};

export const createConversationSlice = (set, get) => ({
  conversationSessions: {},
  activeConversationSessionId: null,
  conversationMessages: [],
  isStreaming: false,
  streamingContent: '',
  streamingThought: '',
  streamingMessageId: null,
  streamingSessionId: null,
  isWaitingForAI: false,
  waitingSessionId: null,
  lastAIError: null,
  conversationTopic: null,
  conversationIntent: null,
  editingMessageId: null,
  editingContent: '',
  conversationSources: [],
  lastStreamSources: [],
  isSearchPerformed: false,
  currentCanvasType: null,
  sessionStates: {},
  streamTokenCounter: 0,

  // ─────────────────────────────────────────────────────────────────────────────
  // MESSAGE CREATION
  // ─────────────────────────────────────────────────────────────────────────────

  addUserMessage: (content) => {
    const userId = generateId('user');
    const msg = {
      id: userId, role: 'user', content,
      timestamp: new Date().toISOString(),
      metadata: {
        edited: false, regenerated: false, feedback: null, aborted: false, error: null,
        versions: [{ text: content, subsequentMessages: [] }], activeVersionIndex: 0,
      },
    };
    const sid = get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const session = state.conversationSessions[sid];
      session.messagesById[userId] = toUiMessage(msg);
      session.orderedMessageIds.push(userId);
      state.activeConversationSessionId = sid;
      state.conversationMessages = session.orderedMessageIds.map((id) => session.messagesById[id]).filter(Boolean);
      state.isWaitingForAI = true;
      state.waitingSessionId = sid;
      state.lastAIError = null;
      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].isWaitingForAI = true;
      state.sessionStates[sid].waitingSessionId = sid;
    });
    const { conversationTopic, conversationMessages } = get();
    if (!conversationTopic && conversationMessages.length <= 1) {
      set({ conversationTopic: content.substring(0, 60).replace(/[?\n]/g, '').trim() });
    }
    return { userId };
  },

  addAssistantMessage: (content, id = null, extraMetadata = {}) => {
    const msgId = id || generateId('assistant');
    const sid = get().activeConversationSessionId || get().chatSessionId || get().sessionId || 'temp';
    const msg = {
      id: msgId, role: 'assistant', content,
      timestamp: new Date().toISOString(),
      metadata: {
        edited: false, regenerated: false, feedback: null, aborted: false, error: null,
        versions: [{ text: content, subsequentMessages: [] }], activeVersionIndex: 0,
        ...extraMetadata,
      },
      ...extraMetadata,
    };
    set((state) => {
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const session = state.conversationSessions[sid];
      session.messagesById[msgId] = toUiMessage(msg);
      session.orderedMessageIds.push(msgId);
      state.conversationMessages = session.orderedMessageIds.map((id) => session.messagesById[id]).filter(Boolean);

      // FIX: Only clear THIS session's state — not all sessions
      state.isWaitingForAI = false;
      state.isStreaming = false;
      state.waitingSessionId = null;
      state.streamingSessionId = null;
      state.streamingContent = '';
      state.streamingMessageId = null;

      if (state.sessionStates[sid]) {
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].isWaitingForAI = false;
      }
    });
    return msgId;
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // STREAMING STATE MACHINE
  // ─────────────────────────────────────────────────────────────────────────────

  startStreaming: (messageId, sessionId = null, streamToken = null) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      const token = streamToken || `stream-${Date.now()}-${++state.streamTokenCounter}`;
      state.isStreaming = true;
      state.isWaitingForAI = false;
      state.waitingSessionId = null;
      state.streamingSessionId = sid;
      state.streamingContent = '';
      state.streamingThought = '';
      state.streamingMessageId = messageId;
      state.isSearchPerformed = false;

      state.sessionStates[sid] = {
        isStreaming: true,
        isWaitingForAI: false,
        content: '',
        thought: '',
        messageId,
        streamToken: token,
        sources: [],
        searchPerformed: false,
        aborted: false,
      };

      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || 'idle';
      if (canTransitionStream(currentStatus, 'requesting')) {
        state.conversationSessions[sid].streamState.status = 'requesting';
      }
      if (canTransitionStream(state.conversationSessions[sid].streamState.status, 'streaming')) {
        state.conversationSessions[sid].streamState = {
          ...state.conversationSessions[sid].streamState,
          status: 'streaming',
          streamId: token,
          requestId: token,
          messageId,
          assistantMessageId: messageId,
          createdAt: Date.now(),
          latencyMs: null,
          aborted: false,
        };
      }
    });
  },

  prepareRegeneration: (messageId) => {
    // NOTE: Do NOT add versions here — only in finishStreaming after server confirms
    const sid = get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.isWaitingForAI = true;
      state.waitingSessionId = sid;
      state.streamingMessageId = messageId;
      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].isWaitingForAI = true;
      state.sessionStates[sid].messageId = messageId;
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || 'idle';
      if (canTransitionStream(currentStatus, 'requesting')) {
        state.conversationSessions[sid].streamState.status = 'requesting';
        state.conversationSessions[sid].streamState.requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        state.conversationSessions[sid].streamState.createdAt = Date.now();
      }
    });
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // STREAM CHUNK HANDLING — all validate streamToken
  // ─────────────────────────────────────────────────────────────────────────────

  updateStreamingContent: (content, sessionId = null, streamToken = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    set((state) => {
      const activeToken = state.sessionStates[sid]?.streamToken;
      if (streamToken && activeToken && streamToken !== activeToken) return; // stale chunk — drop
      if (state.sessionStates[sid]) state.sessionStates[sid].content = content;
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingContent = content;
      }
    });
  },

  appendStreamChunk: (chunk, sessionId = null, streamToken = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    set((state) => {
      // FIX: Validate token — drop stale/mismatched chunks
      const activeToken = state.sessionStates[sid]?.streamToken;
      if (streamToken && activeToken && streamToken !== activeToken) return;

      if (!state.sessionStates[sid]) state.sessionStates[sid] = { content: '' };
      state.sessionStates[sid].content = (state.sessionStates[sid].content || '') + chunk;
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingContent = (state.streamingContent || '') + chunk;
      }
    });
  },

  appendStreamThought: (thought, sessionId = null, streamToken = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    set((state) => {
      const activeToken = state.sessionStates[sid]?.streamToken;
      if (streamToken && activeToken && streamToken !== activeToken) return;

      if (!state.sessionStates[sid]) state.sessionStates[sid] = { thought: '' };
      state.sessionStates[sid].thought = (state.sessionStates[sid].thought || '') + thought;
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingThought = (state.streamingThought || '') + thought;
      }
    });
  },

  setSources: (sources, sessionId = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    set((state) => {
      if (state.sessionStates[sid]) {
        state.sessionStates[sid].sources = sources;
        state.sessionStates[sid].searchPerformed = true;
      }
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.conversationSources = sources;
        state.lastStreamSources = sources;
        state.isSearchPerformed = true;
      }
      if (state.conversationSessions[sid]) {
        state.conversationSessions[sid].metadata.lastSources = sources;
      }
    });
  },

  clearSources: () => set({ conversationSources: [], lastStreamSources: [] }),

  // ─────────────────────────────────────────────────────────────────────────────
  // FINISH STREAMING — validates token, handles regen versions
  // ─────────────────────────────────────────────────────────────────────────────

  finishStreaming: (
    finalContent,
    sessionId = null,
    thoughtContent = '',
    sources = [],
    artifactId = null,
    canvasType = null,
    latencyMs = null,
    streamToken = null,
    isRegeneration = false, // FIX: explicit regen flag
  ) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    const { conversationMessages, chatSessionId, sessionId: activeSessionId } = get();
    const currentViewId = chatSessionId || activeSessionId;
    const isCurrentChat = sid === currentViewId || sid === chatSessionId || sid === activeSessionId;
    const targetMsgId = get().sessionStates[sid]?.messageId || get().streamingMessageId;
    let existingIdx = conversationMessages.findIndex((m) => m.id === targetMsgId);

    // Extraction logic for JSON-wrapped responses
    const { content: cleanContent, artifact, canvasType: extractedCanvasType } = extractJsonResponse(finalContent);
    const effectiveContent = cleanContent;
    const effectiveCanvasType = canvasType || extractedCanvasType;
    const effectiveArtifactId = artifactId || (artifact ? `art-${Date.now()}` : null);

    set((state) => {
      // FIX: Validate streamToken before committing
      const activeStreamToken = state.sessionStates[sid]?.streamToken;
      if (streamToken && activeStreamToken && streamToken !== activeStreamToken) return;

      // If aborted, discard (abortStreaming handles its own commit)
      if (state.sessionStates[sid]?.aborted) {
        state.sessionStates[sid].aborted = false;
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].isWaitingForAI = false;
        state.sessionStates[sid].content = '';
        state.sessionStates[sid].thought = '';
        if (sid === state.streamingSessionId || sid === state.chatSessionId) {
          state.isStreaming = false;
          state.streamingContent = '';
          state.streamingThought = '';
          state.streamingMessageId = null;
          state.streamingSessionId = null;
          state.isWaitingForAI = false;
          state.waitingSessionId = null;
        }
        return;
      }

      // Clear session state
      if (state.sessionStates[sid]) {
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].isWaitingForAI = false;
        state.sessionStates[sid].content = '';
        state.sessionStates[sid].thought = '';
        state.sessionStates[sid].streamToken = null;
      }

      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const normalizedSession = state.conversationSessions[sid];
      const streamStatus = normalizedSession.streamState.status || 'idle';
      // FIX: Allow 'idle→completed' as a fallback for race conditions where
      // startStreaming ran against a different sid than finishStreaming resolves.
      // Without this, finishStreaming silently returns and no message ever appears.
      const canComplete = canTransitionStream(streamStatus, 'completed') || streamStatus === 'idle';
      if (!canComplete) return;

      if (sid === state.streamingSessionId || sid === state.chatSessionId) {
        state.isStreaming = false;
        state.streamingContent = '';
        state.streamingThought = '';
        state.streamingMessageId = null;
        state.streamingSessionId = null;
        state.isWaitingForAI = false;
        state.waitingSessionId = null;
      }

      if (existingIdx !== -1 && isCurrentChat) {
        const targetMsg = state.conversationMessages[existingIdx];
        
        // SEC-UX-REGEN: Never overwrite a USER message with assistant content, even if ID matches
        if (targetMsg.role === 'user') {
          // Redirect to "New Message" path by setting existingIdx to -1
          existingIdx = -1; 
        }
      }

      if (existingIdx !== -1 && isCurrentChat) {
        const targetMsg = state.conversationMessages[existingIdx];
        const activeIdx = targetMsg.metadata.activeVersionIndex ?? 0;
        const existingVersions = targetMsg.metadata.versions || [{ text: targetMsg.content, subsequentMessages: [] }];

        let updatedVersions;
        if (isRegeneration) {
          // Idempotency check: if this version already exists (e.g. from server 'done' sync), don't double-append
          const alreadyExists = existingVersions.some(v => v.text === finalContent);
          if (alreadyExists) {
            updatedVersions = existingVersions;
          } else {
            updatedVersions = [
              ...existingVersions,
              { text: finalContent, subsequentMessages: [] },
            ];
          }
        } else {
          updatedVersions = existingVersions.map((v, i) =>
            i === activeIdx ? { ...v, text: finalContent } : v
          );
        }

        const newActiveIdx = isRegeneration ? updatedVersions.length - 1 : activeIdx;

        state.conversationMessages[existingIdx] = {
          ...targetMsg,
          content: effectiveContent,
          hasCanvas: !!effectiveCanvasType || targetMsg.hasCanvas,
          canvasType: effectiveCanvasType || targetMsg.canvasType,
          metadata: {
            ...targetMsg.metadata,
            regenerated: isRegeneration,
            thought: thoughtContent || targetMsg.metadata.thought,
            sources: sources.length > 0 ? sources : targetMsg.metadata.sources,
            searchPerformed: state.isSearchPerformed || targetMsg.metadata.searchPerformed,
            artifactId: effectiveArtifactId || targetMsg.metadata.artifactId,
            artifactData: artifact || targetMsg.metadata.artifactData,
            versions: updatedVersions.map((v, i) => 
              i === newActiveIdx ? { ...v, text: effectiveContent } : v
            ),
            activeVersionIndex: newActiveIdx,
            latencyMs: latencyMs || targetMsg.metadata.latencyMs,
            aborted: false,
            error: null,
          },
        };
        const updatedId = state.conversationMessages[existingIdx].id;
        normalizedSession.messagesById[updatedId] = toUiMessage(state.conversationMessages[existingIdx]);
        if (!normalizedSession.orderedMessageIds.includes(updatedId)) {
          normalizedSession.orderedMessageIds.push(updatedId);
        }
      } else if (isCurrentChat) {
        const msg = {
          id: targetMsgId || generateId('assistant'),
          role: 'assistant', content: effectiveContent,
          timestamp: new Date().toISOString(),
          hasCanvas: !!effectiveCanvasType,
          canvasType: effectiveCanvasType,
          metadata: {
            edited: false, regenerated: false, feedback: null, aborted: false, error: null,
            thought: thoughtContent,
            sources,
            searchPerformed: state.isSearchPerformed,
            artifactId: effectiveArtifactId,
            artifactData: artifact,
            versions: [{ text: effectiveContent, subsequentMessages: [] }],
            activeVersionIndex: 0,
            latencyMs,
          },
        };
        state.conversationMessages = [...state.conversationMessages, msg];
        normalizedSession.messagesById[msg.id] = toUiMessage(msg);
        normalizedSession.orderedMessageIds.push(msg.id);
        state.conversationSources = [];
        state.isSearchPerformed = false;
        state.currentCanvasType = null;
      }

      normalizedSession.streamState = {
        ...normalizedSession.streamState,
        status: 'completed',
        latencyMs: latencyMs || normalizedSession.streamState.latencyMs || null,
        aborted: false,
      };
    });
  },

  setCurrentCanvasType: (type) => set({ currentCanvasType: type }),

  // ─────────────────────────────────────────────────────────────────────────────
  // ABORT STREAMING — commits partial as versioned entry with aborted flag
  // ─────────────────────────────────────────────────────────────────────────────

  abortStreaming: (sessionId = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    const state = get();
    const sessionState = state.sessionStates[sid] || {};
    const partialContent = sessionState.content || state.streamingContent || '';
    const msgId = sessionState.messageId || state.streamingMessageId;

    set((state) => {
      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].aborted = true;
      state.sessionStates[sid].isStreaming = false;
      state.sessionStates[sid].isWaitingForAI = false;
      state.sessionStates[sid].content = '';
      state.sessionStates[sid].thought = '';
      state.isStreaming = false;
      state.streamingContent = '';
      state.streamingMessageId = null;
      state.streamingSessionId = null;
      state.isWaitingForAI = false;
      state.waitingSessionId = null;

      // FIX: Commit partial content as an aborted version entry
      if (msgId && partialContent) {
        const idx = state.conversationMessages.findIndex((m) => m.id === msgId);
        if (idx !== -1) {
          const targetMsg = state.conversationMessages[idx];
          const existingVersions = targetMsg.metadata.versions || [{ text: targetMsg.content, subsequentMessages: [] }];
          const updatedVersions = [
            ...existingVersions,
            { text: partialContent, subsequentMessages: [], aborted: true },
          ];
          state.conversationMessages[idx] = {
            ...targetMsg,
            content: partialContent,
            metadata: {
              ...targetMsg.metadata,
              versions: updatedVersions,
              activeVersionIndex: updatedVersions.length - 1,
              aborted: true,
            },
          };
          const sSid = state.activeConversationSessionId || sid;
          if (state.conversationSessions[sSid]) {
            state.conversationSessions[sSid].messagesById[msgId] = toUiMessage(state.conversationMessages[idx]);
          }
        }
      }

      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || 'idle';
      if (canTransitionStream(currentStatus, 'aborted')) {
        state.conversationSessions[sid].streamState = {
          ...state.conversationSessions[sid].streamState,
          status: 'aborted',
          aborted: true,
        };
      }
    });
  },

  setWaitingForAI: (waiting, sessionId = null) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.isWaitingForAI = waiting;
      if (waiting) state.waitingSessionId = sid;
      else state.waitingSessionId = null;
      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].isWaitingForAI = waiting;
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || 'idle';
      if (waiting && canTransitionStream(currentStatus, 'requesting')) {
        state.conversationSessions[sid].streamState.status = 'requesting';
        state.conversationSessions[sid].streamState.createdAt = Date.now();
      }
    });
  },

  setLastAIError: (error, sessionId = null) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.lastAIError = error;
      state.isWaitingForAI = false;
      state.isStreaming = false;
      state.streamingContent = '';
      state.streamingMessageId = null;
      if (state.sessionStates[sid]) {
        state.sessionStates[sid].isWaitingForAI = false;
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].content = '';
      }
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || 'idle';
      if (canTransitionStream(currentStatus, 'failed')) {
        state.conversationSessions[sid].streamState.status = 'failed';
      }

      // Mark the last assistant message with the error for inline error recovery UI
      const msgs = state.conversationMessages;
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
        const last = msgs[msgs.length - 1];
        state.conversationMessages[msgs.length - 1] = {
          ...last,
          metadata: { ...last.metadata, error: error?.message || 'Generation failed' },
        };
      }
    });
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EDITING
  // ─────────────────────────────────────────────────────────────────────────────

  startEditingMessage: (messageId) => {
    const msg = get().conversationMessages.find((m) => m.id === messageId);
    if (msg && msg.role === 'user') {
      set({ editingMessageId: messageId, editingContent: msg.content });
    }
  },
  updateEditingContent: (content) => set({ editingContent: content }),
  cancelEditing: () => set({ editingMessageId: null, editingContent: '' }),

  applyEdit: (messageId, newContent) => {
    const { conversationMessages } = get();
    const idx = conversationMessages.findIndex((m) => m.id === messageId);
    if (idx === -1) return conversationMessages;
    const targetMsg = conversationMessages[idx];
    const subsequentMessages = conversationMessages.slice(idx + 1);
    const currentVersions = targetMsg.metadata.versions || [{ text: targetMsg.content, subsequentMessages: [] }];
    const activeIdx = targetMsg.metadata.activeVersionIndex || 0;

    const updatedCurrentVersions = currentVersions.map((v, i) =>
      i === activeIdx ? { ...v, subsequentMessages } : v
    );
    const newVersions = [
      ...updatedCurrentVersions,
      { text: newContent, subsequentMessages: [] },
    ];
    const newActiveIdx = newVersions.length - 1;
    const updated = conversationMessages.slice(0, idx + 1);
    updated[idx] = {
      ...targetMsg, content: newContent,
      metadata: {
        ...targetMsg.metadata, edited: true,
        versions: newVersions, activeVersionIndex: newActiveIdx,
      },
    };
    const sid = get().activeConversationSessionId || get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.conversationMessages = updated;
      state.editingMessageId = null;
      state.editingContent = '';
      state.isWaitingForAI = true;
      resyncNormalizedSession(state, sid, updated);
    });
    return updated;
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // VERSION SWITCHING — FIX: full resync of normalized store
  // ─────────────────────────────────────────────────────────────────────────────

  switchMessageVersion: (messageId, versionIndex) => {
    const { conversationMessages } = get();
    const idx = conversationMessages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const targetMsg = conversationMessages[idx];
    if (!targetMsg.metadata.versions) return;

    const currentSubsequent = conversationMessages.slice(idx + 1);
    const activeIdx = targetMsg.metadata.activeVersionIndex || 0;
    const updatedVersions = targetMsg.metadata.versions.map((v, i) =>
      i === activeIdx ? { ...v, subsequentMessages: currentSubsequent } : v
    );
    const targetVersion = updatedVersions[versionIndex];
    const updatedMsg = {
      ...targetMsg,
      content: targetVersion.text,
      metadata: { ...targetMsg.metadata, versions: updatedVersions, activeVersionIndex: versionIndex },
    };
    const newConversation = [
      ...conversationMessages.slice(0, idx),
      updatedMsg,
      ...(targetVersion.subsequentMessages || []),
    ];

    set((state) => {
      state.conversationMessages = newConversation;
      const sid = state.activeConversationSessionId || state.chatSessionId || state.sessionId || 'temp';
      // FIX: Full resync of normalized store
      resyncNormalizedSession(state, sid, newConversation);
    });
  },

  addMessageVersion: (messageId, text, metadata = {}) => {
    // ✅ FIX: mutate draft — do NOT return new object from immer producer
    set((state) => {
      const idx = state.conversationMessages.findIndex(m => m.id === messageId);
      if (idx === -1) return;
      const m = state.conversationMessages[idx];
      const versions = m.metadata.versions || [{ text: m.content, subsequentMessages: [] }];
      state.conversationMessages[idx] = {
        ...m, content: text,
        metadata: {
          ...m.metadata, ...metadata,
          versions: [...versions, { text, subsequentMessages: [] }],
          activeVersionIndex: versions.length,
        },
      };
    });
  },

  deleteMessageById: (messageId) => {
    // ✅ FIX: mutate draft
    set((state) => {
      state.conversationMessages = state.conversationMessages.filter((m) => m.id !== messageId);
    });
  },

  removeLastAssistantMessage: () => {
    const { conversationMessages } = get();
    if (conversationMessages.length === 0) return conversationMessages;
    const last = conversationMessages[conversationMessages.length - 1];
    if (last.role !== 'assistant') return conversationMessages;
    const updated = conversationMessages.slice(0, -1);
    set({ conversationMessages: updated, isWaitingForAI: true });
    return updated;
  },

  setConversationMessages: (messages) => {
    set((state) => {
      const sid = state.chatSessionId || state.sessionId || state.activeConversationSessionId || 'temp';
      const normalized = messages.map((m) => {
        const content = m.content || '';
        return {
          id: m.id || m._id?.toString() || generateId(m.role),
          role: m.role, content,
          timestamp: m.timestamp || new Date().toISOString(),
          hasCanvas: m.hasCanvas || false,
          canvasType: m.canvasType || null,
          canvasSnapshot: m.canvasSnapshot || null,
          metadata: {
            edited: false, regenerated: false, feedback: null, aborted: false, error: null,
            versions: [{ text: content, subsequentMessages: [] }], activeVersionIndex: 0,
            ...(m.metadata || {}),
          },
        };
      });
      state.activeConversationSessionId = sid;
      state.conversationMessages = normalized;
      resyncNormalizedSession(state, sid, normalized);
    });
  },

  clearConversation: () => {
    // FIX: Also clear sessionStates and conversationSessions so stale streamTokens
    // from the previous session don't block appendStreamChunk on the new session.
    set({
      conversationMessages: [],
      conversationSessions: {},
      sessionStates: {},
      activeConversationSessionId: null,
      isStreaming: false,
      streamingContent: '',
      streamingThought: '',
      streamingMessageId: null,
      streamingSessionId: null,
      streamTokenCounter: 0,
      isWaitingForAI: false,
      waitingSessionId: null,
      lastAIError: null,
      conversationTopic: null,
      conversationIntent: null,
      editingMessageId: null,
      editingContent: '',
      conversationSources: [],
      lastStreamSources: [],
    });
  },

  setMessageFeedback: (messageId, feedback) => {
    // ✅ FIX: mutate draft
    set((state) => {
      const idx = state.conversationMessages.findIndex(m => m.id === messageId);
      if (idx !== -1) state.conversationMessages[idx].metadata.feedback = feedback;
    });
  },

  updateMessageMetadata: (messageId, metadata) => {
    // ✅ FIX: mutate draft
    set((state) => {
      const idx = state.conversationMessages.findIndex(m => m.id === messageId);
      if (idx !== -1) Object.assign(state.conversationMessages[idx].metadata, metadata);
    });
  },

  setConversationTopic: (topic) => set({ conversationTopic: topic }),
  setConversationIntent: (intent) => set({ conversationIntent: intent }),

  syncMessageIds: (userMessageId, assistantMessageId) => {
    set((state) => {
      const msgs = [...state.conversationMessages];
      if (msgs.length >= 2) {
        const oldAssistantId = msgs[msgs.length - 1].id;
        if (userMessageId) msgs[msgs.length - 2] = { ...msgs[msgs.length - 2], id: userMessageId };
        if (assistantMessageId) {
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], id: assistantMessageId };
          if (state.streamingMessageId === oldAssistantId) state.streamingMessageId = assistantMessageId;
          Object.keys(state.sessionStates).forEach((sid) => {
            if (state.sessionStates[sid].messageId === oldAssistantId) {
              state.sessionStates[sid].messageId = assistantMessageId;
            }
          });
        }
      }
      const sid = state.activeConversationSessionId || state.chatSessionId || state.sessionId || 'temp';
      resyncNormalizedSession(state, sid, msgs);
      state.conversationMessages = msgs;
    });
  },

  migrateSessionState: (oldId, newId) => {
    if (!oldId || !newId || oldId === newId) return;
    set((state) => {
      if (state.sessionStates[oldId]) state.sessionStates[newId] = { ...state.sessionStates[oldId] };
      if (state.conversationSessions[oldId] && !state.conversationSessions[newId]) {
        state.conversationSessions[newId] = state.conversationSessions[oldId];
      }
      if (state.activeConversationSessionId === oldId) state.activeConversationSessionId = newId;
      if (state.streamingSessionId === oldId) state.streamingSessionId = newId;
      if (state.waitingSessionId === oldId) state.waitingSessionId = newId;
    });
  },

  setActiveConversationSession: (sessionId) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.activeConversationSessionId = sid;
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const session = state.conversationSessions[sid];
      state.conversationMessages = session.orderedMessageIds.map((id) => session.messagesById[id]).filter(Boolean);
    });
  },

  getConversationMessagesForSession: (sessionId) => {
    const sid = sessionId || get().activeConversationSessionId || get().chatSessionId || get().sessionId || 'temp';
    const session = get().conversationSessions[sid];
    if (!session) return [];
    return session.orderedMessageIds.map((id) => session.messagesById[id]).filter(Boolean);
  },
});