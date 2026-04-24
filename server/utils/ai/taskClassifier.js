/**
 * Task Classifier v3 — Scoring-Based Complexity Engine
 * 
 * Replaces keyword-category matching with a unified 0–100 complexity score.
 * The score drives model tier selection with configurable thresholds.
 * 
 * Scoring factors:
 *   1. Prompt length (0–15)
 *   2. Advanced keyword density (0–25)
 *   3. Code detection (0–20)
 *   4. Multi-step reasoning (0–15)
 *   5. Domain complexity (0–10)
 *   6. Question depth (0–15)
 */

// ── Weighted keyword sets ─────────────────────────────────────────────────────
const ADVANCED_KEYWORDS = {
  // weight 5 — deep analysis
  'prove': 5, 'derive': 5, 'theorem': 5, 'proof': 5, 'induction': 5,
  'disprove': 5, 'lemma': 5, 'corollary': 5,
  // weight 4 — implementation/optimization
  'implement': 4, 'optimize': 4, 'refactor': 4, 'architect': 4, 'benchmark': 4,
  'parallelize': 4, 'scale': 4, 'distributed': 4,
  // weight 3 — design/analysis
  'analyze': 3, 'design': 3, 'evaluate': 3, 'compare': 3, 'critique': 3,
  'synthesize': 3, 'formulate': 3, 'hypothesize': 3, 'investigate': 3,
  // weight 2 — moderate complexity
  'explain': 2, 'describe': 2, 'illustrate': 2, 'differentiate': 2,
  'summarize': 2, 'outline': 2, 'classify': 2, 'categorize': 2,
};

// Words that signal coding tasks (matched as substrings in lowercase)
const CODE_WORD_SIGNALS = [
  'implement', 'code', 'program', 'function', 'algorithm', 'debug',
  'javascript', 'typescript', 'python', 'java', 'rust', 'c++', 'golang',
  'react', 'node', 'api', 'database', 'sql', 'nosql', 'mongodb',
  'binary search', 'sorting', 'recursion', 'dynamic programming',
  'linked list', 'tree', 'graph', 'hash', 'stack', 'queue', 'heap',
  'data structure', 'leetcode', 'array', 'string manipulation',
  'insert', 'delete', 'balance', 'traverse', 'iterator',
  'class', 'object-oriented', 'inheritance', 'polymorphism',
  'compile', 'runtime', 'memory', 'pointer', 'reference',
  'regex', 'parser', 'lexer', 'compiler', 'interpreter',
];

