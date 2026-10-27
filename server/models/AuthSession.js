import mongoose from 'mongoose';

/**
 * One row per sign-in (device/browser). Access and refresh tokens carry its id
 * (`sid`), so ending the row ends every token minted for it: logout, "log out
 * everywhere", password reset and admin revocation all work by setting
 * `revokedAt`. The refresh token rotates on every use; only the newest jti is
 * accepted, and replaying an older one revokes the session (token theft).
 */
const authSessionSchema = new mongoose.Schema({
  _id: { type: String }, // opaque random id (sid)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  method: { type: String, enum: ['password', 'google', 'github', 'reset', 'legacy'], required: true },
  refreshJti: { type: String, required: true },
  // the jti just replaced, honoured for a few seconds so two tabs refreshing at
  // once do not look like a stolen token
  prevRefreshJti: { type: String, default: null },
  rotatedAt: { type: Date, default: null },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokedReason: { type: String, default: '' },
}, { timestamps: true, _id: false });

// rows disappear a week after they stop being usable
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
authSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: -1 });

const AuthSession = mongoose.model('AuthSession', authSessionSchema);
export default AuthSession;
