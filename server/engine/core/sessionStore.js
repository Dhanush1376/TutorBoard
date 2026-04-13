/**
 * SessionStore — Simple in-memory session persistence
 */
import LearnerProfile from '../../models/LearnerProfile.js';

const SESSION_TTL_MS = 20 * 60 * 1000; // 20 minutes for active sessions
const IDLE_TTL_MS = 5 * 60 * 1000;     // 5 minutes for sessions that never started
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // Check every 2 minutes
const MAX_SESSIONS = 100; // Hard cap on concurrent sessions

class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.maxSessions = MAX_SESSIONS;
    this._startCleanup();
  }

  create(id) {
    if (this.sessions.has(id)) {
      const session = this.sessions.get(id);
      session.lastActivityAt = Date.now();
      return session;
    }

    if (this.sessions.size >= this.maxSessions) {
      console.error(`[SessionStore] ❌ Session limit reached (${this.maxSessions}). Denying ${id}`);
      throw new Error('SESSION_LIMIT_REACHED');
    }

    const session = {
      id,
      topic: null,
      context: [],
      teachingMachine: null,
      timeline: null,
      steps: [],
      currentStepIndex: 0,
      lastActivityAt: Date.now(),
      createdAt: Date.now(),
      learnerProfile: {
        level: 'beginner',
        pace: 'normal',
        confusionIndex: 0
      }
    };

    this.sessions.set(id, session);
    console.log(`[SessionStore] 👤 Created session: ${id} (Total: ${this.sessions.size}/${this.maxSessions})`);
    return session;
  }

  get(id) {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    return session;
  }

  update(id, data) {
    const session = this.sessions.get(id);
    if (!session) return null;

    Object.assign(session, data);
    session.lastActivityAt = Date.now();
    return session;
  }

  setTimeline(id, timeline) {
    const session = this.sessions.get(id);
    if (!session) return;
    session.timeline = timeline;
    session.steps = timeline.steps || timeline.timeline || [];
    session.currentStepIndex = 0;
    session.lastActivityAt = Date.now();
  }

  goToStep(id, index) {
    const session = this.sessions.get(id);
    if (!session || !session.steps) return;
    if (index >= 0 && index < session.steps.length) {
      session.currentStepIndex = index;
      session.lastActivityAt = Date.now();
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
        level: 'beginner', // could be derived from mastery
        pace: 'normal',
        confusionIndex: 0,
        learningStyle: profile.learningStyle || 'visual',
        topicsMastery: profile.topicsMastery || new Map(),
      };

      this.update(id, { userId, learnerProfile });
      console.log(`[SessionStore] Profile loaded for ${userId}: style=${learnerProfile.learningStyle}`);
    } catch (err) {
      console.error(`[SessionStore] Failed to init profile for ${userId}:`, err.message);
      // Fallback to default guest-like profile already set in create()
    }
  }

  destroy(id) {
    return this.sessions.delete(id);
  }

  getAll() {
    return Array.from(this.sessions.values());
  }

  _startCleanup() {
    setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
  }

  _cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      const inactiveTime = now - session.lastActivityAt;
      const isIdle = !session.topic && !session.timeline;
      const ttl = isIdle ? IDLE_TTL_MS : SESSION_TTL_MS;

      if (inactiveTime > ttl) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionStore] 🧹 Cleaned up ${cleaned} stale sessions.`);
    }
  }
}

export default new SessionStore();
