import mongoose from 'mongoose';

/**
 * ActivityLog — UX-level event tracking
 * 
 * Captures user interactions, mode switches, and AI lifecycle events
 * for auditing, context reconstruction, and persistence verification.
 */
const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: String, // Can be local UUID or ChatSession _id
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    enum: [
      'session_start',
      'mode_switch',
      'canvas_action',
      'ai_step_start',
      'ai_step_complete',
      'ai_retry',
      'doubt_asked',
      'doubt_resolved',
      'navigation',
      'chat_message'
    ],
    required: true,
  },
  eventData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    clientTime: Date,
    userAgent: String,
    ip: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// TTL index: auto-delete logs after 30 days to prevent bloat
activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
