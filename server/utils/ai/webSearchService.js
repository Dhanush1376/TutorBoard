/**
 * Web Search Service — Tavily Search API Integration
 * 
 * Provides real-time web data for LLM context augmentation.
 * Used by both the chat controller (conversational) and agent loop (teaching pipeline).
 * 
 * Features:
 *   - Tavily Search API with 5s timeout
 *   - Result sanitization (strip HTML, truncate snippets)
 *   - Graceful degradation (returns [] on failure — never blocks the pipeline)
 *   - Research-optimized results
 */

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const SEARCH_TIMEOUT_MS = 5000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_LENGTH = 400;

// Startup check
if (!process.env.TAVILY_API_KEY) {
  console.info('[WebSearch] TAVILY_API_KEY is not set. Using offline search stubs in development.');
}


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
 * Search the web using Tavily Search API.
 * 
 * @param {string} query — The search query
 * @param {object} [options]
 * @param {number} [options.count=5] — Number of results to return
 * @param {string} [options.search_depth='basic'] — 'basic' or 'advanced'
 * @returns {Promise<Array<{ title: string, snippet: string, url: string, score?: number }>>}
 */
export async function searchWeb(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    console.info(`[WebSearch] Using offline search stub for: "${query}"`);
    return [
      { 
        title: `${query} - Concept Overview`, 
        snippet: `This is a simulated search result for "${query}". In a production environment, this would contain real-time data from the Tavily Search API.`, 
        url: 'https://simulated.tutorboard.app/concept',
        isMock: true
      },
      { 
        title: `Advanced Applications of ${query}`, 
        snippet: `Exploring how ${query} is used in modern enterprise environments. Simulated data for development purposes.`, 
        url: 'https://simulated.tutorboard.app/advanced',
        isMock: true
      }
    ];
  }

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    console.warn('[WebSearch] Invalid query — skipping.');
    return [];
  }

  const count = options.count || MAX_RESULTS;
  const searchDepth = options.search_depth || 'basic';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    console.log(`[WebSearch] 🔍 Searching: "${query.substring(0, 60)}..." (Tavily, depth: ${searchDepth})`);

    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim(),
        search_depth: searchDepth,
        max_results: count,
        include_answer: false,
        include_images: false,
        include_raw_content: false
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[WebSearch] ❌ Tavily API error ${response.status}: ${errBody.substring(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const webResults = data.results || [];

    const results = webResults.slice(0, count).map(result => ({
      title: (result.title || '').substring(0, 200),
      snippet: sanitizeSnippet(result.content || ''),
      url: result.url || '',
      score: result.score || 0,
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
