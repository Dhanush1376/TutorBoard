/**
 * chatPlannerAgent.js — UPGRADED
 *
 * Changes:
 * 1. Detects math/formula queries more precisely
 * 2. Signals `suggest_canvas` so the main LLM knows when to mention canvas
 * 3. Better artifact_type decisions (diagram for hierarchy, table for comparisons)
 * 4. canvas_type field tells the client which renderer to use
 * 5. Passes context correctly (was always empty strings before)
 */

import { requestCompletion, getTextModel, resolveModelId } from '../../utils/ai/llmClient.js';

const CHAT_PLANNER_PROMPT = `You are the Planner Agent of TutorBoard AI.

Analyze the user query and return a structured JSON plan that controls how the AI responds.

━━━━━━━━━━━━━━━━━━━━━━━━━
INPUTS
━━━━━━━━━━━━━━━━━━━━━━━━━

User Query: {{QUERY}}
Past Context: {{PAST_CONTEXT}}
Web Data Available: {{HAS_WEB_CONTEXT}}

━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR DECISIONS
━━━━━━━━━━━━━━━━━━━━━━━━━

1. CONTENT TYPE (pick one):
   concept | coding | ui_design | comparison | math | general

2. COMPLEXITY: beginner | intermediate | advanced

3. TONE: teaching | storytelling | intuitive | technical | encouraging

4. SECTIONS (dynamic list, only include relevant ones):
   Available: title, introduction, core_explanation, formula, analogy, 
   code_example, comparison_table, visual_insight, summary, practice_problem
   → Include only what genuinely helps for this query. Maximum 6 sections.

5. TOOLS:
   - use_web_search → true if query is about recent/live events, trends, current versions
   - use_code_block → true if user expects working code
   - use_formula → true if the topic has mathematical formulas (physics, math, ML, algorithms with complexity)
   - use_table → true if comparing 3+ items or showing structured data

6. ARTIFACT:
   - generate_artifact → true for: code to write, UI to build, document to create, diagram to draw, data table
   - artifact_type → "code" | "ui" | "document" | "table" | "diagram"
   - artifact_count → 1-3
   - artifact_types → array if multiple

   ARTIFACT RULES:
   - "write/implement/build X" → code artifact
   - "create UI/component/layout" → ui artifact  
   - "create notes/summary/cheatsheet" → document artifact
   - "compare A vs B vs C" → table artifact
   - "draw diagram/flowchart/hierarchy" → diagram artifact
   - "explain concept X" → NO artifact (just explain in chat)
   - "what is X" → NO artifact
   - Maximum 3 artifacts per response

7. CANVAS:
   - suggest_canvas → true ONLY when the topic genuinely benefits from visual animation
   - canvas_type → "cinematic" | "d3" | "physics" | "narrative" | "simulator"
   
   CANVAS RULES (be selective):
   - Data structures (tree, graph, linked list, hash table) → suggest_canvas: true, canvas_type: "d3"
   - Sorting/searching algorithms (bubble sort, binary search, BFS, DFS) → suggest_canvas: true, canvas_type: "d3"
   - Physics concepts (pendulum, projectile, waves) → suggest_canvas: true, canvas_type: "physics"
   - Sequential processes (HTTP request lifecycle, CPU scheduling) → suggest_canvas: true, canvas_type: "cinematic"
   - Abstract CS concepts (recursion, pointers, memory) → suggest_canvas: true, canvas_type: "cinematic"
   - Historical events, biographies, definitions → suggest_canvas: false
   - Coding syntax, debugging → suggest_canvas: false
   - Math formulas (without visual processes) → suggest_canvas: false

━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT (strict JSON only)
━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "content_type": "concept",
  "complexity": "intermediate",
  "tone": "teaching",
  "sections": ["introduction", "core_explanation", "formula", "summary"],
  "use_web_search": false,
  "use_code_block": false,
  "use_formula": false,
  "use_table": false,
  "generate_artifact": false,
  "artifact_type": null,
  "artifact_count": 1,
  "artifact_types": [],
  "suggest_canvas": false,
  "canvas_type": null
}`;

// ─── Regex Fallback Classifier ────────────────────────────────────────────────

