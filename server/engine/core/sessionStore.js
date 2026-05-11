/**
 * SessionStore — Distributed session persistence with Redis fallback
 */
import LearnerProfile from '../../models/LearnerProfile.js';
import ChatMessage from '../../models/ChatMessage.js';
import sessionRepository from '../../repositories/session.repository.js';
import redis from '../../utils/core/redis.js';
import VectorStoreService from './vectorStore.js';
import EngineSessionState from '../../models/EngineSessionState.js';
import SpacedRepetitionScheduler from './SpacedRepetitionScheduler.js';
import { runtimeState } from '../../core/runtimeState.js';

const SESSION_TTL_SEC = 20 * 60; // 20 minutes (Redis uses seconds for EX)
const IDLE_TTL_SEC = 5 * 60;     // 5 minutes
const MAX_SESSIONS = 100;
const KEY_PREFIX = 'sess:';

class SessionStore {
  constructor() {
    this.localSessions = new Map(); // Dev fallback
    this.maxSessions = MAX_SESSIONS;

    // ML-5 FIX: Periodic eviction of stale in-memory sessions
    // Runs every 30 seconds, evicts sessions idle for > SESSION_TTL_SEC
    this._evictionTimer = setInterval(() => {
      const now = Date.now();
      const ttlMs = SESSION_TTL_SEC * 1000;
      let evicted = 0;
      for (const [id, session] of this.localSessions) {
        if (now - (session.lastActivityAt || 0) > ttlMs) {
          this.localSessions.delete(id);
          evicted++;
        }
      }
      if (evicted > 0) {
        console.log(`[SessionStore] 🧹 Evicted ${evicted} stale sessions (${this.localSessions.size} remaining)`);
      }
    }, 30_000);

    // Prevent the timer from keeping the process alive during shutdown
    if (this._evictionTimer?.unref) this._evictionTimer.unref();
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
        confusionStreak: 0, 
        lowConfusionStreak: 0, 
        topicsMastery: {},
        engagementMetrics: { visual: 0, conceptual: 0, doubtsAfterNarration: 0, fastThroughVisuals: 0 }
      },
      chatSessionId: null,
      learnerProfileId: null,
      engineSessionId: id,
      _lastPersistAt: null,
      ...metadata, // Merge incoming metadata (userId, socketId, etc.)
    };


    await this.update(id, session, session);
    console.log(`[SessionStore] 👤 Created session: ${id}`);
    return session;
  }

  /**
   * Explicitly remove a session from the store (local + Redis)
   */
  async delete(id) {
    this.localSessions.delete(id);
    if (redis.isConnected) {
      await redis.del(`${KEY_PREFIX}${id}`);
    }
    console.log(`[SessionStore] 🗑️ Session ${id} deleted.`);
  }

  /**
   * Appends a message to the persistent chat history.
   * Writes to the ChatMessage collection (same as the HTTP chat path)
   * to prevent dual-storage data loss. Also keeps a slim in-memory
   * copy for quick access during the active session.
   */
  async addMessage(id, role, content, metadata = {}) {
    const session = await this.get(id);
    if (!session) return;

    const newMessage = { 
      role, 
      content, 
      timestamp: new Date(),
      ...metadata 
    };

    // PRIMARY: Write to the ChatMessage collection (consistent with HTTP flow)
    // If we don't have a chatSessionId yet, we must create one now to ensure persistence.
    if (!session.chatSessionId) {
      try {
        console.log(`[SessionStore] 🐣 No chatSessionId for ${id}, creating one now...`);
        const mongoSession = await sessionRepository.findOrCreate(session.userId || null, id, {
          title: 'New Session',
          topic: session.topic || 'General'
        });
        if (mongoSession) {
          session.chatSessionId = mongoSession._id.toString();
          // Update the session in store to include the new ID
          await this.update(id, { chatSessionId: session.chatSessionId }, session);
        }
      } catch (err) {
        console.error(`[SessionStore] Failed to auto-create ChatSession for ${id}:`, err.message);
      }
    }

    if (session.chatSessionId) {
      try {
        await sessionRepository.addMessage(session.chatSessionId, {
          role,
          content,
          hasCanvas: metadata.hasCanvas || false,
          canvasType: metadata.canvasType || null,
          canvasSnapshot: metadata.canvasSnapshot || null,
          metadata: {
            sources: metadata.sources || [],
          },
        });
        console.log(`[SessionStore] 💾 Message persisted via Repository (session: ${session.chatSessionId})`);
      } catch (err) {
        console.error(`[SessionStore] Failed to persist message via Repository:`, err.message);
      }
    }

    // SECONDARY: Keep a slim in-memory copy for quick access during active session
    const messages = Array.isArray(session.messages) ? session.messages : [];
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
        
        // BUG-FALLBACK: Mirror to local memory as hot standby for Redis disconnects
        this.localSessions.set(id, session);
        return session;
      }
      return null;
    }
    
    // Fallback 1: Local Memory
    let session = this.localSessions.get(id);
    if (session) {
      session.lastActivityAt = Date.now();
      return session;
    }

    // Fallback 2: MongoDB Cold Storage (DL-04)
    try {
      const coldState = await EngineSessionState.findOne({ sessionId: id });
      if (coldState) {
        console.log(`[SessionStore] ❄️ Restored session ${id} from MongoDB cold storage`);
        session = coldState.data;
        session.lastActivityAt = Date.now();
        this.localSessions.set(id, session);
        
        // Re-hydrate Redis if possible for performance
        if (redis.isConnected) {
          const isIdle = !session.topic && !session.timeline;
          await redis.set(`${KEY_PREFIX}${id}`, JSON.stringify(session), isIdle ? IDLE_TTL_SEC : SESSION_TTL_SEC);
        }
        return session;
      }
    } catch (err) {
      console.error(`[SessionStore] Cold storage recovery failed for ${id}:`, err.message);
    }

    return null;
  }

  async update(id, data, existingSession = null) {
    let session = existingSession || await this.get(id);
    if (!session) {
      // If we are updating a non-existent session, it might be the initial save
      session = data;
    } else {
      // Deep merge for learnerProfile if needed, or just regular assign
      // Deep merge the nested objects:
      if (data.learnerProfile && session.learnerProfile) {
        data.learnerProfile = { 
          ...session.learnerProfile, 
          ...data.learnerProfile,
          engagementMetrics: {
            ...session.learnerProfile.engagementMetrics,
            ...(data.learnerProfile.engagementMetrics || {})
          }
        };
      }
      Object.assign(session, data);
    }
    
    session.lastActivityAt = Date.now();
    
    // DEV-MODE: Only cap local map size if we are actually using it
    if (!redis.isConnected && this.localSessions.size > this.maxSessions) {
      const oldestKey = this.localSessions.keys().next().value;
      this.localSessions.delete(oldestKey);
    }
    
    // Always update local sessions as a hot-standby, but prioritize Redis for consistency
    this.localSessions.set(id, session);

    if (redis.isConnected) {
      const isIdle = !session.topic && !session.timeline;
      await redis.set(`${KEY_PREFIX}${id}`, JSON.stringify(session), isIdle ? IDLE_TTL_SEC : SESSION_TTL_SEC);
    } else {
      // DL-04: Persist to MongoDB cold storage if Redis is down (memory-only fallback)
      try {
        await EngineSessionState.findOneAndUpdate(
          { sessionId: id },
          { 
            data: session, 
            userId: session.userId, 
            lastActivityAt: new Date(),
            expiresAt: new Date(Date.now() + 48 * 3600 * 1000) // Extend TTL
          },
          { upsert: true }
        );
      } catch (err) {
        console.error(`[SessionStore] MongoDB fallback persistence failed for ${id}:`, err.message);
      }
    }
    
    return session;
  }

  async setTimeline(id, timeline) {
    const data = {
      timeline,
      steps: timeline.steps || timeline.timeline || [],
      currentStepIndex: 0,
      topic: timeline.title || timeline.topic,
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

      // Fetch due concepts for spaced repetition reinforcement
      const dueConcepts = await SpacedRepetitionScheduler.getDueConcepts(userId);

      const learnerProfile = {
        level: profile.level || 'beginner',
        pace: profile.pace || 'normal',
        confusionIndex: 0,
        confusionStreak: 0,
        lowConfusionStreak: 0,
        learningStyle: profile.learningStyle || 'visual',
        topicsMastery: (profile.topicsMastery && typeof profile.topicsMastery.toObject === 'function') 
          ? profile.topicsMastery.toObject() 
          : (profile.topicsMastery instanceof Map ? Object.fromEntries(profile.topicsMastery) : (profile.topicsMastery || {})),
        engagementMetrics: profile.engagementMetrics || { visual: 0, conceptual: 0, doubtsAfterNarration: 0, fastThroughVisuals: 0 },
        dueConcepts: dueConcepts || []
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

      // Add a "lastPersistAt" timestamp. Skip if persisted < 10 seconds ago:
      if (s._lastPersistAt && Date.now() - s._lastPersistAt < 10 * 1000) return;
      s._lastPersistAt = Date.now();
      await this.update(id, { _lastPersistAt: s._lastPersistAt }, s);

      const profile = await LearnerProfile.findById(s.learnerProfileId);
      if (!profile) return;

      // Interaction history tracking (Doubt handling)
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
        s._sessionCounted = true;
        await this.update(id, { _sessionCounted: true }, s);
        profile.totalSessions = (profile.totalSessions || 0) + 1;
        
        // Compute quality (0-5) from session performance
        const progressRatio = (s.currentStepIndex + 1) / Math.max(s.steps?.length || 5, 1);
        const confusionFactor = 1 - (s.learnerProfile?.confusionIndex || 0);
        const quality = Math.round(progressRatio * confusionFactor * 5); // 0–5
        
        // SM-2 owns the mastery write — no plain-number write before this
        await SpacedRepetitionScheduler.updateMastery(s.userId, [{
          concept: s.topic,
          quality  // pass quality directly, not mastery float
        }]);
      }

      // Sync engagement metrics
      if (s.learnerProfile?.engagementMetrics) {
        const em = s.learnerProfile.engagementMetrics;
        profile.engagementMetrics.visualStepsCompleted = (profile.engagementMetrics.visualStepsCompleted || 0) + (em.visualStepsCompleted || 0);
        profile.engagementMetrics.conceptualDoubtsAsked = (profile.engagementMetrics.conceptualDoubtsAsked || 0) + (em.conceptualDoubtsAsked || 0);
        
        // Reset in-session counters after sync to prevent double counting if persistProfile is called multiple times
        s.learnerProfile.engagementMetrics.visualStepsCompleted = 0;
        s.learnerProfile.engagementMetrics.conceptualDoubtsAsked = 0;
        await this.update(id, { learnerProfile: s.learnerProfile }, s);
      }

      await profile.save();
      console.log(`[SessionStore:Persist] Profile updated for user ${s.userId} (Confusion: ${s.learnerProfile.confusionIndex})`);
    } catch (err) {
      console.error(`[SessionStore:Persist] Failed to persist profile:`, err.message);
    }
  }

  async finalizeSessionMemory(sessionId, summary) {
    try {
      const s = await this.get(sessionId);
      if (!s?.userId) return;

      // Existing VectorStore call (Now real in Phase 5)
      // NEW: Persist metrics to metadata for style detection
      const metrics = {
        topic: s.topic,
        domain: s.domain || 'general',
        keyConcepts: summary?.keyConcepts || [],
        doubtsCount: s.doubtHistory?.length || 0,
        stepCount: (s.currentStepIndex || 0) + 1,
      };

      await VectorStoreService.addSession(sessionId, summary, { 
        ...metrics,
        userId: s.userId 
      });

      // --- Learner Style Detection ---
      const recentSessions = await VectorStoreService.getLatestMemories(s.userId, 'session', 10);
      
      if (recentSessions.length >= 3) {
        // Map PostgreSQL metadata back to the format detectStyle expects
        const sessionHistory = recentSessions.map(m => m.metadata);
        const style = this.constructor.detectStyle(sessionHistory);
        
        await LearnerProfile.updateOne(
          { userId: s.userId },
          { 
            $set: { 
              'engagementMetrics.styleDetected': style,
              'engagementMetrics.styleDetectedAt': recentSessions.length
            }
          }
        );
        console.log(`[SessionStore:Style] 🕵️ Style Detected: ${style.toUpperCase()} for user ${s.userId}`);
      }
      
      console.log(`[SessionStore:Memory] 🧠 Session memory persisted for user ${s.userId}`);
    } catch (err) {
      console.error(`[SessionStore:Memory] Failed to finalize memory:`, err.message);
    }
  }

  /**
   * Classify after 3 sessions based on ratio of visual steps vs conceptual doubts
   */
  static detectStyle(sessions) {
    if (!sessions || sessions.length < 3) return 'unknown';
    const avgVisual = sessions.reduce((s, x) => s + (x.stepCount || 0), 0) / sessions.length;
    const avgDoubts = sessions.reduce((s, x) => s + (x.doubtsCount || x.doubts?.length || 0), 0) / sessions.length;
    const ratio = avgDoubts / Math.max(avgVisual, 1);
    
    if (ratio > 0.4) return 'conceptual'; // many doubts per step = wants text
    if (ratio < 0.1) return 'visual';     // few doubts per step = visual learner
    return 'balanced';
  }

  /**
   * Restores engine state from a MongoDB ChatSession.
   * Messages are fetched from the ChatMessage collection (source of truth)
   * instead of the embedded mongoSession.messages array.
   */
  async restoreFromMongo(id, mongoSession) {
    if (!mongoSession) return null;
    
    console.log(`[SessionStore] 🔄 Restoring session ${id} from MongoDB ChatSession ${mongoSession._id}`);

    // Fetch messages from the ChatMessage collection (source of truth)
    let messages = [];
    try {
      messages = await ChatMessage.find({ sessionId: mongoSession._id })
        .sort({ timestamp: 1 })
        .limit(100)
        .lean();
    } catch (err) {
      console.warn(`[SessionStore] Failed to fetch ChatMessage history for ${mongoSession._id}:`, err.message);
      // Fallback to embedded array if ChatMessage query fails
      messages = mongoSession.messages || [];
    }
    
    const session = {
      id,
      chatSessionId: mongoSession._id,
      engineSessionId: id,
      topic: mongoSession.topic,
      messages,
      steps: mongoSession.canvasSteps || mongoSession.steps || [],
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
    // Always clean local map (hot-standby mirror)
    this.localSessions.delete(id);
    if (redis.isConnected) {
      await redis.del(`${KEY_PREFIX}${id}`);
    }
  }

  async getAll() {
    // This is rarely used in production, mostly for debug
    if (redis.isConnected) {
      // Not implemented for Redis to avoid KEYS * (expensive)
      return [];
    }
    return Array.from(this.localSessions.values());
  }

  /**
   * DL-04: Flush all active in-memory sessions to MongoDB
   * Ensures in-flight sessions survive server restarts/pod scaling.
   */
  async flushToMongo() {
    const sessions = Array.from(this.localSessions.entries());
    if (sessions.length === 0) return;

    console.log(`[SessionStore] 💾 Flushing ${sessions.length} active sessions to cold storage...`);
    
    // We use bulkWrite for efficiency
    const ops = sessions.map(([id, data]) => ({
      updateOne: {
        filter: { sessionId: id },
        update: { 
          $set: { 
            data, 
            userId: data.userId || null,
            lastActivityAt: new Date() 
          } 
        },
        upsert: true
      }
    }));

    try {
      await EngineSessionState.bulkWrite(ops);
      console.log(`[SessionStore] ✅ Cold storage flush complete.`);
    } catch (err) {
      console.error(`[SessionStore] ❌ Cold storage flush failed:`, err.message);
    }
  }
}

const sessionStore = new SessionStore();

// Register graceful shutdown hook
runtimeState.registerCleanup('sessionStore', () => sessionStore.flushToMongo());

export default sessionStore;
