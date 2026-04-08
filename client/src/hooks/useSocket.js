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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('reconnect_attempt', onRetry);

    // Initial state sync
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
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

  // Listen to an event (auto-cleanup on unmount)
  const on = useCallback((event, callback) => {
    if (!globalSocket) return () => {};

    globalSocket.on(event, callback);

    // Track listener for cleanup
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, []);
    }
    listenersRef.current.get(event).push(callback);

    // Return cleanup function
    return () => {
      globalSocket?.off(event, callback);
      const listeners = listenersRef.current.get(event) || [];
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
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

export default useSocket;
