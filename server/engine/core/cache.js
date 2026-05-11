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

  _getKey(topic, userProfile, userId) {
    const normalized = this._normalize(topic);
    const stableProfile = (userProfile || '').replace(/Confusion Level = \d+\/10/g, 'Confusion Level = *');
    // SEC-03: Scope cache per user to ensure data isolation
    const scope = userId || 'anon';
    return `${REDIS_PREFIX}${scope}:${normalized}:::${stableProfile}`;
  }

  async get(topic, userProfile, userId) {
    if (!redis.isConnected) return null;
    const key = this._getKey(topic, userProfile, userId);

    try {
      const cached = await redis.get(key);
      if (cached) {
        console.log(`[Cache] ❄️ HIT (Redis) for: ${topic} (User: ${userId || 'anon'})`);
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn(`[Cache] Redis get error: ${e.message}`);
    }
    return null;
  }

  async set(topic, userProfile, data, userId) {
    if (!redis.isConnected) return;
    const key = this._getKey(topic, userProfile, userId);

    try {
      await redis.set(key, JSON.stringify(data), CACHE_TTL_SEC);
      console.log(`[Cache] 📦 STORED (Redis) for: ${topic} (User: ${userId || 'anon'})`);
    } catch (e) {
      console.warn(`[Cache] Redis set error: ${e.message}`);
    }
  }

  async has(topic, userProfile, userId) {
    if (!redis.isConnected) return false;
    const key = this._getKey(topic, userProfile, userId);

    try {
      const cached = await redis.get(key);
      return cached !== null;
    } catch (e) {
      console.warn(`[Cache] Redis has error: ${e.message}`);
      return false;
    }
  }

  async delete(topic, userProfile, userId) {
    if (!redis.isConnected) return;
    const key = this._getKey(topic, userProfile, userId);

    try {
      await redis.del(key);
      console.log(`[Cache] 🗑️ DELETED (Redis) for: ${topic} (User: ${userId || 'anon'})`);
    } catch (e) {
      console.warn(`[Cache] Redis delete error: ${e.message}`);
    }
  }

  async clear() {
    if (!redis.isConnected) {
      console.log('[Cache] Redis unavailable. Cannot clear cache.');
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
