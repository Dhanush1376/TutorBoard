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
  DOUBT_TRIGGERED: 'DOUBT_TRIGGERED',
  RESPONDING: 'RESPONDING',
  RESUMING: 'RESUMING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
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
  },
  [STATES.TEACHING]: {
    [EVENTS.STEP_COMPLETE]: STATES.TEACHING,     // stays in TEACHING, advances step
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED,
    [EVENTS.FINISH]: STATES.COMPLETED,
    [EVENTS.FAIL]: STATES.ERROR,
    [EVENTS.PAUSE]: STATES.TEACHING,              // stays, but pauses playback
  },
  [STATES.DOUBT_TRIGGERED]: {
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED, // allow re-asking while paused
    [EVENTS.DOUBT_RESPONSE_READY]: STATES.RESPONDING,  // wait until we start responding
    [EVENTS.FAIL]: STATES.ERROR,
  },
  [STATES.RESPONDING]: {
    [EVENTS.RESUME]: STATES.RESUMING,
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED, // new doubt while viewing response
    [EVENTS.FAIL]: STATES.ERROR,
  },
  [STATES.RESUMING]: {
    [EVENTS.STEP_COMPLETE]: STATES.TEACHING,
    [EVENTS.PLAY]: STATES.TEACHING,
    [EVENTS.DOUBT_ASKED]: STATES.DOUBT_TRIGGERED,
    [EVENTS.FINISH]: STATES.COMPLETED,
    [EVENTS.FAIL]: STATES.ERROR,
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
  },
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
      history.push({
        from: prevState,
        to: STATES.IDLE,
        event: 'FORCE_RESET',
        payload: {},
        timestamp: Date.now(),
      });
      console.log(`[SM:${sessionId}] FORCE RESET: ${prevState} → IDLE`);
    },
  };

  return machine;
}
