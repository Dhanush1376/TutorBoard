/**
 * teachingModes.js — TutorBoard Teaching Modes System
 *
 * 8 formal teaching modes that change AI behavior end-to-end:
 *   - AI tone & personality
 *   - Response depth & structure
 *   - Preferred renderer
 *   - UI layout mode
 *   - Animation pacing
 *   - Interaction style
 *
 * Used by: VisualIntentRouter, BuildSystemPrompt, intentEngine
 */

// ─── Teaching Mode Definitions ───────────────────────────────────────────────

export const TEACHING_MODES = {
  explain: {
    id: 'explain',
    label: 'Explain',
    description: 'Clear text-based explanation with structured breakdowns',
    tone: 'teaching',
    depth: 'standard',
    preferredRenderer: null,
    layout: 'inline',
    pacing: 'normal',
    interactionStyle: 'passive',
    promptDirective: `You are in EXPLAIN mode. Provide a clear, well-structured text explanation.
Use headings, bullet points, and examples. Focus on building intuition before formalism.
Do NOT suggest opening the canvas unless the student explicitly asks for visuals.`,
  },

  visualize: {
    id: 'visualize',
    label: 'Visualize',
    description: 'Animated visual breakdown with canvas integration',
    tone: 'storytelling',
    depth: 'visual',
    preferredRenderer: 'auto',
    layout: 'split',
    pacing: 'normal',
    interactionStyle: 'interactive',
    promptDirective: `You are in VISUALIZE mode. Your response should ACCOMPANY a visual canvas.
Write a concise explanation that complements the animation. Reference visual elements directly:
"As you can see on the canvas...", "Notice how the highlighted nodes...".
Keep text shorter — the visual does most of the teaching.`,
  },

  simulate: {
    id: 'simulate',
    label: 'Simulate',
    description: 'Interactive simulation with live parameters',
    tone: 'technical',
    depth: 'deep',
    preferredRenderer: 'simulator',
    layout: 'split',
    pacing: 'interactive',
    interactionStyle: 'collaborative',
    promptDirective: `You are in SIMULATE mode. A live interactive simulation is being generated.
Explain the underlying physics/math, then guide the student to experiment:
"Try adjusting the slider to see how...", "What happens when you increase...?"
Emphasize cause-and-effect relationships and encourage hands-on exploration.`,
  },

  whiteboard: {
    id: 'whiteboard',
    label: 'Whiteboard',
    description: 'Step-by-step visual walkthrough like a professor at a board',
    tone: 'intuitive',
    depth: 'standard',
    preferredRenderer: 'cinematic',
    layout: 'split',
    pacing: 'normal',
    interactionStyle: 'interactive',
    promptDirective: `You are in WHITEBOARD mode. Imagine you are a professor at a whiteboard.
Build up the concept step by step. Each step should add one idea to the canvas.
Use simple language and real-world analogies. "First, let me draw...", "Now watch as...".
Narrate as if the student is sitting right in front of you.`,
  },

  immersive: {
    id: 'immersive',
    label: 'Immersive',
    description: 'Full cinematic teaching experience with guided navigation',
    tone: 'cinematic',
    depth: 'deep',
    preferredRenderer: 'auto',
    layout: 'fullscreen',
    pacing: 'cinematic',
    interactionStyle: 'collaborative',
    promptDirective: `You are in IMMERSIVE mode. This is a full cinematic learning experience.
The student will see a fullscreen animated teaching session. Your text appears as narration.
Write cinematic narration — dramatic reveals, building tension, satisfying conclusions.
"Welcome to the world of...", "And THIS is where the magic happens...".
Every sentence should feel like a documentary narrator.`,
  },

  interview: {
    id: 'interview',
    label: 'Interview',
    description: 'Socratic questioning to probe understanding',
    tone: 'formal',
    depth: 'probing',
    preferredRenderer: null,
    layout: 'inline',
    pacing: 'slow',
    interactionStyle: 'collaborative',
    promptDirective: `You are in INTERVIEW mode. Use the Socratic method.
Do NOT give the answer directly. Ask probing questions that lead the student to discover it:
"What do you think happens if...?", "Can you explain why that would work?"
Only reveal the answer after 2-3 exchanges, or if the student is clearly stuck.
Be encouraging but rigorous — this is preparation for real interviews.`,
  },

  quiz: {
    id: 'quiz',
    label: 'Quiz',
    description: 'Interactive quiz with instant feedback',
    tone: 'encouraging',
    depth: 'testing',
    preferredRenderer: 'quiz',
    layout: 'inline',
    pacing: 'slow',
    interactionStyle: 'interactive',
    promptDirective: `You are in QUIZ mode. Generate assessment questions.
Start with a quick concept check, then escalate difficulty.
For each question, provide 4 options (A-D) with one correct answer.
After the student answers, give detailed feedback explaining WHY each option is right or wrong.
Be encouraging: "Great thinking!", "Almost! Here's the key insight..."`,
  },

  coding: {
    id: 'coding',
    label: 'Coding',
    description: 'Code-focused with live editor and execution',
    tone: 'technical',
    depth: 'deep',
    preferredRenderer: 'monaco',
    layout: 'split',
    pacing: 'interactive',
    interactionStyle: 'collaborative',
    promptDirective: `You are in CODING mode. Focus on working, runnable code.
Always provide complete, working code examples — never pseudocode.
Explain the code line by line with inline comments.
Suggest modifications the student can try: "Try changing line 5 to..."
If the student's code has bugs, guide them to find the issue rather than fixing it directly.`,
  },
};

