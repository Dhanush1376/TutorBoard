import mongoose from 'mongoose';

const RevokedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
  }
}, {
  timestamps: true
});

// TTL Index: MongoDB automatically deletes document when current date >= expiresAt
RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RevokedToken = mongoose.model('RevokedToken', RevokedTokenSchema);

export default RevokedToken;
