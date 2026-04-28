/**
 * pedagogyHelper.js — Utilities for intelligent lesson adaptation
 */

/**
 * Calculates a mastery score for a topic based on a user's mastery map.
 * Supports partial string matching (e.g., "React Hooks" matches "React").
 * 
 * @param {Map|Object} topicsMastery - Map of topic -> score (0.0 to 1.0)
 * @param {string} topic - Current lesson topic
 * @returns {number} Score from 0.0 to 1.0
 */
export function calculateMastery(topicsMastery, topic) {
  if (!topicsMastery || !topic) return 0.5;

  const t = topic.toLowerCase();

  // Handle both Map (Mongoose) and plain Object (session)
  const entries = topicsMastery instanceof Map
    ? Array.from(topicsMastery.entries())
    : Object.entries(topicsMastery);

  for (const [key, val] of entries) {
    if (t.includes(key.toLowerCase()) || key.toLowerCase().includes(t)) {
      return val;
    }
  }

  return 0.5; // Default middle ground
}

/**
 * Derives a pedagogical level label from a numeric mastery score.
 * 
 * @param {number} score - Mastery score (0.0 to 1.0)
 * @returns {string} beginner, intermediate, or advanced
 */
export function deriveLevel(score) {
  if (score < 0.4) return 'beginner';
  if (score < 0.8) return 'intermediate';
  return 'advanced';
}

/**
 * Returns the next pedagogical level
 * @param {string} level - current level
 * @returns {string} next level
 */
export function deriveNextLevel(level) {
  const flow = { 'beginner': 'intermediate', 'intermediate': 'advanced', 'advanced': 'advanced' };
  return flow[level] || 'intermediate';
}
