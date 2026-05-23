import mongoose from 'mongoose';

const TopicCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

TopicCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TopicCache = mongoose.model('TopicCache', TopicCacheSchema);
export default TopicCache;
