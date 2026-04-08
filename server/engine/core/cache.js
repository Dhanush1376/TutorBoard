/**
 * Pedagogy & Timeline Cache
 * Persists successful generations in-memory to safely bypass AI calls.
 */

const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class TopicCache {
  constructor() {
    this.cache = new Map();
  }

  _buildKey(topic, userProfile) {
    const slug = topic.toLowerCase().trim().replace(/\s+/g, '-');
    return `${slug}_${userProfile}`;
  }

  get(topic, userProfile) {
    const key = this._buildKey(topic, userProfile);
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    // Check TTL
    if (Date.now() > entry.expiry) {
      console.log(`[Cache] 🗑️ Expired entry for: ${topic}`);
      this.cache.delete(key);
      return null;
    }

    console.log(`[Cache] ⚡ HIT! Bypassed LLM generation for: ${topic}`);
    return JSON.parse(JSON.stringify(entry.data)); 
  }

  set(topic, userProfile, data) {
    const key = this._buildKey(topic, userProfile);
    
    // Eviction policy: if full, remove oldest entry (first key in Map)
    if (this.cache.size >= MAX_CACHE_SIZE && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`[Cache] ♻️ Evicted oldest entry to make room`);
    }

    this.cache.set(key, {
      data: JSON.parse(JSON.stringify(data)),
      expiry: Date.now() + CACHE_TTL_MS
    });
    console.log(`[Cache] 📦 STORED new timeline for: ${topic}`);
  }
  
  clear() {
    this.cache.clear();
  }
}

export const cache = new TopicCache();
