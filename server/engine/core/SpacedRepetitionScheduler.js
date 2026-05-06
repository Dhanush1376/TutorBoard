import LearnerProfile from '../../models/LearnerProfile.js';

export default class SpacedRepetitionScheduler {
  /**
   * SM-2 Algorithm for updating spaced repetition parameters
   * @param {Object} node - Concept node from topicsMastery map
   * @param {number} quality - Quality score (0 to 5)
   * @returns {Object} Updated parameters
   */
  static sm2Update(node, quality) { // quality: 0-5 (0=blackout, 5=perfect)
    if (quality < 3) {
      node.repetitions = 0;
      node.interval = 1;
    } else {
      const n = node.repetitions;
      node.interval = n === 0 ? 1 : n === 1 ? 6 : Math.round(node.interval * node.easeFactor);
      node.repetitions += 1;
    }
    node.easeFactor = Math.max(1.3,
      node.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
    node.reinforcementDue = new Date(Date.now() + node.interval * 86400000);
    node.lastTaught = new Date();
    return node;
  }

  /**
   * Finds concepts due for reinforcement for a given user
   * @param {string} userId 
   * @returns {Promise<Array>} List of concepts due (names only)
   */
  static async getDueConcepts(userId) {
    const profile = await LearnerProfile.findOne({ userId });
    if (!profile || !profile.topicsMastery) return [];

    const now = new Date();
    const due = [];

    // DEFENSIVE: Ensure we handle both Mongoose Map and plain object (pre-migration)
    const masteryMap = profile.topicsMastery instanceof Map 
      ? profile.topicsMastery 
      : new Map(Object.entries(profile.topicsMastery || {}));

    for (const [topic, node] of masteryMap.entries()) {
      if (!node) continue;
      // Handle potential legacy numeric values during read
      const data = typeof node === 'number' ? this.migrate(node) : node;
      
      if (data.mastery < 0.7 && data.reinforcementDue && data.reinforcementDue <= now) {
        due.push(topic);
      }
    }
    return due;
  }

  /**
   * Migrates legacy numeric mastery values to SM-2 objects
   * @param {number} masteryValue 
   * @returns {Object} Initialized SM-2 object
   */
  static migrate(masteryValue) {
    return {
      mastery: masteryValue,
      easeFactor: 2.5,
      interval: 1,
      repetitions: 0,
      lastTaught: new Date(),
      reinforcementDue: new Date(),
      prerequisites: []
    };
  }

  /**
   * Updates the LearnerProfile after a session
   * @param {string} userId 
   * @param {Array} masteryDeltas - Array of { concept, quality (0-5) or mastery (0-1) }
   */
  static async updateMastery(userId, masteryDeltas) {
    const profile = await LearnerProfile.findOne({ userId });
    if (!profile) return;

    for (const delta of masteryDeltas) {
      let node = profile.topicsMastery.get(delta.concept);
      
      // Determine quality (0-5)
      let quality = delta.quality;
      if (quality === undefined) {
        quality = Math.round((delta.mastery || 0.5) * 5);
      }
      
      // Migration/Initialization
      if (!node || typeof node === 'number') {
        const initial = typeof node === 'number' ? this.migrate(node) : {
          mastery: delta.mastery || 0.5,
          easeFactor: 2.5,
          interval: 1,
          repetitions: 0,
          prerequisites: this.inferDependencies(delta.concept)
        };
        this.sm2Update(initial, quality);
        node = initial;
      } else {
        this.sm2Update(node, quality);
      }
      
      profile.topicsMastery.set(delta.concept, node);
    }

    await profile.save();
  }

  /**
   * Simple rule-based dependency inference
   */
  static inferDependencies(concept) {
    const deps = {
      'linked lists': ['arrays', 'pointers'],
      'binary search': ['arrays', 'recursion'],
      'trees': ['linked lists', 'recursion'],
      'graphs': ['trees', 'sets'],
      'sorting': ['arrays', 'loops'],
      'dynamic programming': ['recursion', 'memoization'],
      'quick sort': ['recursion', 'arrays'],
      'merge sort': ['recursion', 'arrays'],
    };

    const key = concept.toLowerCase();
    for (const [target, prereqs] of Object.entries(deps)) {
      if (key.includes(target) || target.includes(key)) return prereqs;
    }
    return [];
  }
}
