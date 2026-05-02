/**
 * ConversationSlice — LLM-style chat state management
 */

const generateId = (prefix = 'msg') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const createConversationSlice = (set, get) => ({
  conversationMessages: [],
  isStreaming: false,
  streamingContent: '',
  streamingThought: '', // Internal reasoning/planning
  streamingMessageId: null,
  streamingSessionId: null, // Track which session is streaming
  isWaitingForAI: false,
  waitingSessionId: null, // Track which session is waiting for AI
  lastAIError: null,
  conversationTopic: null,
  conversationMode: 'basic',
  conversationIntent: null,
  editingMessageId: null,
  editingContent: '',
  conversationSources: [],   // Web search sources for citation display
  lastStreamSources: [],     // Sources from the last streaming response

  addUserMessage: (content) => {
    const id = generateId('user');
    const msg = {
      id, role: 'user', content,
      timestamp: new Date().toISOString(),
      metadata: { 
        edited: false, regenerated: false, feedback: null,
        versions: [{ text: content, subsequentMessages: [] }], activeVersionIndex: 0 
      },
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
      isWaitingForAI: true, 
      waitingSessionId: get().chatSessionId || get().sessionId || 'temp', 
      lastAIError: null,
    }));
    const { conversationTopic, conversationMessages } = get();
    if (!conversationTopic && conversationMessages.length <= 1) {
      set({ conversationTopic: content.substring(0, 60).replace(/[?\n]/g, '').trim() });
    }
    return id;
  },

  addAssistantMessage: (content, id = null) => {
    const msgId = id || generateId('assistant');
    const msg = {
      id: msgId, role: 'assistant', content,
      timestamp: new Date().toISOString(),
      metadata: { 
        edited: false, regenerated: false, feedback: null,
        versions: [{ text: content, subsequentMessages: [] }], activeVersionIndex: 0
      },
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
      isWaitingForAI: false, isStreaming: false,
      waitingSessionId: null, streamingSessionId: null,
      streamingContent: '', streamingMessageId: null,
    }));
    return msgId;
  },

  startStreaming: (messageId) => {
    set({ 
      isStreaming: true, 
      isWaitingForAI: false, 
      waitingSessionId: null,
      streamingSessionId: get().chatSessionId || get().sessionId || 'temp',
      streamingContent: '', 
      streamingThought: '',
      streamingMessageId: messageId 
    });
  },

  updateStreamingContent: (content) => set({ streamingContent: content }),

  // Efficient append for real SSE streaming (avoids full string replacement)
  appendStreamChunk: (chunk) => set((state) => ({
    streamingContent: state.streamingContent + chunk
  })),

  appendStreamThought: (thought) => set((state) => ({
    streamingThought: state.streamingThought + thought
  })),

  // Set web search sources for citation display
  setSources: (sources) => set({ conversationSources: sources, lastStreamSources: sources }),

  // Clear sources
  clearSources: () => set({ conversationSources: [], lastStreamSources: [] }),

  finishStreaming: (finalContent, thoughtContent = '', sources = []) => {
    const { streamingMessageId } = get();
    const msg = {
      id: streamingMessageId || generateId('assistant'),
      role: 'assistant', content: finalContent,
      timestamp: new Date().toISOString(),
      metadata: { 
        edited: false, regenerated: false, feedback: null,
        thought: thoughtContent,
        sources: sources,
        versions: [{ text: finalContent, subsequentMessages: [] }], activeVersionIndex: 0
      },
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
      isStreaming: false, streamingContent: '', streamingThought: '', streamingMessageId: null, streamingSessionId: null,
      isWaitingForAI: false, waitingSessionId: null,
      conversationSources: [],
    }));
  },

  abortStreaming: () => {
    const { streamingContent, streamingMessageId } = get();
    if (streamingContent.trim()) {
      const msg = {
        id: streamingMessageId || generateId('assistant'),
        role: 'assistant', content: streamingContent + '\n\n*[Response stopped]*',
        timestamp: new Date().toISOString(),
        metadata: { 
          edited: false, regenerated: false, feedback: null,
          versions: [{ text: streamingContent + '\n\n*[Response stopped]*', subsequentMessages: [] }], activeVersionIndex: 0
        },
      };
      set((state) => ({
        conversationMessages: [...state.conversationMessages, msg],
        isStreaming: false, streamingContent: '', streamingMessageId: null, isWaitingForAI: false,
      }));
    } else {
      set({ isStreaming: false, streamingContent: '', streamingMessageId: null, isWaitingForAI: false });
    }
  },

  setWaitingForAI: (waiting) => set({ isWaitingForAI: waiting }),
  setLastAIError: (error) => set({ lastAIError: error, isWaitingForAI: false }),

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
    
    // Save current branch to the current active version before switching
    const currentSubsequent = conversationMessages.slice(idx + 1);
    const activeIdx = targetMsg.metadata.activeVersionIndex || 0;
    
    const updatedVersions = targetMsg.metadata.versions.map((v, i) => 
      i === activeIdx ? { ...v, subsequentMessages: currentSubsequent } : v
    );
    
    // Now switch to the requested version
    const targetVersion = updatedVersions[versionIndex];
    
    const updatedMsg = {
      ...targetMsg,
      content: targetVersion.text,
      metadata: { ...targetMsg.metadata, versions: updatedVersions, activeVersionIndex: versionIndex }
    };
    
    // Reconstruct the conversation array: messages before this + this message + saved subsequent messages
    const newConversation = [
      ...conversationMessages.slice(0, idx),
      updatedMsg,
      ...(targetVersion.subsequentMessages || [])
    ];
    
    set({ conversationMessages: newConversation });
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
});
