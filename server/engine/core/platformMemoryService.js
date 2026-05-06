/**
 * PlatformMemoryService v1.0 — Contextual Educational Memory
 *
 * Provides the AI with awareness of the student's CURRENT session state.
 * This is NOT database persistence (that already exists in ChatSession/Artifact models).
 * This is CONTEXTUAL AWARENESS — what the student is looking at RIGHT NOW.
 *
 * Used by: BuildSystemPrompt.js, chat.controller.js, VisualIntentRouter
 *
 * Example: User says "Compare this with merge sort"
 *   → PlatformMemory detects bubble sort artifact is open
 *   → Injects "Student is currently viewing: Bubble Sort (D3 renderer)"
 *   → AI automatically knows to create a side-by-side comparison
 */

// ─── In-Memory Session Context Store ─────────────────────────────────────────
// Keyed by sessionId. Evicted after 30 minutes of inactivity.

const memoryStore = new Map();
const MEMORY_TTL = 30 * 60 * 1000; // 30 minutes

// ─── PlatformMemory Schema ──────────────────────────────────────────────────

/**
 * @typedef {Object} PlatformMemory
 * @property {string} sessionId
 * @property {string} activeTopic - Current learning subject
 * @property {string[]} openedArtifacts - IDs of currently visible artifacts
 * @property {string} activeRenderer - Currently active renderer type
 * @property {string} activeTeachingMode - Current teaching mode
 * @property {TeachingHistoryEntry[]} teachingHistory - Recent interactions
 * @property {string} learningDepth - surface | core | advanced
 * @property {Object|null} previousVisualContext - Last canvas state summary
 * @property {string[]} sessionGoals - Learning goals for this session
 * @property {Object} conceptGraph - Connected concepts explored
 * @property {number} lastUpdated - Timestamp
 */

/**
 * @typedef {Object} TeachingHistoryEntry
 * @property {string} topic
 * @property {string} mode
 * @property {string} renderer
 * @property {number} timestamp
 * @property {string} [outcome] - success | partial | abandoned
 */

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get or create the platform memory for a session.
 * Fix S-01: Verify ownership via composite key.
 */
export function getMemory(userId, sessionId) {
  evictStale();
  const key = `${userId || 'guest'}:${sessionId}`;
  let memory = memoryStore.get(key);
  if (!memory) {
    memory = createEmptyMemory(userId, sessionId);
    memoryStore.set(key, memory);
  }
  return memory;
}

/**
 * Update specific fields in the platform memory.
 */
export function updateMemory(userId, sessionId, updates) {
  const memory = getMemory(userId, sessionId);
  const key = `${userId || 'guest'}:${sessionId}`;
  Object.assign(memory, updates, { lastUpdated: Date.now() });
  memoryStore.set(key, memory);
  return memory;
}

/**
 * Record a teaching interaction in the history.
 */
export function recordTeachingInteraction(userId, sessionId, { topic, mode, renderer, outcome }) {
  const memory = getMemory(userId, sessionId);
  memory.teachingHistory.push({
    topic,
    mode: mode || 'explain',
    renderer: renderer || null,
    timestamp: Date.now(),
    outcome: outcome || 'success',
  });

  // Keep only last 20 interactions
  if (memory.teachingHistory.length > 20) {
    memory.teachingHistory = memory.teachingHistory.slice(-20);
  }

  // Update concept graph
  if (topic) {
    memory.conceptGraph[topic] = (memory.conceptGraph[topic] || 0) + 1;
  }

  // Auto-detect learning depth from interaction count on same topic
  const topicCount = memory.teachingHistory.filter(h => h.topic === topic).length;
  if (topicCount >= 5) {
    memory.learningDepth = 'advanced';
  } else if (topicCount >= 2) {
    memory.learningDepth = 'core';
  } else {
    memory.learningDepth = 'surface';
  }

  memory.activeTopic = topic;
  memory.lastUpdated = Date.now();
  updateMemory(userId, sessionId, memory);
}

