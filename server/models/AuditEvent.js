import mongoose from 'mongoose';

/**
 * Security-relevant account and admin events. Never holds secrets, codes,
 * tokens or message content — only who, what, which target and safe metadata.
 */
const auditEventSchema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  target: { type: String, default: '' },
  outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
  ip: { type: String, default: '' },
  requestId: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

// one year of history
auditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60, name: 'audit_ttl' });

const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
export default AuditEvent;
