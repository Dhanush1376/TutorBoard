/**
 * Animation Planner v1.0 — Concept Classification & Renderer Selection
 *
 * Sits between intentEngine and agentLoop.
 * Classifies the concept type, picks the optimal renderer,
 * and sets the creative freedom budget for the agent.
 *
 * Input:  { topic, domain }
 * Output: { conceptType, renderer, animationStyle, freedomLevel, domainGuide }
 */

import { requestCompletion, getTextModel } from '../../utils/ai/llmClient.js';
import { getAnimationGuide, getDomainMeta, DOMAIN_SCENE_SCAFFOLDS } from '../config/domainConfig.js';

// ─── Concept Type Heuristics (fast, zero-LLM fallback) ──────────────────────

const CONCEPT_PATTERNS = {
  FLOW:       /\b(sort|search|traversal|bfs|dfs|linked list|pipeline|process|flow|pathway|cycle|digestion|circulation|step.?by.?step)\b/i,
  PHYSICS:    /\b(force|motion|wave|orbit|gravity|solar|planet|star|astronomy|oscillat|pendulum|projectile|field|electromagnetic|optic|refract|diffract|energy|momentum|velocity|acceleration|spring|collision|circuit|satellite)\b/i,
  DATA:       /\b(array|matrix|table|graph|tree|heap|stack|queue|hash|set|map|database|schema|data.?struct|network|neural|cluster)\b/i,
  NARRATIVE:  /\b(history|war|battle|revolution|empire|timeline|era|century|dynasty|evolution|cause.?effect|civil.?rights|independence|colonialism|biography|movement|politics|civilization)\b/i,
  COMPARISON: /\b(vs|versus|compare|comparison|difference|between|contrast|pros.?cons|advantage|disadvantage|tradeoff)\b/i,
  ABSTRACT:   /\b(theory|theorem|proof|principle|concept|law|definition|axiom|postulate|hypothesis|philosophy|logic|ethics|epistemology)\b/i,
};

const RENDERER_MAP = {
  FLOW:       'd3',
  PHYSICS:    'matter',
  DATA:       'd3',
  NARRATIVE:  'narrative',
  COMPARISON: 'cinematic',
  ABSTRACT:   'cinematic', // katex reserved for explicit math/equation topics via intentEngine
};

const STYLE_MAP = {
  FLOW:       'linear',
  PHYSICS:    'simulation',
  DATA:       'radial',
  NARRATIVE:  'timeline',
  COMPARISON: 'comparison',
  ABSTRACT:   'radial',
};

/**
 * Fast heuristic classification (no LLM call needed).
 */
function classifyFast(topic) {
  const scores = {};
  for (const [type, pattern] of Object.entries(CONCEPT_PATTERNS)) {
    const matches = (topic.match(pattern) || []).length;
    if (matches > 0) scores[type] = matches;
  }

  if (Object.keys(scores).length === 0) return 'FLOW'; // Safe default

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * LLM-powered classification for ambiguous topics.
 * Only called if the fast classifier has low confidence.
 */
async function classifyDeep(topic, domain) {
  try {
    const res = await requestCompletion({
      model: getTextModel(),
      messages: [{
        role: 'user',
        content: `Classify this educational topic into exactly ONE concept type.

Topic: "${topic}"
Domain: ${domain}

Concept types:
- FLOW: Sequential processes, algorithms, pipelines, biological pathways
- PHYSICS: Motion, forces, waves, orbits, energy systems, field interactions
- DATA: Data structures, networks, matrices, statistical charts, hierarchies
- NARRATIVE: Historical events, timelines, cause-effect chains, evolution stories
- COMPARISON: Comparing two or more things, trade-offs, vs analysis
- ABSTRACT: Pure theory, proofs, philosophical concepts, definitions, axioms

Return ONLY a JSON: { "conceptType": "TYPE", "confidence": 0.0-1.0, "reason": "one sentence" }`
      }],
      temperature: 0,
      maxTokens: 120,
      responseMimeType: 'application/json'
    });

    const parsed = JSON.parse(res.content || '{}');
    return parsed.conceptType || 'FLOW';
  } catch (err) {
    console.error(`[AnimationPlanner] ⚠️ Deep classification failed: ${err.message}. Falling back to heuristics.`);
    return classifyFast(topic);
  }
}

/**
 * Main Planning Function
 *
 * @param {string} topic - The user's topic
 * @param {string} domain - Detected domain from domainConfig
 * @returns {Promise<PlanningResult>}
 */
export async function planAnimation(topic, domain) {
  // 1. Fast classify
  const fastType = classifyFast(topic);

  // 2. Check confidence — if multiple patterns match (high ambiguity), use LLM
  const matchCount = Object.values(CONCEPT_PATTERNS).filter(p => p.test(topic)).length;
  const conceptType = matchCount > 3
    ? await classifyDeep(topic, domain)
    : fastType;

  // 3. Select renderer and style
  const renderer = RENDERER_MAP[conceptType] || 'cinematic';
  const animationStyle = STYLE_MAP[conceptType] || 'linear';

  // 4. Freedom level: high for most, medium for data structures (need precision)
  const freedomLevel = conceptType === 'DATA' ? 'medium' : 'high';

  // 5. Get domain-specific animation guide
  const domainGuide = getAnimationGuide(domain);
  const domainMeta = getDomainMeta(domain);

  const result = {
    conceptType,
    renderer,
    animationStyle,
    freedomLevel,
    domain,
    domainGuide,
    domainMeta,
    scaffolds: DOMAIN_SCENE_SCAFFOLDS[domain] || [],
    topic,
  };

  console.log(`[AnimationPlanner] 🎯 ${topic} → ${conceptType} → renderer:${renderer} style:${animationStyle} freedom:${freedomLevel}`);
  return result;
}
