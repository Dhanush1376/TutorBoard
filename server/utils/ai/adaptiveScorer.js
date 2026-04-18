/**
 * Adaptive Scorer — Learning-based routing optimization
 * 
 * Uses historical UsageLog data to score models by:
 *   - Success rate (40% weight)
 *   - Speed / latency (30% weight)
 *   - Cost efficiency (30% weight)
 * 
 * Scores are cached in-memory with a 5-minute TTL to avoid DB queries per request.
 * The adaptive scores feed into selectOptimalModel to prefer historically better models.
 */

import UsageLog from '../../models/UsageLog.js';

// In-memory cache
let cachedScores = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch adaptive scores for all models from the last 7 days
 * @param {string} [userId] — Optional: scope to a specific user
 * @returns {Promise<Record<string, { score: number, successRate: number, avgLatency: number, avgCost: number, requestCount: number }>>}
 */
export async function getAdaptiveScores(userId = null) {
  // Return cached if fresh
  const cacheKey = userId || '__global__';
  if (cachedScores?.[cacheKey] && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedScores[cacheKey];
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const match = { timestamp: { $gte: sevenDaysAgo } };
    if (userId) match.userId = userId;

    const modelStats = await UsageLog.aggregate([
      { $match: match },
      { $group: {
        _id: '$model',
        totalRequests: { $sum: 1 },
        successCount: { $sum: { $cond: ['$success', 1, 0] } },
        avgLatency: { $avg: '$responseTimeMs' },
        avgCost: { $avg: '$costEstimate' },
        totalTokens: { $sum: '$tokensUsed' },
      }},
      { $match: { totalRequests: { $gte: 3 } } }, // Minimum 3 requests for valid score
    ]);

    if (modelStats.length === 0) {
      return {};
    }

    // Compute min/max for normalization
    const latencies = modelStats.map(m => m.avgLatency).filter(v => v > 0);
    const costs = modelStats.map(m => m.avgCost).filter(v => v >= 0);
    
    const maxLatency = Math.max(...latencies, 1);
    const minLatency = Math.min(...latencies, 0);
    const maxCost = Math.max(...costs, 1);
    const minCost = Math.min(...costs, 0);

    const scores = {};
    for (const stat of modelStats) {
      const successRate = stat.totalRequests > 0 ? stat.successCount / stat.totalRequests : 0;
      
      // Speed score: lower latency = higher score (inverted, normalized 0-1)
      const latencyRange = maxLatency - minLatency || 1;
      const speedScore = 1 - ((stat.avgLatency - minLatency) / latencyRange);

      // Cost score: lower cost = higher score (inverted, normalized 0-1)
      const costRange = maxCost - minCost || 1;
      const costScore = 1 - ((stat.avgCost - minCost) / costRange);

      // Weighted composite: successRate (40%) + speed (30%) + cost (30%)
      const compositeScore = Math.round(
        (successRate * 40 + speedScore * 30 + costScore * 30)
      );

      scores[stat._id] = {
        score: Math.max(0, Math.min(100, compositeScore)),
        successRate: Math.round(successRate * 100) / 100,
        avgLatency: Math.round(stat.avgLatency),
        avgCost: Math.round(stat.avgCost * 100) / 100,
        requestCount: stat.totalRequests,
      };
    }

    // Cache results
    if (!cachedScores) cachedScores = {};
    cachedScores[cacheKey] = scores;
    cacheTimestamp = Date.now();

    return scores;
  } catch (err) {
    console.warn('[AdaptiveScorer] Failed to compute scores:', err.message);
    return {};
  }
}

/**
 * Invalidate the adaptive scores cache (call after significant events)
 */
export function invalidateCache() {
  cachedScores = null;
  cacheTimestamp = 0;
}
