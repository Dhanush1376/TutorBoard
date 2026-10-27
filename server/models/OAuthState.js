import mongoose from 'mongoose';

/**
 * Pending OAuth authorization: the `state` handle sent to the provider, the PKCE
 * verifier, the browser it was started in (hash of a cookie nonce) and what the
 * sign-in is for (log in, or link a provider to the signed-in account).
 */
const oauthStateSchema = new mongoose.Schema({
  handleHash: { type: String, required: true, unique: true },
  bindingHash: { type: String, required: true },
  verifier: { type: String, default: null },
  intent: {
    mode: { type: String, enum: ['login', 'link'], default: 'login' },
    userId: { type: String, default: null },
  },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OAuthState = mongoose.model('OAuthState', oauthStateSchema);
export default OAuthState;
