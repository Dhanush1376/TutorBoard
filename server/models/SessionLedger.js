import mongoose from 'mongoose';

/**
 * SessionLedger — Per-request status tracking
 * 
 * Separated from ChatSession to reduce write amplification on the main document
 * and provide more granular TTL for request metadata.
 */
const sessionLedgerSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true,
  },
  requestId: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['requesting', 'streaming', 'completed', 'failed', 'aborted'],
    default: 'requesting',
  },
  userMessageId: {
    type: String,
    default: null,
  },
  assistantMessageId: {
    type: String,
    default: null,
  },
  response: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Compound index for fast atomic lookups
sessionLedgerSchema.index({ sessionId: 1, requestId: 1 }, { unique: true });

// TTL Index: Auto-evict ledger entries after 24 hours to prevent log bloat
sessionLedgerSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 3600 });

const SessionLedger = mongoose.model('SessionLedger', sessionLedgerSchema);

export default SessionLedger;
