export function safeParse(content) {
  if (!content || typeof content !== 'string') return null;
  try {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/<[^>]*>/g, '').trim();
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[Parser] Error:', err.message);
    return null;
  }
}
