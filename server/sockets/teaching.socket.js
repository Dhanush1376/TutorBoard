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

export function setupTeachingSocket(io) {
  const teachingIO = io.of('/teaching');

  // ─── Auth Guard & Connection Limiter ────────────────────────────────────
  teachingIO.use(async (socket, next) => {
    try {
      const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
      
      // Parse cookies from handshake headers
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = cookies['tb-token'] || socket.handshake.auth?.token;
      
      if (token === 'guest' || !token) {
        socket.user = { id: 'guest', isGuest: true };
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
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

      socket.user = {
        ...decoded,
        id: userId
      };
      
      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // ─── Global Rate Limiter Middleware ─────────────────────────────────────
  teachingIO.use(async (socket, next) => {
    socket.use(async ([event, ...args], nextEvent) => {
      if (['disconnect', 'error'].includes(event)) return nextEvent();
      
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
    const sessionId = createTrackedSessionId(socket.id, requestId);

    // Initialize Session
    try {
      await sessionStore.create(sessionId, socket.id);
      
      if (socket.user?.isGuest) {
        const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
        const count = await getGuestUsageCount(ip);
        socket.emit('guest:status', { count, limit: GUEST_MONTHLY_LIMIT, warning: count >= 40 });
      }
    } catch (err) {
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
      if (socket.user && !socket.user.isGuest) {
        try {
          await sessionStore.persistProfile(sessionId);

          const session = await sessionStore.get(sessionId);
          if (session?.learnerProfile?.topicsMastery) {
            const masteryData = session.learnerProfile.topicsMastery;
            const topicKeys = masteryData instanceof Map ? Array.from(masteryData.keys()) : Object.keys(masteryData);
            
            if (topicKeys.length > 0) {
              const updateObject = {};
              for (const key of topicKeys) {
                const value = masteryData instanceof Map ? masteryData.get(key) : masteryData[key];
                updateObject[`topicsMastery.${key}`] = value;
              }
              
              await LearnerProfile.findOneAndUpdate(
                { userId: socket.user.id },
                { $set: updateObject },
                { new: true }
              );
            }
          }
        } catch (err) {
          console.error(`[WS] Persistence failed on disconnect:`, err.message);
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

  return teachingIO;
}
