/**
 * Chat Planner Agent — Structured Query Classification Layer
 * 
 * Pre-processes every user query before the main LLM generates its response.
 * Classifies the query by content type, complexity, intent, and decides:
 *   - Which tools to activate (web search, code blocks, formulas, tables, visuals)
 *   - Which sections the response should include
 *   - What tone to use
 * 
 * The output JSON plan is injected into the system prompt to dynamically
 * shape the main LLM's response structure.
 * 
 * Architecture:
 *   1. Fast, cheap LLM call (temperature: 0, JSON mode)
 *   2. Graceful regex-based fallback if LLM fails
 *   3. ~500ms latency — runs in parallel with web search
 */

import { requestCompletion, getTextModel, resolveModelId } from '../../utils/ai/llmClient.js';

// ─── Prompt Template ──────────────────────────────────────────────────────────

const CHAT_PLANNER_PROMPT = `You are the Planner Agent of TutorBoard AI.

Your job is to deeply understand the user query and decide HOW the final answer should be generated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

User Query:
{{QUERY}}

Past Context:
{{PAST_CONTEXT}}

Web Data Available:
{{HAS_WEB_CONTEXT}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analyze the query and produce a structured plan in JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: CLASSIFY QUERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Determine:

1. content_type:
- concept
- coding
- ui_design
- comparison
- math
- general

2. complexity:
- beginner
- intermediate
- advanced

3. intent:
- explanation
- implementation
- learning
- comparison

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: TOOL DECISION
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Decide:

- use_web_search → true/false  
- use_code_block → true/false  
- use_formula → true/false  
- use_table → true/false  
- use_visual_explanation → true/false  

Rules:
- Use web search for latest/dynamic topics
- Use formula only if mathematically relevant
- Use table only if comparison is useful
- Use code only if user expects implementation

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: STRUCTURE PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Decide sections dynamically:

Example:

[
  "title",
  "introduction",
  "core_explanation",
  "formula",
  "example",
  "table",
  "visual_insight"
]

IMPORTANT:
- Do NOT include unnecessary sections
- Keep it minimal and relevant

━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: EXPLANATION STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose tone:

- teaching
- storytelling
- intuitive
- technical

━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "content_type": "",
  "complexity": "",
  "intent": "",
  "tools": {
    "web_search": false,
    "code": false,
    "formula": false,
    "table": false,
    "visual": false
  },
  "sections": [],
  "tone": ""
}

DO NOT explain anything.
DO NOT generate the final answer.
ONLY return JSON.`;

// ─── Regex-Based Fallback Heuristics ──────────────────────────────────────────

const CODING_PATTERNS = /\b(implement|code|program|function|algorithm|debug|javascript|python|java|react|node|api|class|loop|array|sort|search|leetcode|compile|syntax|variable|recursion|stack|queue|linked\s*list|tree|graph|hash)\b/i;
const MATH_PATTERNS = /\b(derivative|integral|equation|formula|calculus|algebra|geometry|trigonometry|matrix|vector|probability|statistics|theorem|proof|solve|calculate|compute)\b/i;
const COMPARISON_PATTERNS = /\b(vs\.?|versus|compared?\s+to|difference\s+between|better\s+than|alternative|pros?\s+and\s+cons?|advantages?\s+and\s+disadvantages?)\b/i;
const UI_DESIGN_PATTERNS = /\b(ui|ux|design|layout|component|responsive|css|tailwind|figma|wireframe|prototype|mockup|animation|transition)\b/i;
const FRESHNESS_PATTERNS = /\b(latest|recent|new|news|current|today|this\s+(?:week|month|year)|now|trending|update|updated|202[5-9]|203[0-9])\b/i;
const ADVANCED_PATTERNS = /\b(prove|derive|theorem|proof|induction|optimize|architect|benchmark|parallelize|distributed|differential|topology|quantum)\b/i;

/**
 * Generate a fallback plan using regex heuristics when the LLM call fails.
 * @param {string} query 
 * @param {boolean} hasWebContext 
 * @returns {object} — Structured plan JSON
 */
