import mongoose from 'mongoose';

const RateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit = mongoose.model('RateLimit', RateLimitSchema);
export default RateLimit;
