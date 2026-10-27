import mongoose from 'mongoose';

/**
 * A signed-in user's request to become an administrator. Only a super-admin
 * decides it. Status moves only forward: pending → approved | rejected |
 * cancelled, and approved → revoked when the super-admin takes access back.
 * At most one pending request per user (partial unique index).
 */
const adminAccessRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // snapshot at request time; approval re-checks the account still has this verified email
  email: { type: String, required: true },
  name: { type: String, default: '' },
  reason: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'revoked'], default: 'pending', index: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  decisionNote: { type: String, default: '', maxlength: 300 },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

adminAccessRequestSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_per_user' });
adminAccessRequestSchema.index({ status: 1, createdAt: -1 });

const AdminAccessRequest = mongoose.model('AdminAccessRequest', adminAccessRequestSchema);
export default AdminAccessRequest;
