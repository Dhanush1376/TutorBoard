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

  async get(topic, userProfile) {
    if (!redis.isConnected) {
      console.warn('[Cache] Redis is unavailable, bypassing get.');
      return null;
    }

    const key = this._getKey(topic, userProfile);

    try {
      const cached = await redis.get(key);
      if (cached) {
        console.log(`[Cache] ❄️ HIT (Redis) for: ${topic}`);
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn(`[Cache] Redis get error: ${e.message}`);
    }

    return null;
  }

  async set(topic, userProfile, data) {
    if (!redis.isConnected) {
      console.warn('[Cache] Redis is unavailable, bypassing set.');
      return;
    }

    const key = this._getKey(topic, userProfile);

    try {
      await redis.set(key, JSON.stringify(data), CACHE_TTL_SEC);
      console.log(`[Cache] 📦 STORED entry for: ${topic}`);
    } catch (e) {
      console.warn(`[Cache] Redis set error: ${e.message}`);
    }
  }

  async has(topic, userProfile) {
    if (!redis.isConnected) {
      console.warn('[Cache] Redis is unavailable, bypassing has.');
      return false;
    }

    const key = this._getKey(topic, userProfile);

    try {
      const cached = await redis.get(key);
      return cached !== null;
    } catch (e) {
      console.warn(`[Cache] Redis has error: ${e.message}`);
      return false;
    }
  }

  async delete(topic, userProfile) {
    if (!redis.isConnected) {
      console.warn('[Cache] Redis is unavailable, bypassing delete.');
      return;
    }

    const key = this._getKey(topic, userProfile);

    try {
      await redis.del(key);
      console.log(`[Cache] 🗑️ DELETED entry for: ${topic}`);
    } catch (e) {
      console.warn(`[Cache] Redis delete error: ${e.message}`);
    }
  }

  async clear() {
    console.warn('[Cache] clear() called, but pattern deletion is not implemented for Redis to prevent blocking.');
  }
}

export const cache = new TopicCache();
