/**
 * TeachingMachine — Server-side Finite State Machine
 * 
 * States:
 *   IDLE         → Waiting for a topic
 *   GENERATING   → AI is producing the teaching timeline
 *   TEACHING     → Stepping through the timeline
 *   DOUBT_TRIGGERED → Student asked a doubt, pausing
 *   RESPONDING   → AI is generating a doubt response
 *   RESUMING     → Transitioning back to the teaching timeline
 *   COMPLETED    → All steps finished
 *   ERROR        → Something went wrong
 */

// ─── State Constants ───
export const STATES = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  TEACHING: 'TEACHING',
  PAUSED: 'PAUSED',
  DOUBT_TRIGGERED: 'DOUBT_TRIGGERED',
  RESPONDING: 'RESPONDING',
  RESUMING: 'RESUMING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
  RECOVERING: 'RECOVERING', // Graceful fallback state
};

// ─── Event Constants ───
export const EVENTS = {
  START: 'START',
  TIMELINE_READY: 'TIMELINE_READY',
  STEP_COMPLETE: 'STEP_COMPLETE',
  DOUBT_ASKED: 'DOUBT_ASKED',
  DOUBT_RESPONSE_READY: 'DOUBT_RESPONSE_READY',
  RESUME: 'RESUME',
  FINISH: 'FINISH',
  FAIL: 'FAIL',
  RESET: 'RESET',
  PAUSE: 'PAUSE',
  PLAY: 'PLAY',
};

// ─── Transition Table ───
const TRANSITIONS = {
  [STATES.IDLE]: {
    [EVENTS.START]: STATES.GENERATING,
  },
  [STATES.GENERATING]: {
    [EVENTS.TIMELINE_READY]: STATES.TEACHING,
    [EVENTS.FAIL]: STATES.ERROR,
    // explicitly removed [EVENTS.START] to prevent redundant triggers while calculating
  },
  [STATES.TEACHING]: {
    [EVENTS.STEP_COMPLETE]: STATES.TEACHING,
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED,
    [EVENTS.FINISH]: STATES.COMPLETED,
    [EVENTS.FAIL]: STATES.ERROR,
    [EVENTS.PAUSE]: STATES.PAUSED,
    [EVENTS.START]: STATES.GENERATING, // Allow hard restart
  },
  [STATES.PAUSED]: {
    [EVENTS.PLAY]: STATES.TEACHING,
    [EVENTS.RESUME]: STATES.TEACHING,
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED,
    [EVENTS.START]: STATES.GENERATING,
    [EVENTS.RESET]: STATES.IDLE,
  },
  [STATES.DOUBT_TRIGGERED]: {
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED,
    [EVENTS.DOUBT_RESPONSE_READY]: STATES.RESPONDING,
    [EVENTS.FAIL]: STATES.ERROR,
    [EVENTS.START]: STATES.GENERATING, // Allow hard restart
  },
  [STATES.RESPONDING]: {
    [EVENTS.RESUME]: STATES.RESUMING,
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED,
    [EVENTS.FAIL]: STATES.ERROR,
    [EVENTS.START]: STATES.GENERATING, // Allow hard restart
  },
  [STATES.RESUMING]: {
    [EVENTS.STEP_COMPLETE]: STATES.TEACHING,
    [EVENTS.PLAY]: STATES.TEACHING,
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED,
    [EVENTS.FINISH]: STATES.COMPLETED,
    [EVENTS.FAIL]: STATES.ERROR,
    [EVENTS.START]: STATES.GENERATING, // Allow hard restart
  },
  [STATES.COMPLETED]: {
    [EVENTS.RESET]: STATES.IDLE,
    [EVENTS.START]: STATES.GENERATING,            // start a new topic
    [EVENTS.PLAY]: STATES.TEACHING,               // replay/resume
    [EVENTS.RESUME]: STATES.TEACHING,
    [EVENTS.STEP_COMPLETE]: STATES.TEACHING,      // allow navigation
  },
  [STATES.ERROR]: {
    [EVENTS.RESET]: STATES.IDLE,
    [EVENTS.START]: STATES.GENERATING,            // retry
    [EVENTS.RESUME]: STATES.RECOVERING,           // fall back to previous safe state
  },
  [STATES.RECOVERING]: {
    [EVENTS.TIMELINE_READY]: STATES.TEACHING,
    [EVENTS.STEP_COMPLETE]: STATES.TEACHING,
    [EVENTS.FAIL]: STATES.ERROR,
  }
};

/**
 * Creates a new teaching state machine instance.
 * Each session gets its own machine.
 */
export function createTeachingMachine(sessionId, onTransition) {
  let currentState = STATES.IDLE;
  let isPaused = false;
  const history = [];

  const machine = {
    get state() { return currentState; },
    get paused() { return isPaused; },
    get sessionId() { return sessionId; },

    /**
     * Send an event to the machine. Returns the new state or null if transition invalid.
     */
    send(event, payload = {}) {
      const transitions = TRANSITIONS[currentState];
      if (!transitions) {
        console.warn(`[SM:${sessionId}] No transitions from state: ${currentState}`);
        return null;
      }

      const nextState = transitions[event];
      if (!nextState) {
        if (event === EVENTS.START && currentState === STATES.GENERATING) {
          console.warn(`[SM:${sessionId}] Ignored START: System already generating.`);
          return null;
        }
        console.warn(`[SM:${sessionId}] Invalid transition: ${currentState} + ${event}`);
        return null;
      }

      const prevState = currentState;
      currentState = nextState;

      // Handle pause/play within TEACHING state
      if (event === EVENTS.PAUSE) isPaused = true;
      if (event === EVENTS.PLAY || event === EVENTS.RESUME) isPaused = false;
      if (event === EVENTS.DOUBT_ASKED) isPaused = true;

      const transition = {
        from: prevState,
        to: currentState,
        event,
        payload,
        timestamp: Date.now(),
      };

      history.push(transition);
      console.log(`[SM:${sessionId}] ${prevState} → ${currentState} (${event})`);

      // Notify listener
      if (onTransition) {
        onTransition(transition);
      }

      return currentState;
    },

    /**
     * Check if an event is valid from the current state.
     */
    can(event) {
      const transitions = TRANSITIONS[currentState];
      return !!(transitions && transitions[event]);
    },

    /**
     * Get transition history.
     */
    getHistory() {
      return [...history];
    },

    /**
     * Force-reset to IDLE (for cleanup/error recovery).
     */
    forceReset() {
      const prevState = currentState;
      currentState = STATES.IDLE;
      isPaused = false;

      const transition = {
        from: prevState,
        to: STATES.IDLE,
        event: 'FORCE_RESET',
        payload: {},
        timestamp: Date.now(),
      };

      history.push(transition);
      console.log(`[SM:${sessionId}] FORCE RESET: ${prevState} → IDLE`);

      // Notify listener so client state syncs
      if (onTransition) {
        onTransition(transition);
      }
    },
  };

  return machine;
}
