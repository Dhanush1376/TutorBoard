import mongoose from 'mongoose';

/**
 * Versioned runtime settings. Every change inserts a new version (append-only);
 * the highest version is live. Rollback = insert a copy of an older version.
 * The unique `version` index makes two concurrent admin saves conflict instead
 * of silently overwriting each other.
 */
const platformConfigSchema = new mongoose.Schema({
  version: { type: Number, required: true, unique: true },
  settings: { type: mongoose.Schema.Types.Mixed, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note: { type: String, default: '' },
  rolledBackFrom: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

const PlatformConfig = mongoose.model('PlatformConfig', platformConfigSchema);
export default PlatformConfig;
