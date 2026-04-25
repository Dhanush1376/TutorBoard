/**
 * TeachingSocket v5.0 — Modular Handler Architecture
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { createTeachingMachine, STATES, EVENTS } from '../engine/core/teachingMachine.js';
import sessionStore from '../engine/core/sessionStore.js';
import tokenStore from '../utils/auth/tokenStore.js';
import { checkSocketRate, cleanupSocket, getGuestUsageCount, GUEST_MONTHLY_LIMIT } from '../middleware/rateLimiter.js';
import { getOrCreateRequestId, createTrackedSessionId } from '../middleware/requestIdMiddleware.js';
import { getRateKey } from './utils.js';

// Handlers
import { registerSessionHandlers } from './handlers/session.js';
import { registerDoubtHandlers } from './handlers/doubt.js';
import { registerNavigationHandlers } from './handlers/navigation.js';

export function setupTeachingSocket(io) {
  const teachingIO = io.of('/teaching');

  // ─── Auth Guard & Connection Limiter ────────────────────────────────────
  teachingIO.use(async (socket, next) => {
    try {
      const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
      const token = socket.handshake.auth?.token;
      
      // Allow guests to connect for Trial Mode
      if (token === 'guest' || !token) {
        console.log(`[WS] Guest connection accepted from ${ip}`);
        socket.user = { id: 'guest', isGuest: true };
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // DIAGNOSTIC: Log successful decode and payload structure
      console.log(`[WS:Auth] ✅ Token verified. Payload:`, { 
        id: decoded.id, 
        email: decoded.email, 
        jti: decoded.jti,
        hasId: !!decoded.id,
        hasUnderlineId: !!decoded._id 
      });

      // CRITICAL: Check if token has been revoked (e.g., after logout)
      if (await tokenStore.isTokenRevoked(decoded.jti)) {
        console.warn(`[WS:Auth] 🚨 Token REVOKED for ${ip}: ${decoded.jti}`);
        return next(new Error('Authentication error: Token has been revoked'));
      }

      // Standardize identity for the session
      const userId = decoded.id || decoded._id;
      
      // SEC-15: Ensure the user still exists in the database
      const user = await User.findById(userId);
      if (!user) {
        console.warn(`[WS:Auth] 🚨 User NOT FOUND in DB for ${ip}: ${userId}`);
        return next(new Error('Authentication error: User account no longer exists'));
      }

      socket.user = {
        ...decoded,
        id: userId
      };
      
      console.log(`[WS:Auth] User assigned to socket: ${socket.user.id}`);
      next();
    } catch (err) {
      console.error(`[WS:Auth] ❌ Failure [Token: ${socket.handshake.auth?.token?.substring(0, 15)}...]:`, err.message);
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // ─── Global Rate Limiter Middleware ─────────────────────────────────────
  teachingIO.use(async (socket, next) => {
    socket.use(async ([event, ...args], nextEvent) => {
      // Internal events like disconnect are skipped
      if (['disconnect', 'error'].includes(event)) return nextEvent();
      
      const isAllowed = await checkSocketRate(getRateKey(socket));
      if (!isAllowed) {
        console.warn(`[WS:RateLimit] 🚨 ABUSER BLOCKED: ${getRateKey(socket)} on event: ${event}`);
        socket.emit('error:ratelimit', { 
          message: 'Too many requests. Please slow down.',
          event 
        });
        // Block the event by NOT calling nextEvent()
        return;
      }
      nextEvent();
    });
    next();
  });

  teachingIO.on('connection', async (socket) => {
    const requestId = getOrCreateRequestId(socket);
    const sessionId = createTrackedSessionId(socket.id, requestId);
    console.log(`[${requestId}] [WS] Client connected: ${socket.id} → Session: ${sessionId}`);

    // Initialize Session
    try {
      await sessionStore.create(sessionId, socket.id);
      
      // Emit Guest Trial Status
      if (socket.user?.isGuest) {
        const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
        const count = await getGuestUsageCount(ip);
        socket.emit('guest:status', { count, limit: GUEST_MONTHLY_LIMIT, warning: count >= 40 });
      }
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
      
      // BUG-02: Ensure profile is persisted even if student just closes the tab
      if (socket.user && !socket.user.isGuest) {
        try {
          await sessionStore.persistProfile(sessionId);
        } catch (err) {
          console.error(`[WS] Persistence failed on disconnect for ${socket.user.id}:`, err.message);
        }
      }

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