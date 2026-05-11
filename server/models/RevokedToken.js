import mongoose from 'mongoose';

const RevokedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    // SEC-21: Auto-delete revoked tokens after they reach their expiry date.
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true
});

// SEC-21: Schema-level TTL index is managed via the 'expires' option above.

const RevokedToken = mongoose.model('RevokedToken', RevokedTokenSchema);

export default RevokedToken;
