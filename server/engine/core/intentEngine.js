/**
 * intentEngine.js
 * Parses raw text input to detect the user's intent or desired mode,
 * specifically targeting visualization triggers vs standard text chat.
 */

const INTENT_PATTERNS = {
  deep: /\b(explain|teach|show|visualize|draw|animate|diagram|full|detailed|step by step)\b/i,
  quick: /\b(quick|fast|summary|brief|short|just tell me|tldr|one line)\b/i,
  test_me: /\b(test me|ask questions|practice|challenge me|quiz)\b/i,
};

export function detectIntent(prompt, explicitMode) {
  // 1. Explicit UI Mode always wins
  if (explicitMode && (explicitMode === 'quick' || explicitMode === 'deep' || explicitMode === 'test_me')) {
    return explicitMode;
  }

  // 2. Fallbacks to visual for old UI explicit mode
  if (explicitMode && ['explain', 'solve', 'show_diagram', 'explain_in_detail'].includes(explicitMode)) {
    return 'deep';
  }

  // 3. NLP Parsing
  const normalizedPrompt = prompt.trim();
  
  if (INTENT_PATTERNS.test_me.test(normalizedPrompt)) return 'test_me';
  if (INTENT_PATTERNS.quick.test(normalizedPrompt)) return 'quick';
  if (INTENT_PATTERNS.deep.test(normalizedPrompt)) return 'deep';

  // 4. Default for TutorBoard is deep visual teaching
  return 'deep';
}
