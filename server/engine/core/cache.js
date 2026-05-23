import TopicCacheModel from '../../models/TopicCache.js';

const CACHE_TTL_SEC = 24 * 60 * 60; // 24 hours
const CACHE_PREFIX = 'topic:';

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
    const scope = userId || 'anon';
    return `${CACHE_PREFIX}${scope}:${normalized}:::${stableProfile}`;
  }

  async get(topic, userProfile, userId) {
    const key = this._getKey(topic, userProfile, userId);

    try {
      const cachedDoc = await TopicCacheModel.findOne({ key });
      if (cachedDoc && cachedDoc.expiresAt.getTime() > Date.now()) {
        console.log(`[Cache] ❄️ HIT (MongoDB) for: ${topic} (User: ${userId || 'anon'})`);
        return cachedDoc.data;
      }
    } catch (e) {
      console.warn(`[Cache] MongoDB cache get error: ${e.message}`);
    }
    return null;
  }

  async set(topic, userProfile, data, userId) {
    const key = this._getKey(topic, userProfile, userId);
    const expiresAt = new Date(Date.now() + CACHE_TTL_SEC * 1000);

    try {
      await TopicCacheModel.findOneAndUpdate(
        { key },
        { data, expiresAt },
        { upsert: true, new: true }
      );
      console.log(`[Cache] 📦 STORED (MongoDB) for: ${topic} (User: ${userId || 'anon'})`);
    } catch (e) {
      console.warn(`[Cache] MongoDB cache set error: ${e.message}`);
    }
  }

  async has(topic, userProfile, userId) {
    const key = this._getKey(topic, userProfile, userId);

    try {
      const count = await TopicCacheModel.countDocuments({ key, expiresAt: { $gt: new Date() } });
      return count > 0;
    } catch (e) {
      console.warn(`[Cache] MongoDB cache has error: ${e.message}`);
      return false;
    }
  }

  async delete(topic, userProfile, userId) {
    const key = this._getKey(topic, userProfile, userId);

    try {
      await TopicCacheModel.deleteOne({ key });
      console.log(`[Cache] 🗑️ DELETED (MongoDB) for: ${topic} (User: ${userId || 'anon'})`);
    } catch (e) {
      console.warn(`[Cache] MongoDB cache delete error: ${e.message}`);
    }
  }

  async clear() {
    console.log('[Cache] 🧹 Clearing all TopicCache keys...');
    try {
      await TopicCacheModel.deleteMany({});
      console.log('[Cache] ✅ TopicCache cleared successfully.');
    } catch (err) {
      console.error('[Cache] ❌ Failed to clear TopicCache:', err.message);
    }
  }
}

export const cache = new TopicCache();
