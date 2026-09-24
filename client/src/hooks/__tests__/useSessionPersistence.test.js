import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSessionPersistence } from '../useSessionPersistence';
import * as api from '../../services/api';
import useTutorStore from '../../store/tutorStore';

vi.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    post: vi.fn(),
    put: vi.fn()
  }
}));

// Bypass Zustand persist middleware to prevent storage event listener leaks in test environment
vi.mock('zustand/middleware', () => {
  return {
    persist: (config) => config,
    createJSONStorage: vi.fn()
  };
});

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth()
}));

// Capture the real initial state ONCE so we can restore it after each test.
// This prevents Zustand persist subscriptions and leaked state from keeping
// the vitest process alive.
const initialStoreState = useTutorStore.getState();

describe('useSessionPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state first (restores real methods like setChatSessionId)
    useTutorStore.setState(initialStoreState, true);
    // Then overlay test-specific data fields — do NOT replace real store methods with vi.fn() stubs
    useTutorStore.setState({
      conversationMessages: [{ id: 'm1', content: 'test message', role: 'user' }],
      canvasObjects: [],
      isStreaming: false,
      streamingMessageId: null,
    });
  });

  afterEach(() => {
    // Unmount any rendered hooks to prevent leaked useEffect subscriptions
    cleanup();
    // Restore store to pristine initial state
    useTutorStore.setState(initialStoreState, true);
  });

  it('bypasses API for guests (local-only fallback)', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null });
    
    const { result } = renderHook(() => useSessionPersistence({ activeChatId: 'local-temp-id', activeSession: null, isAuthenticated: false, user: null, token: null, generateCleanTitle: vi.fn() }));
    
    await act(async () => {
      await result.current.saveCurrentSession([{ content: 'test', role: 'user' }], 'local-temp-id');
    });

    expect(api.default.post).not.toHaveBeenCalled();
    expect(api.default.put).not.toHaveBeenCalled();
  });

  it('promotes local temp ID to MongoDB ID on first authenticated save', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: 'u1' } });
    
    // Simulate API returning a real mongo ID
    vi.mocked(api.default.post).mockResolvedValue({ status: 201, data: { _id: 'mongo-id-123' } });
    
    // Set store state with a local id — use real store methods, not vi.fn() stubs
    useTutorStore.setState({ sessionId: 'temp-local-id' });

    const { result } = renderHook(() => useSessionPersistence({ activeChatId: 'temp-local-id', activeSession: null, isAuthenticated: true, user: { id: 'u1' }, token: 'fake', generateCleanTitle: vi.fn() }));
    
    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveCurrentSession([{ content: 'test', role: 'user' }], 'temp-local-id');
    });

    // Should call API
    expect(api.default.post).toHaveBeenCalled();
    
    // The hook calls setSessionId(saved._id) on successful promotion (line 139),
    // which atomically updates sessionId to the permanent Mongo ID.
    // Note: chatSessionId is intentionally reset by setSessionId's manifest
    // restoration logic (sessionSlice.js line 228), so we verify via sessionId
    // and the hook's return value — both canonical proofs of successful promotion.
    const state = useTutorStore.getState();
    expect(state.sessionId).toBe('mongo-id-123');
    expect(saveResult).toBe('mongo-id-123');
  });

  it('uses update API when session already has a Mongo ID', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { id: 'u1' } });
    
    vi.mocked(api.default.post).mockResolvedValue({ status: 200, data: { success: true } });
    useTutorStore.setState({ sessionId: 'mongo-id-456' });

    const { result } = renderHook(() => useSessionPersistence({ activeChatId: 'mongo-id-456', activeSession: null, isAuthenticated: true, user: { id: 'u1' }, token: 'fake', generateCleanTitle: vi.fn() }));
    
    await act(async () => {
      await result.current.saveCurrentSession([{ content: 'test update', role: 'user' }], 'mongo-id-456');
    });

    expect(api.default.put).not.toHaveBeenCalled();
    expect(api.default.post).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ sessionId: 'mongo-id-456' }));
  });
});
