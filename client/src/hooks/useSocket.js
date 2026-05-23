/**
 * useSocket — React hook for managing Socket.IO connection
 * 
 * Production Architecture Fixes:
 * 1. Zero Zustand global re-render subscriptions to eliminate HMR invalidation loops.
 * 2. Strict automatic event cleanup preventing duplicate subscriptions and listener leaks.
 * 3. Stable singleton references resistant to Fast Refresh collisions.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

import { SOCKET_BASE_URL as SOCKET_URL } from '../services/api';
import useTutorStore from '../store/tutorStore';

// Socket Singleton instance
let globalSocket = null;

export function useSocket(isAuthReady = true) {
  const [isConnected, setIsConnected] = useState(() => globalSocket?.connected || false);
  const [connectionError, setConnectionError] = useState(null);
  const listenersRef = useRef(new Map());

  // Handle global connection state without triggering reactive re-renders on the whole store
  useEffect(() => {
    if (!isAuthReady) return;
    
    if (!globalSocket) {
      import.meta.env.DEV && console.log('[Socket] Initializing lazily on hook mount...');
      syncSocketAuth(localStorage.getItem('tb-auth-token') || 'guest');
    }

    const socket = globalSocket;

    const onConnect = () => {
      import.meta.env.DEV && console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
      
      // Update store state immutably via getState() to avoid component subscription re-renders
      const store = useTutorStore.getState();
      if (typeof store.setConnected === 'function') store.setConnected(true);
      if (typeof store.setConnectionError === 'function') store.setConnectionError(null);

      window.dispatchEvent(new CustomEvent('tb-refresh-api-prefs'));
    };

    const onDisconnect = (reason) => {
      import.meta.env.DEV && console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
      const store = useTutorStore.getState();
      if (typeof store.setConnected === 'function') store.setConnected(false);
    };

    const onError = (error) => {
      console.error('[Socket] Connection error:', error.message);
      const msg = error.message || "Connection failed";
      setConnectionError(msg);
      setIsConnected(false);
      const store = useTutorStore.getState();
      if (typeof store.setConnectionError === 'function') store.setConnectionError(msg);
      if (typeof store.setConnected === 'function') store.setConnected(false);
    };

    const onRetry = () => {
      import.meta.env.DEV && console.log('[Socket] Reconnect attempt...');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('reconnect_attempt', onRetry);

    const handleReset = () => {
      import.meta.env.DEV && console.log('[Socket] Global reset event detected. Refreshing local state.');
      setIsConnected(false);
      setConnectionError('Session reset');
    };
    window.addEventListener('tb-socket-reset', handleReset);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('reconnect_attempt', onRetry);
      window.removeEventListener('tb-socket-reset', handleReset);

      // Perform strict local listener cleanup to prevent memory leaks and duplicate triggers
      if (listenersRef.current) {
        for (const [event, callbacks] of listenersRef.current) {
          for (const cb of callbacks) {
            socket.off(event, cb);
          }
        }
        listenersRef.current.clear();
      }
    };
  }, [isAuthReady]);

  const emit = useCallback((event, data) => {
    if (globalSocket) {
      if (!globalSocket.connected) {
        import.meta.env.DEV && console.log(`[Socket] Buffering emit '${event}' until connected`);
      }
      globalSocket.emit(event, data);
    } else {
      console.warn(`[Socket] Cannot emit '${event}' — socket instance not initialized`);
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (!globalSocket) return () => {};

    // SEC-42: Dev warning for excessive listeners on same event
    if (import.meta.env.DEV) {
      const existing = listenersRef.current.get(event) || [];
      if (existing.length > 5) {
        console.warn(`[Socket] ⚠️ Component registered >5 listeners for event '${event}'. Possible memory leak in caller.`);
      }
    }

    globalSocket.on(event, callback);

    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, []);
    }
    const listeners = listenersRef.current.get(event);
    listeners.push(callback);

    return () => {
      if (globalSocket) {
        globalSocket.off(event, callback);
      }
      if (listenersRef.current) {
        const listeningList = listenersRef.current.get(event) || [];
        const idx = listeningList.indexOf(callback);
        if (idx > -1) listeningList.splice(idx, 1);
      }
    };
  }, []);

  const off = useCallback((event, callback) => {
    if (globalSocket) {
      globalSocket.off(event, callback);
    }
  }, []);

  return {
    socket: globalSocket,
    isConnected,
    connectionError,
    emit,
    on,
    off,
  };
}

export function disconnectSocket() {
  if (globalSocket) {
    import.meta.env.DEV && console.log('[Socket] Disconnecting and destroying global instance...');
    globalSocket.disconnect();
    globalSocket = null;
    
    // SEC-30: Trigger global reset so useSocket hooks in all components refresh
    window.dispatchEvent(new CustomEvent('tb-socket-reset'));
  }
}

export function syncSocketAuth(newToken = 'guest') {
  const targetPath = `${SOCKET_URL || ''}/teaching`;
  
  if (!globalSocket) {
    import.meta.env.DEV && console.log(`[Socket] Initializing explicitly via syncSocketAuth...`);
    globalSocket = io(targetPath, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      auth: { token: newToken },
      withCredentials: true,
    });
    return;
  }

  if (globalSocket.auth?.token !== newToken) {
    import.meta.env.DEV && console.log(`[Socket] Explicit auth sync: Updating token...`);
    globalSocket.auth = { token: newToken };
    if (globalSocket.connected) {
      globalSocket.disconnect().connect();
    } else {
      globalSocket.connect();
    }
  }
}

export default useSocket;
