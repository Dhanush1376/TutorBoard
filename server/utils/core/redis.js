import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.SESSION_STORE_URL || null;

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;

    if (REDIS_URL) {
      this._connect();
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ [Redis] No REDIS_URL found in production. Services will fallback to volatile in-memory storage.');
    }
  }

  _connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 200, 2000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log('✅ [Redis] Connected to shared datastore.');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.isConnecting = false;
        console.error(`❌ [Redis] Connection error: ${err.message}`);
      });
    } catch (err) {
      this.isConnecting = false;
      console.error(`❌ [Redis] Failed to initialize client: ${err.message}`);
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      return null;
    }
  }

  async set(key, value, ttlSeconds = null) {
    if (!this.isConnected) return false;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  async hset(key, field, value) {
    if (!this.isConnected) return false;
    try {
      await this.client.hset(key, field, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  async hget(key, field) {
    if (!this.isConnected) return null;
    try {
      return await this.client.hget(key, field);
    } catch (err) {
      return null;
    }
  }

  async hgetall(key) {
    if (!this.isConnected) return null;
    try {
      return await this.client.hgetall(key);
    } catch (err) {
      return null;
    }
  }
}

export default new RedisClient();
