/**
 * SessionStore — Distributed session persistence with Redis fallback
 */
import LearnerProfile from '../../models/LearnerProfile.js';
import redis from '../../utils/core/redis.js';

const SESSION_TTL_SEC = 20 * 60; // 20 minutes (Redis uses seconds for EX)
const IDLE_TTL_SEC = 5 * 60;     // 5 minutes
const MAX_SESSIONS = 100;
const KEY_PREFIX = 'sess:';

class SessionStore {
  constructor() {
    this.localSessions = new Map(); // Dev fallback
    this.maxSessions = MAX_SESSIONS;
  }

  async create(id) {
    let session = await this.get(id);
    if (session) {
      session.lastActivityAt = Date.now();
      await this.update(id, session);
      return session;
    }

    // Check capacity (local estimate if no Redis)
    if (!redis.isConnected && this.localSessions.size >= this.maxSessions) {
      throw new Error('SESSION_LIMIT_REACHED');
    }

    session = {
      id,
      topic: null,
      context: [],
      teachingMachine: null, // This is usually a class instance, handled via machine.state in sockets
      timeline: null,
      steps: [],
      currentStepIndex: 0,
      lastActivityAt: Date.now(),
      createdAt: Date.now(),
      learnerProfile: {
        level: 'beginner',
        pace: 'normal',
        confusionIndex: 0
      },
      mongoSessionId: null, // Link to ChatSession ObjectId
      engineSessionId: id,   // String ID for internal tracking
    };

    await this.update(id, session);
    console.log(`[SessionStore] 👤 Created session: ${id}`);
    return session;
  }

  async get(id) {
    if (redis.isConnected) {
      const data = await redis.get(`${KEY_PREFIX}${id}`);
      if (data) {
        const session = JSON.parse(data);
        session.lastActivityAt = Date.now();
        // Sliding window: refresh TTL on get
        const isIdle = !session.topic && !session.timeline;
        await redis.set(`${KEY_PREFIX}${id}`, JSON.stringify(session), isIdle ? IDLE_TTL_SEC : SESSION_TTL_SEC);
        return session;
      }
      return null;
    }
    
    // Fallback
    const session = this.localSessions.get(id);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    return session;
  }

  async update(id, data) {
    let session = await this.get(id);
    if (!session) {
      // If we are updating a non-existent session, it might be the initial save
      session = data;
    } else {
      Object.assign(session, data);
    }
    
    session.lastActivityAt = Date.now();

    if (redis.isConnected) {
      const isIdle = !session.topic && !session.timeline;
      await redis.set(`${KEY_PREFIX}${id}`, JSON.stringify(session), isIdle ? IDLE_TTL_SEC : SESSION_TTL_SEC);
    } else {
      this.localSessions.set(id, session);
    }
    
    return session;
  }

  async setTimeline(id, timeline) {
    const data = {
      timeline,
      steps: timeline.steps || timeline.timeline || [],
      currentStepIndex: 0,
    };
    return await this.update(id, data);
  }

  async goToStep(id, index) {
    const session = await this.get(id);
    if (!session || !session.steps) return;
    if (index >= 0 && index < session.steps.length) {
      await this.update(id, { currentStepIndex: index });
    }
  }

  async initProfile(id, userId) {
    try {
      console.log(`[SessionStore] Initializing profile for user: ${userId} in session ${id}`);
      let profile = await LearnerProfile.findOne({ userId });

      if (!profile) {
        console.log(`[SessionStore] No profile found for ${userId}. Creating default.`);
        profile = await LearnerProfile.create({ userId });
      }

      const learnerProfile = {
        level: 'beginner',
        pace: 'normal',
        confusionIndex: 0,
        learningStyle: profile.learningStyle || 'visual',
        topicsMastery: profile.topicsMastery || new Map(),
      };

      await this.update(id, { userId, learnerProfile, mongoSessionId: profile._id });
    } catch (err) {
      console.error(`[SessionStore] Failed to init profile for ${userId}:`, err.message);
    }
  }

  /**
   * Restores engine state from a MongoDB ChatSession
   */
  async restoreFromMongo(id, mongoSession) {
    if (!mongoSession) return null;
    
    console.log(`[SessionStore] 🔄 Restoring session ${id} from MongoDB ChatSession ${mongoSession._id}`);
    
    const session = {
      id,
      mongoSessionId: mongoSession._id,
      engineSessionId: id,
      topic: mongoSession.topic,
      steps: mongoSession.steps || [],
      currentStepIndex: mongoSession.currentStepIndex || 0,
      createdAt: mongoSession.createdAt || Date.now(),
      lastActivityAt: Date.now(),
      // Context can be derived from messages if needed in pedagogyEngine
    };

    await this.update(id, session);
    return session;
  }

  async destroy(id) {
    if (redis.isConnected) {
      return await redis.del(`${KEY_PREFIX}${id}`);
    }
    return this.localSessions.delete(id);
  }

  async getAll() {
    // This is rarely used in production, mostly for debug
    if (redis.isConnected) {
      // Not implemented for Redis to avoid KEYS * (expensive)
      return [];
    }
    return Array.from(this.localSessions.values());
  }
}

export default new SessionStore();
