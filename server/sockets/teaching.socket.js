/**
 * TeachingSocket v5.0 — Modular Handler Architecture
 */

import jwt from 'jsonwebtoken';
import { createTeachingMachine, STATES, EVENTS } from '../engine/core/teachingMachine.js';
import sessionStore from '../engine/core/sessionStore.js';
import { checkSocketRate, cleanupSocket } from '../middleware/rateLimiter.js';
import { getOrCreateRequestId, createTrackedSessionId } from '../middleware/requestIdMiddleware.js';
import { getRateKey } from './utils.js';

// Handlers
import { registerSessionHandlers } from './handlers/session.js';
import { registerDoubtHandlers } from './handlers/doubt.js';
import { registerNavigationHandlers } from './handlers/navigation.js';

export function setupTeachingSocket(io) {
  const teachingIO = io.of('/teaching');

  // ─── Auth Guard & Connection Limiter ────────────────────────────────────
  teachingIO.use((socket, next) => {
    try {
      const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
      const token = socket.handshake.auth?.token;
      
      if (!token || token === 'guest') {
        return next(new Error('Authentication error: Invalid or missing token'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      console.error('[WS] Auth Error:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  teachingIO.on('connection', async (socket) => {
    const requestId = getOrCreateRequestId(socket);
    const sessionId = createTrackedSessionId(socket.id, requestId);
    console.log(`[${requestId}] [WS] Client connected: ${socket.id} → Session: ${sessionId}`);

    // Initialize Session
    try {
      await sessionStore.create(sessionId, socket.id);
    } catch (err) {
      console.error(`[WS] Failed to create session: ${err.message}`);
      socket.emit('session:error', { error: 'SESSION_LIMIT_REACHED' });
      return socket.disconnect();
    }

    // Initialize State Machine
    const machine = createTeachingMachine(sessionId, async (transition) => {
      socket.emit('teaching:state', {
        state:     transition.to,
        from:      transition.from,
        event:     transition.event,
        payload:   transition.payload,
        timestamp: transition.timestamp,
      });
      await sessionStore.update(sessionId, { state: transition.to });
    });

    // ─── Register Modular Handlers ──────────────────────────────────────────
    registerSessionHandlers(socket, machine, sessionId, requestId);
    registerDoubtHandlers(socket, machine, sessionId);
    registerNavigationHandlers(socket, machine, sessionId);

    // ─── Cleanup on Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
      await sessionStore.destroy(sessionId);
      cleanupSocket(getRateKey(socket));
    });

    // Send initial state
    socket.emit('teaching:state', {
      state:     STATES.IDLE,
      from:      null,
      event:     'INIT',
      payload:   { sessionId },
      timestamp: Date.now(),
    });
  });

  console.log('[WS] Teaching socket handlers registered on /teaching namespace');
  return teachingIO;
}