/**
 * intentEngine.js
 * Parses raw text input to detect the user's intent or desired mode,
 * specifically targeting visualization triggers vs standard text chat.
 */

// Mapping of canonical UI modes to regex patterns (case-insensitive)
const INTENT_PATTERNS = {
  // Teach / Explain
  explain: /\b(explain|help me understand|show me how|walk me through|guide me)\b/i,
  // Problem Solving
  solve: /\b(solve|solve this|help me solve|find the answer|work this out|fix this)\b/i,
  // Testing and Quizzing
  test_me: /\b(test me|ask questions|practice|challenge me|give me a quiz|quiz me)\b/i,
  // Visualizations and Diagrams
  show_diagram: /\b(show visually|draw|illustrate|show diagram|make it visual|visualize|diagram)\b/i,
  // Deep Dive
  explain_in_detail: /\b(explain in detail|go deeper|detailed explanation|break it down|full explanation|deep dive)\b/i
};

/**
 * Detects the intended mode from a text prompt.
 * @param {string} prompt - The raw user input.
 * @param {string|null} explicitMode - The explicitly selected mode from the UI (if any).
 * @returns {string} - The exact mode string ('explain', 'solve', 'test_me', 'show_diagram', 'explain_in_detail') or 'text_only' if no visual modes triggered.
 */
export function detectIntent(prompt, explicitMode) {
  // 1. Explicit UI Mode always wins
  if (explicitMode && Object.keys(INTENT_PATTERNS).includes(explicitMode)) {
    return explicitMode;
  }

  // 2. No explicit mode, parse text to detect intent
  const normalizedPrompt = prompt.trim();
  
  for (const [mode, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(normalizedPrompt)) {
      return mode; // Return the first matched mode
    }
  }

  // 3. If no keywords are matched, default to standard text-only conversational mode
  return 'text_only';
}
