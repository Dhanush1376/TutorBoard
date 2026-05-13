const generateId = (prefix = "msg") => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
const extractJsonResponse = (text) => {
  if (!text || typeof text !== "string") return { content: text };
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return { content: text };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.chat_response) {
      return {
        content: parsed.chat_response,
        artifact: parsed.artifact || null,
        canvasType: parsed.canvasType || parsed.artifact?.type || null
      };
    }
    if (parsed.text && typeof parsed.text === "string") {
      return { content: parsed.text, artifact: parsed.artifact || null };
    }
  } catch (e) {
  }
  return { content: text };
};
const buildNormalizedSession = () => ({
  messagesById: {},
  orderedMessageIds: [],
  streamState: {
    status: "idle",
    streamId: null,
    requestId: null,
    messageId: null,
    assistantMessageId: null,
    createdAt: null,
    latencyMs: null,
    aborted: false
  },
  metadata: {}
});
const toUiMessage = (msg) => {
  const content = msg.content || "";
  const defaultMetadata = {
    edited: false,
    regenerated: false,
    feedback: null,
    aborted: false,
    error: null,
    versions: [{ text: content, subsequentMessages: [] }],
    activeVersionIndex: 0
  };
  return {
    ...msg,
    metadata: {
      ...defaultMetadata,
      ...msg.metadata || {}
    }
  };
};
const ALLOWED_STREAM_TRANSITIONS = {
  idle: /* @__PURE__ */ new Set(["requesting"]),
  requesting: /* @__PURE__ */ new Set(["streaming", "failed", "aborted", "completed"]),
  streaming: /* @__PURE__ */ new Set(["completed", "failed", "aborted"]),
  completed: /* @__PURE__ */ new Set(["requesting"]),
  failed: /* @__PURE__ */ new Set(["requesting", "completed"]),
  aborted: /* @__PURE__ */ new Set(["requesting", "completed"])
};
const canTransitionStream = (fromStatus = "idle", toStatus = "idle") => !!ALLOWED_STREAM_TRANSITIONS[fromStatus]?.has(toStatus);
const resyncNormalizedSession = (state, sid, messages) => {
  if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
  const session = state.conversationSessions[sid];
  session.messagesById = {};
  session.orderedMessageIds = [];
  messages.forEach((m) => {
    const resolvedId = (m.id || m._id)?.toString();
    if (!resolvedId) return;
    const resolvedMsg = { ...m, id: resolvedId };
    session.messagesById[resolvedId] = toUiMessage(resolvedMsg);
    session.orderedMessageIds.push(resolvedId);
  });
};
const createConversationSlice = (set, get) => ({
  conversationSessions: {},
  activeConversationSessionId: null,
  conversationMessages: [],
  isStreaming: false,
  streamingContent: "",
  streamingThought: "",
  streamingMessageId: null,
  streamingSessionId: null,
  isWaitingForAI: false,
  isMessagesLoading: false,
  waitingSessionId: null,
  lastAIError: null,
  conversationTopic: null,
  conversationIntent: null,
  editingMessageId: null,
  editingContent: "",
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
    import.meta.env.DEV && console.log("[Store:Chat] addUserMessage:", content);
    const userId = generateId("user");
    const msg = {
      id: userId,
      role: "user",
      content,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: {
        edited: false,
        regenerated: false,
        feedback: null,
        aborted: false,
        error: null,
        versions: [{ text: content, subsequentMessages: [] }],
        activeVersionIndex: 0
      }
    };
    const sid = get().chatSessionId || get().sessionId || "temp";
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
      state.streamingMessageId = null;
      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].isWaitingForAI = true;
      state.sessionStates[sid].waitingSessionId = sid;
      state.sessionStates[sid].messageId = null;
    });
    const { conversationTopic, conversationMessages } = get();
    if (!conversationTopic && conversationMessages.length <= 1) {
      set({ conversationTopic: content.substring(0, 60).replace(/[?\n]/g, "").trim() });
    }
    return { userId };
  },
  addAssistantMessage: (content, id = null, extraMetadata = {}) => {
    const msgId = id || generateId("assistant");
    const sid = get().activeConversationSessionId || get().chatSessionId || get().sessionId || "temp";
    const msg = {
      id: msgId,
      role: "assistant",
      content,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: {
        edited: false,
        regenerated: false,
        feedback: null,
        aborted: false,
        error: null,
        versions: [{ text: content, subsequentMessages: [] }],
        activeVersionIndex: 0,
        ...extraMetadata
      },
      ...extraMetadata
    };
    set((state) => {
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const session = state.conversationSessions[sid];
      session.messagesById[msgId] = toUiMessage(msg);
      session.orderedMessageIds.push(msgId);
      state.conversationMessages = session.orderedMessageIds.map((id2) => session.messagesById[id2]).filter(Boolean);
      state.isWaitingForAI = false;
      state.isStreaming = false;
      state.waitingSessionId = null;
      state.streamingSessionId = null;
      state.streamingContent = "";
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
    const sid = sessionId || get().chatSessionId || get().sessionId || "temp";
    set((state) => {
      const token = streamToken || `stream-${Date.now()}-${++state.streamTokenCounter}`;
      state.isStreaming = true;
      state.isWaitingForAI = false;
      state.waitingSessionId = null;
      state.streamingSessionId = sid;
      state.streamingContent = "";
      state.streamingThought = "";
      state.streamingMessageId = messageId;
      state.isSearchPerformed = false;
      state.sessionStates[sid] = {
        isStreaming: true,
        isWaitingForAI: false,
        content: "",
        thought: "",
        messageId,
        streamToken: token,
        sources: [],
        searchPerformed: false,
        aborted: false
      };
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || "idle";
      if (canTransitionStream(currentStatus, "requesting")) {
        state.conversationSessions[sid].streamState.status = "requesting";
      }
      if (canTransitionStream(state.conversationSessions[sid].streamState.status, "streaming")) {
        state.conversationSessions[sid].streamState = {
          ...state.conversationSessions[sid].streamState,
          status: "streaming",
          streamId: token,
          requestId: token,
          messageId,
          assistantMessageId: messageId,
          createdAt: Date.now(),
          latencyMs: null,
          aborted: false
        };
      }
    });
  },
  prepareRegeneration: (messageId, streamToken = null) => {
    const sid = get().chatSessionId || get().sessionId || "temp";
    set((state) => {
      state.isWaitingForAI = true;
      state.waitingSessionId = sid;
      state.streamingMessageId = messageId;
      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].isWaitingForAI = true;
      state.sessionStates[sid].messageId = messageId;
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || "idle";
      if (canTransitionStream(currentStatus, "requesting")) {
        state.conversationSessions[sid].streamState.status = "requesting";
        state.conversationSessions[sid].streamState.requestId = streamToken || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        state.conversationSessions[sid].streamState.createdAt = Date.now();
      }
    });
  },
  // ─────────────────────────────────────────────────────────────────────────────
  // STREAM CHUNK HANDLING — all validate streamToken
  // ─────────────────────────────────────────────────────────────────────────────
  updateStreamingContent: (content, sessionId = null, streamToken = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || "temp";
    set((state) => {
      const activeToken = state.sessionStates[sid]?.streamToken;
      if (streamToken && activeToken && streamToken !== activeToken) return;
      if (state.sessionStates[sid]) state.sessionStates[sid].content = content;
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingContent = content;
      }
    });
  },
  appendStreamChunk: (chunk, sessionId = null, streamToken = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || "temp";
    set((state) => {
      const activeToken = state.sessionStates[sid]?.streamToken;
      if (streamToken && activeToken && streamToken !== activeToken) return;
      if (!state.sessionStates[sid]) state.sessionStates[sid] = { content: "" };
      state.sessionStates[sid].content = (state.sessionStates[sid].content || "") + chunk;
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingContent = (state.streamingContent || "") + chunk;
      }
    });
  },
  appendStreamThought: (thought, sessionId = null, streamToken = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || "temp";
    set((state) => {
      const activeToken = state.sessionStates[sid]?.streamToken;
      if (streamToken && activeToken && streamToken !== activeToken) return;
      if (!state.sessionStates[sid]) state.sessionStates[sid] = { thought: "" };
      state.sessionStates[sid].thought = (state.sessionStates[sid].thought || "") + thought;
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingThought = (state.streamingThought || "") + thought;
      }
    });
  },
  setSources: (sources, sessionId = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || "temp";
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
  finishStreaming: (finalContent, sessionId = null, thoughtContent = "", sources = [], artifactId = null, canvasType = null, latencyMs = null, streamToken = null, isRegeneration = false) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || "temp";
    const { conversationMessages, chatSessionId, sessionId: activeSessionId } = get();
    const currentViewId = chatSessionId || activeSessionId;
    const isCurrentChat = sid === currentViewId || sid === chatSessionId || sid === activeSessionId;
    const targetMsgId = get().sessionStates[sid]?.messageId || get().streamingMessageId;
    let existingIdx = conversationMessages.findIndex((m) => m.id === targetMsgId);
    const { content: cleanContent, artifact, canvasType: extractedCanvasType } = extractJsonResponse(finalContent);
    const effectiveContent = cleanContent;
    const effectiveCanvasType = canvasType || extractedCanvasType;
    const effectiveArtifactId = artifactId || (artifact ? `art-${Date.now()}` : null);
    set((state) => {
      const activeStreamToken = state.sessionStates[sid]?.streamToken;
      if (streamToken && activeStreamToken && streamToken !== activeStreamToken) return;
      if (state.sessionStates[sid]?.aborted) {
        state.sessionStates[sid].aborted = false;
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].isWaitingForAI = false;
        state.sessionStates[sid].content = "";
        state.sessionStates[sid].thought = "";
        if (sid === state.streamingSessionId || sid === state.chatSessionId) {
          state.isStreaming = false;
          state.streamingContent = "";
          state.streamingThought = "";
          state.streamingMessageId = null;
          state.streamingSessionId = null;
          state.isWaitingForAI = false;
          state.waitingSessionId = null;
        }
        return;
      }
      if (state.sessionStates[sid]) {
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].isWaitingForAI = false;
        state.sessionStates[sid].content = "";
        state.sessionStates[sid].thought = "";
        state.sessionStates[sid].streamToken = null;
      }
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const normalizedSession = state.conversationSessions[sid];
      const streamStatus = normalizedSession.streamState.status || "idle";
      const canComplete = canTransitionStream(streamStatus, "completed") || streamStatus === "idle";
      if (!canComplete) return;
      if (sid === state.streamingSessionId || sid === state.chatSessionId) {
        state.isStreaming = false;
        state.streamingContent = "";
        state.streamingThought = "";
        state.streamingMessageId = null;
        state.streamingSessionId = null;
        state.isWaitingForAI = false;
        state.waitingSessionId = null;
      }
      if (existingIdx !== -1 && isCurrentChat) {
        const targetMsg = state.conversationMessages[existingIdx];
        if (targetMsg.role === "user") {
          existingIdx = -1;
        }
      }
      if (existingIdx !== -1 && isCurrentChat) {
        const targetMsg = state.conversationMessages[existingIdx];
        const activeIdx = targetMsg.metadata.activeVersionIndex ?? 0;
        const existingVersions = targetMsg.metadata.versions || [{ text: targetMsg.content, subsequentMessages: [] }];
        let updatedVersions;
        if (isRegeneration) {
          const alreadyExists = existingVersions.some((v) => v.text === finalContent);
          if (alreadyExists) {
            updatedVersions = existingVersions;
          } else {
            updatedVersions = [
              ...existingVersions,
              { text: finalContent, subsequentMessages: [] }
            ];
          }
        } else {
          updatedVersions = existingVersions.map(
            (v, i) => i === activeIdx ? { ...v, text: finalContent } : v
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
            hasVisualArtifact: !!effectiveCanvasType || targetMsg.metadata?.hasVisualArtifact,
            rendererType: effectiveCanvasType || targetMsg.metadata?.rendererType,
            artifactStatus: "completed",
            versions: updatedVersions.map(
              (v, i) => i === newActiveIdx ? { ...v, text: effectiveContent } : v
            ),
            activeVersionIndex: newActiveIdx,
            latencyMs: latencyMs || targetMsg.metadata.latencyMs,
            aborted: false,
            error: null
          }
        };
        const updatedId = state.conversationMessages[existingIdx].id;
        normalizedSession.messagesById[updatedId] = toUiMessage(state.conversationMessages[existingIdx]);
        if (!normalizedSession.orderedMessageIds.includes(updatedId)) {
          normalizedSession.orderedMessageIds.push(updatedId);
        }
      } else if (isCurrentChat) {
        const msg = {
          id: targetMsgId || generateId("assistant"),
          role: "assistant",
          content: effectiveContent,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          hasCanvas: !!effectiveCanvasType,
          canvasType: effectiveCanvasType,
          metadata: {
            edited: false,
            regenerated: false,
            feedback: null,
            aborted: false,
            error: null,
            thought: thoughtContent,
            sources,
            searchPerformed: state.isSearchPerformed,
            artifactId: effectiveArtifactId,
            artifactData: artifact,
            hasVisualArtifact: !!effectiveCanvasType,
            rendererType: effectiveCanvasType,
            artifactStatus: "completed",
            versions: [{ text: effectiveContent, subsequentMessages: [] }],
            activeVersionIndex: 0,
            latencyMs
          }
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
        status: "completed",
        latencyMs: latencyMs || normalizedSession.streamState.latencyMs || null,
        aborted: false
      };
    });
  },
  setCurrentCanvasType: (type) => set({ currentCanvasType: type }),
  // ─────────────────────────────────────────────────────────────────────────────
  // ABORT STREAMING — commits partial as versioned entry with aborted flag
  // ─────────────────────────────────────────────────────────────────────────────
  abortStreaming: (sessionId = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || "temp";
    const state = get();
    const sessionState = state.sessionStates[sid] || {};
    const partialContent = sessionState.content || state.streamingContent || "";
    const msgId = sessionState.messageId || state.streamingMessageId;
    set((state2) => {
      if (!state2.sessionStates[sid]) state2.sessionStates[sid] = {};
      state2.sessionStates[sid].aborted = true;
      state2.sessionStates[sid].isStreaming = false;
      state2.sessionStates[sid].isWaitingForAI = false;
      state2.sessionStates[sid].content = "";
      state2.sessionStates[sid].thought = "";
      state2.isStreaming = false;
      state2.streamingContent = "";
      state2.streamingMessageId = null;
      state2.streamingSessionId = null;
      state2.isWaitingForAI = false;
      state2.waitingSessionId = null;
      if (msgId && partialContent) {
        const idx = state2.conversationMessages.findIndex((m) => m.id === msgId);
        if (idx !== -1) {
          const targetMsg = state2.conversationMessages[idx];
          const existingVersions = targetMsg.metadata.versions || [{ text: targetMsg.content, subsequentMessages: [] }];
          const updatedVersions = [
            ...existingVersions,
            { text: partialContent, subsequentMessages: [], aborted: true }
          ];
          state2.conversationMessages[idx] = {
            ...targetMsg,
            content: partialContent,
            metadata: {
              ...targetMsg.metadata,
              versions: updatedVersions,
              activeVersionIndex: updatedVersions.length - 1,
              aborted: true
            }
          };
          const sSid = state2.activeConversationSessionId || sid;
          if (state2.conversationSessions[sSid]) {
            state2.conversationSessions[sSid].messagesById[msgId] = toUiMessage(state2.conversationMessages[idx]);
          }
        }
      }
      if (!state2.conversationSessions[sid]) state2.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state2.conversationSessions[sid].streamState.status || "idle";
      if (canTransitionStream(currentStatus, "aborted")) {
        state2.conversationSessions[sid].streamState = {
          ...state2.conversationSessions[sid].streamState,
          status: "aborted",
          aborted: true
        };
      }
    });
  },
  setWaitingForAI: (waiting, sessionId = null) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || "temp";
    set((state) => {
      state.isWaitingForAI = waiting;
      if (waiting) {
        state.waitingSessionId = sid;
        state.streamingMessageId = null;
      } else {
        state.waitingSessionId = null;
      }
      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].isWaitingForAI = waiting;
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || "idle";
      if (waiting && canTransitionStream(currentStatus, "requesting")) {
        state.conversationSessions[sid].streamState.status = "requesting";
        state.conversationSessions[sid].streamState.createdAt = Date.now();
      }
    });
  },
  setLastAIError: (error, sessionId = null) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || "temp";
    set((state) => {
      state.lastAIError = error;
      state.isWaitingForAI = false;
      state.isStreaming = false;
      state.streamingContent = "";
      state.streamingMessageId = null;
      if (state.sessionStates[sid]) {
        state.sessionStates[sid].isWaitingForAI = false;
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].content = "";
      }
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const currentStatus = state.conversationSessions[sid].streamState.status || "idle";
      if (canTransitionStream(currentStatus, "failed")) {
        state.conversationSessions[sid].streamState.status = "failed";
      }
      const msgs = state.conversationMessages;
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        const last = msgs[msgs.length - 1];
        state.conversationMessages[msgs.length - 1] = {
          ...last,
          metadata: { ...last.metadata, error: error?.message || "Generation failed" }
        };
      }
    });
  },
  // ─────────────────────────────────────────────────────────────────────────────
  // EDITING
  // ─────────────────────────────────────────────────────────────────────────────
  startEditingMessage: (messageId) => {
    const msg = get().conversationMessages.find((m) => m.id?.toString() === messageId?.toString() || m._id?.toString() === messageId?.toString());
    if (msg && msg.role === "user") {
      set({ editingMessageId: messageId, editingContent: msg.content, lastAIError: null });
    }
  },
  updateEditingContent: (content) => set({ editingContent: content }),
  cancelEditing: () => set({ editingMessageId: null, editingContent: "" }),
  applyEdit: (messageId, newContent) => {
    const { conversationMessages } = get();
    const idx = conversationMessages.findIndex((m) => m.id?.toString() === messageId?.toString() || m._id?.toString() === messageId?.toString());
    if (idx === -1) return conversationMessages;
    const targetMsg = conversationMessages[idx];
    const subsequentMessages = conversationMessages.slice(idx + 1);
    const currentVersions = targetMsg.metadata.versions || [{ text: targetMsg.content, subsequentMessages: [] }];
    const activeIdx = targetMsg.metadata.activeVersionIndex || 0;
    const updatedCurrentVersions = currentVersions.map(
      (v, i) => i === activeIdx ? { ...v, subsequentMessages } : v
    );
    const newVersions = [
      ...updatedCurrentVersions,
      { text: newContent, subsequentMessages: [] }
    ];
    const newActiveIdx = newVersions.length - 1;
    const updated = conversationMessages.slice(0, idx + 1);
    updated[idx] = {
      ...targetMsg,
      content: newContent,
      metadata: {
        ...targetMsg.metadata,
        edited: true,
        versions: newVersions,
        activeVersionIndex: newActiveIdx
      }
    };
    const sid = get().activeConversationSessionId || get().chatSessionId || get().sessionId || "temp";
    set((state) => {
      state.conversationMessages = updated;
      state.editingMessageId = null;
      state.editingContent = "";
      state.isWaitingForAI = true;
      resyncNormalizedSession(state, sid, updated);
    });
    return updated;
  },
  // ─────────────────────────────────────────────────────────────────────────────
  // VERSION SWITCHING — FIX: full resync of normalized store
  // ─────────────────────────────────────────────────────────────────────────────
  switchMessageVersion: (messageId, versionIndex) => {
    console.log(`[Store] switchMessageVersion: ${messageId} -> ${versionIndex}`);
    set((state) => {
      state.lastAIError = null;
      const idx = state.conversationMessages.findIndex((m) => m.id?.toString() === messageId?.toString() || m._id?.toString() === messageId?.toString());
      if (idx === -1) {
        return;
      }
      const targetMsg = state.conversationMessages[idx];
      if (!targetMsg.metadata?.versions || versionIndex < 0 || versionIndex >= targetMsg.metadata.versions.length) {
        state.isVersionSwitching = false;
        state.versionLockTimer = null;
        return;
      }
      const targetVersion = targetMsg.metadata.versions[versionIndex];
      const newContent = targetVersion.text || targetVersion.content || "";
      state.conversationMessages[idx] = {
        ...targetMsg,
        content: newContent,
        metadata: {
          ...targetMsg.metadata,
          activeVersionIndex: versionIndex
        }
      };
      const sid = state.activeConversationSessionId || state.chatSessionId || state.sessionId || "temp";
      resyncNormalizedSession(state, sid, state.conversationMessages);
    });
  },
  addMessageVersion: (messageId, text, metadata = {}) => {
    set((state) => {
      const idx = state.conversationMessages.findIndex((m2) => m2.id?.toString() === messageId?.toString() || m2._id?.toString() === messageId?.toString());
      if (idx === -1) return;
      const m = state.conversationMessages[idx];
      const versions = m.metadata.versions || [{ text: m.content, subsequentMessages: [] }];
      state.conversationMessages[idx] = {
        ...m,
        content: text,
        metadata: {
          ...m.metadata,
          ...metadata,
          versions: [...versions, { text, subsequentMessages: [] }],
          activeVersionIndex: versions.length
        }
      };
    });
  },
  deleteMessageById: (messageId) => {
    set((state) => {
      state.conversationMessages = state.conversationMessages.filter((m) => m.id?.toString() !== messageId?.toString() && m._id?.toString() !== messageId?.toString());
    });
  },
  removeLastAssistantMessage: () => {
    const { conversationMessages } = get();
    if (conversationMessages.length === 0) return conversationMessages;
    const last = conversationMessages[conversationMessages.length - 1];
    if (last.role !== "assistant") return conversationMessages;
    const updated = conversationMessages.slice(0, -1);
    set({ conversationMessages: updated, isWaitingForAI: true });
    return updated;
  },
  setConversationMessages: (messages) => {
    set((state) => {
      const sid = state.chatSessionId || state.sessionId || state.activeConversationSessionId || "temp";
      const existingMessages = state.conversationMessages || [];
      const normalized = messages.map((m) => {
        const mId = (m.id || m._id)?.toString();
        const fallbackContent = m.content || "";
        const existing = existingMessages.find((em) => em.id?.toString() === mId);
        const resolvedActiveIdx = existing ? existing.metadata?.activeVersionIndex ?? 0 : m.metadata?.activeVersionIndex || 0;
        const resolvedVersions = existing ? existing.metadata?.versions ?? [{ text: fallbackContent, subsequentMessages: [] }] : m.metadata?.versions || [{ text: fallbackContent, subsequentMessages: [] }];
        const resolvedContent = resolvedVersions[resolvedActiveIdx] ? resolvedVersions[resolvedActiveIdx].text || resolvedVersions[resolvedActiveIdx].content : fallbackContent;
        return {
          id: mId || generateId(m.role),
          role: m.role,
          content: resolvedContent,
          timestamp: m.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
          hasCanvas: m.hasCanvas || false,
          canvasType: m.canvasType || null,
          canvasSnapshot: m.canvasSnapshot || null,
          metadata: {
            edited: false,
            regenerated: false,
            feedback: null,
            aborted: false,
            error: null,
            ...m.metadata || {},
            versions: resolvedVersions,
            activeVersionIndex: resolvedActiveIdx
          }
        };
      });
      state.activeConversationSessionId = sid;
      state.conversationMessages = normalized;
      resyncNormalizedSession(state, sid, normalized);
    });
  },
  clearConversation: () => {
    set({
      conversationMessages: [],
      conversationSessions: {},
      sessionStates: {},
      activeConversationSessionId: null,
      isStreaming: false,
      streamingContent: "",
      streamingThought: "",
      streamingMessageId: null,
      streamingSessionId: null,
      streamTokenCounter: 0,
      isWaitingForAI: false,
      waitingSessionId: null,
      lastAIError: null,
      conversationTopic: null,
      conversationIntent: null,
      editingMessageId: null,
      editingContent: "",
      conversationSources: [],
      lastStreamSources: []
    });
  },
  setMessageFeedback: (messageId, feedback) => {
    set((state) => {
      const idx = state.conversationMessages.findIndex((m) => m.id === messageId);
      if (idx !== -1) state.conversationMessages[idx].metadata.feedback = feedback;
    });
  },
  updateMessageMetadata: (messageId, metadata) => {
    set((state) => {
      const idx = state.conversationMessages.findIndex((m) => m.id === messageId);
      if (idx !== -1) Object.assign(state.conversationMessages[idx].metadata, metadata);
    });
  },
  setConversationTopic: (topic) => set({ conversationTopic: topic }),
  setConversationIntent: (intent) => set({ conversationIntent: intent }),
  syncMessageIds: (userMessageId, assistantMessageId, oldUserMessageId, oldAssistantMessageId) => {
    set((state) => {
      const msgs = [...state.conversationMessages];
      let changed = false;
      if (oldUserMessageId && userMessageId) {
        const uIdx = msgs.findIndex((m) => m.id?.toString() === oldUserMessageId?.toString() || m._id?.toString() === oldUserMessageId?.toString());
        if (uIdx !== -1) {
          msgs[uIdx] = { ...msgs[uIdx], id: userMessageId };
          changed = true;
        }
      } else if (!oldUserMessageId && userMessageId && msgs.length >= 2) {
        msgs[msgs.length - 2] = { ...msgs[msgs.length - 2], id: userMessageId };
        changed = true;
      }
      if (oldAssistantMessageId && assistantMessageId) {
        const aIdx = msgs.findIndex((m) => m.id?.toString() === oldAssistantMessageId?.toString() || m._id?.toString() === oldAssistantMessageId?.toString());
        if (aIdx !== -1) {
          msgs[aIdx] = { ...msgs[aIdx], id: assistantMessageId };
          changed = true;
        }
        if (state.streamingMessageId === oldAssistantMessageId) state.streamingMessageId = assistantMessageId;
        Object.keys(state.sessionStates).forEach((sid) => {
          if (state.sessionStates[sid].messageId === oldAssistantMessageId) {
            state.sessionStates[sid].messageId = assistantMessageId;
          }
        });
      } else if (!oldAssistantMessageId && assistantMessageId && msgs.length >= 1) {
        const oldAssistantId = msgs[msgs.length - 1].id;
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], id: assistantMessageId };
        changed = true;
        if (state.streamingMessageId === oldAssistantId) state.streamingMessageId = assistantMessageId;
        Object.keys(state.sessionStates).forEach((sid) => {
          if (state.sessionStates[sid].messageId === oldAssistantId) {
            state.sessionStates[sid].messageId = assistantMessageId;
          }
        });
      }
      if (changed) {
        const sid = state.activeConversationSessionId || state.chatSessionId || state.sessionId || "temp";
        resyncNormalizedSession(state, sid, msgs);
        state.conversationMessages = msgs;
      }
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
    const sid = sessionId || get().chatSessionId || get().sessionId || "temp";
    if (get().isVersionSwitching) {
      import.meta.env.DEV && console.log("[Store] Postponing setActiveConversationSession: Version lock active");
      return;
    }
    set((state) => {
      state.activeConversationSessionId = sid;
      if (!state.conversationSessions[sid]) state.conversationSessions[sid] = buildNormalizedSession();
      const session = state.conversationSessions[sid];
      state.conversationMessages = session.orderedMessageIds.map((id) => session.messagesById[id]).filter(Boolean);
    });
  },
  promoteSessionId: (oldId, newId) => {
    set((state) => {
      if (oldId && newId && oldId !== newId && state.conversationSessions[oldId]) {
        state.conversationSessions[newId] = state.conversationSessions[oldId];
        delete state.conversationSessions[oldId];
        if (state.activeConversationSessionId === oldId) {
          state.activeConversationSessionId = newId;
        }
      }
    });
  },
  getConversationMessagesForSession: (sessionId) => {
    const sid = sessionId || get().activeConversationSessionId || get().chatSessionId || get().sessionId || "temp";
    const session = get().conversationSessions[sid];
    if (!session) return [];
    return session.orderedMessageIds.map((id) => session.messagesById[id]).filter(Boolean);
  },
  setMessageMetadata: (messageId, metadata) => {
    set((state) => {
      const idx = state.conversationMessages.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        state.conversationMessages[idx].metadata = {
          ...state.conversationMessages[idx].metadata,
          ...metadata
        };
      }
    });
  },
  restoreMessageContent: (messageId, originalContent) => {
    set((state) => {
      const idx = state.conversationMessages.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        const msg = state.conversationMessages[idx];
        msg.content = originalContent;
        msg.metadata.error = null;
        msg.metadata.aborted = false;
        if (msg.metadata.versions && msg.metadata.versions.length > 1) {
          const lastVersion = msg.metadata.versions[msg.metadata.versions.length - 1];
          if (lastVersion.text.includes("\u26A0\uFE0F") || lastVersion.text === "") {
            msg.metadata.versions.pop();
            msg.metadata.activeVersionIndex = msg.metadata.versions.length - 1;
          }
        }
      }
    });
  },
  /**
   * PERSISTENCE FIX: Restore conversation messages from the server after page refresh.
   * Called by useSessionSync when it detects a persisted chatSessionId with empty conversationMessages.
   */
  restoreSessionFromServer: async (sessionId) => {
    if (!sessionId) return;
    const currentMessages = get().conversationMessages;
    if (currentMessages && currentMessages.length > 0) return;
    set({ isMessagesLoading: true, lastAIError: null });
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId);
    if (!isMongoId) return;
    try {
      const { default: API } = await import("../../services/api");
      const response = await API.get(`/api/sessions/${sessionId}`);
      if (response.data) {
        const { messages, canvasState, canvasSteps, currentTopic, topic, title } = response.data;
        if (messages && messages.length > 0) {
          import.meta.env.DEV && console.log(`[Store] \u267B\uFE0F Restored ${messages.length} messages from server for session ${sessionId}`);
          get().setConversationMessages(messages);
        }
        if (canvasState && canvasState.length > 0) {
          import.meta.env.DEV && console.log(`[Store] \u267B\uFE0F Restored canvas state for session ${sessionId}`);
          get().setCanvasSnapshot({
            canvasObjects: canvasState,
            canvasSteps: canvasSteps || [],
            totalSteps: canvasSteps?.length || 0,
            title: currentTopic || topic || title
          });
        }
        if (currentTopic || topic || title) {
          set({ conversationTopic: currentTopic || topic || title });
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[Store] Failed to restore session from server:", err?.message || err);
      }
      set({ lastAIError: { message: "Failed to restore conversation history. Please check your connection.", type: "RESTORE_ERROR" } });
    } finally {
      set({ isMessagesLoading: false });
    }
  }
});
export {
  createConversationSlice
};
