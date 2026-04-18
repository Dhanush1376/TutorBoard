export function safeParse(content) {
  if (!content || typeof content !== 'string') return null;
  try {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    // Extract the largest valid JSON structure (object or array)
    const isObject = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket);
    const start = isObject ? firstBrace : firstBracket;
    const end = isObject ? lastBrace : lastBracket;

    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[Parser] Error:', err.message);
    return null;
  }
}
