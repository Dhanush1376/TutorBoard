import LearnerProfile from '../models/LearnerProfile.js';
import SessionMemory from '../models/SessionMemory.js';
import UsageLog from '../models/UsageLog.js';
import SpacedRepetitionScheduler from '../engine/core/SpacedRepetitionScheduler.js';

/**
 * Get aggregated data for the learner dashboard
 */
export const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    console.log(`[Dashboard] Fetching data for user: ${userId}`);

    // 1. Fetch Learner Profile
    let profile = await LearnerProfile.findOne({ userId });
    console.log(`[Dashboard] Profile found: ${!!profile}`);
    if (!profile) {
      console.log(`[Dashboard] No profile found for ${userId}. Creating default.`);
      profile = await LearnerProfile.create({ userId });
    }

    // 2. Aggregate Mastery Data
    const topicsMastery = profile.topicsMastery instanceof Map 
      ? Object.fromEntries(profile.topicsMastery) 
      : (profile.topicsMastery || {});
    console.log(`[Dashboard] Mastery topics count: ${Object.keys(topicsMastery).length}`);

    // 3. Fetch Session History for Confusion Trend
    const confusionHistory = (profile.doubtHistory || []).map(d => ({
      timestamp: d.timestamp,
      score: d.confusionScore || 0,
      topic: d.topic
    })).slice(-20); // Last 20 interactions

    // 4. Calculate Learning Velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const masteredInLastMonth = Object.values(topicsMastery).filter(m => {
      const lastTaught = m.lastTaught ? new Date(m.lastTaught) : null;
      return (m.mastery > 0.7) && (!lastTaught || lastTaught > thirtyDaysAgo);
    }).length;
    
    const velocity = Math.max(0.2, (masteredInLastMonth / 4)).toFixed(1);

    // 5. Aggregate Analytics
    const analytics = {
      totalDoubts: profile.engagementMetrics?.conceptualDoubtsAsked || 0,
      totalSteps: profile.engagementMetrics?.visualStepsCompleted || 0,
      avgConfusion: profile.doubtHistory?.length > 0
        ? (profile.doubtHistory.reduce((s, d) => s + (d.confusionScore || 0), 0) / profile.doubtHistory.length).toFixed(2)
        : 0
    };

    console.log(`[Dashboard] Fetching due concepts...`);
    const dueConcepts = await SpacedRepetitionScheduler.getDueConcepts(userId);
    console.log(`[Dashboard] Due concepts count: ${dueConcepts.length}`);

    res.json({
      userId,
      mastery: topicsMastery,
      confusionHistory,
      velocity,
      analytics,
      learningStyle: profile.engagementMetrics?.styleDetected || 'unknown',
      totalSessions: profile.totalSessions || 0,
      dueConcepts
    });
  } catch (err) {
    console.error('[LearnerController] Failed to fetch dashboard data:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
