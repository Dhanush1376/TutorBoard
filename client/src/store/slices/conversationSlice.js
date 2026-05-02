/**
 * ConversationSlice — LLM-style chat state management
 */

const generateId = (prefix = 'msg') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const createConversationSlice = (set, get) => ({
  conversationMessages: [],
  isStreaming: false,
  streamingContent: '',
  streamingMessageId: null,
  isWaitingForAI: false,
  lastAIError: null,
  conversationTopic: null,
  conversationMode: 'basic',
  conversationIntent: null,
  editingMessageId: null,
  editingContent: '',

  addUserMessage: (content) => {
    const id = generateId('user');
    const msg = {
      id, role: 'user', content,
      timestamp: new Date().toISOString(),
      metadata: { edited: false, regenerated: false, feedback: null },
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
      isWaitingForAI: true, lastAIError: null,
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
      metadata: { edited: false, regenerated: false, feedback: null },
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
      isWaitingForAI: false, isStreaming: false,
      streamingContent: '', streamingMessageId: null,
    }));
    return msgId;
  },

  startStreaming: (messageId) => {
    set({ isStreaming: true, isWaitingForAI: false, streamingContent: '', streamingMessageId: messageId });
  },

  updateStreamingContent: (content) => set({ streamingContent: content }),

  finishStreaming: (finalContent) => {
    const { streamingMessageId } = get();
    const msg = {
      id: streamingMessageId || generateId('assistant'),
      role: 'assistant', content: finalContent,
      timestamp: new Date().toISOString(),
      metadata: { edited: false, regenerated: false, feedback: null },
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
      isStreaming: false, streamingContent: '', streamingMessageId: null, isWaitingForAI: false,
    }));
  },

  abortStreaming: () => {
    const { streamingContent, streamingMessageId } = get();
    if (streamingContent.trim()) {
      const msg = {
        id: streamingMessageId || generateId('assistant'),
        role: 'assistant', content: streamingContent + '\n\n*[Response stopped]*',
        timestamp: new Date().toISOString(),
        metadata: { edited: false, regenerated: false, feedback: null },
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
    const updated = conversationMessages.slice(0, idx + 1);
    updated[idx] = { ...updated[idx], content: newContent, metadata: { ...updated[idx].metadata, edited: true } };
    set({ conversationMessages: updated, editingMessageId: null, editingContent: '', isWaitingForAI: true });
    return updated;
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
      conversationMessages: messages.map((m) => ({
        id: m.id || m._id?.toString() || generateId(m.role),
        role: m.role, content: m.content,
        timestamp: m.timestamp || new Date().toISOString(),
        metadata: m.metadata || { edited: false, regenerated: false, feedback: null },
      })),
    });
  },

  clearConversation: () => {
    set({
      conversationMessages: [], isStreaming: false, streamingContent: '', streamingMessageId: null,
      isWaitingForAI: false, lastAIError: null, conversationTopic: null,
      conversationMode: 'basic', conversationIntent: null, editingMessageId: null, editingContent: '',
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