function buildFallbackPlan(query, hasWebContext) {
  const q = (query || '').toLowerCase();

  // Content type detection
  let content_type = 'general';
  if (CODING_PATTERNS.test(q)) content_type = 'coding';
  else if (MATH_PATTERNS.test(q)) content_type = 'math';
  else if (COMPARISON_PATTERNS.test(q)) content_type = 'comparison';
  else if (UI_DESIGN_PATTERNS.test(q)) content_type = 'ui_design';
  else if (q.split(/\s+/).length > 5) content_type = 'concept';

  // Complexity detection
  let complexity = 'intermediate';
  if (ADVANCED_PATTERNS.test(q) || q.split(/\s+/).length > 30) complexity = 'advanced';
  else if (q.split(/\s+/).length <= 5) complexity = 'beginner';

  // Intent detection
  let intent = 'explanation';
  if (CODING_PATTERNS.test(q) && /\b(implement|build|create|write|code)\b/i.test(q)) intent = 'implementation';
  else if (COMPARISON_PATTERNS.test(q)) intent = 'comparison';
  else if (/\b(learn|understand|what\s+is|explain|how\s+does)\b/i.test(q)) intent = 'learning';

  // Tool decisions
  const tools = {
    web_search: FRESHNESS_PATTERNS.test(q) || hasWebContext,
    code: content_type === 'coding',
    formula: content_type === 'math',
    table: content_type === 'comparison',
    visual: false,
  };

  // Section planning
  const sections = ['title', 'introduction', 'core_explanation'];
  if (tools.formula) sections.push('formula');
  if (tools.code) sections.push('code_example');
  if (tools.table) sections.push('comparison_table');
  sections.push('example');

  // Tone
  let tone = 'teaching';
  if (content_type === 'coding') tone = 'technical';
  else if (complexity === 'beginner') tone = 'intuitive';
  else if (content_type === 'concept') tone = 'storytelling';

  return { content_type, complexity, intent, tools, sections, tone };
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

/**
 * Execute the Chat Planner Agent.
 * Makes a fast LLM call to classify the query and produce a structured plan.
 * Falls back to regex heuristics if the LLM call fails.
 * 
 * @param {string} query — The user's message
 * @param {string} pastContext — RAG context from previous sessions
 * @param {string} webContext — Formatted web search context (or empty string)
 * @param {object} [userConfig] — User's API configuration
 * @returns {Promise<object>} — Structured plan JSON
 */
export async function runChatPlanner(query, pastContext = '', webContext = '', userConfig = null) {
  const startTime = Date.now();
  const hasWebContext = !!(webContext && webContext.length > 0);

  try {
    // Hydrate prompt template
    const hydratedPrompt = CHAT_PLANNER_PROMPT
      .replace('{{QUERY}}', query)
      .replace('{{PAST_CONTEXT}}', pastContext || 'No prior context available.')
      .replace('{{HAS_WEB_CONTEXT}}', hasWebContext ? 'Yes — web data is available and should be referenced.' : 'No — rely on internal knowledge only.');

    const result = await requestCompletion({
      model: resolveModelId(getTextModel()),
      messages: [
        { role: 'system', content: hydratedPrompt },
      ],
      temperature: 0,
      maxTokens: 500,
      responseMimeType: 'application/json',
      userConfig,
      taskType: 'classification',
    });

    if (result.error || !result.content) {
      console.warn(`[ChatPlanner] LLM returned error or empty: ${result.error}`);
      return buildFallbackPlan(query, hasWebContext);
    }

    // Parse JSON response
    const raw = (result.content || '{}').replace(/```json|```/g, '').trim();
    const plan = JSON.parse(raw);

    // Validate required fields
    if (!plan.content_type || !plan.tools || !plan.sections) {
      console.warn('[ChatPlanner] LLM returned incomplete plan — falling back to heuristics.');
      return buildFallbackPlan(query, hasWebContext);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[ChatPlanner] Classified: ${plan.content_type}/${plan.complexity} | Intent: ${plan.intent} | Tone: ${plan.tone} | ${elapsed}ms`);

    return plan;

  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[ChatPlanner] Failed after ${elapsed}ms: ${err.message}. Using fallback heuristics.`);
    return buildFallbackPlan(query, hasWebContext);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { CHAT_PLANNER_PROMPT, buildFallbackPlan };
export default { runChatPlanner, buildFallbackPlan };
