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

  async create(id, metadata = {}) {
    let session = await this.get(id);
    if (session) {
      session.lastActivityAt = Date.now();
      await this.update(id, session, session);
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
      messages: [],
      canvasState: [],
      teachingMachine: null,
      timeline: null,
      steps: [],
      currentStepIndex: 0,
      lastActivityAt: Date.now(),
      createdAt: Date.now(),
      learnerProfile: {
        level: 'beginner',
        pace: 'normal',
        confusionIndex: 0,
        topicsMastery: {},
      },
      chatSessionId: null,
      learnerProfileId: null,
      engineSessionId: id,
    };


    await this.update(id, session, session);
    console.log(`[SessionStore] 👤 Created session: ${id}`);
    return session;
  }

  /**
   * Appends a message to the persistent chat history
   */
  async addMessage(id, role, content) {
    const session = await this.get(id);
    if (!session) return;
    
    const messages = Array.isArray(session.messages) ? session.messages : [];
    const newMessage = { role, content, timestamp: new Date() };
    
    // Prevent document bloat: keep last 100 messages in active session
    const updatedMessages = [...messages, newMessage].slice(-100);
    
    return await this.update(id, { messages: updatedMessages }, session);
  }

  /**
   * Updates the manual canvas objects state
   */
  async updateCanvasState(id, objects) {
    if (!Array.isArray(objects)) return;
    return await this.update(id, { canvasState: objects }); // update() will do the get internally since we don't have it
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

  async update(id, data, existingSession = null) {
    let session = existingSession || await this.get(id);
    if (!session) {
      // If we are updating a non-existent session, it might be the initial save
      session = data;
    } else {
      // Deep merge for learnerProfile if needed, or just regular assign
      if (data.learnerProfile && session.learnerProfile) {
        data.learnerProfile = { ...session.learnerProfile, ...data.learnerProfile };
      }
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
      await this.update(id, { currentStepIndex: index }, session);
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
        level: profile.level || 'beginner',
        pace: profile.pace || 'normal',
        confusionIndex: 0,
        learningStyle: profile.learningStyle || 'visual',
        topicsMastery: profile.topicsMastery instanceof Map ? Object.fromEntries(profile.topicsMastery) : (profile.topicsMastery || {}),
      };

      // We update the local object directly first, then persist
      const updateData = { userId, learnerProfile, learnerProfileId: profile._id };
      const currentSession = await this.get(id);
      if (currentSession) {
        await this.update(id, updateData, currentSession);
      }
    } catch (err) {
      console.error(`[SessionStore] Failed to init profile for ${userId}:`, err.message);
    }
  }

  /**
   * Persists the leaners progress back to MongoDB
   */
  async persistProfile(id, interaction = null) {
    try {
      const s = await this.get(id);
      if (!s || !s.userId || !s.learnerProfileId) return;

      const profile = await LearnerProfile.findById(s.learnerProfileId);
      if (!profile) return;

      // Update Mastery if topic exists
      if (s.topic) {
        const currentMastery = profile.topicsMastery.get(s.topic) || 0;
        
        // Refined Mastery: +0.1 * progress * (1 - confusion), min 0.01 per interaction
        const totalSteps = s.steps?.length || 5; // Default to 5 if unknown
        const progressRatio = totalSteps > 0 ? (s.currentStepIndex + 1) / totalSteps : 0.5;
        const confusionFactor = 1 - (s.learnerProfile.confusionIndex || 0); // confusionIndex is 0..1
        
        const increment = Math.max(0.01, 0.1 * progressRatio * confusionFactor);
        
        profile.topicsMastery.set(s.topic, Math.min(1.0, currentMastery + increment));
      }

      // Append interaction history if provided (Doubt handling)
      if (interaction && interaction.question) {
        profile.doubtHistory.push({
          topic: s.topic,
          question: interaction.question,
          resolved: true,
          confusionScore: s.learnerProfile.confusionIndex,
          timestamp: new Date()
        });
        
        // BUG-10: Cap doubt history to prevent document bloat (max 50 entries)
        if (profile.doubtHistory.length > 50) {
          profile.doubtHistory = profile.doubtHistory.slice(-50);
        }
      }

      profile.lastSessionDate = new Date();
      // Ensure we don't increment totalSessions multiple times per "active" session
      if (!s._sessionCounted) {
        profile.totalSessions = (profile.totalSessions || 0) + 1;
        await this.update(id, { _sessionCounted: true }, s);
      }

      await profile.save();
      console.log(`[SessionStore:Persist] Profile updated for user ${s.userId} (Confusion: ${s.learnerProfile.confusionIndex})`);
    } catch (err) {
      console.error(`[SessionStore:Persist] Failed to persist profile:`, err.message);
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
      chatSessionId: mongoSession._id,
      engineSessionId: id,
      topic: mongoSession.topic,
      messages: mongoSession.messages || [],
      steps: mongoSession.steps || [],
      currentStepIndex: mongoSession.currentStepIndex || 0,
      canvasState: mongoSession.canvasState || [],
      canvasVersion: mongoSession.canvasVersion || 0,
      preferences: mongoSession.preferences || {},
      createdAt: mongoSession.createdAt || Date.now(),
      lastActivityAt: Date.now(),
    };

    await this.update(id, session, session);
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
