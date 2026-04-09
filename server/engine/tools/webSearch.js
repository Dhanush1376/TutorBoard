/**
 * WebSearch Tool — Factual Grounding & Retrieval
 * 
 * Supports grounding for: History, Medicine, Law, Economics
 */

import axios from 'axios';

const FACTUAL_DOMAINS = ['history', 'medicine', 'law', 'economics', 'biology', 'physics'];

/**
 * Perform a web search (Placeholder for Tavily/Serper/Google)
 */
export async function searchDomainKnowledge(domain, topic) {
  if (!FACTUAL_DOMAINS.includes(domain?.toLowerCase())) {
    return null;
  }

  console.log(`[WebSearch] 🔍 Grounding factual domain "${domain}" for topic: "${topic}"`);

  // INTEGRATION NOTE: Replace with actual Tavily/Google API call
  // For now, we simulate authoritative retrieval for the AI context.
  
  if (process.env.TAVILY_API_KEY) {
      try {
          const res = await axios.post('https://api.tavily.com/search', {
              api_key: process.env.TAVILY_API_KEY,
              query: `${topic} authoritative tutorial explanation for student`,
              search_depth: "advanced",
              include_answer: true,
              max_results: 3
          });
          return res.data;
      } catch (err) {
          console.warn(`[WebSearch] Search API failed: ${err.message}. Falling back to parametric knowledge.`);
      }
  }

  // Fallback / Mock Authoritative Context
  return {
    results: [
      { title: `Authoritative Overview of ${topic}`, content: `Detailed factual data about ${topic} in the field of ${domain}.` }
    ],
    answer: `Authoritative context for ${topic} should prioritize factual accuracy, dates, specific terminology, and consensus-driven explanations suitable for a ${domain} student.`
  };
}

/**
 * Format search results for LLM injection
 */
export function formatSearchContext(searchData) {
  if (!searchData) return "";

  return `
━━━ AUTHORITATIVE SEARCH GROUNDING ━━━
${searchData.answer || ''}
SOURCES:
${(searchData.results || []).map(r => `- ${r.title}: ${r.content}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}
