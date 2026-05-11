import mongoose from 'mongoose';

/**
 * EngineSessionState — Cold storage for active teaching sessions
 * 
 * Used as a secondary fallback for Redis/In-memory sessions to prevent 
 * data loss during server restarts or pod scaling events.
 */
const engineSessionStateSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  // TTL: Auto-delete state after 48 hours of inactivity
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 48 * 3600 * 1000),
    index: { expireAfterSeconds: 0 },
  }
}, { timestamps: true });

const EngineSessionState = mongoose.model('EngineSessionState', engineSessionStateSchema);

export default EngineSessionState;
