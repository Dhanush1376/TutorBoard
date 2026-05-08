/**
 * VisualIntentRouter v1.0 — The Core Decision Brain
 *
 * Single authoritative router that replaces fragmented decision-making
 * across intentEngine, chatPlannerAgent, chat.controller, and pedagogyEngine.
 *
 * INPUT:  userMessage, plannerResult, intentResult, sessionContext
 * OUTPUT: VisualIntentDecision — the ONE object that controls the entire response pipeline
 *
 * Responsibilities:
 *   - Decides: chat_only | chat_plus_visual | chat_plus_live_canvas | immersive_teaching | artifact_only
 *   - Prevents over-generation (no canvas for "what is X?")
 *   - Selects renderer mode, teaching mode, streaming strategy
 *   - Selects interaction depth based on query complexity
 *   - Returns a single unified decision consumed by chat.controller.js
 */

import { TEACHING_MODES, detectTeachingMode, getTeachingMode, modeRequiresCanvas, getModeRenderer } from '../config/teachingModes.js';

// ─── Decision Types ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} VisualIntentDecision
 * @property {'chat_only'|'chat_plus_visual'|'chat_plus_live_canvas'|'immersive_teaching'|'artifact_only'} responseMode
 * @property {string} teachingMode - One of TEACHING_MODES keys
 * @property {string|null} rendererType - d3, katex, matter, three, monaco, simulator, narrative, null
 * @property {'text_first'|'parallel'|'visual_first'|'progressive'} streamingStrategy
 * @property {'passive'|'interactive'|'collaborative'} interactionDepth
 * @property {string|null} artifactType - code, ui, document, table, diagram, visual, null
 * @property {'inline'|'split'|'fullscreen'|null} canvasLayout
 * @property {number} confidence - 0-1
 * @property {number} visualBenefitScore - 0-1 score indicating how much visual aids help
 * @property {string} reasoning - Why this decision was made
 */

// ─── Over-Generation Guards ──────────────────────────────────────────────────

const TEXT_ONLY_PATTERNS = [
  /^(hi|hello|hey|sup|yo|good morning|good evening)/i,
  /^(who are you|what are you|what can you do|help)/i,
  /^(thanks|thank you|ok|okay|got it|understood|cool|nice)/i,
  /^(yes|no|sure|maybe|agreed|disagree)/i,
  /\b(define|meaning of|what is the definition)\b/i,
];

const ARTIFACT_ONLY_PATTERNS = [
  /^(write|create|build|generate|make)\s+(a\s+)?(code|script|function|class|component|program)/i,
  /^(create|generate|make)\s+(a\s+)?(document|table|diagram|chart|flowchart)/i,
];

const IMMERSIVE_PATTERNS = [
  /\b(deep dive|full lesson|teach me everything about|immersive|guided tour)\b/i,
  /\b(cinematic|full walkthrough|complete tutorial)\b/i,
];

const DSA_PATTERNS = [
  /\b(array|sorting|searching|binary search|bubble sort|merge sort|quick sort|linked list|stack|queue|tree|graph|algorithm|visualize array|show the array)\b/i,
  /\b(dsa|data structure|pathfinding|traversal|bfs|dfs)\b/i,
];

// ─── Router Class ────────────────────────────────────────────────────────────

/**
 * Route a user message to the appropriate response strategy.
 *
 * @param {Object} params
 * @param {string} params.userMessage - The raw user prompt
 * @param {Object|null} params.plannerResult - Output from chatPlannerAgent
 * @param {Object|null} params.queryUnderstanding - Output from QueryUnderstandingEngine
 * @param {Object} params.sessionContext - Active session state
 * @param {string} [params.sessionContext.activeTopic] - Current topic
 * @param {string[]} [params.sessionContext.openArtifacts] - IDs of open artifacts
 * @param {string} [params.sessionContext.activeRenderer] - Current renderer
 * @param {string} [params.sessionContext.currentTeachingMode] - Current mode
 * @param {number} [params.sessionContext.messageCount] - Messages in session
 * @returns {VisualIntentDecision}
 */
