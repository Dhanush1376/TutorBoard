import { useState, useCallback } from 'react';
import { API_URL } from '../components/settings/SettingsShared';
import { useAuth } from '../hooks/useAuth';
import API from '../services/api';

/**
 * Hook to interact with the new modular AI Router
 */
export function useAiRouter() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const askAi = useCallback(async (query, options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await API.post('/api/ai/ask', { query, options });

      if (response.status !== 200) {
        throw new Error(response.data?.message || 'AI Router failed');
      }

      const data = response.data;
      setResult(data);
      return data;

    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  return { askAi, isLoading, error, result };
}
