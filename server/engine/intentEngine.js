/**
 * intentEngine.js
<<<<<<< HEAD
 * Parses raw text input to detect the user's intent or desired mode.
 *
 * TutorBoard is a VISUAL learning tool — the default is always visual explanation.
 * Only greetings and small-talk get routed to text-only responses.
=======
 * Parses raw text input to detect the user's intent or desired mode,
 * specifically targeting visualization triggers vs standard text chat.
>>>>>>> 82eb7560587ff0921601e5fc4872899d64305177
 */

// Mapping of canonical UI modes to regex patterns (case-insensitive)
const INTENT_PATTERNS = {
  // Teach / Explain
<<<<<<< HEAD
  explain: /\b(explain|help me understand|show me how|walk me through|guide me|teach|learn|what is|how does|how do|tell me about|describe)\b/i,
=======
  explain: /\b(explain|help me understand|show me how|walk me through|guide me)\b/i,
>>>>>>> 82eb7560587ff0921601e5fc4872899d64305177
  // Problem Solving
  solve: /\b(solve|solve this|help me solve|find the answer|work this out|fix this)\b/i,
  // Testing and Quizzing
  test_me: /\b(test me|ask questions|practice|challenge me|give me a quiz|quiz me)\b/i,
  // Visualizations and Diagrams
  show_diagram: /\b(show visually|draw|illustrate|show diagram|make it visual|visualize|diagram)\b/i,
  // Deep Dive
<<<<<<< HEAD
  explain_in_detail: /\b(explain in detail|go deeper|detailed explanation|break it down|full explanation|deep dive)\b/i,
};

// Patterns that indicate casual chat / greetings (NOT educational queries)
const TEXT_ONLY_PATTERNS = /^(hi|hello|hey|yo|sup|thanks|thank you|bye|goodbye|ok|okay|yes|no|sure|cool|nice|great|good|wow|lol|haha|hmm|hm|what's up|how are you|good morning|good night)\s*[.!?]*$/i;

=======
  explain_in_detail: /\b(explain in detail|go deeper|detailed explanation|break it down|full explanation|deep dive)\b/i
};

>>>>>>> 82eb7560587ff0921601e5fc4872899d64305177
/**
 * Detects the intended mode from a text prompt.
 * @param {string} prompt - The raw user input.
 * @param {string|null} explicitMode - The explicitly selected mode from the UI (if any).
<<<<<<< HEAD
 * @returns {string} - The mode string. Defaults to 'explain' (visual) for educational queries.
=======
 * @returns {string} - The exact mode string ('explain', 'solve', 'test_me', 'show_diagram', 'explain_in_detail') or 'text_only' if no visual modes triggered.
>>>>>>> 82eb7560587ff0921601e5fc4872899d64305177
 */
export function detectIntent(prompt, explicitMode) {
  // 1. Explicit UI Mode always wins
  if (explicitMode && Object.keys(INTENT_PATTERNS).includes(explicitMode)) {
    return explicitMode;
  }

<<<<<<< HEAD
  const normalizedPrompt = prompt.trim();

  // 2. Check if it's a greeting / small-talk → text_only
  if (TEXT_ONLY_PATTERNS.test(normalizedPrompt)) {
    return 'text_only';
  }

  // 3. Check for specific intent keywords
  for (const [mode, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(normalizedPrompt)) {
      return mode;
    }
  }

  // 4. Default: this is a visual learning tool — generate visual explanation
  return 'explain';
=======
  // 2. No explicit mode, parse text to detect intent
  const normalizedPrompt = prompt.trim();
  
  for (const [mode, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(normalizedPrompt)) {
      return mode; // Return the first matched mode
    }
  }

  // 3. If no keywords are matched, default to standard text-only conversational mode
  return 'text_only';
>>>>>>> 82eb7560587ff0921601e5fc4872899d64305177
}
