/**
 * JSON extraction utilities for robust AI response parsing
 */

export function extractJSON(text: string) {
  if (!text || typeof text !== 'string') return null;

  // 1. Precise Markdown Block Extraction
  const jsonBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of jsonBlocks) {
    try {
      const cleaned = match[1].trim();
      return JSON.parse(cleaned);
    } catch (_) { /* continue */ }
  }

  // 2. Loose Brace Extraction (handles leading/trailing chatter)
  const stack = [];
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (stack.length === 0) start = i;
      stack.push('{');
    } else if (text[i] === '}') {
      if (stack.length > 0) {
        stack.pop();
        if (stack.length === 0 && start !== -1) {
          try {
            const candidate = text.substring(start, i + 1);
            return JSON.parse(candidate);
          } catch (_) { /* continue search */ }
        }
      }
    }
  }

  // 3. Last Resort: Trimmed direct parse
  try {
    return JSON.parse(text.trim());
  } catch (_) {
    return null;
  }
}
