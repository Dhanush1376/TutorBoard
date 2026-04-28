import redis from '../../utils/core/redis.js';

const CACHE_TTL_SEC = 24 * 60 * 60; // 24 hours
const REDIS_PREFIX = 'topic:';
class TopicCache {
  _normalize(topic) {
    const stopWords = /\b(show|me|what|is|explain|how|does|tell|about|visualize|diagram|of|animate|the)\b/gi;
    return topic.toLowerCase()
      .replace(stopWords, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  _getKey(topic, userProfile) {
    const normalized = this._normalize(topic);
    const stableProfile = (userProfile || '').replace(/Confusion Level = \d+\/10/g, 'Confusion Level = *');
    return `${REDIS_PREFIX}${normalized}:::${stableProfile}`;
  }

  constructor() {
    this.localFallback = new Map(); // Dev/Offline fallback
  }

  async get(topic, userProfile) {
    const key = this._getKey(topic, userProfile);

    if (redis.isConnected) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          console.log(`[Cache] ❄️ HIT (Redis) for: ${topic}`);
          return JSON.parse(cached);
        }
      } catch (e) {
        console.warn(`[Cache] Redis get error: ${e.message}`);
      }
    } else {
      const local = this.localFallback.get(key);
      if (local) {
        console.log(`[Cache] 🍃 HIT (Local) for: ${topic}`);
        return local;
      }
    }

    return null;
  }

  async set(topic, userProfile, data) {
    const key = this._getKey(topic, userProfile);

    if (redis.isConnected) {
      try {
        await redis.set(key, JSON.stringify(data), CACHE_TTL_SEC);
        console.log(`[Cache] 📦 STORED (Redis) for: ${topic}`);
      } catch (e) {
        console.warn(`[Cache] Redis set error: ${e.message}`);
      }
    } else {
      this.localFallback.set(key, data);
      // Prune local if too large
      if (this.localFallback.size > 100) {
        const firstKey = this.localFallback.keys().next().value;
        this.localFallback.delete(firstKey);
      }
    }
  }

  async has(topic, userProfile) {
    const key = this._getKey(topic, userProfile);

    if (redis.isConnected) {
      try {
        const cached = await redis.get(key);
        return cached !== null;
      } catch (e) {
        console.warn(`[Cache] Redis has error: ${e.message}`);
        return false;
      }
    }
    return this.localFallback.has(key);
  }

  async delete(topic, userProfile) {
    const key = this._getKey(topic, userProfile);

    if (redis.isConnected) {
      try {
        await redis.del(key);
        console.log(`[Cache] 🗑️ DELETED (Redis) for: ${topic}`);
      } catch (e) {
        console.warn(`[Cache] Redis delete error: ${e.message}`);
      }
    }
    this.localFallback.delete(key);
  }

  async clear() {
    this.localFallback.clear();
    
    if (!redis.isConnected) {
      console.log('[Cache] Local cache cleared. Redis unavailable.');
      return;
    }

    console.log('[Cache] 🧹 Clearing all Redis keys for prefix:', REDIS_PREFIX);
    
    try {
      let cursor = '0';
      do {
        // Use SCAN to avoid blocking the server
        const [nextCursor, keys] = await redis.client.scan(cursor, 'MATCH', `${REDIS_PREFIX}*`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.client.del(...keys);
        }
      } while (cursor !== '0');
      
      console.log('[Cache] ✅ Redis cache cleared successfully.');
    } catch (err) {
      console.error('[Cache] ❌ Failed to clear Redis cache:', err.message);
    }
  }
}

export const cache = new TopicCache();
