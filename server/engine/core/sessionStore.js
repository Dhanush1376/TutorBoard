/**
 * SessionStore — Distributed session persistence with MongoDB backend
 */
import LearnerProfile from '../../models/LearnerProfile.js';
import ChatMessage from '../../models/ChatMessage.js';
import sessionRepository from '../../repositories/session.repository.js';
import VectorStoreService from './vectorStore.js';
import EngineSessionState from '../../models/EngineSessionState.js';
import SpacedRepetitionScheduler from './SpacedRepetitionScheduler.js';
import { runtimeState } from '../../core/runtimeState.js';

const SESSION_TTL_SEC = 20 * 60; // 20 minutes
const MAX_SESSIONS = 100;

class SessionStore {
  constructor() {
    this.localSessions = new Map();
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

    if (this.localSessions.size >= this.maxSessions) {
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
      ...metadata,
    };

    await this.update(id, session, session);
    console.log(`[SessionStore] 👤 Created session: ${id}`);
    return session;
  }

  /**
   * Explicitly remove a session from the store (local + MongoDB)
   */
  async delete(id) {
    this.localSessions.delete(id);
    try {
      await EngineSessionState.deleteOne({ sessionId: id });
      console.log(`[SessionStore] 🗑️ Session ${id} deleted.`);
    } catch (err) {
      console.error(`[SessionStore] Failed to delete session ${id}:`, err.message);
    }
  }

  /**
   * Appends a message to the persistent chat history.
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
    if (!session.chatSessionId) {
      try {
        console.log(`[SessionStore] 🐣 No chatSessionId for ${id}, creating one now...`);
        const mongoSession = await sessionRepository.findOrCreate(session.userId || null, id, {
          title: 'New Session',
          topic: session.topic || 'General'
        });
        if (mongoSession) {
          session.chatSessionId = mongoSession._id.toString();
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
    return await this.update(id, { canvasState: objects });
  }

  async get(id) {
    // 1. Local Memory (Hot Cache)
    let session = this.localSessions.get(id);
    if (session) {
      session.lastActivityAt = Date.now();
      return session;
    }

    // 2. MongoDB Cold/Warm Storage (DL-04)
    try {
      const coldState = await EngineSessionState.findOne({ sessionId: id });
      if (coldState) {
        console.log(`[SessionStore] ❄️ Restored session ${id} from MongoDB storage`);
        session = coldState.data;
        session.lastActivityAt = Date.now();
        this.localSessions.set(id, session);
        return session;
      }
    } catch (err) {
      console.error(`[SessionStore] MongoDB recovery failed for ${id}:`, err.message);
    }

    return null;
  }

  async update(id, data, existingSession = null) {
    let session = existingSession || await this.get(id);
    if (!session) {
      session = data;
    } else {
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
    
    if (this.localSessions.size > this.maxSessions) {
      const oldestKey = this.localSessions.keys().next().value;
      this.localSessions.delete(oldestKey);
    }
    
    this.localSessions.set(id, session);

    // Save to MongoDB warm/cold storage
    try {
      await EngineSessionState.findOneAndUpdate(
        { sessionId: id },
        { 
          data: session, 
          userId: session.userId, 
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000) // Extend TTL to 48 hours
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`[SessionStore] MongoDB persistence failed for ${id}:`, err.message);
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

      if (s._lastPersistAt && Date.now() - s._lastPersistAt < 10 * 1000) return;
      s._lastPersistAt = Date.now();
      await this.update(id, { _lastPersistAt: s._lastPersistAt }, s);

      const profile = await LearnerProfile.findById(s.learnerProfileId);
      if (!profile) return;

      if (interaction && interaction.question) {
        profile.doubtHistory.push({
          topic: s.topic,
          question: interaction.question,
          resolved: true,
          confusionScore: s.learnerProfile.confusionIndex,
          timestamp: new Date()
        });
        
        if (profile.doubtHistory.length > 50) {
          profile.doubtHistory = profile.doubtHistory.slice(-50);
        }
      }

      profile.lastSessionDate = new Date();
      if (!s._sessionCounted) {
        s._sessionCounted = true;
        await this.update(id, { _sessionCounted: true }, s);
        profile.totalSessions = (profile.totalSessions || 0) + 1;
        
        const progressRatio = (s.currentStepIndex + 1) / Math.max(s.steps?.length || 5, 1);
        const confusionFactor = 1 - (s.learnerProfile?.confusionIndex || 0);
        const quality = Math.round(progressRatio * confusionFactor * 5); // 0–5
        
        await SpacedRepetitionScheduler.updateMastery(s.userId, [{
          concept: s.topic,
          quality
        }]);
      }

      if (s.learnerProfile?.engagementMetrics) {
        const em = s.learnerProfile.engagementMetrics;
        profile.engagementMetrics.visualStepsCompleted = (profile.engagementMetrics.visualStepsCompleted || 0) + (em.visualStepsCompleted || 0);
        profile.engagementMetrics.conceptualDoubtsAsked = (profile.engagementMetrics.conceptualDoubtsAsked || 0) + (em.conceptualDoubtsAsked || 0);
        
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

      const recentSessions = await VectorStoreService.getLatestMemories(s.userId, 'session', 10);
      
      if (recentSessions.length >= 3) {
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

  static detectStyle(sessions) {
    if (!sessions || sessions.length < 3) return 'unknown';
    const avgVisual = sessions.reduce((s, x) => s + (x.stepCount || 0), 0) / sessions.length;
    const avgDoubts = sessions.reduce((s, x) => s + (x.doubtsCount || x.doubts?.length || 0), 0) / sessions.length;
    const ratio = avgDoubts / Math.max(avgVisual, 1);
    
    if (ratio > 0.4) return 'conceptual';
    if (ratio < 0.1) return 'visual';
    return 'balanced';
  }

  async restoreFromMongo(id, mongoSession) {
    if (!mongoSession) return null;
    
    console.log(`[SessionStore] 🔄 Restoring session ${id} from MongoDB ChatSession ${mongoSession._id}`);

    let messages = [];
    try {
      messages = await ChatMessage.find({ sessionId: mongoSession._id })
        .sort({ timestamp: 1 })
        .limit(100)
        .lean();
    } catch (err) {
      console.warn(`[SessionStore] Failed to fetch ChatMessage history for ${mongoSession._id}:`, err.message);
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
    await this.delete(id);
  }

  async getAll() {
    return Array.from(this.localSessions.values());
  }

  /**
   * DL-04: Flush all active in-memory sessions to MongoDB
   */
  async flushToMongo() {
    const sessions = Array.from(this.localSessions.entries());
    if (sessions.length === 0) return;

    console.log(`[SessionStore] 💾 Flushing ${sessions.length} active sessions to cold storage...`);
    
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
