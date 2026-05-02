import mongoose from 'mongoose';

const RevokedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
    index: { expires: '7d' }
  },
  expiresAt: {
    type: Date,
    required: true,
    // SEC-21: Auto-delete revoked tokens after 7 days to keep blocklist lean.
    index: { expires: '7d' }
  }
}, {
  timestamps: true
});

// SEC-21: Schema-level TTL index is managed via the 'expires' option above.

const RevokedToken = mongoose.model('RevokedToken', RevokedTokenSchema);

export default RevokedToken;
