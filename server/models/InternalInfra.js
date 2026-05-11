import mongoose from 'mongoose';

// Real Redis is strictly enforced. No mock schemas are permitted.
 * StorageMockSchema - Persistent blob storage for S3 fallback
 */
const StorageMockSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  body: { type: Buffer, required: true },
  contentType: { type: String, default: 'application/json' },
  size: { type: Number },
}, { timestamps: true });

// Removed TTL index to ensure uploads remain permanently accessible in MongoDB fallback

export const StorageMock = mongoose.model('StorageMock', StorageMockSchema);
