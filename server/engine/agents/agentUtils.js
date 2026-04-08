/**
 * Agent Utilities — Restored
 */

export function isGreeting(text) {
  const greetings = ['hi', 'hello', 'hey', 'yo', 'greetings', 'sup', 'howdy'];
  const cleaned = text.toLowerCase().trim().replace(/[?!.,]/g, '');
  return greetings.includes(cleaned);
}

export function buildTeachingPrompt(topic) {
  return `Visualize the core concept of "${topic}". 
Break it down into a logical visual sequence.
Use specific shapes, labels, and narrations.
Focus on simplicity and clarity.`;
}
