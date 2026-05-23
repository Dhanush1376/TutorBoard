import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import User from '../models/User.js';
import LearnerProfile from '../models/LearnerProfile.js';
import { createTeachingMachine, STATES } from '../engine/core/teachingMachine.js';
import sessionStore from '../engine/core/sessionStore.js';
import tokenStore from '../utils/auth/tokenStore.js';
import { checkSocketRate, cleanupSocket, getGuestUsageCount, GUEST_MONTHLY_LIMIT } from '../middleware/rateLimiter.js';
import { getOrCreateRequestId, createTrackedSessionId } from '../middleware/requestIdMiddleware.js';
import { getRateKey } from './utils.js';

// Handlers
import { registerSessionHandlers } from './handlers/session.js';
import { registerDoubtHandlers } from './handlers/doubt.js';
import { registerNavigationHandlers } from './handlers/navigation.js';
import { registerArtifactHandlers } from './handlers/artifact.js';

export function setupTeachingSocket(io) {
  const teachingIO = io.of('/teaching');

  // ─── Auth Guard & Connection Limiter ────────────────────────────────────
  teachingIO.use(async (socket, next) => {
    try {
      const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
      
      // Parse cookies from handshake headers
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = cookies['tb-access-token'] || socket.handshake.auth?.token;
      
      // SEC-GUARD: Only accept null/undefined/empty as guest. Reject explicit strings.
      if (!token || token === '') {
        socket.user = { id: 'guest', isGuest: true };
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      
      if (await tokenStore.isTokenRevoked(decoded.jti)) {
        return next(new Error('Authentication error: Token has been revoked'));
      }

      const userId = decoded.id || decoded._id;
      // Add a 5s timeout to avoid hanging the connection if MongoDB is slow
      const user = await Promise.race([
        User.findById(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 5000))
      ]);
      
      if (!user) {
        return next(new Error('Authentication error: User account no longer exists or timeout'));
      }
      
      // SEC-16: Reject tokens issued before password change
      if (user.passwordChangedAt) {
        const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (decoded.iat < changedTimestamp) {
          return next(new Error('Authentication error: Password has been changed since this session started'));
        }
      }

      socket.user = {
        ...decoded,
        id: userId
      };
      
      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // ─── Global Rate Limiter & Token Expiry Check ───────────────────────────
  teachingIO.use(async (socket, next) => {
    socket.use(async ([event, ...args], nextEvent) => {
      if (['disconnect', 'error'].includes(event)) return nextEvent();
      
      // BUG-04: Proactive Token Expiry Check
      if (socket.user && !socket.user.isGuest && socket.user.exp) {
        const now = Math.floor(Date.now() / 1000);
        if (now > socket.user.exp) {
          console.warn(`[Auth] Token expired mid-session for user ${socket.user.id}`);
          socket.emit('auth:token-expired', { reason: 'SESSION_EXPIRED' });
          return; // Block event execution
        }

        // SEC-03: Proactive Revocation Check
        if (socket.user.jti && await tokenStore.isTokenRevoked(socket.user.jti)) {
          console.warn(`[Auth] Token revoked mid-session for user ${socket.user.id}`);
          socket.emit('auth:token-revoked', { reason: 'SESSION_REVOKED' });
          socket.disconnect(); 
          return;
        }
      }

      const isAllowed = await checkSocketRate(getRateKey(socket));
      if (!isAllowed) {
        socket.emit('error:ratelimit', { 
          message: 'Too many requests. Please slow down.',
          event 
        });
        return;
      }
      nextEvent();
    });
    next();
  });

  teachingIO.on('connection', async (socket) => {
    const requestId = getOrCreateRequestId(socket);
    const sessionId = createTrackedSessionId(socket, requestId);

    // Initialize Session
    let session = null;
    try {
      session = await sessionStore.create(sessionId, { 
        socketId: socket.id,
        userId: socket.user?.id || socket.user?._id || null
      });
      
      if (socket.user?.isGuest) {
        const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
        const count = await getGuestUsageCount(ip);
        socket.emit('guest:status', { count, limit: GUEST_MONTHLY_LIMIT, warning: count >= 40 });
      }
    } catch (err) {
      socket.emit('session:error', { error: 'SESSION_LIMIT_REACHED' });
      return socket.disconnect();
    }

    // Initialize State Machine with restored state if available
    const machine = createTeachingMachine(sessionId, async (transition) => {
      socket.emit('teaching:state', {
        state:     transition.to,
        from:      transition.from,
        event:     transition.event,
        payload:   transition.payload,
        timestamp: transition.timestamp,
      });
      
      // Persist machine state to Redis for horizontal recovery
      await sessionStore.update(sessionId, { 
        state: transition.to,
        machineState: {
          state: transition.to,
          isPaused: machine.paused,
          history: machine.getHistory().slice(-20) // Cap history size for serialization
        }
      });
    }, session?.machineState || {});

    // ─── Register Modular Handlers ──────────────────────────────────────────
    registerSessionHandlers(socket, machine, sessionId, requestId);
    registerDoubtHandlers(socket, machine, sessionId);
    registerNavigationHandlers(socket, machine, sessionId);
    registerArtifactHandlers(socket, machine, sessionId, requestId);

    // ─── Cleanup on Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      if (socket.user && !socket.user.isGuest) {
        try {
          await sessionStore.update(sessionId, { state: machine.state });
          await sessionStore.persistProfile(sessionId);
        } catch (err) {
          console.error(`[WS] Failed to persist session on disconnect:`, err.message);
        }
      }

      await sessionStore.destroy(sessionId);
      cleanupSocket(getRateKey(socket));
    });

    // Send initial state (restored or IDLE)
    socket.emit('teaching:state', {
      state:     machine.state,
      from:      null,
      event:     'INIT',
      payload:   { sessionId, isRestored: !!session?.machineState },
      timestamp: Date.now(),
    });
  });

  return teachingIO;
}
