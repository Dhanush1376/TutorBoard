/**
 * Pedagogy & Timeline Cache
 * Persists successful generations in-memory to safely bypass AI calls.
 */

class TopicCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Generate robust key combining topic and traits
   */
  _buildKey(topic, userProfile) {
    const slug = topic.toLowerCase().trim().replace(/\s+/g, '-');
    return `${slug}_${userProfile}`;
  }

  /**
   * Get cached generation
   */
  get(topic, userProfile) {
    const key = this._buildKey(topic, userProfile);
    if (this.cache.has(key)) {
      console.log(`[Cache] ⚡ HIT! Bypassed LLM generation for: ${topic}`);
      return JSON.parse(JSON.stringify(this.cache.get(key))); // return clone
    }
    return null;
  }

  /**
   * Set cached generation
   */
  set(topic, userProfile, data) {
    const key = this._buildKey(topic, userProfile);
    // Deep clone to prevent state mutation bleed
    this.cache.set(key, JSON.parse(JSON.stringify(data)));
    console.log(`[Cache] 📦 STORED new timeline for: ${topic}`);
  }
  
  clear() {
    this.cache.clear();
  }
}

export const cache = new TopicCache();
