import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSessionHistory } from '../useSessionHistory';
import API from '../../services/api';
import useTutorStore from '../../store/tutorStore';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn()
  }
}));

// Bypass Zustand persist middleware to prevent storage event listener leaks in test environment
vi.mock('zustand/middleware', () => {
  return {
    persist: (config) => config,
    createJSONStorage: vi.fn()
  };
});

describe('useSessionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = useTutorStore.getState();
    if (store.setSessionHistory) store.setSessionHistory([]);
    if (store.setSessionPagination) store.setSessionPagination({
      currentPage: 1,
      totalPages: 1,
      totalSessions: 0,
      hasMore: false
    });
    if (store.resetSession) store.resetSession();
  });

  afterEach(() => {
    cleanup(); // Unmount any rendered hooks to prevent leaked listeners
  });

  it('fetches cloud sessions correctly', async () => {
    const mockData = { 
      sessions: [{ _id: '1', title: 'Test 1', messages: [{role: 'user', content: 'hi'}] }], 
      pagination: { page: 1, pages: 1, total: 1, hasMore: false } 
    };
    
    vi.mocked(API.get).mockResolvedValue({ status: 200, data: mockData });

    const { result } = renderHook(() => useSessionHistory({ isAuthenticated: true, isGuest: false, token: 'fake', user: { _id: '1' } }));
    
    await waitFor(() => expect(result.current.historyFetched).toBe(true));
    
    // Should call API with correct URL
    expect(API.get).toHaveBeenCalledWith('/api/sessions?page=1&limit=15', expect.any(Object));
  });

  it('hydrates active session correctly on load', async () => {
    const { result } = renderHook(() => useSessionHistory({ isAuthenticated: true, isGuest: false, token: 'fake', user: { _id: '1' }, authLoading: false }));

    await waitFor(() => expect(result.current.historyFetched).toBe(true));
  });
});
