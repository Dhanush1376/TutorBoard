/**
 * budget.service.ts — TutorBoard v7.0
 * 
 * Manages token budgets and cost optimization for AI interactions.
 * Prevents runaway agent execution and routes tasks to cost-effective models.
 * Features: Graceful degradation with in-memory fallback during Redis outages.
 */

import { container } from '../../core/container.js';

const SESSION_BUDGET_KEY = (sid: string) => `budget:session:${sid}`;
const DEFAULT_LIMITS = {
  free: parseInt(process.env.AI_BUDGET_FREE || '50000'),
  pro: parseInt(process.env.AI_BUDGET_PRO || '250000'),
  enterprise: parseInt(process.env.AI_BUDGET_ENTERPRISE || '1000000')
};

// In-memory fallback for when Redis is down
const memoryBudget = new Map<string, number>();

export interface BudgetStatus {
  used: number;
  remaining: number;
  limit: number;
  tier: 'free' | 'pro' | 'enterprise';
}

class BudgetService {
  /**
   * Track token usage for a session
   */
  async recordUsage(sessionId: string, tokens: number, tier: 'free' | 'pro' | 'enterprise' = 'free'): Promise<BudgetStatus> {
    const key = SESSION_BUDGET_KEY(sessionId);
    const limit = DEFAULT_LIMITS[tier];
    let used = 0;

    try {
      if (container.has('redis-main')) {
        const client = container.resolve<any>('redis-main');
        const usedStr = await client.get(key);
        used = parseInt(usedStr || '0') + tokens;
        await client.set(key, used.toString(), 'EX', 86400); // 24h TTL
      } else {
        used = (memoryBudget.get(sessionId) || 0) + tokens;
      }
      
      // Sync memory fallback
      memoryBudget.set(sessionId, used);
    } catch (err) {
      console.warn(`[BudgetService] Redis error, falling back to memory: ${(err as Error).message}`);
      used = (memoryBudget.get(sessionId) || 0) + tokens;
      memoryBudget.set(sessionId, used);
    }
    
    return { used, remaining: Math.max(0, limit - used), limit, tier };
  }

  /**
   * Check if a session has enough budget for a new request
   */
  async checkBudget(sessionId: string, tier: 'free' | 'pro' | 'enterprise' = 'free', requiredTokens: number = 4000): Promise<boolean> {
    const key = SESSION_BUDGET_KEY(sessionId);
    const limit = DEFAULT_LIMITS[tier];
    let used = 0;

    try {
      if (container.has('redis-main')) {
        const client = container.resolve<any>('redis-main');
        const usedStr = await client.get(key);
        used = parseInt(usedStr || '0');
      } else {
        used = memoryBudget.get(sessionId) || 0;
      }
    } catch (err) {
      console.warn(`[BudgetService] Redis error during check: ${(err as Error).message}`);
      used = memoryBudget.get(sessionId) || 0;
    }
    
    return (used + requiredTokens) <= limit;
  }

  /**
   * Route to the most cost-effective model for the given task.
   * Automatically downgrades model if budget is near limit (> 80%).
   */
  async resolveOptimizedModel(
    taskType: 'planning' | 'narration' | 'visualization' | 'critique' | 'final_answer',
    sessionId?: string,
    tier: 'free' | 'pro' | 'enterprise' = 'free'
  ): Promise<string> {
    let budgetHit = false;
    
    if (sessionId) {
      try {
        const key = SESSION_BUDGET_KEY(sessionId);
        let used = 0;
        if (container.has('redis-main')) {
          const client = container.resolve<any>('redis-main');
          const usedStr = await client.get(key);
          used = parseInt(usedStr || '0');
        } else {
          used = memoryBudget.get(sessionId) || 0;
        }
        const limit = DEFAULT_LIMITS[tier];
        
        if (used > (limit * 0.8)) {
          budgetHit = true;
          console.log(`[Budget] ⚠️ Budget near limit (${Math.round((used/limit)*100)}%). Downgrading models.`);
        }
      } catch (err) {
        // Ignore error and assume budget is fine, or use memory fallback
        const used = memoryBudget.get(sessionId) || 0;
        if (used > (DEFAULT_LIMITS[tier] * 0.8)) budgetHit = true;
      }
    }

    switch (taskType) {
      case 'planning':
      case 'critique':
      case 'visualization':
        return 'google/gemini-2.0-flash';
      case 'narration':
      case 'final_answer':
        if (budgetHit || tier === 'free') {
          return 'google/gemini-2.0-flash';
        }
        return 'anthropic/claude-3-5-sonnet-20241022';
      default:
        return 'google/gemini-2.0-flash';
    }
  }
}

export default new BudgetService();