const CODING_PATTERNS = /\b(write|implement|create|build|code|function|class|algorithm|program|script|api|endpoint|component|hook|sort|search)\b/i;
const MATH_PATTERNS = /\b(formula|equation|derivative|integral|matrix|vector|probability|gradient|loss|entropy|theorem|proof|complexity|O\(n\)|Big.?O)\b/i;
const COMPARISON_PATTERNS = /\b(vs|versus|difference between|compare|comparison|better|faster|when to use)\b/i;
const UI_PATTERNS = /\b(ui|interface|layout|component|page|design|dashboard|form|button|navbar|sidebar|modal)\b/i;
const CANVAS_DS_PATTERNS = /\b(binary tree|linked list|graph|heap|hash table|trie|stack|queue|BFS|DFS|dijkstra|sorting|quicksort|mergesort|binary search|traversal)\b/i;
const CANVAS_ALGO_PATTERNS = /\b(algorithm|step.?by.?step|how does .+ work|execution|simulation|animate|visualize)\b/i;
const CANVAS_PHYSICS_PATTERNS = /\b(pendulum|projectile|wave|circuit|orbit|gravity|spring|collision|motion|force|energy)\b/i;
const WEB_SEARCH_PATTERNS = /\b(latest|current|2024|2025|2026|recent|today|now|trending|news|version|release|update)\b/i;
const ARTIFACT_CODE_PATTERNS = /\b(write|implement|build|create|make|code|function|script|program|generate|develop)\b.{0,40}\b(code|function|class|script|algorithm|program|api|component|hook|server|app)\b/i;
const ARTIFACT_DIAGRAM_PATTERNS = /\b(draw|show|create|make|diagram|flowchart|hierarchy|chart|mind map|structure of|architecture of)\b/i;
const ARTIFACT_TABLE_PATTERNS = /\b(compare|comparison table|list all|show all|differences between)\b.{0,30}\b(and|vs|versus)\b/i;

function buildFallbackPlan(query) {
  const q = query.toLowerCase();
  const isCoding = CODING_PATTERNS.test(query);
  const isMath = MATH_PATTERNS.test(query);
  const isComparison = COMPARISON_PATTERNS.test(query);
  const isUI = UI_PATTERNS.test(query);
  const isCanvasDS = CANVAS_DS_PATTERNS.test(query);
  const isCanvasAlgo = CANVAS_ALGO_PATTERNS.test(query);
  const isCanvasPhysics = CANVAS_PHYSICS_PATTERNS.test(query);
  const wantsCode = ARTIFACT_CODE_PATTERNS.test(query);
  const wantsDiagram = ARTIFACT_DIAGRAM_PATTERNS.test(query);
  const wantsTable = ARTIFACT_TABLE_PATTERNS.test(query);

  const suggestCanvas = isCanvasDS || isCanvasPhysics;
  const canvasType = isCanvasPhysics ? 'physics' : isCanvasDS ? 'd3' : isCanvasAlgo ? 'cinematic' : null;

  return {
    content_type: isUI ? 'ui_design' : isMath ? 'math' : isComparison ? 'comparison' : isCoding ? 'coding' : 'concept',
    complexity: 'intermediate',
    tone: isMath ? 'technical' : isCoding ? 'technical' : 'teaching',
    sections: [
      'introduction',
      'core_explanation',
      ...(isMath ? ['formula'] : []),
      ...(isCoding || wantsCode ? ['code_example'] : []),
      ...(isComparison || wantsTable ? ['comparison_table'] : []),
      'summary',
    ],
    use_web_search: WEB_SEARCH_PATTERNS.test(query),
    use_code_block: isCoding || wantsCode,
    use_formula: isMath,
    use_table: isComparison || wantsTable,
    generate_artifact: wantsCode || wantsDiagram || wantsTable || isUI,
    artifact_type: isUI ? 'ui' : wantsDiagram ? 'diagram' : wantsTable ? 'table' : wantsCode ? 'code' : null,
    artifact_count: 1,
    artifact_types: [],
    suggest_canvas: suggestCanvas,
    canvas_type: canvasType,
  };
}

// ─── Main Planner ─────────────────────────────────────────────────────────────

export async function runChatPlanner(userMessage, pastContext = '', webContext = '', userConfig = null) {
  const prompt = CHAT_PLANNER_PROMPT
    .replace('{{QUERY}}', userMessage)
    .replace('{{PAST_CONTEXT}}', pastContext || 'None')
    .replace('{{HAS_WEB_CONTEXT}}', webContext ? 'Yes' : 'No');

  try {
    const modelId = getTextModel();
    const res = await requestCompletion({
      model: modelId,
      userConfig,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      max_tokens: 600,
      responseMimeType: 'application/json',
    });

    const raw = (res.content || '{}').replace(/```json|```/g, '').trim();

    // Find the JSON object
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');

    const parsed = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));

    // Validate required fields exist
    if (!parsed.content_type || !parsed.tone) throw new Error('Missing required fields');

    console.log(`[Planner] ✓ Plan: type=${parsed.content_type}, artifact=${parsed.generate_artifact}, canvas=${parsed.suggest_canvas}, canvas_type=${parsed.canvas_type}`);
    return parsed;
  } catch (err) {
    console.warn('[Planner] LLM classification failed, using regex fallback:', err.message);
    return buildFallbackPlan(userMessage);
  }
}