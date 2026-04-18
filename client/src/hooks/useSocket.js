/**
 * useSocket — React hook for managing Socket.IO connection
 * 
 * Handles connection lifecycle, event listeners, and reconnection.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Socket Singleton instance
let globalSocket = null;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(globalSocket?.connected || false);
  const [connectionError, setConnectionError] = useState(null);
  const listenersRef = useRef(new Map());

  // Handle global connection state
  useEffect(() => {
    if (!globalSocket) {
      console.log('[Socket] Initializing singleton connection...');
      const token = localStorage.getItem('tb-token');
      globalSocket = io(`${SOCKET_URL}/teaching`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        auth: { token },
      });
    }

    const socket = globalSocket;

    // Handle Auth Refresh (Bug 37 Fix)
    const checkToken = () => {
      const currentToken = localStorage.getItem('tb-token');
      // If socket initialized with no token but we have one now, or vice versa
      if (socket.auth?.token !== currentToken) {
        console.log('[Socket] Auth token mismatch. Reconnecting with fresh credentials...');
        socket.auth = { token: currentToken };
        socket.disconnect().connect();
      }
    };

    const onConnect = () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
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
      const freshToken = localStorage.getItem('tb-token');
      socket.auth = { token: freshToken };
    };

    // BUG FIX #37: Check token immediately and on every mount
    checkToken();

    // BUG FIX #37: Set up periodic token refresh (every 30 seconds) to catch auth changes
    const tokenCheckInterval = setInterval(checkToken, 30000);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('reconnect_attempt', onRetry);

    // Initial state sync
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      // BUG FIX #38: Clean up listeners and interval on unmount
      clearInterval(tokenCheckInterval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('reconnect_attempt', onRetry);
    };
  }, []);

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
 * Call this during logout to prevent session bleed between users.
 */
export function disconnectSocket() {
  if (globalSocket) {
    console.log('[Socket] Disconnecting and destroying global instance...');
    globalSocket.disconnect();
    globalSocket = null;
  }
}

export default useSocket;