const CODE_PATTERNS = [
  /```[\s\S]*?```/,                    // Fenced code blocks
  /\bfunction\s+\w+\s*\(/,            // function declarations
  /\bconst\s+\w+\s*=/,                // const assignments
  /\blet\s+\w+\s*=/,                  // let assignments
  /\bclass\s+\w+/,                    // class declarations
  /\bimport\s+[\w{]/,                 // import statements
  /\bexport\s+(default\s+)?/,         // export statements
  /\b(if|for|while|switch)\s*\(/,     // control flow
  /=>\s*[{(]/,                        // arrow functions
  /\b(async|await)\b/,                // async patterns
  /\b(try|catch|throw)\b/,            // error handling
  /\.(map|filter|reduce|forEach)\(/,  // array methods
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE)\b/i, // SQL
  /\b(def|self\.|__init__)\b/,        // Python patterns
  /[{}\[\]];?\s*$/m,                  // code-like line endings
];

const MULTI_STEP_INDICATORS = [
  /\bfirst\b.*\bthen\b/i,
  /\bstep\s*\d/i,
  /\b\d+\.\s+/,                       // Numbered lists
  /\bfirstly\b|\bsecondly\b|\bfinally\b/i,
  /\bcompare\b.*\band\b/i,
  /\bon one hand\b/i,
  /\btrade-?offs?\b/i,
  /\bpros?\b.*\bcons?\b/i,
  /\badvantages?\b.*\bdisadvantages?\b/i,
  /\bif\b.*\belse\b.*\bthen\b/i,
  /\bunder what conditions\b/i,
];

const TECHNICAL_DOMAINS = [
  'algorithm', 'neural network', 'machine learning', 'deep learning',
  'quantum', 'cryptography', 'blockchain', 'compiler', 'kernel',
  'calculus', 'linear algebra', 'differential equation', 'topology',
  'thermodynamics', 'electromagnetism', 'relativity', 'organic chemistry',
  'genome', 'protein folding', 'signal processing', 'control theory',
  'operating system', 'microprocessor', 'assembly language', 'fpga',
  'computational complexity', 'np-hard', 'np-complete', 'turing machine',
];

// ── Configurable routing thresholds ───────────────────────────────────────────
const ROUTING_THRESHOLDS = {
  economy: { max: 12 },
  standard: { min: 13, max: 35 },
  premium: { min: 36 },
};

/**
 * Compute a unified complexity score (0–100) for a prompt
 * @param {string} prompt - User's input text
 * @returns {{ complexityScore: number, breakdown: object, recommendedTier: string, taskType: string, reasoning: string }}
 */
export function classifyTask(prompt) {
  if (!prompt || prompt.length < 3) {
    return {
      complexityScore: 0,
      breakdown: { length: 0, keywords: 0, code: 0, multiStep: 0, domain: 0, depth: 0 },
      recommendedTier: 'economy',
      taskType: 'simple_qa',
      reasoning: 'Empty or very short input',
    };
  }

  const lower = prompt.toLowerCase();
  const words = prompt.split(/\s+/);
  const wordCount = words.length;
  const breakdown = { length: 0, keywords: 0, code: 0, multiStep: 0, domain: 0, depth: 0 };

  // ── Factor 1: Prompt Length (0–15) ──
  if (wordCount <= 3)        breakdown.length = 0;
  else if (wordCount <= 8)   breakdown.length = 2;
  else if (wordCount <= 15)  breakdown.length = 5;
  else if (wordCount <= 30)  breakdown.length = 8;
  else if (wordCount <= 60)  breakdown.length = 11;
  else if (wordCount <= 120) breakdown.length = 13;
  else                       breakdown.length = 15;

  // ── Factor 2: Advanced Keyword Density (0–25) ──
  let kwScore = 0;
  for (const [keyword, weight] of Object.entries(ADVANCED_KEYWORDS)) {
    if (lower.includes(keyword)) kwScore += weight;
  }
  breakdown.keywords = Math.min(25, kwScore);

  // ── Factor 3: Code Detection (0–20) ──
  let codeHits = 0;
  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(prompt)) codeHits++;
  }
  // Bonus for fenced code blocks (strong signal)
  if (prompt.includes('```')) codeHits += 3;
  // Code word signals (catch task descriptions without actual code)
  for (const word of CODE_WORD_SIGNALS) {
    if (lower.includes(word)) codeHits += 1.5;
  }
  breakdown.code = Math.min(20, Math.round(codeHits * 2));

  // ── Factor 4: Multi-Step Reasoning (0–15) ──
  let stepHits = 0;
  for (const pattern of MULTI_STEP_INDICATORS) {
    if (pattern.test(prompt)) stepHits++;
  }
  // Bonus for multiple question marks (compound questions)
  const questionMarks = (prompt.match(/\?/g) || []).length;
  if (questionMarks >= 2) stepHits += 2;
  breakdown.multiStep = Math.min(15, stepHits * 3);

  // ── Factor 5: Domain Complexity (0–10) ──
  let domainHits = 0;
  for (const domain of TECHNICAL_DOMAINS) {
    if (lower.includes(domain)) domainHits++;
  }
  breakdown.domain = Math.min(10, domainHits * 3);

  // ── Factor 6: Question Depth (0–15) ──
  let depthScore = 0;
  if (/\bwhy\b/i.test(prompt)) depthScore += 5;
  if (/\bhow\b/i.test(prompt)) depthScore += 3;
  if (/\bwhat\b/i.test(prompt)) depthScore += 1;
  // Multi-clause questions
  if ((prompt.match(/,/g) || []).length >= 3) depthScore += 2;
  // Conditional complexity
  if (/\bif\b.*\bwould\b/i.test(prompt) || /\bassuming\b/i.test(prompt)) depthScore += 3;
  // Explicit depth requests
  if (/\bin[- ]depth\b|\bcomprehensive\b|\bdetailed\b|\bthorough\b/i.test(prompt)) depthScore += 4;
  breakdown.depth = Math.min(15, depthScore);

  // ── Compute final score ──
  const complexityScore = Math.min(100,
    breakdown.length + breakdown.keywords + breakdown.code +
    breakdown.multiStep + breakdown.domain + breakdown.depth
  );

  // ── Determine tier ──
  let recommendedTier;
  if (complexityScore <= ROUTING_THRESHOLDS.economy.max) recommendedTier = 'economy';
  else if (complexityScore <= ROUTING_THRESHOLDS.standard.max) recommendedTier = 'standard';
  else recommendedTier = 'premium';

  // ── Determine task type (for logging) ──
  let taskType = 'simple_qa';
  if (breakdown.code >= 8) taskType = 'coding';
  else if (breakdown.keywords >= 12 || breakdown.domain >= 6) taskType = 'deep_reasoning';
  else if (complexityScore >= 40) taskType = 'creative';

  // ── Reasoning string ──
  const topFactor = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
  const reasonMap = {
    length: 'Long, complex prompt',
    keywords: 'Advanced analysis keywords detected',
    code: 'Code patterns detected — engineering task',
    multiStep: 'Multi-step reasoning required',
    domain: 'Technical domain complexity',
    depth: 'Deep analytical question',
  };

  return {
    complexityScore,
    breakdown,
    recommendedTier,
    taskType,
    reasoning: `Score ${complexityScore}/100 → ${recommendedTier} (${reasonMap[topFactor[0]] || 'General task'})`,
  };
}

// ── Model tier classification ─────────────────────────────────────────────────
const MODEL_TIERS = {
  'gpt-4o': 'premium',
  'gpt-4o-mini': 'standard',
  'gpt-4-turbo': 'premium',
  'o3-mini': 'premium',
  'gemini-1.5-pro': 'premium',
  'gemini-2.0-flash': 'standard',
  'gemini-2.0-flash-lite': 'economy',
  'claude-sonnet-4-20250514': 'premium',
  'claude-3-5-haiku-20241022': 'standard',
  'claude-3-haiku-20240307': 'economy',
  
  // Groq
  'llama-3.3-70b-versatile': 'premium',
  'llama-3.1-8b-instant': 'standard',
  'mixtral-8x7b-32768': 'standard',
  'gemma2-9b-it': 'economy',

  // OpenRouter
  'openai/gpt-4o-mini': 'standard',
  'anthropic/claude-3.5-sonnet': 'premium',
  'google/gemini-2.0-flash-001': 'standard',
  'deepseek/deepseek-r1': 'premium',
  'meta-llama/llama-3.3-70b-instruct': 'premium',
};

/**
 * Select the best model for a task, factoring in adaptive performance scores
 * @param {string} taskType - From classifyTask
 * @param {string} recommendedTier - From classifyTask  
 * @param {Array} availableKeys - User's configured API keys
 * @param {object} [adaptiveScores] - Per-model adaptive scores from adaptiveScorer
 * @returns {{ provider: string, model: string, keyId: string } | null}
 */
export function selectOptimalModel(taskType, recommendedTier, availableKeys, adaptiveScores = null) {
  if (!availableKeys || availableKeys.length === 0) return null;

  const activeKeys = availableKeys.filter(k => k.isActive && k.isValid);
  if (activeKeys.length === 0) return null;

  const tierPriority = {
    economy: ['economy', 'standard', 'premium'],
    standard: ['standard', 'premium', 'economy'],
    premium: ['premium', 'standard', 'economy'],
  };

  const priority = tierPriority[recommendedTier] || tierPriority.standard;

  // Build scored candidates
  const candidates = activeKeys.map(key => {
    const tier = MODEL_TIERS[key.model] || 'standard';
    const tierRank = priority.indexOf(tier);
    const adaptiveScore = adaptiveScores?.[key.model]?.score ?? 50; // default middle
    return { key, tier, tierRank: tierRank === -1 ? 99 : tierRank, adaptiveScore };
  });

  // Sort by: tier priority first, then adaptive score (higher is better)
  candidates.sort((a, b) => {
    if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
    return b.adaptiveScore - a.adaptiveScore; // higher adaptive score wins
  });

  const best = candidates[0];
  return { provider: best.key.provider, model: best.key.model, keyId: best.key._id };
}

export { MODEL_TIERS, ROUTING_THRESHOLDS };
