import { useState, useCallback } from 'react';
import { API_URL } from '../components/settings/SettingsShared';
import { useAuth } from '../context/AuthContext';

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
      const response = await fetch(`${API_URL}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query, options })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'AI Router failed');
      }

      const data = await response.json();
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
