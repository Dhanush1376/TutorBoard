/**
 * Agent Utilities — Restored
 */

export function isGreeting(text) {
  const greetings = ['hi', 'hello', 'hey', 'yo', 'greetings', 'sup', 'howdy'];
  const cleaned = text.toLowerCase().trim().replace(/[?!.,]/g, '');
  return greetings.includes(cleaned);
}