// ─── Mode Detection Patterns ─────────────────────────────────────────────────

export const MODE_DETECTION_PATTERNS = {
  visualize: /\b(visualize|show me|draw|animate|diagram|illustrate|display|render)\b/i,
  simulate: /\b(simulate|simulation|interactive|slider|experiment|physics lab|sandbox)\b/i,
  whiteboard: /\b(whiteboard|step by step|walk me through|break down|show how)\b/i,
  immersive: /\b(immersive|deep dive|full lesson|teach me everything|cinematic|guided)\b/i,
  interview: /\b(interview|quiz me|test my|socratic|probe|assess my|challenge me)\b/i,
  quiz: /\b(quiz|test|mcq|multiple choice|exam prep|practice questions|assess)\b/i,
  coding: /\b(code|implement|write a function|build|program|debug|fix this|refactor)\b/i,
  explain: /\b(explain|what is|define|describe|tell me about|how does|why does)\b/i,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Detect teaching mode from a user prompt using regex patterns.
 * Returns the mode ID or 'explain' as default.
 */
export function detectTeachingMode(prompt) {
  if (!prompt) return 'explain';
  const q = prompt.trim();

  const scores = {};
  const weights = {
    quiz: 1.4,
    interview: 1.4,
    simulate: 1.5,
    coding: 1.3,      // Slightly lower than simulate/visualize to allow them to win in "code and visualize"
    immersive: 1.4,
    whiteboard: 1.2,
    visualize: 1.5,
    explain: 0.5,     // Fallback
  };

  // 1. Calculate weighted scores
  for (const [mode, pattern] of Object.entries(MODE_DETECTION_PATTERNS)) {
    const regex = new RegExp(pattern.source, 'gi');
    const matches = q.match(regex);
    scores[mode] = (matches ? matches.length : 0) * (weights[mode] || 1);
  }

  // 2. Resolve best mode (highest score wins, priority order handles ties)
  const priority = ['simulate', 'visualize', 'quiz', 'interview', 'coding', 'immersive', 'whiteboard', 'explain'];
  
  let bestMode = 'explain';
  let maxScore = 0;

  for (const mode of priority) {
    if (scores[mode] > maxScore) {
      maxScore = scores[mode];
      bestMode = mode;
    }
  }

  // 3. Fallback: If no explicit matches but query is very short, keep it as explain
  if (maxScore === 0) return 'explain';

  return bestMode;
}

/**
 * Get the full mode configuration object.
 */
export function getTeachingMode(modeId) {
  return TEACHING_MODES[modeId] || TEACHING_MODES.explain;
}

/**
 * Get just the prompt directive for a mode.
 */
export function getTeachingModeDirective(modeId) {
  return (TEACHING_MODES[modeId] || TEACHING_MODES.explain).promptDirective;
}

/**
 * Check if a mode requires canvas/visual rendering.
 */
export function modeRequiresCanvas(modeId) {
  const mode = TEACHING_MODES[modeId];
  if (!mode) return false;
  return mode.layout === 'split' || mode.layout === 'fullscreen';
}

/**
 * Check if a mode prefers a specific renderer.
 */
export function getModeRenderer(modeId) {
  const mode = TEACHING_MODES[modeId];
  if (!mode) return null;
  return mode.preferredRenderer === 'auto' ? null : mode.preferredRenderer;
}
