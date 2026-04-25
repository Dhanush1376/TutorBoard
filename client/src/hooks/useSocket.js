/**
 * useSocket — React hook for managing Socket.IO connection
 * 
 * Handles connection lifecycle, event listeners, and reconnection.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

import { BASE_URL as SOCKET_URL } from '../services/api';

// Socket Singleton instance
let globalSocket = null;

export function useSocket(isAuthReady = true) {
  const [isConnected, setIsConnected] = useState(globalSocket?.connected || false);
  const [connectionError, setConnectionError] = useState(null);
  const listenersRef = useRef(new Map());

  // Handle global connection state
  useEffect(() => {
    if (!isAuthReady) return;

    // Socket initialization is now handled exclusively by syncSocketAuth() 
    // to ensure the connection always starts with the correct authentication state.
    if (!globalSocket) return;

    const socket = globalSocket;
    
    // BUG FIX #37 & Persistence Hardening:
    // Handle Auth Refresh immediately on login/logout
    const checkToken = () => {
      const currentToken = localStorage.getItem('tb-token') || 'guest';
      if (socket.auth?.token !== currentToken) {
        console.log(`[Socket] Auth transition detected (${socket.auth?.token || 'none'} -> ${currentToken}). Reconnecting...`);
        socket.auth = { token: currentToken };
        // Clean disconnect/connect cycle to ensure fresh session
        if (socket.connected) {
          socket.disconnect().connect();
        } else {
          socket.connect();
        }
      }
    };

    // Immediate check on hook mount
    checkToken();

    // Listen for storage changes (e.g., login in another tab or same tab state update)
    window.addEventListener('storage', checkToken);

    const onConnect = () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);

      // SEC-18: Broadcast connection event to AuthContext to refresh API keys/prefs
      window.dispatchEvent(new CustomEvent('tb-refresh-api-prefs'));
    };

    const onDisconnect = (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    };

    const onError = (error) => {
      console.error('[Socket] Connection error:', error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    };

    const onRetry = () => {
      console.log('[Socket] Refreshing auth token for reconnect attempt...');
      const freshToken = localStorage.getItem('tb-token') || 'guest';
      socket.auth = { token: freshToken };
    };

    // BUG FIX #37: Check token immediately and on every mount
    checkToken();

    // BUG FIX #37: Periodic interval removed to reduce network load (BUG-25).
    // Token refresh is now handled on reconnection events.

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('reconnect_attempt', onRetry);

    // Initial state sync
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      // BUG FIX #38: Clean up listeners on unmount
      window.removeEventListener('storage', checkToken);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('reconnect_attempt', onRetry);
    };
  }, [isAuthReady]);

  // Emit an event (relies on socket.io's native offline buffering)
  const emit = useCallback((event, data) => {
    if (globalSocket) {
      if (!globalSocket.connected) {
        console.log(`[Socket] Buffering emit '${event}' until connected`);
      }
      globalSocket.emit(event, data);
    } else {
      console.warn(`[Socket] Cannot emit '${event}' — socket instance not initialized`);
    }
  }, []);

  // BUG FIX #38: Listen to an event with proper listener tracking and cleanup
  // Components MUST call the returned cleanup function in useEffect() on unmount
  const on = useCallback((event, callback) => {
    if (!globalSocket) return () => {};

    globalSocket.on(event, callback);

    // Track listener for cleanup and leak detection
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, []);
    }
    const listeners = listenersRef.current.get(event);
    listeners.push(callback);
    
    // Warn if too many listeners accumulate (likely unclean unmounts)
    if (listeners.length > 10) {
      console.warn(`[Socket] Event "${event}" has ${listeners.length} listeners (possible listener leak from unmounted components)`);
    }

    // Return cleanup function
    return () => {
      globalSocket?.off(event, callback);
      const listeningList = listenersRef.current.get(event) || [];
      const idx = listeningList.indexOf(callback);
      if (idx > -1) listeningList.splice(idx, 1);
    };
  }, []);

  // Remove a specific listener
  const off = useCallback((event, callback) => {
    globalSocket?.off(event, callback);
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

/**
 * disconnectSocket — Static utility to destroy the global socket instance.
 */
export function disconnectSocket() {
  if (globalSocket) {
    console.log('[Socket] Disconnecting and destroying global instance...');
    globalSocket.disconnect();
    globalSocket = null;
  }
}

/**
 * syncSocketAuth — Explicitly updates the global socket token and reconnects.
 * Call this immediately after login/logout to ensure zero-delay auth transition.
 */
export function syncSocketAuth(newToken = 'guest') {
  if (!globalSocket) {
    console.log(`[Socket] Initializing explicitly via syncSocketAuth...`);
    globalSocket = io(`${SOCKET_URL}/teaching`, {
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
    console.log(`[Socket] Explicit auth sync: Updating token...`);
    globalSocket.auth = { token: newToken };
    if (globalSocket.connected) {
      globalSocket.disconnect().connect();
    } else {
      globalSocket.connect();
    }
  }
}

export default useSocket;
