/**
 * ConversationSlice — LLM-style chat state management
 */

const generateId = (prefix = 'msg') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const createConversationSlice = (set, get) => ({
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
  conversationMode: 'basic',
  conversationIntent: null,
  editingMessageId: null,
  editingContent: '',
  conversationSources: [],
  lastStreamSources: [],
  isSearchPerformed: false,
  currentCanvasType: null,   // Track canvas_type for the active stream
  sessionStates: {},         // { [sessionId]: { isStreaming, isWaitingForAI, content, thought, messageId, sources, searchPerformed } }

  addUserMessage: (content) => {
    const userId = generateId('user');
    const assistantId = generateId('assistant');
    const msg = {
      id: userId, role: 'user', content,
      timestamp: new Date().toISOString(),
      metadata: { 
        edited: false, regenerated: false, feedback: null,
        versions: [{ text: content, subsequentMessages: [] }], activeVersionIndex: 0 
      },
    };
    const sid = get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.conversationMessages = [...state.conversationMessages, msg];
      state.isWaitingForAI = true; 
      state.waitingSessionId = sid;
      state.lastAIError = null;
      
      // Update session-specific state
      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].isWaitingForAI = true;
      state.sessionStates[sid].waitingSessionId = sid;
    });
    const { conversationTopic, conversationMessages } = get();
    if (!conversationTopic && conversationMessages.length <= 1) {
      set({ conversationTopic: content.substring(0, 60).replace(/[?\n]/g, '').trim() });
    }
    return { userId, assistantId };
  },

  addAssistantMessage: (content, id = null, extraMetadata = {}) => {
    const msgId = id || generateId('assistant');
    const msg = {
      id: msgId, role: 'assistant', content,
      timestamp: new Date().toISOString(),
      metadata: { 
        edited: false, regenerated: false, feedback: null,
        versions: [{ text: content, subsequentMessages: [] }], activeVersionIndex: 0,
        ...extraMetadata
      },
      ...extraMetadata // Spread to root as well for hasCanvas etc
    };
    set((state) => {
      state.conversationMessages = [...state.conversationMessages, msg];
      state.isWaitingForAI = false;
      state.isStreaming = false;
      state.waitingSessionId = null;
      state.streamingSessionId = null;
      state.streamingContent = '';
      state.streamingMessageId = null;

      // Clear all active session states (legacy cleanup)
      Object.keys(state.sessionStates).forEach(sid => {
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].isWaitingForAI = false;
      });
    });
    return msgId;
  },

  startStreaming: (messageId, sessionId = null) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.isStreaming = true;
      state.isWaitingForAI = false;
      state.waitingSessionId = null;
      state.streamingSessionId = sid;
      state.streamingContent = '';
      state.streamingThought = '';
      state.streamingMessageId = messageId;
      state.isSearchPerformed = false;

      // Initialize session-specific state
      state.sessionStates[sid] = {
        isStreaming: true,
        isWaitingForAI: false,
        content: '',
        thought: '',
        messageId: messageId,
        sources: [],
        searchPerformed: false
      };
    });
  },

  prepareRegeneration: (messageId) => {
    set((state) => {
      const messages = state.conversationMessages.map(m => {
        if (m.id === messageId) {
          const versions = m.metadata?.versions || [{ text: m.content, subsequentMessages: [] }];
          const newVersion = { text: '', subsequentMessages: [] };
          return {
            ...m,
            content: '', // Clear content for the new version
            metadata: {
              ...m.metadata,
              versions: [...versions, newVersion],
              activeVersionIndex: versions.length,
              regenerated: true
            }
          };
        }
        return m;
      });
      return { conversationMessages: messages };
    });
  },

  updateStreamingContent: (content, sessionId = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    set((state) => {
      if (state.sessionStates[sid]) state.sessionStates[sid].content = content;
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingContent = content;
      }
    });
  },

  // Efficient append for real SSE streaming (avoids full string replacement)
  appendStreamChunk: (chunk, sessionId = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    set((state) => {
      if (!state.sessionStates[sid]) state.sessionStates[sid] = { content: '' };
      state.sessionStates[sid].content = (state.sessionStates[sid].content || '') + chunk;
      
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingContent = (state.streamingContent || '') + chunk;
      }
    });
  },

  appendStreamThought: (thought, sessionId = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    set((state) => {
      if (!state.sessionStates[sid]) state.sessionStates[sid] = { thought: '' };
      state.sessionStates[sid].thought = (state.sessionStates[sid].thought || '') + thought;
      
      if (sid === state.chatSessionId || sid === state.streamingSessionId) {
        state.streamingThought = (state.streamingThought || '') + thought;
      }
    });
  },

  // Set web search sources for citation display
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
    });
  },

  // Clear sources
  clearSources: () => set({ conversationSources: [], lastStreamSources: [] }),

  finishStreaming: (finalContent, sessionId = null, thoughtContent = '', sources = [], artifactId = null, canvasType = null, latencyMs = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    const { conversationMessages, chatSessionId, sessionId: activeSessionId } = get();
    const currentViewId = chatSessionId || activeSessionId;
    
    // Check if this session is the one currently visible
    const isCurrentChat = sid === currentViewId || sid === chatSessionId || sid === activeSessionId;
    
    const targetMsgId = get().sessionStates[sid]?.messageId || get().streamingMessageId;
    const existingIdx = conversationMessages.findIndex(m => m.id === targetMsgId);
    
    set((state) => {
      // 1. Update session-specific map
      if (state.sessionStates[sid]) {
        state.sessionStates[sid].isStreaming = false;
        state.sessionStates[sid].isWaitingForAI = false;
        state.sessionStates[sid].content = '';
        state.sessionStates[sid].thought = '';
      }

      // 2. Update global legacy state IF this was the active session
      if (sid === state.streamingSessionId || sid === state.chatSessionId) {
        state.isStreaming = false;
        state.streamingContent = '';
        state.streamingThought = '';
        state.streamingMessageId = null;
        state.streamingSessionId = null;
        state.isWaitingForAI = false;
        state.waitingSessionId = null;
      }

      // 3. Update conversation messages if visible
      if (existingIdx !== -1 && isCurrentChat) {
        const targetMsg = state.conversationMessages[existingIdx];
        const activeIdx = targetMsg.metadata.activeVersionIndex || 0;
        const updatedVersions = (targetMsg.metadata.versions || []).map((v, i) => 
          i === activeIdx ? { ...v, text: finalContent } : v
        );

        state.conversationMessages[existingIdx] = {
          ...targetMsg,
          content: finalContent,
          hasCanvas: !!canvasType || targetMsg.hasCanvas,
          canvasType: canvasType || targetMsg.canvasType,
          metadata: {
            ...targetMsg.metadata,
            regenerated: true,
            thought: thoughtContent || targetMsg.metadata.thought,
            sources: sources.length > 0 ? sources : targetMsg.metadata.sources,
            searchPerformed: state.isSearchPerformed || targetMsg.metadata.searchPerformed,
            artifactId: artifactId || targetMsg.metadata.artifactId,
            versions: updatedVersions,
            activeVersionIndex: activeIdx,
            latencyMs: latencyMs || targetMsg.metadata.latencyMs
          }
        };
      } else if (isCurrentChat) {
        // APPEND NEW (Standard message case)
        const msg = {
          id: targetMsgId || generateId('assistant'),
          role: 'assistant', content: finalContent,
          timestamp: new Date().toISOString(),
          hasCanvas: !!canvasType,
          canvasType: canvasType,
          metadata: { 
            edited: false, regenerated: false, feedback: null,
            thought: thoughtContent,
            sources: sources,
            searchPerformed: state.isSearchPerformed,
            artifactId: artifactId,
            versions: [{ text: finalContent, subsequentMessages: [] }], activeVersionIndex: 0,
            latencyMs: latencyMs
          },
        };
        state.conversationMessages = [...state.conversationMessages, msg];
        state.conversationSources = [];
        state.isSearchPerformed = false;
        state.currentCanvasType = null;
      }
    });
  },

  setCurrentCanvasType: (type) => set({ currentCanvasType: type }),

  abortStreaming: (sessionId = null) => {
    const sid = sessionId || get().streamingSessionId || get().chatSessionId || 'temp';
    const state = get();
    const sessionState = state.sessionStates[sid] || {};
    const content = sessionState.content || state.streamingContent || '';
    const msgId = sessionState.messageId || state.streamingMessageId;

    if (content.trim()) {
      const msg = {
        id: msgId || generateId('assistant'),
        role: 'assistant', content: content + '\n\n*[Response stopped]*',
        timestamp: new Date().toISOString(),
        metadata: { 
          edited: false, regenerated: false, feedback: null,
          versions: [{ text: content + '\n\n*[Response stopped]*', subsequentMessages: [] }], activeVersionIndex: 0
        },
      };
      set((state) => {
        const update = {
          conversationMessages: [...state.conversationMessages, msg],
          isStreaming: false, 
          streamingContent: '', 
          streamingMessageId: null, 
          streamingSessionId: null,
          isWaitingForAI: false,
          waitingSessionId: null
        };
        if (state.sessionStates[sid]) {
          state.sessionStates[sid].isStreaming = false;
          state.sessionStates[sid].isWaitingForAI = false;
        }
        return update;
      });
    } else {
      set((state) => {
        if (state.sessionStates[sid]) {
          state.sessionStates[sid].isStreaming = false;
          state.sessionStates[sid].isWaitingForAI = false;
        }
        return { 
          isStreaming: false, 
          streamingContent: '', 
          streamingMessageId: null, 
          streamingSessionId: null,
          isWaitingForAI: false,
          waitingSessionId: null
        };
      });
    }
  },

  setWaitingForAI: (waiting, sessionId = null) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.isWaitingForAI = waiting;
      if (waiting) state.waitingSessionId = sid;
      else state.waitingSessionId = null;

      if (!state.sessionStates[sid]) state.sessionStates[sid] = {};
      state.sessionStates[sid].isWaitingForAI = waiting;
    });
  },
  setLastAIError: (error, sessionId = null) => {
    const sid = sessionId || get().chatSessionId || get().sessionId || 'temp';
    set((state) => {
      state.lastAIError = error;
      state.isWaitingForAI = false;
      if (state.sessionStates[sid]) state.sessionStates[sid].isWaitingForAI = false;
    });
  },

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
    
    // Ensure the current active version has the subsequent messages saved
    const currentVersions = targetMsg.metadata.versions || [{ text: targetMsg.content, subsequentMessages: [] }];
    const activeIdx = targetMsg.metadata.activeVersionIndex || 0;
    
    // Save current branch to the active version BEFORE creating the new one
    const updatedCurrentVersions = currentVersions.map((v, i) => 
      i === activeIdx ? { ...v, subsequentMessages } : v
    );
    
    // Append the new edit as a new version
    const newVersions = [
      ...updatedCurrentVersions,
      { text: newContent, subsequentMessages: [] }
    ];
    
    const newActiveIdx = newVersions.length - 1;
    
    // The new conversation stops at this message
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
    set({ conversationMessages: updated, editingMessageId: null, editingContent: '', isWaitingForAI: true });
    return updated;
  },

  switchMessageVersion: (messageId, versionIndex) => {
    const { conversationMessages } = get();
    const idx = conversationMessages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    
    const targetMsg = conversationMessages[idx];
    if (!targetMsg.metadata.versions) return;
    
    // 1. Save CURRENT branch state to the currently active version before switching away
    const currentSubsequent = conversationMessages.slice(idx + 1);
    const activeIdx = targetMsg.metadata.activeVersionIndex || 0;
    
    const updatedVersions = targetMsg.metadata.versions.map((v, i) => 
      i === activeIdx ? { ...v, subsequentMessages: currentSubsequent } : v
    );
    
    // 2. Switch to the target version and RESTORE its branch
    const targetVersion = updatedVersions[versionIndex];
    
    const updatedMsg = {
      ...targetMsg,
      content: targetVersion.text,
      metadata: { ...targetMsg.metadata, versions: updatedVersions, activeVersionIndex: versionIndex }
    };
    
    // Reconstruct the conversation array: [messages before] + [updated message] + [restored branch]
    const newConversation = [
      ...conversationMessages.slice(0, idx),
      updatedMsg,
      ...(targetVersion.subsequentMessages || [])
    ];
    
    set({ conversationMessages: newConversation });
  },

  addMessageVersion: (messageId, text, metadata = {}) => {
    set((state) => ({
      conversationMessages: state.conversationMessages.map((m) => {
        if (m.id !== messageId) return m;
        const versions = m.metadata.versions || [{ text: m.content, subsequentMessages: [] }];
        return {
          ...m,
          content: text,
          metadata: {
            ...m.metadata,
            ...metadata,
            versions: [...versions, { text, subsequentMessages: [] }],
            activeVersionIndex: versions.length
          }
        };
      })
    }));
  },

  deleteMessageById: (messageId) => {
    set((state) => ({ conversationMessages: state.conversationMessages.filter((m) => m.id !== messageId) }));
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
    set({
      conversationMessages: messages.map((m) => {
        const content = m.content || '';
        return {
          id: m.id || m._id?.toString() || generateId(m.role),
          role: m.role, content,
          timestamp: m.timestamp || new Date().toISOString(),
          metadata: m.metadata || { 
            edited: false, regenerated: false, feedback: null,
            versions: [{ text: content, subsequentMessages: [] }], activeVersionIndex: 0
          },
        };
      }),
    });
  },

  clearConversation: () => {
    set({
      conversationMessages: [], isStreaming: false, streamingContent: '', streamingMessageId: null,
      isWaitingForAI: false, lastAIError: null, conversationTopic: null,
      conversationMode: 'basic', conversationIntent: null, editingMessageId: null, editingContent: '',
      conversationSources: [], lastStreamSources: [],
    });
  },

  setMessageFeedback: (messageId, feedback) => {
    set((state) => ({
      conversationMessages: state.conversationMessages.map((m) =>
        m.id === messageId ? { ...m, metadata: { ...m.metadata, feedback } } : m
      ),
    }));
  },

  setConversationTopic: (topic) => set({ conversationTopic: topic }),
  setConversationMode: (mode) => set({ conversationMode: mode }),
  setConversationIntent: (intent) => set({ conversationIntent: intent }),

  syncMessageIds: (userMessageId, assistantMessageId) => {
    set((state) => {
      const msgs = [...state.conversationMessages];
      if (msgs.length >= 2) {
        const oldAssistantId = msgs[msgs.length - 1].id;
        if (userMessageId) msgs[msgs.length - 2] = { ...msgs[msgs.length - 2], id: userMessageId };
        if (assistantMessageId) {
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], id: assistantMessageId };
          
          // CRITICAL: Update streaming reference if this message is currently being streamed
          if (state.streamingMessageId === oldAssistantId) {
            state.streamingMessageId = assistantMessageId;
          }
          
          // Also update session-specific maps
          Object.keys(state.sessionStates).forEach(sid => {
            if (state.sessionStates[sid].messageId === oldAssistantId) {
              state.sessionStates[sid].messageId = assistantMessageId;
            }
          });
        }
      }
      return { conversationMessages: msgs };
    });
  },

  migrateSessionState: (oldId, newId) => {
    if (!oldId || !newId || oldId === newId) return;
    
    set((state) => {
      // 1. Copy session-specific state
      if (state.sessionStates[oldId]) {
        state.sessionStates[newId] = {
          ...state.sessionStates[oldId],
          // Maintain the reference to the same state object if possible, or deep copy
        };
        // We keep the old one for a moment to prevent race conditions during render
        // but mark it as migrated or just let it be pruned later
      }

      // 2. Update global pointers
      if (state.streamingSessionId === oldId) state.streamingSessionId = newId;
      if (state.waitingSessionId === oldId) state.waitingSessionId = newId;
      
      console.log(`[Store] 🔄 Migrated session state from ${oldId} to ${newId}`);
    });
  },
});
