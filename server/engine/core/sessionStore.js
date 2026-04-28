/**
 * SessionStore — Distributed session persistence with Redis fallback
 */
import LearnerProfile from '../../models/LearnerProfile.js';
import redis from '../../utils/core/redis.js';
import VectorStoreService from './vectorStore.js';
import SessionMemory from '../../models/SessionMemory.js';
import SpacedRepetitionScheduler from './SpacedRepetitionScheduler.js';

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
        confusionStreak: 0, // NEW: Track high confusion streaks
        lowConfusionStreak: 0, // NEW: Track low confusion streaks
        topicsMastery: {},
        engagementMetrics: { visual: 0, conceptual: 0, doubtsAfterNarration: 0, fastThroughVisuals: 0 }
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
  async addMessage(id, role, content, metadata = {}) {
    const session = await this.get(id);
    if (!session) return;
    
    const messages = Array.isArray(session.messages) ? session.messages : [];
    const newMessage = { 
      role, 
      content, 
      timestamp: new Date(),
      ...metadata 
    };
    
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

      const learnerProfile = {
        level: profile.level || 'beginner',
        pace: profile.pace || 'normal',
        confusionIndex: 0,
        confusionStreak: 0,
        lowConfusionStreak: 0,
        learningStyle: profile.learningStyle || 'visual',
        topicsMastery: profile.topicsMastery instanceof Map ? Object.fromEntries(profile.topicsMastery) : (profile.topicsMastery || {}),
        engagementMetrics: profile.engagementMetrics || { visual: 0, conceptual: 0, doubtsAfterNarration: 0, fastThroughVisuals: 0 }
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
        s._sessionCounted = true; // set in-memory first
        await this.update(id, { _sessionCounted: true }, s); // then persist
        profile.totalSessions = (profile.totalSessions || 0) + 1;
        
        // 3. SM-2 Integration: Update Spaced Repetition mastery on session count
        const masteryDeltas = [{ concept: s.topic, mastery: profile.topicsMastery.get(s.topic) || 0.5 }];
        await SpacedRepetitionScheduler.updateMastery(s.userId, masteryDeltas);
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

      // Existing VectorStore call (stubbed, fine)
      await VectorStoreService.addSession(sessionId, summary, { topic: s.topic });

      // NEW: persist to MongoDB for style detection + planner context
      const memory = await SessionMemory.findOneAndUpdate(
        { userId: s.userId },
        { 
          $push: { 
            sessions: {
              topic:       s.topic,
              domain:      s.domain || 'general',
              keyConcepts: summary?.keyConcepts || [],
              doubts:      s.doubtHistory?.map(d => ({ question: d.question, pathway: d.pathway })) || [],
              masteryDelta: summary?.masteryDelta || {},
              stepCount:   (s.currentStepIndex || 0) + 1,
            }
          }
        },
        { upsert: true, new: true }
      );

      // --- Learner Style Detection ---
      if (memory.sessions.length >= 3) {
        const style = this.constructor.detectStyle(memory.sessions);
        await LearnerProfile.updateOne(
          { userId: s.userId },
          { 
            $set: { 
              'engagementMetrics.styleDetected': style,
              'engagementMetrics.styleDetectedAt': memory.sessions.length
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
    const avgDoubts = sessions.reduce((s, x) => s + (x.doubts?.length || 0), 0) / sessions.length;
    const ratio = avgDoubts / Math.max(avgVisual, 1);
    
    if (ratio > 0.4) return 'conceptual'; // many doubts per step = wants text
    if (ratio < 0.1) return 'visual';     // few doubts per step = visual learner
    return 'balanced';
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