export function routeVisualIntent({ userMessage, plannerResult, queryUnderstanding, sessionContext = {} }) {
  const msg = (userMessage || '').trim();
  const planner = plannerResult || {};
  const queryEng = queryUnderstanding || {};
  const ctx = sessionContext;

  // ── Step 1: Detect Teaching Mode ───────────────────────────────────────
  // Prefer the deep analysis from QueryUnderstandingEngine
  let teachingMode = queryEng.teaching_mode || detectTeachingMode(msg);

  // If planner explicitly suggests deep mode, upgrade
  if (planner.intent === 'deep' && teachingMode === 'explain') {
    teachingMode = 'visualize';
  }
  if (planner.intent === 'test_me') {
    teachingMode = 'quiz';
  }
  if (planner.intent === 'quick') {
    teachingMode = 'explain';
  }

  // If user is already in a teaching mode, respect continuity
  if (ctx.currentTeachingMode && teachingMode === 'explain') {
    const continuityModes = ['visualize', 'simulate', 'coding', 'whiteboard'];
    if (continuityModes.includes(ctx.currentTeachingMode)) {
      // Only maintain continuity if the message is a clear follow-up (referential and short, or explicit marker)
      const isReferential = /\b(it|this|that|these|those|them|they|the\s+former|the\s+latter|that\s+one|such|him|her|his|hers|its)\b/i.test(msg);
      const isShort = msg.length < 60; // Increased length but coupled with referential check
      const hasMarker = /\b(now|next|also|more|further|continue|go\s+on|again|step|back|explain|tell|show)\b/i.test(msg);
      
      // Fix A-08: Tighten follow-up logic. Length alone is not enough.
      const isFollowUp = (isReferential && isShort) || hasMarker;
      if (isFollowUp) {
        teachingMode = ctx.currentTeachingMode;
      }
    }
  }

  const modeConfig = getTeachingMode(teachingMode);

  // ── Step 2: Over-Generation Guards ─────────────────────────────────────
  // Never launch canvas for simple greetings, acknowledgments, or definitions
  const isTextOnly = TEXT_ONLY_PATTERNS.some(p => p.test(msg));
  if (isTextOnly || queryEng.visualization_necessity === 'none') {
    return buildDecision({
      responseMode: 'chat_only',
      teachingMode: 'explain',
      rendererType: null,
      streamingStrategy: 'text_first',
      interactionDepth: 'passive',
      artifactType: null,
      canvasLayout: null,
      confidence: 0.95,
      visualBenefitScore: 0.0,
      reasoning: 'Simple conversational message — text-only response',
    });
  }

  // ── Step 3: Immersive Mode Check ───────────────────────────────────────
  const isImmersive = IMMERSIVE_PATTERNS.some(p => p.test(msg)) || teachingMode === 'immersive';
  if (isImmersive) {
    const renderer = resolveRenderer(queryEng, planner, modeConfig);
    return buildDecision({
      responseMode: 'immersive_teaching',
      teachingMode: 'immersive',
      rendererType: renderer,
      streamingStrategy: 'progressive',
      interactionDepth: 'collaborative',
      artifactType: null,
      canvasLayout: 'fullscreen',
      confidence: 0.9,
      visualBenefitScore: 1.0,
      reasoning: 'Immersive mode — fullscreen cinematic teaching experience',
    });
  }

  // ── Step 4: DSA/Algorithm Check (CRITICAL FIX) ────────────────────────
  // If user is asking for DSA/Algorithm visualization, always favor canvas
  const isDSA = DSA_PATTERNS.some(p => p.test(msg)) || (planner.intent === 'visualize' && ['d3', 'algorithm', 'sorting'].includes(planner.canvas_type));
  if (isDSA) {
    return buildDecision({
      responseMode: 'chat_plus_live_canvas',
      teachingMode: 'visualize',
      rendererType: 'd3',
      streamingStrategy: 'progressive',
      interactionDepth: 'interactive',
      artifactType: null,
      canvasLayout: 'split',
      confidence: 0.95,
      visualBenefitScore: 1.0,
      reasoning: 'DSA/Algorithm intent detected — routing to immersive D3 canvas',
    });
  }

  // ── Step 5: Artifact-Only Check (Fix A-06) ─────────────────────────────
  // Remove the planner.generate_artifact gate. Pattern match alone is enough.
  const isArtifactOnly = ARTIFACT_ONLY_PATTERNS.some(p => p.test(msg));
  if (isArtifactOnly) {
    return buildDecision({
      responseMode: 'artifact_only',
      teachingMode: teachingMode === 'explain' ? 'coding' : teachingMode,
      rendererType: null,
      streamingStrategy: 'parallel',
      interactionDepth: 'interactive',
      artifactType: planner.artifact_type || 'code',
      canvasLayout: 'split',
      confidence: 0.85,
      visualBenefitScore: 0.8,
      reasoning: `Artifact generation request — creating ${planner.artifact_type || 'code'}`,
    });
  }

  // ── Step 5: Canvas Decision ────────────────────────────────────────────
  const plannerWantsCanvas = planner.suggest_canvas === true;
  const queryEngWantsCanvas = ['highly_recommended', 'required'].includes(queryEng.visualization_necessity);
  const modeWantsCanvas = modeRequiresCanvas(teachingMode);
  
  const canvasConfidence = calculateCanvasConfidence(plannerWantsCanvas, queryEngWantsCanvas, modeWantsCanvas, queryEng.confidence);
  const visualBenefitScore = queryEng.visualization_necessity === 'required' ? 1.0 : (queryEng.visualization_necessity === 'highly_recommended' ? 0.8 : (queryEng.visualization_necessity === 'optional' ? 0.5 : 0.0));

  // ONLY generate visual if benefit score is high enough OR user explicitly asks
  const userExplicitlyRequested = modeWantsCanvas || queryEngWantsCanvas;
  const shouldUseCanvas = userExplicitlyRequested || (canvasConfidence >= 0.6 && visualBenefitScore >= 0.75);

  // ── Step 6: Artifact Decision ──────────────────────────────────────────
  const shouldGenerateArtifact = planner.generate_artifact === true;

  // ── Step 7: Determine Response Mode ────────────────────────────────────
  let responseMode = 'chat_only';
  if (shouldUseCanvas) {
    responseMode = 'chat_plus_live_canvas';
  } else if (shouldGenerateArtifact) {
    responseMode = 'chat_plus_visual';
  }

  // ── Step 8: Resolve Renderer ───────────────────────────────────────────
  const rendererType = shouldUseCanvas ? resolveRenderer(queryEng, planner, modeConfig) : null;

  // ── Step 9: Determine Streaming Strategy ───────────────────────────────
  const streamingStrategy = determineStreamingStrategy(responseMode, teachingMode);

  // ── Step 10: Determine Interaction Depth ───────────────────────────────
  const interactionDepth = modeConfig.interactionStyle || 'passive';

  // ── Step 11: Canvas Layout ─────────────────────────────────────────────
  let canvasLayout = null;
  if (shouldUseCanvas) {
    canvasLayout = modeConfig.layout === 'fullscreen' ? 'fullscreen' : 'split';
  }

  // ── Step 12: Build Reasoning ───────────────────────────────────────────
  const parts = [];
  if (shouldUseCanvas) parts.push(`canvas=${rendererType}`);
  if (shouldGenerateArtifact) parts.push(`artifact=${planner.artifact_type}`);
  parts.push(`mode=${teachingMode}`);
  parts.push(`conf=${canvasConfidence.toFixed(2)}`);
  const reasoning = `Route: ${responseMode} [${parts.join(', ')}]`;

  return buildDecision({
    responseMode,
    teachingMode,
    rendererType,
    streamingStrategy,
    interactionDepth,
    artifactType: shouldGenerateArtifact ? (planner.artifact_type || 'code') : null,
    canvasLayout,
    confidence: canvasConfidence,
    visualBenefitScore,
    reasoning,
  });
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function buildDecision(overrides) {
  return {
    responseMode: 'chat_only',
    teachingMode: 'explain',
    rendererType: null,
    streamingStrategy: 'text_first',
    interactionDepth: 'passive',
    artifactType: null,
    canvasLayout: null,
    confidence: 0.5,
    visualBenefitScore: 0.0,
    reasoning: '',
    ...overrides,
  };
}

/**
 * Resolve the best renderer from intent, planner, and mode signals.
 * Priority: mode override > planner canvas_type > query renderer
 */
function resolveRenderer(queryEng, planner, modeConfig) {
  // Mode-specific renderer takes highest priority
  const modeRenderer = modeConfig.preferredRenderer;
  if (modeRenderer && modeRenderer !== 'auto') {
    return modeRenderer;
  }

  // Planner's canvas_type (it has the richest context)
  if (planner.canvas_type) {
    return planner.canvas_type;
  }

  // Query Understanding Engine's renderer
  if (queryEng.renderer && queryEng.renderer !== 'none') {
    return queryEng.renderer;
  }

  // Fallback
  return 'cinematic';
}

/**
 * Calculate canvas confidence from multiple signals.
 * Uses a weighted voting system.
 */
function calculateCanvasConfidence(plannerWants, intentWants, modeWants, intentConfidence = 0.5) {
  let score = 0;
  let weight = 0;

  // Planner signal (weight 0.4) — it has the richest context
  if (plannerWants) { score += 0.4; }
  weight += 0.4;

  // Intent signal (weight 0.35, scaled by intent confidence)
  if (intentWants) { score += 0.35 * (intentConfidence || 0.5); }
  weight += 0.35;

  // Teaching mode signal (weight 0.25)
  if (modeWants) { score += 0.25; }
  weight += 0.25;

  return weight > 0 ? score / weight : 0;
}

/**
 * Determine SSE streaming strategy based on response mode and teaching mode.
 */
function determineStreamingStrategy(responseMode, teachingMode) {
  if (responseMode === 'immersive_teaching') return 'progressive';
  if (responseMode === 'chat_plus_live_canvas') {
    // For canvas modes, stream text first while canvas generates in parallel
    if (teachingMode === 'simulate' || teachingMode === 'coding') return 'parallel';
    return 'progressive';
  }
  if (responseMode === 'chat_plus_visual') return 'parallel';
  return 'text_first';
}

export default { routeVisualIntent };
