/**
 * user.repository.ts — User Repository
 * 
 * Encapsulates all User database operations.
 */

import { BaseRepository } from './base.repository.js';
import User from '../models/User.js';
import { container } from '../core/container.js';

class UserRepository extends BaseRepository<any> {
  constructor() {
    super(User);
  }

  async findByEmail(email: string) {
    return this.findOne({ email: email.toLowerCase() });
  }

  async findByGoogleId(googleId: string) {
    return this.findOne({ googleId });
  }

  async findByGithubId(githubId: string) {
    return this.findOne({ githubId });
  }

  /**
   * Update user preferences (partial update)
   */
  async updatePreferences(userId: string, prefs: Record<string, unknown>) {
    const result = await this.updateById(userId, {
      $set: Object.fromEntries(
        Object.entries(prefs).map(([k, v]) => [`preferences.${k}`, v])
      ),
    });
    
    // SEC-CACHE: Invalidate user cache to ensure profile updates are live
    await this.clearUserCache(userId);
    return result;
  }

  /**
   * Track user activity timestamp
   */
  async touchLastActive(userId: string) {
    return this.updateById(userId, { lastActiveAt: new Date() });
  }

  /**
   * Helper to invalidate the user cache in Redis
   */
  async clearUserCache(userId: string) {
    if (!container.has('redis-main')) return;
    try {
      const client = container.resolve<any>('redis-main');
      await client.del(`user:${userId}`);
      console.log(`[Cache] Invalidated user profile: ${userId}`);
    } catch (err) {
      console.warn(`[Cache] Failed to invalidate user ${userId}:`, (err as Error).message);
    }
  }
}

export default new UserRepository();
