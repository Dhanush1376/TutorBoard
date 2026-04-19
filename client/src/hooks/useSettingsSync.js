import { useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useSettingsSync = () => {
  const { token, user } = useAuth();
  const timeoutRef = useRef(null);

  const syncSettings = useCallback((category, newValues, topLevel = {}) => {
    if (!user || user.isGuest) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_URL}/api/user/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ 
            settings: { [category]: newValues },
            ...topLevel
          })
        });
      } catch (err) {
        console.error('Settings sync failed:', err, category, newValues);
      }
    }, 1000);
  }, [user, token]);

  return syncSettings;
};
