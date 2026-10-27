import mongoose from 'mongoose';

/**
 * One-time handoff from the OAuth callback (backend origin) to the frontend,
 * which exchanges it for a session within 60 s. Holds only the user id and the
 * sign-in method — no token — so a leaked code cannot be replayed after use.
 */
const OauthCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  method: { type: String, default: null },
  // hash of the HttpOnly handoff cookie set on the browser that finished OAuth
  bindingHash: { type: String, default: null },
  // legacy (pre-session) codes carried an access token
  token: { type: String, default: null },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

OauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OauthCode = mongoose.model('OauthCode', OauthCodeSchema);
export default OauthCode;
