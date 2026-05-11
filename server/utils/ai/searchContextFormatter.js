/**
 * Search Context Formatter — Transforms web search results into LLM-injectable context.
 * 
 * Responsibilities:
 *   1. Format results as structured markdown for prompt injection
 *   2. Extract source citations for frontend display
 *   3. Enforce token budget (max ~2000 tokens ≈ 8000 chars)
 */

const MAX_CONTEXT_CHARS = 8000;

/**
 * Sanitize text to prevent prompt injection and enforce basic safety.
 * @param {string} text 
 * @returns {string}
 */
function sanitizeWebResult(text) {
  if (!text) return '';
  return text
    .replace(/ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?/gi, '[redacted]')
    .replace(/system\s+prompt/gi, '[redacted]')
    .replace(/you\s+are\s+now/gi, '[redacted]')
    .slice(0, 500); // Hard truncation to prevent long-form injection
}

/**
 * Format web search results into a structured string for LLM prompt injection.
 * 
 * @param {Array<{ title: string, snippet: string, url: string, age?: string }>} results
 * @returns {string} — Formatted context string, or empty string if no results
 */
export function formatForPrompt(results) {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return '';
  }

  let context = 'LIVE WEB DATA (use to enrich your answer with current information):\n\n';
  let totalLength = context.length;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const cleanTitle = sanitizeWebResult(r.title);
    const cleanSnippet = sanitizeWebResult(r.snippet);
    const entry = `[Source ${i + 1}] ${cleanTitle}\n${cleanSnippet}\n${r.url}${r.age ? ` (${r.age})` : ''}\n\n`;

    // Enforce token budget
    if (totalLength + entry.length > MAX_CONTEXT_CHARS) {
      console.log(`[SearchFormatter] Truncated at ${i} results (token budget).`);
      break;
    }

    context += entry;
    totalLength += entry.length;
  }

  return context.trim();
}

/**
 * Extract clean source citations from web search results.
 * These are attached to the response for frontend display.
 * 
 * @param {Array<{ title: string, snippet: string, url: string, age?: string }>} results
 * @returns {Array<{ title: string, url: string, domain: string }>}
 */
export function extractSources(results) {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return [];
  }

  return results
    .filter(r => r.url && r.title)
    .map(r => {
      let domain = '';
      try {
        domain = new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        domain = r.url.substring(0, 30);
      }

      return {
        title: r.title.substring(0, 120),
        url: r.url,
        domain,
      };
    });
}

export default { formatForPrompt, extractSources };
