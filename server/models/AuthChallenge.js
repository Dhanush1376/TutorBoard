import mongoose from 'mongoose';

/**
 * A one-time code sent by email, bound to one account and one purpose.
 * At most one live challenge per (user, purpose): requesting a new code replaces
 * the old one. Only hashes are stored. A verified reset challenge issues a
 * single-use `grantHash` that the final password-reset call must present.
 */
const authChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: ['verify_email', 'reset_password'], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  verifiedAt: { type: Date, default: null },
  grantHash: { type: String, default: null },
  grantExpiresAt: { type: Date, default: null },
  // hourly send cap
  windowStart: { type: Date, default: null },
  sendCount: { type: Number, default: 0 },
}, { timestamps: true });

authChallengeSchema.index({ userId: 1, purpose: 1 }, { unique: true });
authChallengeSchema.index({ grantHash: 1 }, { sparse: true });
// keep a day past expiry so cooldown/attempt state survives retries, then drop
authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const AuthChallenge = mongoose.model('AuthChallenge', authChallengeSchema);
export default AuthChallenge;
