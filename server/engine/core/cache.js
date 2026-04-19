import { getEmbeddings } from '../../utils/ai/llmClient.js';
import redis from '../../utils/core/redis.js';

/**
 * Pedagogy & Timeline Cache
 * Persists successful generations in Redis (backdoor) and in-memory (hot).
 * v2: Semantic embeddings for fuzzy matching.
 */
const MAX_CACHE_BYTES = 5 * 1024 * 1024; // 5MB In-memory Budget
const CACHE_TTL_SEC = 24 * 60 * 60;   // 24 hours in Redis
const SIMILARITY_THRESHOLD = 0.9;    // Cosine distance < 0.1
const REDIS_PREFIX = 'cache:topic:';

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
    this.localCache = new Map();
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

  _estimateSize(data) {
    return JSON.stringify(data).length * 2;
  }

  async get(topic, userProfile) {
    const normalized = this._normalize(topic);
    const stableProfile = (userProfile || '').replace(/Confusion Level = \d+\/10/g, 'Confusion Level = *');
    const entryKey = `${normalized}:::${stableProfile}`;
    
    // 1. Hot Direct Hit (In-memory)
    const hotEntry = this.localCache.get(entryKey);
    if (hotEntry && Date.now() < hotEntry.expiry) {
      console.log(`[Cache] ⚡ HOT HIT (Direct) for: ${topic}`);
      return JSON.parse(JSON.stringify(hotEntry.data));
    }

    // 2. Cold Direct Hit (Redis)
    if (redis.isConnected) {
      try {
        const cached = await redis.get(`${REDIS_PREFIX}${entryKey}`);
        if (cached) {
          const entry = JSON.parse(cached);
          console.log(`[Cache] ❄️ COLD HIT (Redis) for: ${topic}`);
          // Hydrate local cache
          this.localCache.set(entryKey, { ...entry, expiry: Date.now() + 60 * 60 * 1000 });
          return entry.data;
        }
      } catch (e) {
        console.error('[Cache] Redis get error:', e.message);
      }
    }

    // 3. Semantic Hit (Local memory only for performance)
    if (process.env.ENABLE_SEMANTIC_CACHE === 'false') return null;

    const queryVector = await getEmbeddings(normalized);
    if (!queryVector) return null;

    for (const [key, entry] of this.localCache) {
      if (Date.now() > entry.expiry) {
        this.localCache.delete(key);
        this.currentSizeBytes -= entry.size;
        continue;
      }
      
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

    // Eviction: Keep total size under 5MB in memory
    while (this.currentSizeBytes + size > MAX_CACHE_BYTES && this.localCache.size > 0) {
      const oldestKey = this.localCache.keys().next().value;
      const oldestEntry = this.localCache.get(oldestKey);
      this.currentSizeBytes -= oldestEntry.size;
      this.localCache.delete(oldestKey);
    }

    const embedding = await getEmbeddings(normalized);
    
    const entry = {
      data: JSON.parse(JSON.stringify(data)),
      embedding: embedding || [],
      size,
      expiry: Date.now() + (60 * 60 * 1000) // 1h in memory
    };

    this.localCache.set(key, entry);
    this.currentSizeBytes += size;

    // Persist to Redis if connected
    if (redis.isConnected) {
      try {
        await redis.set(`${REDIS_PREFIX}${key}`, JSON.stringify(entry), CACHE_TTL_SEC);
      } catch (e) {
        console.error('[Cache] Redis set error:', e.message);
      }
    }

    console.log(`[Cache] 📦 STORED entry for: ${topic} (Redis: ${redis.isConnected})`);
  }
  
  clear() {
    this.localCache.clear();
    this.currentSizeBytes = 0;
  }
}

export const cache = new TopicCache();
