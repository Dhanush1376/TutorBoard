/**
 * Search Gate — Smart Web Search Decision Engine
 * 
 * Determines whether a user query warrants a live web search.
 * Prevents unnecessary API calls for evergreen topics (math, DSA, physics laws)
 * while ensuring fresh data for time-sensitive queries.
 * 
 * Decision matrix:
 *   1. Keyword triggers (latest, recent, 2025-2029, news, current, today)
 *   2. Domain overrides (current_events always search, math never search)
 *   3. Query complexity (very short queries skip search)
 */

// ─── Keyword Patterns ─────────────────────────────────────────────────────────

const FRESHNESS_TRIGGERS = /\b(latest|recent|new|news|current|today|this\s+(?:week|month|year)|now|trending|update|updated|202[5-9]|203[0-9])\b/i;

const COMPARISON_TRIGGERS = /\b(vs\.?|versus|compared?\s+to|difference\s+between|better\s+than|alternative)\b/i;

const TOOL_TRIGGERS = /\b(how\s+to\s+use|setup|install|configure|documentation|docs|pricing|cost)\b/i;

// ─── Evergreen Domains (skip search) ──────────────────────────────────────────

const EVERGREEN_DOMAINS = new Set([
  'math', 'mathematics', 'calculus', 'algebra', 'geometry', 'trigonometry',
  'physics_classical', 'chemistry_basics',
  'dsa', 'data_structures', 'algorithms',
  'logic', 'proof', 'set_theory',
]);

// ─── Always-Search Domains ────────────────────────────────────────────────────

const ALWAYS_SEARCH_DOMAINS = new Set([
  'current_events', 'technology_news', 'ai_ml_latest',
  'market_trends', 'research_papers',
]);

// ─── Evergreen Topic Patterns (skip search even without domain) ───────────────

const EVERGREEN_TOPICS = /^(what\s+is|explain|define|how\s+does)\s+(binary\s+search|bubble\s+sort|merge\s+sort|quick\s+sort|linked\s+list|stack|queue|tree|graph|hash\s+map|array|recursion|dynamic\s+programming|newton|gravity|photosynthesis|mitosis|meiosis|pythagorean|quadratic\s+formula|derivative|integral|matrix|vector|boolean|oop|encapsulation|polymorphism|inheritance)\b/i;

/**
 * Detect whether query + domain combination should trigger a web search.
 * 
 * @param {string} query — The user's query text
 * @param {string} [domain] — Optional domain classification
 * @returns {boolean}
 */
export function shouldSearch(query, domain = '') {
  if (!query || typeof query !== 'string') return false;
  
  const q = query.trim();
  
  // Too short — not enough signal to search
  if (q.length < 10) return false;

  // Domain overrides
  const normalizedDomain = (domain || '').toLowerCase().replace(/\s+/g, '_');
  
  if (ALWAYS_SEARCH_DOMAINS.has(normalizedDomain)) {
    console.log(`[SearchGate] ✅ Domain "${normalizedDomain}" always triggers search.`);
    return true;
  }

  // Keyword triggers (highest priority)
  if (FRESHNESS_TRIGGERS.test(q)) {
    console.log(`[SearchGate] ✅ Freshness keyword detected in query.`);
    return true;
  }

  if (COMPARISON_TRIGGERS.test(q)) {
    console.log(`[SearchGate] ✅ Comparison query detected.`);
    return true;
  }

  if (TOOL_TRIGGERS.test(q)) {
    console.log(`[SearchGate] ✅ Tool/setup query detected.`);
    return true;
  }

  // Evergreen domain — skip search
  if (EVERGREEN_DOMAINS.has(normalizedDomain)) {
    console.log(`[SearchGate] ⏭️ Evergreen domain "${normalizedDomain}" — skipping search.`);
    return false;
  }

  // Evergreen topic pattern — skip search
  if (EVERGREEN_TOPICS.test(q)) {
    console.log(`[SearchGate] ⏭️ Evergreen topic detected — skipping search.`);
    return false;
  }

  // Default: don't search for generic educational queries
  console.log(`[SearchGate] ⏭️ No search triggers found — skipping.`);
  return false;
}

/**
 * Tool-calling decision layer.
 * Detects which tools should be activated for a given query.
 * 
 * @param {string} query 
 * @returns {{ useWebSearch: boolean }}
 */
export function detectTools(query) {
  if (!query || typeof query !== 'string') {
    return { useWebSearch: false };
  }

  // Check for explicit freshness signals
  if (FRESHNESS_TRIGGERS.test(query)) {
    return { useWebSearch: true };
  }

  // Check for comparison/tool queries
  if (COMPARISON_TRIGGERS.test(query) || TOOL_TRIGGERS.test(query)) {
    return { useWebSearch: true };
  }

  return { useWebSearch: false };
}

/**
 * Apply the Chat Planner Agent's web search decision as an override.
 * The planner has full semantic understanding, so it takes precedence.
 * 
 * @param {object} plannerPlan — The structured plan from runChatPlanner
 * @param {boolean} gateDecision — The original shouldSearch/detectTools result
 * @returns {boolean} — Final search decision
 */
export function applyPlannerOverride(plannerPlan, gateDecision) {
  if (!plannerPlan || !plannerPlan.tools) {
    return gateDecision; // No planner result — use gate decision
  }

  const plannerWantsSearch = plannerPlan.tools.web_search === true;

  if (plannerWantsSearch !== gateDecision) {
    console.log(`[SearchGate] Planner override: gate=${gateDecision} → planner=${plannerWantsSearch}`);
  }

  // Planner wins — it has deeper semantic understanding
  return plannerWantsSearch;
}

export default { shouldSearch, detectTools, applyPlannerOverride };
