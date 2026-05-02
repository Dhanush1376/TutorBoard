/**
 * Web Search Service — Brave Search API Integration
 * 
 * Provides real-time web data for LLM context augmentation.
 * Used by both the chat controller (conversational) and agent loop (teaching pipeline).
 * 
 * Features:
 *   - Brave Search API with 5s timeout
 *   - Result sanitization (strip HTML, truncate snippets)
 *   - Graceful degradation (returns [] on failure — never blocks the pipeline)
 *   - Rate limiting awareness
 */

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const SEARCH_TIMEOUT_MS = 5000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_LENGTH = 300;

/**
 * Sanitize a snippet: strip HTML tags and truncate.
 * @param {string} text 
 * @returns {string}
 */
function sanitizeSnippet(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')           // Strip HTML tags
    .replace(/&[a-z]+;/gi, ' ')        // Strip HTML entities
    .replace(/\s+/g, ' ')             // Collapse whitespace
    .trim()
    .substring(0, MAX_SNIPPET_LENGTH);
}

/**
 * Search the web using Brave Search API.
 * 
 * @param {string} query — The search query
 * @param {object} [options]
 * @param {number} [options.count=5] — Number of results to return
 * @param {string} [options.freshness] — Freshness filter: 'pd' (past day), 'pw' (past week), 'pm' (past month)
 * @returns {Promise<Array<{ title: string, snippet: string, url: string, age?: string }>>}
 */
export async function searchWeb(query, options = {}) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  
  if (!apiKey) {
    console.warn('[WebSearch] BRAVE_SEARCH_API_KEY not set — skipping web search.');
    return [];
  }

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    console.warn('[WebSearch] Invalid query — skipping.');
    return [];
  }

  const count = options.count || MAX_RESULTS;
  const params = new URLSearchParams({
    q: query.trim(),
    count: String(count),
    text_decorations: 'false',
    search_lang: 'en',
  });

  if (options.freshness) {
    params.set('freshness', options.freshness);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    console.log(`[WebSearch] 🔍 Searching: "${query.substring(0, 60)}..." (count: ${count})`);

    const response = await fetch(`${BRAVE_SEARCH_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[WebSearch] ❌ Brave API error ${response.status}: ${errBody.substring(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const webResults = data.web?.results || [];

    const results = webResults.slice(0, count).map(result => ({
      title: (result.title || '').substring(0, 200),
      snippet: sanitizeSnippet(result.description || result.snippet || ''),
      url: result.url || '',
      age: result.age || null,
    }));

    console.log(`[WebSearch] ✅ Got ${results.length} results for: "${query.substring(0, 40)}..."`);
    return results;

  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      console.warn(`[WebSearch] ⏱️ Timeout after ${SEARCH_TIMEOUT_MS}ms for: "${query.substring(0, 40)}..."`);
    } else {
      console.error(`[WebSearch] ❌ Search failed: ${err.message}`);
    }

    return [];
  }
}

export default { searchWeb };
