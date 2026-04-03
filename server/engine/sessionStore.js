/**
 * SessionStore — In-memory teaching session storage
 * 
 * Each session tracks:
 *   - Topic and timeline data
 *   - Current step index
 *   - Doubt history
 *   - Full LLM conversation context
 *   - Timestamps for TTL management
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

class SessionStore {
  constructor() {
    this.sessions = new Map();

    // Auto-cleanup stale sessions
    this._cleanupTimer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Create a new session.
   */
  create(sessionId, socketId) {
    const session = {
      id: sessionId,
      socketId,
      topic: null,
      timeline: null,           // Full timeline from AI
      steps: [],                // Array of step objects
      objects: [],              // Scene objects for canvas
      currentStepIndex: 0,
      isPaused: false,
      doubts: [],               // { question, response, stepIndex, timestamp }
      conversationContext: [],   // Messages for LLM context
      state: 'IDLE',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    console.log(`[SessionStore] Created session: ${sessionId}`);
    return session;
  }

  /**
   * Get a session by ID.
   */
  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    return session || null;
  }

  /**
   * Update session fields.
   */
  update(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[SessionStore] Session not found: ${sessionId}`);
      return null;
    }

    Object.assign(session, updates, { lastActivityAt: Date.now() });
    return session;
  }

  /**
   * Set the teaching timeline for a session.
   */
  setTimeline(sessionId, timelineData) {
    const session = this.get(sessionId);
    if (!session) return null;

    session.timeline = timelineData;
    session.steps = timelineData.steps || [];
    session.objects = timelineData.objects || [];
    session.currentStepIndex = 0;
    session.lastActivityAt = Date.now();

    return session;
  }

  /**
   * Advance to the next step.
   */
  advanceStep(sessionId) {
    const session = this.get(sessionId);
    if (!session) return null;

    if (session.currentStepIndex < session.steps.length - 1) {
      session.currentStepIndex += 1;
      session.lastActivityAt = Date.now();
      return session.currentStepIndex;
    }
    return null; // Already at last step
  }

  /**
   * Go to a specific step.
   */
  goToStep(sessionId, stepIndex) {
    const session = this.get(sessionId);
    if (!session) return null;

    if (stepIndex >= 0 && stepIndex < session.steps.length) {
      session.currentStepIndex = stepIndex;
      session.lastActivityAt = Date.now();
      return session.currentStepIndex;
    }
    return null;
  }

  /**
   * Add a doubt to the session.
   */
  addDoubt(sessionId, question, response, visualData = null) {
    const session = this.get(sessionId);
    if (!session) return null;

    const doubt = {
      question,
      response,
      visualData,
      stepIndex: session.currentStepIndex,
      timestamp: Date.now(),
    };

    session.doubts.push(doubt);
    session.lastActivityAt = Date.now();

    return doubt;
  }

  /**
   * Add a message to the LLM conversation context.
   */
  addContext(sessionId, role, content) {
    const session = this.get(sessionId);
    if (!session) return;

    session.conversationContext.push({ role, content });

    // Keep context manageable (last 20 messages)
    if (session.conversationContext.length > 20) {
      session.conversationContext = session.conversationContext.slice(-20);
    }

    session.lastActivityAt = Date.now();
  }

  /**
   * Build LLM context summary for a session.
   */
  buildContextSummary(sessionId) {
    const session = this.get(sessionId);
    if (!session) return '';

    const parts = [];

    if (session.topic) {
      parts.push(`TOPIC: "${session.topic}"`);
    }

    if (session.steps.length > 0) {
      parts.push(`TEACHING PROGRESS: Step ${session.currentStepIndex + 1}/${session.steps.length}`);
      const taughtSteps = session.steps.slice(0, session.currentStepIndex + 1);
      parts.push(`STEPS COVERED: ${taughtSteps.map(s => s.label || s.title || 'Step').join(' → ')}`);
    }

    if (session.doubts.length > 0) {
      const recentDoubts = session.doubts.slice(-3);
      parts.push(`RECENT DOUBTS: ${recentDoubts.map(d => d.question).join('; ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Destroy a session.
   */
  destroy(sessionId) {
    const existed = this.sessions.delete(sessionId);
    if (existed) {
      console.log(`[SessionStore] Destroyed session: ${sessionId}`);
    }
    return existed;
  }

  /**
   * Get all active sessions (for monitoring).
   */
  getAll() {
    return Array.from(this.sessions.values());
  }

  /**
   * Cleanup stale sessions.
   */
  _cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionStore] Cleaned up ${cleaned} stale session(s). Active: ${this.sessions.size}`);
    }
  }

  /**
   * Shutdown cleanup timer.
   */
  shutdown() {
    clearInterval(this._cleanupTimer);
  }
}

// Singleton
const sessionStore = new SessionStore();
export default sessionStore;