/**
 * Track which artifacts are currently open.
 */
export function setOpenArtifacts(userId, sessionId, artifactIds) {
  updateMemory(userId, sessionId, { openedArtifacts: artifactIds || [] });
}

/**
 * Track the active renderer.
 */
export function setActiveRenderer(userId, sessionId, renderer) {
  updateMemory(userId, sessionId, { activeRenderer: renderer });
}

/**
 * Track the active teaching mode.
 */
export function setActiveTeachingMode(userId, sessionId, mode) {
  updateMemory(userId, sessionId, { activeTeachingMode: mode });
}

/**
 * Save a snapshot of the current visual context (for "compare with previous").
 */
export function saveVisualContext(userId, sessionId, context) {
  updateMemory(userId, sessionId, { previousVisualContext: context });
}

/**
 * Build a context string for injection into the AI system prompt.
 * This is the PRIMARY output consumed by BuildSystemPrompt.js.
 */
export function buildContextForPrompt(userId, sessionId) {
  const memory = getMemory(userId, sessionId);
  
  // FIX I-04: Read-extends-TTL (Touch lastUpdated on every read)
  memory.lastUpdated = Date.now();

  const parts = [];

  if (memory.activeTopic) {
    parts.push(`Currently teaching: ${memory.activeTopic}`);
  }

  if (memory.activeRenderer) {
    parts.push(`Active renderer: ${memory.activeRenderer}`);
  }

  if (memory.activeTeachingMode && memory.activeTeachingMode !== 'explain') {
    parts.push(`Teaching mode: ${memory.activeTeachingMode}`);
  }

  if (memory.learningDepth && memory.learningDepth !== 'surface') {
    parts.push(`Student depth: ${memory.learningDepth} (they've explored this topic multiple times)`);
  }

  if (memory.openedArtifacts.length > 0) {
    parts.push(`Open artifacts: ${memory.openedArtifacts.join(', ')}`);
  }

  if (memory.previousVisualContext) {
    const ctx = memory.previousVisualContext;
    parts.push(`Previous visual: ${ctx.title || ctx.topic || 'Last lesson'} (${ctx.renderer || 'cinematic'})`);
  }

  // Recent topics for continuity
  const recentTopics = [...new Set(memory.teachingHistory.slice(-5).map(h => h.topic))].filter(Boolean);
  if (recentTopics.length > 1) {
    parts.push(`Recent topics: ${recentTopics.join(' → ')}`);
  }

  if (memory.sessionGoals.length > 0) {
    parts.push(`Session goals: ${memory.sessionGoals.join(', ')}`);
  }

  if (parts.length === 0) return '';

  return `\n━━━ ACTIVE CONTEXT ━━━\n${parts.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Clear memory for a session (on session end/switch).
 */
export function clearMemory(userId, sessionId) {
  const key = `${userId || 'guest'}:${sessionId}`;
  memoryStore.delete(key);
}

// ─── Private ─────────────────────────────────────────────────────────────────

function createEmptyMemory(userId, sessionId) {
  return {
    userId: userId || 'guest',
    sessionId,
    activeTopic: null,
    openedArtifacts: [],
    activeRenderer: null,
    activeTeachingMode: 'explain',
    teachingHistory: [],
    learningDepth: 'surface',
    previousVisualContext: null,
    sessionGoals: [],
    conceptGraph: {},
    lastUpdated: Date.now(),
  };
}

function evictStale() {
  const now = Date.now();
  for (const [key, memory] of memoryStore) {
    if (now - memory.lastUpdated > MEMORY_TTL) {
      memoryStore.delete(key);
    }
  }
}

export default {
  getMemory,
  updateMemory,
  recordTeachingInteraction,
  setOpenArtifacts,
  setActiveRenderer,
  setActiveTeachingMode,
  saveVisualContext,
  buildContextForPrompt,
  clearMemory,
};
