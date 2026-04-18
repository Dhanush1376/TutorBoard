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
    index: { expires: 0 } // TTL Index: MongoDB automatically deletes when current date >= expiresAt
  }
}, {
  timestamps: true
});

const RevokedToken = mongoose.model('RevokedToken', RevokedTokenSchema);

export default RevokedToken;
