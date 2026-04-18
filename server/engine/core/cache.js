import { getEmbeddings } from '../../utils/ai/llmClient.js';
import sessionStore from './sessionStore.js';

/**
 * Pedagogy & Timeline Cache
 * Persists successful generations in-memory to safely bypass AI calls.
 * v2: Semantic embeddings for fuzzy matching.
 */
const MAX_CACHE_BYTES = 5 * 1024 * 1024; // 5MB Budget
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const SIMILARITY_THRESHOLD = 0.9;    // Cosine distance < 0.1

let hasWarnedEmbeddings = false;

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
    this.currentSizeBytes = 0;
  }

  _normalize(topic) {
    const stopWords = /\b(show|me|what|is|explain|how|does|tell|about|visualize|diagram|of|animate|the)\b/gi;
    return topic.toLowerCase()
      .replace(stopWords, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Estimates byte size of UTF-16 string
   */
  _estimateSize(data) {
    return JSON.stringify(data).length * 2;
  }

  async get(topic, userProfile) {
    const normalized = this._normalize(topic);
    // Mask confusionIndex in the profile to ensure stability in hits
    const stableProfile = (userProfile || '').replace(/Confusion Level = \d+\/10/g, 'Confusion Level = *');
    const entryKey = `${normalized}:::${stableProfile}`;
    
    // 1. Direct Hit
    const directEntry = this.cache.get(entryKey);
    if (directEntry && Date.now() < directEntry.expiry) {
      console.log(`[Cache] ⚡ DIRECT HIT! Bypassed LLM for: ${topic}`);
      return JSON.parse(JSON.stringify(directEntry.data));
    }

    // 2. Semantic Hit (Cosine Similarity)
    if (process.env.ENABLE_SEMANTIC_CACHE === 'false') return null;

    console.log(`[Cache] 🔍 Checking semantic similarity for: "${topic}"`);
    const queryVector = await getEmbeddings(normalized);
    if (!queryVector) {
      if (!hasWarnedEmbeddings) {
        console.warn('[Cache] ⚠️ Semantic embeddings unavailable. Degrading to exact matching only.');
        hasWarnedEmbeddings = true;
      }
      return null;
    }

    for (const [key, entry] of this.cache) {
      if (Date.now() > entry.expiry) {
        this.cache.delete(key);
        this.currentSizeBytes -= entry.size;
        continue;
      }
      
      // Only compare topics with the same stable user profile
      const [entryTopic, entryProfile] = key.split(':::');
      if (entryProfile !== stableProfile) continue;

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
    const stableProfile = (userProfile || '').replace(/Confusion Level = \d+\/10/g, 'Confusion Level = *');
    const key = `${normalized}:::${stableProfile}`;

    const size = this._estimateSize(data) + this._estimateSize(normalized) * 2; 

    // Eviction: Keep total size under 5MB
    while (this.currentSizeBytes + size > MAX_CACHE_BYTES && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      const oldestEntry = this.cache.get(oldestKey);
      this.currentSizeBytes -= oldestEntry.size;
      this.cache.delete(oldestKey);
      console.log(`[Cache] ♻️ Evicted entry to maintain 5MB budget (Current: ${(this.currentSizeBytes / 1024 / 1024).toFixed(2)}MB)`);
    }

    if (process.env.ENABLE_SEMANTIC_CACHE === 'false') return;

    const embedding = await getEmbeddings(normalized);
    if (!embedding) {
      if (!hasWarnedEmbeddings) {
        console.warn('[Cache] ⚠️ Failed to store semantic embedding. Future hits will rely on exact match.');
        hasWarnedEmbeddings = true;
      }
      return;
    }

    this.cache.set(key, {
      data: JSON.parse(JSON.stringify(data)),
      embedding,
      size,
      expiry: Date.now() + CACHE_TTL_MS
    });
    this.currentSizeBytes += size;

    console.log(`[Cache] 📦 STORED entry for: ${topic} (${(size / 1024).toFixed(1)}KB). Total Cache: ${(this.currentSizeBytes / 1024 / 1024).toFixed(2)}MB`);
  }
  
  clear() {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }
}

export const cache = new TopicCache();
