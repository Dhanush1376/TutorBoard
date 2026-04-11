import { getEmbeddings } from '../utils/llmClient.js';
import sessionStore from './sessionStore.js';

/**
 * Pedagogy & Timeline Cache
 * Persists successful generations in-memory to safely bypass AI calls.
 * v2: Semantic embeddings for fuzzy matching.
 */
const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const SIMILARITY_THRESHOLD = 0.9;    // Cosine distance < 0.1

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

class TopicCache {
  constructor() {
    this.cache = new Map();
  }

  _normalize(topic) {
    const stopWords = /\b(show|me|what|is|explain|how|does|tell|about|visualize|diagram|of|animate|the)\b/gi;
    return topic.toLowerCase()
      .replace(stopWords, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  async get(topic, userProfile) {
    const normalized = this._normalize(topic);
    const entryKey = `${normalized.replace(/\s+/g, '-')}_${userProfile}`;
    
    // 1. Direct Hit
    const directEntry = this.cache.get(entryKey);
    if (directEntry && Date.now() < directEntry.expiry) {
      console.log(`[Cache] ⚡ DIRECT HIT! Bypassed LLM for: ${topic}`);
      return JSON.parse(JSON.stringify(directEntry.data));
    }

    // 2. Semantic Hit (Cosine Similarity)
    console.log(`[Cache] 🔍 Checking semantic similarity for: "${topic}"`);
    const queryVector = await getEmbeddings(normalized);
    if (!queryVector) return null;

    for (const [key, entry] of this.cache) {
      if (Date.now() > entry.expiry) continue;
      
      // Only compare topics with the same user profile
      if (!key.endsWith(userProfile)) continue;

      const similarity = cosineSimilarity(queryVector, entry.embedding);
      if (similarity > SIMILARITY_THRESHOLD) {
        console.log(`[Cache] ⚡ SEMANTIC HIT! (${(similarity * 100).toFixed(1)}% match) for: ${topic}`);
        return JSON.parse(JSON.stringify(entry.data));
      }
    }

    return null;
  }

  async set(topic, userProfile, data) {
    const normalized = this._normalize(topic);
    const key = `${normalized.replace(/\s+/g, '-')}_${userProfile}`;

    // Eviction
    if (this.cache.size >= MAX_CACHE_SIZE && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`[Cache] ♻️ Evicted oldest entry`);
    }

    const embedding = await getEmbeddings(normalized);
    if (!embedding) return;

    this.cache.set(key, {
      data: JSON.parse(JSON.stringify(data)),
      embedding,
      expiry: Date.now() + CACHE_TTL_MS
    });
    console.log(`[Cache] 📦 STORED semantic entry for: ${topic}`);
  }
  
  clear() {
    this.cache.clear();
  }
}

export const cache = new TopicCache();
