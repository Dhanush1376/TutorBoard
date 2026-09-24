import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bypass Zustand persist middleware to prevent storage event listener leaks in test environment
vi.mock('zustand/middleware', () => {
  return {
    persist: (config) => config,
    createJSONStorage: vi.fn()
  };
});

import useTutorStore from '../../tutorStore';

describe('conversationSlice state machine', () => {
const initialState = useTutorStore.getState();

  beforeEach(() => {
    // Reset the store to initial state (including methods)
    useTutorStore.setState(initialState, true);
    
    // Explicitly reset the dynamic data fields we manipulate
    useTutorStore.setState({
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
      sessionStates: {},
      chatSessionId: null,
      sessionId: null,
      _ephemeralSid: 'local-test-id' // Stable ID for tests
    });
  });

  describe('Message Creation', () => {
    it('should add a user message and initialize session state', () => {
      const store = useTutorStore.getState();
      const { messageId } = store.addUserMessage('Hello AI');

      const state = useTutorStore.getState();
      const sid = state.getSid();
      
      expect(state.conversationMessages.length).toBe(1);
      expect(state.conversationMessages[0].content).toBe('Hello AI');
      expect(state.conversationMessages[0].role).toBe('user');
      
      // Verification of isWaitingForAI transition
      expect(state.isWaitingForAI).toBe(true);
      expect(state.waitingSessionId).toBe(sid);
      
      // Normalized session sync
      const session = state.conversationSessions[sid];
      expect(session.orderedMessageIds).toContain(messageId);
      expect(session.messagesById[messageId].content).toBe('Hello AI');
    });

    it('should add an assistant message and clear waiting state', () => {
      const store = useTutorStore.getState();
      store.addUserMessage('Hello AI');
      
      const msgId = store.addAssistantMessage('Hello Human');
      const state = useTutorStore.getState();
      
      expect(state.conversationMessages.length).toBe(2);
      expect(state.conversationMessages[1].content).toBe('Hello Human');
      expect(state.conversationMessages[1].role).toBe('assistant');
      expect(state.conversationMessages[1].id).toBe(msgId);
      
      // Clears waiting/streaming states
      expect(state.isWaitingForAI).toBe(false);
      expect(state.isStreaming).toBe(false);
    });
  });

  describe('Stream Lifecycle and Transitions', () => {
    it('should transition from idle to requesting to streaming to completed', () => {
      const store = useTutorStore.getState();
      store.addUserMessage('Test');
      const sid = useTutorStore.getState().getSid();

      // requesting transition (via prepareRegeneration or just startStreaming)
      store.startStreaming('msg-123', sid, 'token-1');
      
      let state = useTutorStore.getState();
      expect(state.isStreaming).toBe(true);
      expect(state.isWaitingForAI).toBe(false);
      expect(state.streamingMessageId).toBe('msg-123');
      
      const sessionStream = state.conversationSessions[sid].streamState;
      expect(sessionStream.status).toBe('streaming');
      expect(sessionStream.streamId).toBe('token-1');

      // Append chunk
      store.appendStreamChunk('Hello', sid, 'token-1');
      state = useTutorStore.getState();
      expect(state.streamingContent).toBe('Hello');

      // Finish streaming
      store.finishStreaming('Hello World', sid, '', [], null, null, null, 'token-1', false);
      state = useTutorStore.getState();
      
      expect(state.isStreaming).toBe(false);
      expect(state.streamingContent).toBe('');
      expect(state.conversationSessions[sid].streamState.status).toBe('completed');
      expect(state.conversationMessages.slice(-1)[0].content).toBe('Hello World');
    });

    it('should abort streaming and save partial content as aborted version', () => {
      const store = useTutorStore.getState();
      store.addUserMessage('Test');
      const sid = useTutorStore.getState().getSid();

      store.startStreaming('msg-abort', sid, 'token-2');
      store.appendStreamChunk('Partial data', sid, 'token-2');
      
      // Need a placeholder message to be aborted
      store.addAssistantMessage('', 'msg-abort');
      store.appendStreamChunk(' more', sid, 'token-2');

      store.abortStreaming(sid);
      
      const state = useTutorStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.conversationSessions[sid].streamState.status).toBe('aborted');
      
      const abortedMsg = state.conversationMessages.find(m => m.id === 'msg-abort');
      expect(abortedMsg).toBeDefined();
      // Should save the partial content and set aborted metadata
      expect(abortedMsg.metadata.aborted).toBe(true);
      expect(abortedMsg.metadata.versions.slice(-1)[0].aborted).toBe(true);
    });

    it('should ignore chunks with mismatched stream tokens', () => {
      const store = useTutorStore.getState();
      store.addUserMessage('Test');
      const sid = useTutorStore.getState().getSid();

      store.startStreaming('msg-123', sid, 'valid-token');
      store.appendStreamChunk('Valid', sid, 'valid-token');
      store.appendStreamChunk('Invalid', sid, 'stale-token'); // Should be ignored
      
      const state = useTutorStore.getState();
      expect(state.streamingContent).toBe('Valid');
    });
  });

  describe('ID Mechanisms', () => {
    it('should resolve session ID hierarchy correctly', () => {
      // activeConversationSessionId > chatSessionId > sessionId > _ephemeralSid
      useTutorStore.setState({ _ephemeralSid: 'local-123' });
      expect(useTutorStore.getState().getSid()).toBe('local-123');

      useTutorStore.setState({ sessionId: 'mongo-1' });
      expect(useTutorStore.getState().getSid()).toBe('mongo-1');

      useTutorStore.setState({ chatSessionId: 'mongo-2' });
      expect(useTutorStore.getState().getSid()).toBe('mongo-2');

      useTutorStore.setState({ activeConversationSessionId: 'mongo-3' });
      expect(useTutorStore.getState().getSid()).toBe('mongo-3');
    });
  });

  describe('Versioning and Editing', () => {
    it('should switch between message versions', () => {
      const store = useTutorStore.getState();
      store.addUserMessage('Test');
      const msgId = store.addAssistantMessage('V1');
      
      store.addMessageVersion(msgId, 'V2');
      
      let state = useTutorStore.getState();
      let targetMsg = state.conversationMessages.find(m => m.id === msgId);
      expect(targetMsg.content).toBe('V2');
      expect(targetMsg.metadata.activeVersionIndex).toBe(1);

      // Switch back to V1
      store.switchMessageVersion(msgId, 0);
      state = useTutorStore.getState();
      targetMsg = state.conversationMessages.find(m => m.id === msgId);
      
      expect(targetMsg.content).toBe('V1');
      expect(targetMsg.metadata.activeVersionIndex).toBe(0);
    });
    
    it('finishStreaming should add version if isRegeneration is true', () => {
      const store = useTutorStore.getState();
      store.addUserMessage('Test');
      const msgId = store.addAssistantMessage('V1');
      const sid = store.getSid();
      
      store.startStreaming(msgId, sid, 'regen-token');
      store.finishStreaming('V2', sid, '', [], null, null, null, 'regen-token', true); // isRegeneration = true
      
      const state = useTutorStore.getState();
      const targetMsg = state.conversationMessages.find(m => m.id === msgId);
      
      expect(targetMsg.content).toBe('V2');
      expect(targetMsg.metadata.regenerated).toBe(true);
      expect(targetMsg.metadata.versions.length).toBe(2);
      expect(targetMsg.metadata.activeVersionIndex).toBe(1);
    });
  });
});
